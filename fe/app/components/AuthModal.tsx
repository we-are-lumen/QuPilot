"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button, Input, toast, TextField, Label, cn } from "@heroui/react";
import { FaWallet, FaRocket, FaUser, FaUserTie } from "react-icons/fa6";
import { FiCheckCircle, FiLoader, FiArrowLeft } from "react-icons/fi";
import { useWalletLogin } from "@/lib/hooks/useWalletLogin";
import {
  isSolanaWalletInstalled,
  isPhantomInstalled,
  isSolflareInstalled,
  isBackpackInstalled,
  isOkxInstalled,
  isMetaMaskInstalled,
  isMetaMaskSandboxActive,
  connectWallet,
  buildSignInMessage,
  signMessage,
  disconnectWallet,
  type WalletType,
} from "@/lib/utils/wallet";
import { setAuthToken, setUserData, clearAuth } from "@/lib/utils/auth";
import type { IWalletLoginResponse } from "@/lib/types/auth";
import {
  PhantomIcon,
  SolflareIcon,
  BackpackIcon,
  OkxIcon,
  MetaMaskIcon,
} from "./icons/WalletIcons";

interface AuthModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess?: () => void;
}

type AuthStep = "role_selection" | "wallet_selection" | "wallet_action" | "provider_form";

