"use client";

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Card, ProgressBar, toast, Skeleton } from "@heroui/react";
import { FaRocket, FaCoins, FaDiscord, FaXTwitter, FaComments, FaBolt, FaWallet, FaBuilding } from "react-icons/fa6";
import { FiUsers, FiTrendingUp, FiX, FiCpu } from "react-icons/fi";
import { getUserData, clearAuth } from "@/lib/utils/auth";
import { disconnectWallet } from "@/lib/utils/wallet";
import { usePublicQuests } from "@/lib/hooks/useQuests";
import AuthModal from "./components/AuthModal";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF, OrbitControls, Environment, Float } from "@react-three/drei";
import { motion } from "motion/react";

// ─── Data ─────────────────────────────────────────────────────────────────────

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface IMappedQuest {
  id: string;
  title: string;
  description: string;
  agents: string;
  reward: string;
  progress: number;
}

interface IMappedProvider {
  id: string;
  name: string;
  description: string;
  accentColor: string;
  accentBg: string;
  icon: React.ReactNode;
  stats: {
    activeQuests: number;
    totalPool: string;
  };
  quests: IMappedQuest[];
}

const THEME_COLORS = [
  { accentColor: "#3898FF", accentBg: "rgba(56,152,255,0.1)" }, // Sui Blue
  { accentColor: "#F7A600", accentBg: "rgba(247,166,0,0.1)" }, // Bybit Orange
  { accentColor: "#A63420", accentBg: "rgba(166,52,32,0.1)" }, // QuPilot Red
  { accentColor: "#10B981", accentBg: "rgba(16,185,129,0.1)" }, // Emerald Green
  { accentColor: "#8B5CF6", accentBg: "rgba(139,92,246,0.1)" }, // Violet
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatBadge({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  const [currentVal, setCurrentVal] = useState(0);
  const [parsed, setParsed] = useState({ prefix: "", target: 0, suffix: value, decimals: 0 });
  const [hasTriggered, setHasTriggered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered) {
          setHasTriggered(true);
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasTriggered]);

  useEffect(() => {
    if (!hasTriggered) return;

    // Regex to extract prefix, number, and suffix
    // e.g. "$4.2M" -> prefix: "$", number: 4.2, suffix: "M"
    // "12k+" -> prefix: "", number: 12, suffix: "k+"
    // "94%" -> prefix: "", number: 94, suffix: "%"
    const match = value.match(/^([^0-9.]*)([0-9.]+)([^0-9.]*)$/);
    if (!match) {
      setParsed({ prefix: "", target: 0, suffix: value, decimals: 0 });
      return;
    }

    const prefix = match[1];
    const numStr = match[2];
    const suffix = match[3];

    const target = parseFloat(numStr);
    const decimalIndex = numStr.indexOf(".");
    const decimals = decimalIndex === -1 ? 0 : numStr.length - decimalIndex - 1;

    const info = { prefix, target, suffix, decimals };
    setParsed(info);

    let startTimestamp: number | null = null;
    const duration = 2400; // Slower 2.4s elegant count-up duration

    function step(timestamp: number) {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out quad
      const easeProgress = progress * (2 - progress);
      const current = easeProgress * info.target;
      setCurrentVal(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }, [value, hasTriggered]);

  const displayString = parsed.prefix + currentVal.toFixed(parsed.decimals) + parsed.suffix;

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-1.5 px-8">
      <div className="text-2xl text-[#A63420] opacity-80">
        {icon}
      </div>
      <span
        className="text-3xl font-extrabold tracking-tight"
        style={{ fontFamily: "var(--font-nunito)", color: "#1F1B18" }}
      >
        {displayString}
      </span>
      <span
        className="text-[11px] font-bold uppercase tracking-widest"
        style={{ color: "#6B6560" }}
      >
        {label}
      </span>
    </div>
  );
}

function QuestCard({
  quest,
  accentColor,
  accentBg,
}: {
  quest: IMappedQuest;
  accentColor: string;
  accentBg: string;
}) {
  return (
    <Card
      className="flex flex-col gap-3 p-5 rounded-xl border flex-1"
      style={{
        background: "#FFF8F6",
        borderColor: "rgba(223,191,185,0.3)",
        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
      }}
    >
      {/* Top row: agents + reward */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs px-2 py-1 rounded-md"
          style={{ background: "#FFE9E5", color: "#6B6560" }}
        >
          {quest.agents}
        </span>
        <span
          className="text-xs font-bold px-2 py-1 rounded-full"
          style={{ background: accentBg, color: accentColor }}
        >
          {quest.reward}
        </span>
      </div>

      {/* Title */}
      <h3
        className="font-bold text-[17px] leading-snug"
        style={{ fontFamily: "var(--font-nunito)", color: "#1F1B18" }}
      >
        {quest.title}
      </h3>

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: "#6B6560" }}>
        {quest.description}
      </p>

      {/* Progress */}
      <div className="flex flex-col gap-1 mt-auto">
        <div className="flex justify-between text-xs" style={{ color: "#6B6560" }}>
          <span>Progress</span>
          <span>{quest.progress}% Full</span>
        </div>
        <ProgressBar aria-label="Quest Progress" value={quest.progress} className="w-full">
          <ProgressBar.Track className="h-2 rounded-full bg-[#FFE9E5]">
            <ProgressBar.Fill className="rounded-full transition-all" style={{ backgroundColor: accentColor }} />
          </ProgressBar.Track>
        </ProgressBar>
      </div>
    </Card>
  );
}

function ProviderSection({
  provider,
}: {
  provider: IMappedProvider;
}) {
  return (
    <Card
      className="flex flex-col gap-8 p-8 rounded-[32px]"
      style={{
        background: "rgba(255,255,255,0.85)",
        border: `4px solid ${provider.accentColor}33 transparent transparent`,
        borderTop: `4px solid ${provider.accentColor}`,
        borderLeft: "1px solid rgba(255,255,255,0.4)",
        borderRight: "1px solid rgba(255,255,255,0.4)",
        borderBottom: "1px solid rgba(255,255,255,0.4)",
        boxShadow: "0px 8px 32px 0px rgba(166,52,32,0.05)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Provider header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo placeholder */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: provider.accentBg,
              boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
            }}
          >
            {provider.icon}
          </div>

          <div>
            <h2
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-nunito)", color: "#1F1B18" }}
            >
              {provider.name}
            </h2>
            <p className="text-sm" style={{ color: "#6B6560" }}>
              {provider.description}
            </p>
          </div>
        </div>

        {/* Stats pill */}
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-xl"
          style={{ background: "#FFF0EE" }}
        >
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest" style={{ color: "#6B6560" }}>Active Quests</p>
            <p className="text-base font-bold" style={{ color: "#1F1B18", fontFamily: "var(--font-nunito)" }}>
              {provider.stats.activeQuests}
            </p>
          </div>
          <div className="w-px h-8" style={{ background: "#DFBFB9" }} />
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest" style={{ color: "#6B6560" }}>Total Pool</p>
            <p
              className="text-base font-bold"
              style={{ color: "#F59E0B", fontFamily: "var(--font-nunito)" }}
            >
              {provider.stats.totalPool}
            </p>
          </div>
        </div>
      </div>

      {/* Quest cards */}
      <div className="flex gap-4">
        {provider.quests.map((quest) => (
          <QuestCard
            key={quest.id}
            quest={quest}
            accentColor={provider.accentColor}
            accentBg={provider.accentBg}
          />
        ))}
      </div>
    </Card>
  );
}

