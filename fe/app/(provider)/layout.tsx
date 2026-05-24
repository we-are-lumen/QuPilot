"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Popover } from "@heroui/react";
import { LuRocket, LuLogOut } from "react-icons/lu";
import { getUserData, clearAuth } from "@/lib/utils/auth";
import type { IUser } from "@/lib/types/auth";
import AuthGate from "@/app/components/AuthGate";

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<IUser | null>(null);

  useEffect(() => {
    const stored = getUserData();
    if (stored) {
      setUser(stored);
    }
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  // Derive initials from display_name or wallet address
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
              <img
                src="/logo.png"
                alt="QuPilot Logo"
                className="w-6 h-6 object-contain"
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
            <Popover>
              <Popover.Trigger>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#dfbfb94d] hover:shadow-sm transition-all cursor-pointer">
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
                        {user?.display_name ?? "Provider"}
                      </p>
                      <p className="text-[10px] text-[#6b6560] font-mono truncate">
                        {shortWallet}
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
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
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
            © 2026 QuPilot Web3 Quests. Powering decentralized autonomous discovery. 🪐
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
