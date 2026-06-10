"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuRocket } from "react-icons/lu";
import { getAuthToken, getUserData } from "@/lib/utils/auth";
import type { UserRole } from "@/lib/types/auth";

interface AuthGateProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function AuthGate({ children, allowedRoles }: AuthGateProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    const user = getUserData();

    if (!token || !user) {
      // Unauthenticated -> redirect to landing page and show login modal
      router.replace("/?login=true");
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // Role mismatch -> redirect to appropriate home
      if (user.role === "user_provider") {
        router.replace("/dashboard");
      } else {
        router.replace("/explore");
      }
      return;
    }

    setIsAuthorized(true);
    setIsLoading(false);
  }, [router, allowedRoles]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] w-full flex flex-col items-center justify-center bg-white gap-5 py-12">
        <div className="clay-icon relative flex items-center justify-center w-20 h-20 rounded-[28px]">
          {/* Animated cosmic ripples */}
          <div className="absolute inset-0 rounded-full border-4 border-[#ffe9e5] animate-ping opacity-75" />
          <div className="absolute inset-2 rounded-full border-4 border-t-[#e05d45] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          <LuRocket className="text-3xl text-[#e05d45]" />
        </div>
        <div className="flex flex-col items-center text-center gap-1">
          <h3 className="text-sm font-bold text-[#1f1b18] uppercase tracking-wider">
            Establishing Link
          </h3>
          <p className="text-xs text-[#6b6560] font-sans">
            Verifying quantum pilot credentials...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