// ─── Skeleton Component ───────────────────────────────────────────────────────

function ProviderSkeleton() {
  return (
    <Card
      className="flex flex-col gap-8 p-8 rounded-[32px] border"
      style={{
        background: "rgba(255,255,255,0.85)",
        borderColor: "rgba(223,191,185,0.3)",
        boxShadow: "0px 8px 32px 0px rgba(166,52,32,0.05)",
      }}
    >
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-4 w-64 rounded-lg" />
          </div>
        </div>
        <Skeleton className="w-44 h-12 rounded-xl" />
      </div>

      {/* Cards Skeleton */}
      <div className="flex gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card
            key={i}
            className="flex flex-col gap-3 p-5 rounded-xl border flex-1"
            style={{
              background: "#FFF8F6",
              borderColor: "rgba(223,191,185,0.3)",
              height: "220px",
            }}
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-6 w-3/4 rounded-lg mt-2" />
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-5/6 rounded-lg" />
            <div className="flex flex-col gap-2 mt-auto">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-12 rounded-lg" />
                <Skeleton className="h-3 w-16 rounded-lg" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}

// ─── Looped Typewriter Component ──────────────────────────────────────────

function LoopedTypewriter() {
  const phrases = ["Automate your DeFi Journey.", "Earn like a Pro."];
  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: any;
    const currentPhrase = phrases[index];

    if (!isDeleting) {
      if (displayText.length < currentPhrase.length) {
        timer = setTimeout(() => {
          setDisplayText(currentPhrase.substring(0, displayText.length + 1));
        }, 55); // fast typing speed
      } else {
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 2500); // 2.5s hold on completed text
      }
    } else {
      if (displayText.length > 0) {
        timer = setTimeout(() => {
          setDisplayText(currentPhrase.substring(0, displayText.length - 1));
        }, 25); // extra fast deleting speed
      } else {
        setIsDeleting(false);
        setIndex((prev) => (prev + 1) % phrases.length);
      }
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, index]);

  const isGradient = phrases[index] === "Earn like a Pro.";
  const textStyle: React.CSSProperties = isGradient
    ? {
        background: "linear-gradient(168deg, #A63420 0%, #F59E0B 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        display: "inline",
      }
    : {
        color: "#1F1B18",
        display: "inline",
      };

  const cursorColor = isGradient ? "#A63420" : "#1F1B18";

  return (
    <>
      <span style={textStyle}>{displayText}</span>
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
        style={{
          display: "inline-block",
          marginLeft: "6px",
          width: "4px",
          height: "44px",
          backgroundColor: cursorColor,
          verticalAlign: "middle",
          transform: "translateY(-4px)",
        }}
      />
    </>
  );
}

