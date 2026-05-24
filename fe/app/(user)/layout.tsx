"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Avatar, Popover } from "@heroui/react";
import {
  FaWallet,
  FaUserPlus,
  FaDiscord,
  FaTwitter,
  FaCircle,
  FaRocket,
} from "react-icons/fa6";
import { FiLayout, FiUser, FiAward, FiCompass } from "react-icons/fi";
import { LuLogOut } from "react-icons/lu";
import { getUserData, getAuthToken, clearAuth } from "@/lib/utils/auth";
import type { IUser } from "@/lib/types/auth";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<IUser | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Load user data on mount
  useEffect(() => {
    const stored = getUserData();
    const token = getAuthToken();
    if (stored && token) {
      setUser(stored);
    }
  }, []);

  // Derive initials from display_name or wallet address
  const initials = user?.display_name
    ? user.display_name.slice(0, 2).toUpperCase()
    : user?.wallet_address
    ? user.wallet_address.slice(0, 2).toUpperCase()
    : "??";

  // Format wallet address for display
  const shortWallet = user?.wallet_address
    ? `${user.wallet_address.slice(0, 4)}…${user.wallet_address.slice(-4)}`
    : "";

  const handleConnectWallet = useCallback(() => {
    setIsConnecting(true);
    // Redirect to home page with login query parameter to trigger the modal
    router.push("/?login=true");
  }, [router]);

  const handleDisconnectWallet = useCallback(() => {
    clearAuth();
    setUser(null);
    router.push("/");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col bg-[#fffbf5] font-sans antialiased text-[#1f1b18]">
      {/* TopNavBar */}
      <header className="sticky top-0 z-40 bg-[#fff8f6cc] backdrop-blur-md border-b border-[#f5ddd9] py-3 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-12">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 group transition-transform duration-200 hover:scale-105"
          >
            <span className="text-[#a63420] text-2xl font-extrabold flex items-center gap-1.5">
              <FaRocket
                className="inline-block animate-pulse text-[#a63420]"
                size={22}
              />
              <span className="font-extrabold tracking-tight">QuPilot</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/explore"
              className={`px-1 py-1 text-sm font-bold transition-all flex items-center gap-1.5 ${
                pathname === "/explore"
                  ? "text-[#a63420] border-b-2 border-[#a63420]"
                  : "text-[#6b6560] hover:text-[#a63420]"
              }`}
            >
              <FiLayout size={16} />
              Dashboard
            </Link>

            <Link
              href="/quests"
              className={`px-1 py-1 text-sm font-bold transition-all flex items-center gap-1.5 ${
                pathname === "/quests"
                  ? "text-[#a63420] border-b-2 border-[#a63420]"
                  : "text-[#6b6560] hover:text-[#a63420]"
              }`}
            >
              <FiCompass size={16} />
              Quests
            </Link>

            <Link
              href="/profile"
              className={`px-1 py-1 text-sm font-bold transition-all flex items-center gap-1.5 ${
                pathname === "/profile"
                  ? "text-[#a63420] border-b-2 border-[#a63420]"
                  : "text-[#6b6560] hover:text-[#a63420]"
              }`}
            >
              <FiUser size={16} />
              My Profile
            </Link>

            <Link
              href="/leaderboard"
              className={`px-1 py-1 text-sm font-bold transition-all flex items-center gap-1.5 ${
                pathname === "/leaderboard"
                  ? "text-[#a63420] border-b-2 border-[#a63420]"
                  : "text-[#6b6560] hover:text-[#a63420]"
              }`}
            >
              <FiAward size={16} />
              Leaderboard
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {user ? (
              <Popover>
                <Popover.Trigger>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#f5ddd9] hover:shadow-sm transition-all cursor-pointer">
                    <Avatar size="sm" className="bg-[#a63420] text-white font-bold">
                      <Avatar.Fallback>{initials}</Avatar.Fallback>
                    </Avatar>
                    <div className="hidden lg:flex flex-col text-left">
                      <span className="text-xs font-bold leading-none text-[#1f1b18]">
                        {user?.display_name ?? shortWallet}
                      </span>
                      <span className="text-[10px] text-[#6b6560] font-mono">
                        {shortWallet}
                      </span>
                    </div>
                  </div>
                </Popover.Trigger>
                <Popover.Content placement="bottom" offset={8}>
                  <Popover.Dialog className="w-52 p-2">
                    <div className="flex flex-col w-full gap-1">
                      {/* Profile info */}
                      <div className="px-3 py-2 border-b border-[#f5ddd9] mb-1">
                        <p className="text-xs font-bold text-[#1f1b18] truncate">
                          {user?.display_name ?? "User"}
                        </p>
                        <p className="text-[10px] text-[#6b6560] font-mono truncate">
                          {shortWallet}
                        </p>
                      </div>

                      <button
                        onClick={handleDisconnectWallet}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[#a63420] hover:bg-[#ffe9e5] rounded-md transition-colors w-full text-left font-medium cursor-pointer"
                      >
                        <LuLogOut size={16} />
                        <span>Disconnect Wallet</span>
                      </button>
                    </div>
                  </Popover.Dialog>
                </Popover.Content>
              </Popover>
            ) : (
              <Button
                onClick={handleConnectWallet}
                isDisabled={isConnecting}
                className="bg-[#a63420] text-white hover:bg-[#8f2b1a] transition-all text-xs font-bold px-5 py-2.5 rounded-full shadow-sm flex items-center gap-2"
              >
                <FaWallet size={14} />
                {isConnecting ? "Connecting…" : "Connect Wallet"}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="grow max-w-7xl w-full mx-auto px-6 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#f8f4ef] border-t border-[#f5ddd9] py-8 text-sm text-[#6b6560]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-[#a63420] text-lg">QuPilot</span>
            <span>© 2026 QuPilot Web3 Quests. Explore the stars.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/terms"
              className="hover:text-[#a63420] transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="hover:text-[#a63420] transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#a63420] transition-colors flex items-center gap-1"
            >
              <FaTwitter size={14} />
              Twitter
            </Link>
            <Link
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#a63420] transition-colors flex items-center gap-1"
            >
              <FaDiscord size={14} />
              Discord
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