export default function AuthModal({ isOpen, onOpenChange, onSuccess }: AuthModalProps) {
  const router = useRouter();
  const { mutate: loginWithWallet } = useWalletLogin();

  // Step state
  const [authStep, setAuthStep] = useState<AuthStep>("role_selection");
  const [role, setRole] = useState<"user" | "user_provider">("user");

  // Wallet / sign state
  const [loadingText, setLoadingText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string>("");
  const [pendingSignature, setPendingSignature] = useState<string>("");
  const [phantomDetected, setPhantomDetected] = useState(false);
  const [solflareDetected, setSolflareDetected] = useState(false);
  const [backpackDetected, setBackpackDetected] = useState(false);
  const [okxDetected, setOkxDetected] = useState(false);
  const [metamaskDetected, setMetamaskDetected] = useState(false);

  // Provider Form State
  const [displayName, setDisplayName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAuthStep("role_selection");
      setRole("user");
      setWalletAddress(null);
      setPendingMessage("");
      setPendingSignature("");
      setDisplayName("");
      setLogoUrl("");
      setFieldErrors({});
      setIsSubmitting(false);
      setLoadingText("");
      setPhantomDetected(isPhantomInstalled());
      setSolflareDetected(isSolflareInstalled());
      setBackpackDetected(isBackpackInstalled());
      setOkxDetected(isOkxInstalled());
      setMetamaskDetected(isMetaMaskInstalled());
    }
  }, [isOpen]);

  const handleWalletLogin = useCallback(async (walletType: WalletType) => {
    let installed = false;
    switch (walletType) {
      case 'phantom': installed = isPhantomInstalled(); break;
      case 'solflare': installed = isSolflareInstalled(); break;
      case 'backpack': installed = isBackpackInstalled(); break;
      case 'okx': installed = isOkxInstalled(); break;
      case 'metamask': installed = isMetaMaskInstalled(); break;
    }
    if (!installed) {
      const names: Record<WalletType, string> = {
        phantom: 'Phantom',
        solflare: 'Solflare',
        backpack: 'Backpack',
        okx: 'OKX Wallet',
        metamask: 'MetaMask'
      };
      toast.danger(`${names[walletType]} is not installed. Please install it first.`);
      return;
    }

    try {
      setAuthStep("wallet_action");
      setLoadingText("Connecting to wallet...");
      const address = await connectWallet(walletType);
      setWalletAddress(address);

      if (walletType === "metamask" && isMetaMaskSandboxActive()) {
        toast.warning(
          "MetaMask Solana Snap unavailable (snap disabled or invalid origin). Activating Sandbox Mode with a persistent local devnet wallet."
        );
      }

      setLoadingText("Please sign the message in your wallet...");
      const message = buildSignInMessage(address);
      const signature = await signMessage(message, walletType);
      setPendingMessage(message);
      setPendingSignature(signature);

      setLoadingText("Verifying credentials...");
      setIsSubmitting(true);

      // Perform initial check / login
      // For user_provider, we omit the role in the first request so the backend doesn't try to auto-register
      // without a display_name. If they don't exist, it will return { registered: false }.
      loginWithWallet(
        { wallet_address: address, signature, message, role: role === "user" ? "user" : undefined },
        {
          onSuccess: (data: IWalletLoginResponse) => {
            setIsSubmitting(false);
            if (!data.registered) {
              if (role === "user_provider") {
                // Unregistered provider -> show registration form
                setAuthStep("provider_form");
                toast.success("Wallet verified! Please complete your provider profile.");
              } else {
                toast.danger("User account not registered.");
                setAuthStep("role_selection");
              }
            } else {
              // Registered provider or standard user (which is auto-registered/logged in)
              if (role === "user_provider" && data.user.role !== "user_provider") {
                toast.danger("Wallet already registered with a different role.");
                setAuthStep("role_selection");
                return;
              }

              setAuthToken(data.token);
              setUserData(data.user);
              toast.success(`Successfully connected as ${role === "user" ? "Explorer" : "Provider"}!`);
              
              onOpenChange(false);
              if (onSuccess) onSuccess();

              if (data.user.role === "user_provider") {
                router.push("/dashboard");
              } else {
                router.push("/explore");
              }
            }
          },
          onError: (err: any) => {
            setIsSubmitting(false);
            setAuthStep("role_selection");
            const errMsg = err?.response?.data?.error?.message ?? "Authentication failed. Please try again.";
            toast.danger(errMsg);
          },
        }
      );
    } catch (err: any) {
      setIsSubmitting(false);
      setAuthStep("role_selection");
      if (err?.message?.includes("rejected")) {
        toast.warning("Signature request was declined.");
      } else {
        toast.danger(err?.message ?? "An unexpected error occurred.");
      }
    }
  }, [role, loginWithWallet, onOpenChange, onSuccess, router]);

  const handleProviderRegisterSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const errors: Record<string, string> = {};
    if (!displayName.trim()) {
      errors.displayName = "Display name is required.";
    } else if (displayName.trim().length < 2) {
      errors.displayName = "Display name must be at least 2 characters.";
    }
    if (logoUrl.trim() && !/^https?:\/\/.+/.test(logoUrl.trim())) {
      errors.logoUrl = "Please enter a valid URL (starting with http/https).";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    if (!walletAddress || !pendingMessage || !pendingSignature) {
      toast.danger("Wallet session lost. Please try again.");
      setAuthStep("role_selection");
      return;
    }

    setIsSubmitting(true);
    setLoadingText("Registering your provider profile...");

    loginWithWallet(
      {
        wallet_address: walletAddress,
        signature: pendingSignature,
        message: pendingMessage,
        role: "user_provider",
        display_name: displayName.trim(),
        logo_url: logoUrl.trim() || undefined,
      },
      {
        onSuccess: (data: IWalletLoginResponse) => {
          setIsSubmitting(false);
          if (data.registered) {
            setAuthToken(data.token);
            setUserData(data.user);
            toast.success("Provider registered successfully!");
            onOpenChange(false);
            if (onSuccess) onSuccess();
            router.push("/dashboard");
          } else {
            toast.danger("Registration failed. Please try again.");
          }
        },
        onError: (err: any) => {
          setIsSubmitting(false);
          const errMsg = err?.response?.data?.error?.message ?? "Registration failed. Please try again.";
          toast.danger(errMsg);
        },
      }
    );
  }, [walletAddress, pendingSignature, pendingMessage, displayName, logoUrl, loginWithWallet, onOpenChange, onSuccess, router]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog
            className="border bg-white/95 border-[#dfbfb9]/40 text-[#1f1b18] backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden transition-all duration-300"
            style={{ width: "calc(100vw - 32px)", maxWidth: "448px" }}
          >
            <Modal.CloseTrigger />

            {authStep === "role_selection" && (
              <>
                <Modal.Header className="flex flex-col items-center text-center pb-2">
                  <div className="w-12 h-12 rounded-full bg-[#FFE9E5] text-[#A63420] flex items-center justify-center mb-2 animate-bounce">
                    <FaRocket size={20} />
                  </div>
                  <Modal.Heading className="text-xl font-bold tracking-tight text-[#1f1b18]">
                    Join QuPilot
                  </Modal.Heading>
                  <p className="text-xs text-[#6b6560] mt-1 px-4">
                    Select your path in the decentralized space quest ecosystem
                  </p>
                </Modal.Header>

                <Modal.Body className="py-4 px-6 flex flex-col gap-4">
                  {/* Role Cards */}
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setRole("user")}
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer",
                        role === "user"
                          ? "bg-[#FFE9E5]/30 border-[#A63420] shadow-sm"
                          : "bg-white/50 border-[#dfbfb9]/40 hover:bg-[#f8f4ef]/50"
                      )}
                    >
                      <div className={`p-2.5 rounded-lg border ${role === "user" ? "bg-[#A63420] text-white border-[#A63420]" : "bg-[#f8f4ef] text-[#6b6560] border-[#dfbfb9]/30"}`}>
                        <FaUser size={16} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-[#1f1b18]">Explore as User</h4>
                        <p className="text-xs text-[#6b6560] mt-0.5 leading-relaxed">
                          Discover quests, accomplish milestones, and earn decentralized rewards.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("user_provider")}
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer",
                        role === "user_provider"
                          ? "bg-[#FFE9E5]/30 border-[#A63420] shadow-sm"
                          : "bg-white/50 border-[#dfbfb9]/40 hover:bg-[#f8f4ef]/50"
                      )}
                    >
                      <div className={`p-2.5 rounded-lg border ${role === "user_provider" ? "bg-[#A63420] text-white border-[#A63420]" : "bg-[#f8f4ef] text-[#6b6560] border-[#dfbfb9]/30"}`}>
                        <FaUserTie size={16} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-[#1f1b18]">Join as Provider</h4>
                        <p className="text-xs text-[#6b6560] mt-0.5 leading-relaxed">
                          Publish campaigns, engage spaceships, and verify quest proof-of-work.
                        </p>
                      </div>
                    </button>
                  </div>
                </Modal.Body>

                <Modal.Footer className="pt-2 pb-6 px-6">
                  <Button
                    onPress={() => setAuthStep("wallet_selection")}
                    className="w-full bg-[#A63420] text-white font-bold text-xs tracking-widest py-3.5 rounded-full flex items-center justify-center gap-2 hover:bg-[#8f2b1a] transition-all shadow-md active:scale-[0.98]"
                  >
                    <FaWallet size={14} />
                    Connect & Login
                  </Button>
                </Modal.Footer>
              </>
            )}

            {authStep === "wallet_selection" && (
              <>
                <Modal.Header className="flex flex-col items-center text-center pb-2 relative">
                  <button
                    type="button"
                    onClick={() => setAuthStep("role_selection")}
                    className="absolute left-4 top-5 p-2 text-[#6b6560] hover:text-[#1f1b18] rounded-full hover:bg-[#FFE9E5]/50 transition-colors"
                  >
                    <FiArrowLeft size={18} />
                  </button>
                  <div className="w-12 h-12 rounded-full bg-[#FFE9E5] text-[#A63420] flex items-center justify-center mb-2 mt-2">
                    <FaWallet size={20} />
                  </div>
                  <Modal.Heading className="text-xl font-bold tracking-tight text-[#1f1b18] px-8">
                    Connect a wallet
                  </Modal.Heading>
                  <p className="text-xs text-[#6b6560] mt-1 px-8">
                    Select a wallet on Solana to continue
                  </p>
                </Modal.Header>

                 <Modal.Body className="py-4 px-6 flex flex-col gap-3">
                  {/* Phantom Wallet Row */}
                  <button
                    type="button"
                    onClick={() => handleWalletLogin("phantom")}
                    className="flex items-center justify-between p-4 rounded-xl border border-[#dfbfb9]/40 bg-white/50 hover:bg-[#FFE9E5]/10 hover:border-[#A63420]/30 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] group w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#dfbfb9]/30 flex items-center justify-center shrink-0 shadow-sm">
                        <PhantomIcon size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#1f1b18]">Phantom</h4>
                        <p className="text-xs text-[#6b6560]">Solana Wallet</p>
                      </div>
                    </div>
                    <div>
                      {phantomDetected ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#10B981] border border-[#10B981]/20">
                          Detected
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F8F4EF] text-[#A39D97] border border-[#E8E2D9]">
                          Not Installed
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Solflare Wallet Row */}
                  <button
                    type="button"
                    onClick={() => handleWalletLogin("solflare")}
                    className="flex items-center justify-between p-4 rounded-xl border border-[#dfbfb9]/40 bg-white/50 hover:bg-[#FFE9E5]/10 hover:border-[#A63420]/30 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] group w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#dfbfb9]/30 flex items-center justify-center shrink-0 shadow-sm">
                        <SolflareIcon size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#1f1b18]">Solflare</h4>
                        <p className="text-xs text-[#6b6560]">Solana Wallet</p>
                      </div>
                    </div>
                    <div>
                      {solflareDetected ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#10B981] border border-[#10B981]/20">
                          Detected
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F8F4EF] text-[#A39D97] border border-[#E8E2D9]">
                          Not Installed
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Backpack Wallet Row */}
                  <button
                    type="button"
                    onClick={() => handleWalletLogin("backpack")}
                    className="flex items-center justify-between p-4 rounded-xl border border-[#dfbfb9]/40 bg-white/50 hover:bg-[#FFE9E5]/10 hover:border-[#A63420]/30 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] group w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#dfbfb9]/30 flex items-center justify-center shrink-0 shadow-sm">
                        <BackpackIcon size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#1f1b18]">Backpack</h4>
                        <p className="text-xs text-[#6b6560]">Solana Wallet</p>
                      </div>
                    </div>
                    <div>
                      {backpackDetected ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#10B981] border border-[#10B981]/20">
                          Detected
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F8F4EF] text-[#A39D97] border border-[#E8E2D9]">
                          Not Installed
                        </span>
                      )}
                    </div>
                  </button>

                  {/* OKX Wallet Row */}
                  <button
                    type="button"
                    onClick={() => handleWalletLogin("okx")}
                    className="flex items-center justify-between p-4 rounded-xl border border-[#dfbfb9]/40 bg-white/50 hover:bg-[#FFE9E5]/10 hover:border-[#A63420]/30 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] group w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#dfbfb9]/30 flex items-center justify-center shrink-0 shadow-sm">
                        <OkxIcon size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#1f1b18]">OKX Wallet</h4>
                        <p className="text-xs text-[#6b6560]">Solana Wallet</p>
                      </div>
                    </div>
                    <div>
                      {okxDetected ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#10B981] border border-[#10B981]/20">
                          Detected
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F8F4EF] text-[#A39D97] border border-[#E8E2D9]">
                          Not Installed
                        </span>
                      )}
                    </div>
                  </button>

                  {/* MetaMask Wallet Row */}
                  <button
                    type="button"
                    onClick={() => handleWalletLogin("metamask")}
                    className="flex items-center justify-between p-4 rounded-xl border border-[#dfbfb9]/40 bg-white/50 hover:bg-[#FFE9E5]/10 hover:border-[#A63420]/30 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] group w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#dfbfb9]/30 flex items-center justify-center shrink-0 shadow-sm">
                        <MetaMaskIcon size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#1f1b18]">MetaMask</h4>
                        <p className="text-xs text-[#6b6560]">EVM & Solana Snap</p>
                      </div>
                    </div>
                    <div>
                      {metamaskDetected ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#10B981] border border-[#10B981]/20">
                          Detected
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F8F4EF] text-[#A39D97] border border-[#E8E2D9]">
                          Not Installed
                        </span>
                      )}
                    </div>
                  </button>
                </Modal.Body>
                <div className="h-6" />
              </>
            )}

            {authStep === "wallet_action" && (
              <Modal.Body className="py-12 px-6 flex flex-col items-center justify-center gap-6">
                <div className="relative flex items-center justify-center w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-[#FFE9E5] opacity-50" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-[#A63420] animate-spin" />
                  <FaWallet size={24} className="text-[#A63420]" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-bold text-[#1f1b18]">Connecting Wallet</h3>
                  <p className="text-xs text-[#6b6560] mt-2 leading-relaxed">
                    {loadingText}
                  </p>
                </div>
              </Modal.Body>
            )}

            {authStep === "provider_form" && (
              <form onSubmit={handleProviderRegisterSubmit}>
                <Modal.Header className="flex flex-col items-center text-center pb-2">
                  <div className="w-12 h-12 rounded-full bg-[#FFE9E5] text-[#A63420] flex items-center justify-center mb-2">
                    <FaUserTie size={20} />
                  </div>
                  <Modal.Heading className="text-xl font-bold tracking-tight text-[#1f1b18]">
                    Register Provider
                  </Modal.Heading>
                  <p className="text-xs text-[#6b6560] mt-1">
                    Complete your registration profile details
                  </p>
                </Modal.Header>

                <Modal.Body className="py-4 px-6 flex flex-col gap-4">
                  {walletAddress && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#f8f4ef] border border-[#dfbfb9]/30 rounded-lg text-xs">
                      <FiCheckCircle className="text-[#008282]" />
                      <span className="font-mono text-[#A63420] font-bold">
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    <div>
                      <TextField isRequired isDisabled={isSubmitting}>
                        <Label className="text-xs font-semibold text-[#6b6560] mb-1.5 block">Display Name</Label>
                        <Input
                          placeholder="Enter your organization's name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="rounded-md border border-[#e8e2d9] px-3 py-2 text-sm shadow-sm focus-visible:border-[#a63420] w-full"
                        />
                      </TextField>
                      {fieldErrors.displayName && (
                        <p className="text-[10px] text-red-500 font-medium mt-1">
                          {fieldErrors.displayName}
                        </p>
                      )}
                    </div>

                    <div>
                      <TextField isDisabled={isSubmitting}>
                        <Label className="text-xs font-semibold text-[#6b6560] mb-1.5 block">Logo URL (Optional)</Label>
                        <Input
                          placeholder="https://example.com/logo.png"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          className="rounded-md border border-[#e8e2d9] px-3 py-2 text-sm shadow-sm focus-visible:border-[#a63420] w-full"
                        />
                      </TextField>
                      {fieldErrors.logoUrl && (
                        <p className="text-[10px] text-red-500 font-medium mt-1">
                          {fieldErrors.logoUrl}
                        </p>
                      )}
                    </div>
                  </div>
                </Modal.Body>

                <Modal.Footer className="pt-2 pb-6 px-6 flex flex-col gap-2">
                  <Button
                    type="submit"
                    isDisabled={isSubmitting}
                    className="w-full bg-[#A63420] text-white font-bold text-xs tracking-widest py-3.5 rounded-full flex items-center justify-center gap-2 hover:bg-[#8f2b1a] transition-all shadow-md"
                  >
                    {isSubmitting ? (
                      <>
                        <FiLoader className="animate-spin" size={14} />
                        Registering...
                      </>
                    ) : (
                      "Register Provider"
                    )}
                  </Button>
                </Modal.Footer>
              </form>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