// ─── Rocket 3D Model ──────────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  useGLTF.preload("/rocket.glb");
}

function RocketModel({ scrolled }: { scrolled: boolean }) {
  const { scene } = useGLTF("/rocket.glb");
  const pivotRef = useRef<any>(null);
  const bodyRef = useRef<any>(null);

  useFrame((state, delta) => {
    // 1. Rotate the body around its local Y axis to make it spin
    if (bodyRef.current) {
      bodyRef.current.rotation.y += delta * 1.2; // spin speed
    }

    // 2. Lerp the pivot group (scale and position) for scroll flight
    if (pivotRef.current) {
      const targetScale = scrolled ? 0.4 : 4.0;
      const targetY = scrolled ? 1.5 : -2.5;

      const lerpFactor = Math.min(1, 5 * delta);
      pivotRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpFactor);
      pivotRef.current.position.y = THREE.MathUtils.lerp(pivotRef.current.position.y, targetY, lerpFactor);
    }
  });

  return (
    <group 
      ref={pivotRef} 
      scale={4} 
      position={[0, -2.5, 0]} 
      rotation={[0.15, 0, 0.45]} // Tilt: X slightly forward, Z left to point to upper-left
    >
      <primitive ref={bodyRef} object={scene} />
    </group>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function LandingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: questsData, isLoading: isLoadingQuests } = usePublicQuests();

  const groupedProviders = useMemo<IMappedProvider[]>(() => {
    if (!questsData?.quests) return [];

    const groups: Record<string, typeof questsData.quests> = {};
    questsData.quests.forEach((quest) => {
      const providerUuid = quest.provider?.uuid;
      if (!providerUuid) return;
      if (!groups[providerUuid]) {
        groups[providerUuid] = [];
      }
      groups[providerUuid].push(quest);
    });

    return Object.entries(groups).map(([providerUuid, providerQuests], idx) => {
      const sampleQuest = providerQuests[0];
      const provider = sampleQuest.provider;
      const colors = THEME_COLORS[idx % THEME_COLORS.length];

      const poolMap: Record<string, number> = {};
      providerQuests.forEach((q) => {
        let amount = parseFloat(q.total_reward_pool) || 0;
        const token = q.reward_token || "USDT";
        if (token === "SOL") amount /= 1e9;
        poolMap[token] = (poolMap[token] || 0) + amount;
      });
      const totalPool = Object.entries(poolMap)
        .map(([token, amount]) => `${amount.toLocaleString()} ${token}`)
        .join(", ");

      const icon = provider.logo_url ? (
        <img
          src={provider.logo_url}
          alt={provider.display_name}
          className="w-full h-full object-cover"
        />
      ) : (
        <FaBuilding className="text-3xl" style={{ color: colors.accentColor }} />
      );

      const quests: IMappedQuest[] = providerQuests.map((q) => {
        let pool = parseFloat(q.total_reward_pool) || 0;
        let distributed = parseFloat(q.total_reward_distributed) || 0;
        let rewardPerUser = parseFloat(q.reward_per_user) || 0;

        if (q.reward_token === "SOL") {
          pool /= 1e9;
          distributed /= 1e9;
          rewardPerUser /= 1e9;
        }

        const progress = pool > 0 ? Math.min(Math.round((distributed / pool) * 100), 100) : 0;

        const formattedReward = q.reward_per_user
          ? `+${rewardPerUser.toLocaleString()} ${q.reward_token}`
          : "Free";

        return {
          id: q.uuid,
          title: q.title,
          description: q.description,
          agents: `${q.participation_count} Agents`,
          reward: formattedReward,
          progress,
        };
      });

      return {
        id: providerUuid,
        name: provider.display_name,
        description: "Verified DeFi protocol",
        accentColor: colors.accentColor,
        accentBg: colors.accentBg,
        icon,
        stats: {
          activeQuests: providerQuests.length,
          totalPool: totalPool || "0 USDT",
        },
        quests,
      };
    });
  }, [questsData]);

  // Track page scroll progress for header progress bar
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(progress);
      } else {
        setScrollProgress(0);
      }

      if (window.scrollY > 80) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Check auth and redirect if already authenticated
  useEffect(() => {
    const user = getUserData();
    if (user) {
      setWalletAddress(user.wallet_address);
      if (user.role === "user_provider") {
        router.replace("/dashboard");
      } else {
        router.replace("/explore");
      }
    } else {
      setIsCheckingAuth(false);
    }
  }, [router]);

  // Handle URL redirect query parameter ?login=true
  useEffect(() => {
    if (searchParams.get("login") === "true") {
      setIsAuthModalOpen(true);
      // Clean query parameters from address bar
      router.replace("/", { scroll: false });
    }
  }, [searchParams, router]);

  const handleConnectWallet = () => {
    setIsAuthModalOpen(true);
  };

  const handleDisconnectWallet = () => {
    clearAuth();
    disconnectWallet();
    setWalletAddress(null);
    toast.success("Disconnected wallet.");
  };

  const handleAuthSuccess = () => {
    const user = getUserData();
    if (user) {
      setWalletAddress(user.wallet_address);
      if (user.role === "user_provider") {
        router.replace("/dashboard");
      } else {
        router.replace("/explore");
      }
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFBF5] text-[#A63420]">
        <div className="flex flex-col items-center gap-4">
          <FaRocket className="w-12 h-12 animate-bounce" />
          <span className="font-bold tracking-wide text-sm font-sans animate-pulse">
            MISSION CONTROL INITIATED...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#FFFBF5" }}
    >
      {/* ── Navbar ── */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: "rgba(255,248,246,0.8)",
          borderBottom: "1px solid rgba(245,221,217,0.5)",
          backdropFilter: "blur(24px)",
          boxShadow:
            "0px 0px 3px 0px rgba(31,27,24,0.02), 0px 4px 20px -2px rgba(31,27,24,0.05)",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group"
            id="nav-logo"
          >
            <img
              src="/logo.png"
              alt="QuPilot Logo"
              className="w-6 h-6 object-contain transition-transform duration-300 group-hover:scale-110"
            />
            <span
              className="text-2xl font-extrabold tracking-tight"
              style={{
                fontFamily: "var(--font-nunito)",
                color: "#A63420",
              }}
            >
              QuPilot
            </span>
          </Link>

          {/* CTA buttons */}
          <div className="flex items-center gap-3">
            {walletAddress ? (
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-bold"
                  style={{ background: "#FFE9E5", color: "#A63420" }}
                >
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: "#10B981" }}
                  />
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </div>
                <Button
                  isIconOnly
                  variant="ghost"
                  onPress={handleDisconnectWallet}
                  className="w-6 h-6 min-w-auto p-0 rounded-full text-[#A39D97] hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                >
                  <FiX size={14} />
                </Button>
              </div>
            ) : (
              <Button
                onPress={handleConnectWallet}
                id="nav-connect-wallet"
                className="bg-[#a63420] text-white hover:bg-[#8f2b1a] transition-all text-xs font-bold px-5 py-2.5 rounded-full shadow-sm flex items-center gap-2"
              >
                <FaWallet size={14} />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>

        {/* Scroll Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-0.75 bg-transparent overflow-hidden">
          <div
            className="h-full transition-all duration-75 ease-out"
            style={{
              width: `${scrollProgress}%`,
              background: "linear-gradient(90deg, #A63420 0%, #F59E0B 100%)",
            }}
          />
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section
        className="relative overflow-hidden"
        style={{ padding: "140px 20px 48px" }}
      >
        {/* Background blobs */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: 33,
            top: 49,
            width: 600,
            height: 600,
            borderRadius: "9999px",
            background: "rgba(255,180,165,0.4)",
            filter: "blur(100px)",
            opacity: 0.5,
            zIndex: 0,
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            left: 596,
            top: 492,
            width: 700,
            height: 700,
            borderRadius: "9999px",
            background: "rgba(206,189,255,0.3)",
            filter: "blur(100px)",
            opacity: 0.5,
            zIndex: 0,
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            left: 64,
            top: "calc(100% - 282px)",
            width: 500,
            height: 500,
            borderRadius: "9999px",
            background: "rgba(245,158,11,0.2)",
            filter: "blur(100px)",
            opacity: 0.5,
            zIndex: 0,
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto flex items-center justify-between gap-12">
          {/* Left: text content */}
          <div
            className="flex flex-col gap-5"
            style={{
              maxWidth: scrolled ? "100%" : 608,
              width: "100%",
              transition: "all 1.2s cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          >
            {/* Status pill */}
            <div
              className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full text-xs font-bold tracking-widest"
              style={{
                background: "#FFF0EE",
                border: "1px solid rgba(166,52,32,0.2)",
                color: "#6B6560",
                boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <FiCpu className="text-[#A63420]" />
              System Online. Mission Control Active.
            </div>

            <h1
              className="text-[56px] font-extrabold leading-17.5 tracking-tight"
              style={{
                fontFamily: "var(--font-nunito)",
                color: "#1F1B18",
                minHeight: "70px",
              }}
            >
              <LoopedTypewriter />
            </h1>

            {/* Sub-heading */}
            <p
              className="text-lg leading-relaxed"
              style={{
                color: "#6B6560",
                maxWidth: scrolled ? "100%" : 576,
                transition: "all 1.2s cubic-bezier(0.25, 1, 0.5, 1)",
              }}
            >
              Join Mission Control, deploy smart agents to complete complex DeFi
              tasks, and earn crypto rewards on autopilot in a vibrant Web3
              ecosystem.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-3 pt-3">
              <Button
                render={(props) => <Link href="/explore" {...(props as any)} />}
                id="hero-launch-agents"
                className="flex items-center gap-2 px-8 py-3 rounded-full text-[17px] font-bold transition-all hover:opacity-90"
                style={{
                  background: "#A63420",
                  color: "#FFFFFF",
                  boxShadow:
                    "0px 6px 12px 0px rgba(166,52,32,0.3), 0px 4px 0px 0px rgba(137,30,12,1)",
                  height: "auto",
                  minWidth: "auto",
                }}
              >
                Launch Agents
                <FaRocket className="text-white" />
              </Button>

              <Button
                render={(props) => <Link href="/quests" {...(props as any)} />}
                id="hero-view-quests"
                className="flex items-center justify-center px-8 py-3 rounded-full text-[17px] font-bold border-2 transition-all hover:bg-black/5"
                style={{
                  background: "#FFF8F6",
                  borderColor: "rgba(166,52,32,0.2)",
                  color: "#A63420",
                  height: "auto",
                  minWidth: "auto",
                }}
              >
                View Quests
              </Button>
            </div>
          </div>

          {/* Right: hero 3D model */}
          <motion.div
            className="relative shrink-0"
            style={{
              height: 600,
              pointerEvents: scrolled ? "none" : "auto",
              overflow: "hidden",
            }}
            animate={{
              width: scrolled ? 0 : 600,
              x: scrolled ? -1100 : 0,
              y: scrolled ? -600 : 0,
              opacity: scrolled ? 0 : 1,
            }}
            transition={{
              x: { duration: 1.5, ease: [0.25, 1, 0.5, 1] },
              y: { duration: 1.5, ease: [0.25, 1, 0.5, 1] },
              opacity: { duration: 1.2, ease: [0.25, 1, 0.5, 1] },
              width: { duration: 1.2, ease: [0.25, 1, 0.5, 1] },
            }}
          >
            <div className="relative w-full h-full overflow-visible">
              {mounted ? (
                <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
                  <ambientLight intensity={0.7} />
                  <directionalLight position={[10, 10, 5]} intensity={1.5} />
                  <Suspense fallback={null}>
                    <Float speed={scrolled ? 0 : 2} rotationIntensity={scrolled ? 0 : 0.5} floatIntensity={scrolled ? 0 : 1}>
                      <RocketModel scrolled={scrolled} />
                    </Float>
                    <Environment preset="city" />
                  </Suspense>
                  <OrbitControls enableZoom={false} />
                </Canvas>
              ) : (
                <Image
                  src="/hero_mission_control.png"
                  alt="Mission Control - DeFi automation hub"
                  fill
                  className="object-contain"
                  priority
                />
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Trust / Stats Bar ── */}
        <div className="relative z-10 max-w-7xl mx-auto mt-3xl">
          <div
            className="flex items-center justify-center gap-0 rounded-[24px] py-8"
            style={{
              background: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,255,255,0.4)",
              backdropFilter: "blur(16px)",
              boxShadow:
                "0px 4px 6px 0px rgba(31,27,24,0.04), 0px 12px 32px -4px rgba(31,27,24,0.08)",
            }}
          >
            <StatBadge value="12k+" label="Agents Deployed" icon={<FiUsers size={24} />} />
            <div
              className="w-px self-stretch"
              style={{ background: "rgba(223,191,185,0.5)" }}
            />
            <StatBadge value="$4.2M" label="Rewards Distributed" icon={<FaCoins size={22} />} />
            <div
              className="w-px self-stretch"
              style={{ background: "rgba(223,191,185,0.5)" }}
            />
            <StatBadge value="94%" label="Success Rate" icon={<FiTrendingUp size={24} />} />
          </div>
        </div>
      </section>

      {/* ── Providers Section ── */}
      <main
        className="max-w-7xl mx-auto w-full flex flex-col gap-3xl"
        style={{ padding: "48px 20px" }}
      >
        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex flex-col items-center gap-2"
        >
          <h2
            className="text-[32px] font-extrabold tracking-tight"
            style={{
              fontFamily: "var(--font-nunito)",
              color: "#1F1B18",
            }}
          >
            Top Mission Providers
          </h2>
          <p
            className="text-base text-center"
            style={{ color: "#6B6560", maxWidth: 672 }}
          >
            Discover official quests from verified DeFi protocols and exchanges.
          </p>
        </motion.div>

        {/* Provider blocks */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          className="flex flex-col gap-3xl"
        >
          {isLoadingQuests ? (
            Array.from({ length: 2 }).map((_, idx) => (
              <ProviderSkeleton key={idx} />
            ))
          ) : groupedProviders.length > 0 ? (
            groupedProviders.map((provider) => (
              <ProviderSection key={provider.id} provider={provider} />
            ))
          ) : (
            <Card
              className="flex items-center justify-center p-12 text-center rounded-[32px]"
              style={{
                background: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(223,191,185,0.3)",
                boxShadow: "0px 8px 32px 0px rgba(166,52,32,0.05)",
              }}
            >
              <p className="text-base font-semibold" style={{ color: "#6B6560" }}>
                No active quests found. Check back later!
              </p>
            </Card>
          )}
        </motion.div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="mt-auto"
        style={{
          background: "#FFF0EE",
          borderTop: "1px solid rgba(223,191,185,0.5)",
        }}
      >
        <div
          className="max-w-7xl mx-auto flex flex-col gap-8"
          style={{ padding: "32px 20px" }}
        >
          {/* Top row */}
          <div className="flex items-start justify-between gap-12">
            {/* Brand */}
            <div className="flex flex-col gap-3" style={{ maxWidth: 384 }}>
              <Link href="/" className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  alt="QuPilot Logo"
                  className="w-6 h-6 object-contain"
                />
                <span
                  className="text-2xl font-extrabold tracking-tight"
                  style={{ fontFamily: "var(--font-nunito)", color: "#A63420" }}
                >
                  QuPilot
                </span>
              </Link>
              <p className="text-sm leading-relaxed" style={{ color: "#6B6560" }}>
                The most powerful automation layer for Web3 quests. Deploy
                agents, complete missions, and earn rewards effortlessly.
              </p>
            </div>

            {/* Links */}
            <div className="flex gap-16">
              <div className="flex flex-col gap-3">
                <h4
                  className="text-base font-semibold"
                  style={{ color: "#1F1B18", fontFamily: "var(--font-nunito)" }}
                >
                  Resources
                </h4>
                {["Documentation", "Governance", "Provider API"].map((l) => (
                  <Link
                    key={l}
                    href="#"
                    className="text-sm hover:text-[#A63420] transition-colors"
                    style={{ color: "#6B6560" }}
                  >
                    {l}
                  </Link>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <h4
                  className="text-base font-semibold"
                  style={{ color: "#1F1B18", fontFamily: "var(--font-nunito)" }}
                >
                  Community
                </h4>
                {[
                  { label: "Discord", icon: <FaDiscord size={16} /> },
                  { label: "Twitter", icon: <FaXTwitter size={16} /> },
                  { label: "Forum", icon: <FaComments size={16} /> },
                ].map(({ label, icon }) => (
                  <Link
                    key={label}
                    href="#"
                    className="flex items-center gap-2 text-sm hover:text-[#A63420] transition-colors"
                    style={{ color: "#6B6560" }}
                  >
                    {icon} {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div
            className="flex items-center justify-between pt-5"
            style={{ borderTop: "1px solid rgba(223,191,185,0.3)" }}
          >
            <p className="text-sm" style={{ color: "#6B6560" }}>
              © 2024 QuPilot Web3 Quests. Explore the stars.
            </p>
            <div className="flex gap-5">
              {["Terms of Service", "Privacy Policy"].map((l) => (
                <Link
                  key={l}
                  href="#"
                  className="text-sm hover:text-[#A63420] transition-colors"
                  style={{ color: "#6B6560" }}
                >
                  {l}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#FFFBF5] text-[#A63420] font-bold">Loading...</div>}>
      <LandingPageContent />
    </Suspense>
  );
}
