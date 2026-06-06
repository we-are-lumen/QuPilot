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
      <div className="min-h-screen flex flex-col bg-[#fffbf5] text-[#1f1b18] font-sans">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#fff8f6cc] backdrop-blur-md border-b border-[#dfbfb94d] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 group transition-transform duration-200 hover:scale-105"
            >
              <Image
                src="/logo.png"
                alt="QuPilot Logo"
                width={24}
                height={24}
                className="object-contain"
              />
              <span className="text-xl text-[#a63420] font-extrabold tracking-tight">
                QuPilot
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#ffe9e5] text-[#a63420] text-[10px] font-bold border border-[#a63420]/20 tracking-wider">
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
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#dfbfb94d] hover:shadow-sm transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#a63420]"
              >
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
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[#a63420] hover:bg-[#ffe9e5] rounded-md transition-colors w-full text-left font-medium cursor-pointer"
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#dfbfb94d] bg-[#f8f4ef] py-8 text-[#6b6560] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#a63420] text-sm">QuPilot</span>
            <span className="text-xs">| Provider Console</span>
          </div>
          <p className="text-xs text-center">
            &copy; 2026 QuPilot Web3 Quests. Powering decentralized autonomous discovery. &#x1FA90;
          </p>
          <div className="flex gap-4 text-xs font-bold">
            <Link href="#" className="hover:text-[#a63420] transition-colors">Terms</Link>
            <Link href="#" className="hover:text-[#a63420] transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-[#a63420] transition-colors">Twitter</Link>
            <Link href="#" className="hover:text-[#a63420] transition-colors">Discord</Link>
          </div>
        </div>
      </footer>
    </div>
    </AuthGate>
  );
}
