"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Avatar } from "@heroui/react";
import { LuLogOut } from "react-icons/lu";
import { getUserData, clearAuth } from "@/lib/utils/auth";
import type { IUser } from "@/lib/types/auth";
import AuthGate from "@/app/components/AuthGate";
import { useSolBalance } from "@/lib/hooks/useSolBalance";
import SolanaIcon from "@/app/components/SolanaIcon";

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user] = useState<IUser | null>(getUserData);
  const { data: solBalance } = useSolBalance(user?.wallet_address);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  const initials = user?.display_name
    ? user.display_name.slice(0, 2).toUpperCase()
    : user?.wallet_address
    ? user.wallet_address.slice(0, 2).toUpperCase()
    : "??";

  const shortWallet = user?.wallet_address
    ? `${user.wallet_address.slice(0, 4)}…${user.wallet_address.slice(-4)}`
    : "";

  return (
    <AuthGate allowedRoles={["user_provider"]}>
      <div className="min-h-screen flex flex-col bg-white text-[#211c1a] font-sans">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/92 backdrop-blur-xl border-b border-[#eee6e3] shadow-[0_8px_28px_rgba(109,62,51,0.06)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 group"
            >
              <span className="brand-logo-frame flex h-10 w-10 items-center justify-center rounded-xl">
                <Image
                  src="/logo.png"
                  alt="QuPilot Logo"
                  width={26}
                  height={26}
                  className="h-6.5 w-6.5 object-contain"
                />
              </span>
              <span className="text-xl text-[#211c1a] font-extrabold tracking-tight">
                QuPilot
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-[#fbe4df] text-[#e05d45] text-[10px] font-bold border border-[#e05d45]/15 tracking-wider shadow-[inset_0_1px_0_white]">
                PROVIDER
              </span>
            </Link>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="clay-surface-soft flex items-center gap-2 px-3 py-1.5 rounded-2xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#e05d45]"
              >
                <Avatar size="sm" className="bg-[#e05d45] text-white font-bold">
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
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-[#f5ddd9] shadow-lg p-2 z-50">
                  {/* Profile info */}
                  <div className="px-3 py-2 border-b border-[#f5ddd9] mb-1">
                    <p className="text-xs font-bold text-[#1f1b18] truncate">
                      {user?.display_name ?? "Provider"}
                    </p>
                    <p className="text-[10px] text-[#6b6560] font-mono truncate">
                      {shortWallet}
                    </p>
                    <p className="text-sm text-[#1f1b18] font-mono truncate font-bold mt-2">
                      <span className="inline-flex items-center gap-1.5">
                        <SolanaIcon size={16} />
                        {(solBalance?.sol ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                      </span>
                    </p>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[#e05d45] hover:bg-[#ffe9e5] rounded-md transition-colors w-full text-left font-medium cursor-pointer"
                  >
                    <LuLogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#eee6e3] bg-white py-8 text-[#746c68] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#e05d45] text-sm">QuPilot</span>
            <span className="text-xs">| Provider Console</span>
          </div>
          <p className="text-xs text-center">
            &copy; 2026 QuPilot Web3 Quests. Powering decentralized autonomous discovery. &#x1FA90;
          </p>
          <div className="flex gap-4 text-xs font-bold">
            <Link href="#" className="hover:text-[#e05d45] transition-colors">Terms</Link>
            <Link href="#" className="hover:text-[#e05d45] transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-[#e05d45] transition-colors">Twitter</Link>
            <Link href="#" className="hover:text-[#e05d45] transition-colors">Discord</Link>
          </div>
        </div>
      </footer>
    </div>
    </AuthGate>
  );
}
