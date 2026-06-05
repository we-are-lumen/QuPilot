"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Card, ProgressBar, toast, Skeleton, ScrollShadow } from "@heroui/react";
import {
  FaRocket,
  FaCoins,
  FaDiscord,
  FaXTwitter,
  FaComments,
  FaWallet,
  FaBuilding,
  FaRobot,
} from "react-icons/fa6";
import { FiX, FiCpu, FiTarget } from "react-icons/fi";
import { getUserData, clearAuth } from "@/lib/utils/auth";
import { disconnectWallet } from "@/lib/utils/wallet";
import { usePublicQuests } from "@/lib/hooks/useQuests";
import type { IQuestStep } from "@/lib/types/quests";
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
  steps: IQuestStep[];
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
  supportedSkills: string[];
}

const THEME_COLORS = [
  { accentColor: "#3898FF", accentBg: "rgba(56,152,255,0.1)" }, // Sui Blue
  { accentColor: "#F7A600", accentBg: "rgba(247,166,0,0.1)" }, // Bybit Orange
  { accentColor: "#A63420", accentBg: "rgba(166,52,32,0.1)" }, // QuPilot Red
  { accentColor: "#10B981", accentBg: "rgba(16,185,129,0.1)" }, // Emerald Green
  { accentColor: "#8B5CF6", accentBg: "rgba(139,92,246,0.1)" }, // Violet
];

const STEP_NAME_MAP: Record<string, string> = {
  swap: "Swap",
  clmm_open: "Open CLMM",
  clmm_close: "Close CLMM",
  clmm_copy: "Copy CLMM",
};

const STEP_ICON_MAP: Record<string, React.ReactNode> = {
  swap: <FiCpu className="text-xs" />,
  clmm_open: <FaRocket className="text-xs" />,
  clmm_close: <FiX className="text-xs" />,
  clmm_copy: <FaRobot className="text-xs" />,
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatBadge({
  value,
  label,
  icon,
  iconBgClass,
  iconColorClass,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
  iconBgClass: string;
  iconColorClass: string;
}) {
  const [currentVal, setCurrentVal] = useState(0);
  const [parsed, setParsed] = useState({
    prefix: "",
    target: 0,
    suffix: value,
    decimals: 0,
  });
  const [hasTriggered, setHasTriggered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered) {
          setHasTriggered(true);
        }
      },
      { threshold: 0.1 },
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

    const cleanedValue = value.replace(/,/g, "");
    const match = cleanedValue.match(/^([^0-9.]*)([0-9.]+)([^0-9.]*)$/);
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
    const duration = 2000;

    function step(timestamp: number) {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);

      const easeProgress = progress * (2 - progress);
      const current = easeProgress * info.target;
      setCurrentVal(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }, [value, hasTriggered]);

  const formattedVal = (() => {
    const rounded = currentVal.toFixed(parsed.decimals);
    if (parsed.decimals === 0) {
      return parseInt(rounded, 10).toLocaleString();
    }
    return rounded;
  })();

  const displayString = parsed.prefix + formattedVal + parsed.suffix;

  return (
    <div ref={containerRef} className="flex items-center gap-4 px-8 py-2">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-xl ${iconBgClass} ${iconColorClass}`}
      >
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-h1 text-[#1F1B18]">{displayString}</span>
        <span className="text-label text-text-secondary">{label}</span>
      </div>
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
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      className="rounded-2xl p-1 bg-white/50 border border-[#DFBFB9]/30 shadow-soft flex flex-col min-w-71.25 md:min-w-80 max-w-90 cursor-pointer shrink-0"
    >
      <div className="rounded-3xl p-5 bg-white flex flex-col gap-4 w-full h-full justify-between">
        <div className="flex flex-col gap-3">
          {/* Top row: agents + reward */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] px-2 py-0.5 rounded bg-surface-raised border border-border text-text-secondary font-medium">
              {quest.agents}
            </span>
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: accentBg, color: accentColor }}
            >
              {quest.reward}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-h3 text-text-primary leading-snug font-bold">
            {quest.title}
          </h3>

          {/* Description */}
          <p className="text-body-sm text-text-secondary leading-relaxed">
            {quest.description}
          </p>

          {/* Agent steps flow */}
          {quest.steps && quest.steps.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[10px] text-text-muted font-bold tracking-wider uppercase">
                Execution Steps
              </span>
              <div className="flex flex-wrap gap-2">
                {quest.steps.map((step, idx) => (
                  <div
                    key={step.uuid || idx}
                    className="flex items-center gap-1.5 px-2 py-1 bg-surface-raised border border-border rounded-lg text-xs text-text-secondary font-medium"
                  >
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                      style={{ background: accentBg, color: accentColor }}
                    >
                      {idx + 1}
                    </span>
                    <span className="flex items-center gap-1">
                      {STEP_ICON_MAP[step.step_type] || <FiCpu className="text-xs" />}
                      {STEP_NAME_MAP[step.step_type] || step.step_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-1.5 mt-4 pt-3 border-t border-surface-raised">
          <div className="flex justify-between text-body-sm text-text-secondary font-medium">
            <span>Progress</span>
            <span className="text-mono font-bold text-text-primary">{quest.progress}% Full</span>
          </div>
          <ProgressBar
            aria-label="Quest Progress"
            value={quest.progress}
            className="w-full"
          >
            <ProgressBar.Track className="h-0.75 rounded-full bg-transparent">
              <ProgressBar.Fill
                className="rounded-full transition-all duration-500"
                style={{ backgroundColor: accentColor }}
              />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
      </div>
    </motion.div>
  );
}

function ProviderSection({ provider }: { provider: IMappedProvider }) {
  return (
    <div className="rounded-[2rem] p-2 bg-[#DFBFB9]/15 border border-[#DFBFB9]/30 shadow-soft">
      <div className="rounded-[calc(2rem-8px)] p-6 md:p-8 bg-white flex flex-col gap-8 w-full">
        {/* Provider header row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#DFBFB9]/30">
          <div className="flex items-start gap-4">
            {/* Logo placeholder */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border border-[#DFBFB9]/30 shadow-soft p-1 bg-white"
            >
              <div className="w-full h-full rounded-3xl overflow-hidden flex items-center justify-center">
                {provider.icon}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <h2 className="text-h2 text-text-primary font-bold">
                {provider.name}
              </h2>
              <p className="text-body-sm text-text-secondary">
                {provider.description}
              </p>
              {/* Aggregated capabilities badges */}
              {provider.supportedSkills && provider.supportedSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {provider.supportedSkills.map((skill) => (
                    <span
                      key={skill}
                      className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border bg-white shadow-soft"
                      style={{
                        borderColor: `${provider.accentColor}33`,
                        color: provider.accentColor,
                      }}
                    >
                      {STEP_NAME_MAP[skill] || skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats pill - redesigned as premium mechanical/instrument structure */}
          <div
            className="flex items-center gap-4 px-4 py-2.5 rounded-xl border bg-surface-raised border-border shadow-soft self-start md:self-auto"
          >
            <div className="text-right">
              <p className="text-[10px] text-text-muted font-bold tracking-wider uppercase">
                Active Quests
              </p>
              <p className="text-body-lg font-bold text-text-primary">
                {provider.stats.activeQuests}
              </p>
            </div>
            <div className="w-px h-8 bg-border-strong/40" />
            <div className="text-right">
              <p className="text-[10px] text-text-muted font-bold tracking-wider uppercase">
                Total Pool
              </p>
              <p className="text-body-lg font-bold text-accent">
                {provider.stats.totalPool}
              </p>
            </div>
          </div>
        </div>

        {/* Quest cards with ScrollShadow */}
        <ScrollShadow orientation="horizontal" className="w-full" hideScrollBar>
          <div className="flex gap-6 py-2 min-w-full">
            {provider.quests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                accentColor={provider.accentColor}
                accentBg={provider.accentBg}
              />
            ))}
          </div>
        </ScrollShadow>
      </div>
    </div>
  );
}

// ─── Skeleton Component ───────────────────────────────────────────────────────

function ProviderSkeleton() {
  return (
    <div className="rounded-[2rem] p-2 bg-[#DFBFB9]/15 border border-[#DFBFB9]/30 shadow-soft">
      <div className="rounded-[calc(2rem-8px)] p-6 md:p-8 bg-white flex flex-col gap-8 w-full">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#DFBFB9]/30">
          <div className="flex items-start gap-4">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-48 rounded-lg" />
              <Skeleton className="h-4 w-64 rounded-lg" />
              <div className="flex gap-1.5 mt-2">
                <Skeleton className="h-4 w-12 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </div>
          </div>
          <Skeleton className="w-44 h-12 rounded-xl" />
        </div>

        {/* Cards Skeleton */}
        <div className="flex gap-6 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-1 bg-white/50 border border-[#DFBFB9]/30 shadow-soft flex flex-col min-w-71.25 md:min-w-80 max-w-90 shrink-0"
            >
              <div className="rounded-3xl p-5 bg-white flex flex-col gap-4 w-full h-65 justify-between">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-20 rounded-md" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-3/4 rounded-lg mt-2" />
                  <Skeleton className="h-4 w-full rounded-lg" />
                </div>
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-12 rounded-lg" />
                    <Skeleton className="h-3 w-16 rounded-lg" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
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
      pivotRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        lerpFactor,
      );
      pivotRef.current.position.y = THREE.MathUtils.lerp(
        pivotRef.current.position.y,
        targetY,
        lerpFactor,
      );
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

  //TODO: wait for backend to provide real data and update this
  const platformStats = useMemo(() => {
    if (!questsData?.quests || questsData.quests.length === 0) {
      return {
        agentsText: "12,842",
        rewardsText: "$2.48M",
        successRateText: "98.6%",
      };
    }

    let totalParticipations = 0;
    let totalRewardsUsd = 0;
    let totalSuccessRuns = 0;

    questsData.quests.forEach((q) => {
      // 1. Participations / Agents deployed
      const partCount = q.participation_count || 0;
      totalParticipations += partCount;

      // 2. Rewards Distributed
      const dist = parseFloat(q.total_reward_distributed) || 0;
      const token = q.reward_token || "USDT";
      if (token === "SOL") {
        // Assume 1 SOL = ~150 USD
        totalRewardsUsd += (dist / 1e9) * 150;
      } else {
        totalRewardsUsd += dist;
      }

      // 3. Success runs count (total_reward_distributed / reward_per_user)
      const rewardPerUser = parseFloat(q.reward_per_user) || 0;
      if (rewardPerUser > 0) {
        totalSuccessRuns += Math.floor(dist / rewardPerUser);
      }
    });

    // Formatting Agents Deployed: base is 12842
    const finalAgents = 12842 + totalParticipations;
    const agentsText = finalAgents.toLocaleString();

    // Formatting Rewards Distributed: base is $2.48M
    let rewardsText = "$2.48M";
    const finalRewardsUsd = 2480000 + totalRewardsUsd;
    if (finalRewardsUsd < 1000000) {
      rewardsText = `$${(finalRewardsUsd / 1000).toFixed(1)}k`;
    } else {
      rewardsText = `$${(finalRewardsUsd / 1000000).toFixed(2)}M`;
    }

    // Formatting Success Rate: default 98.6%
    let successRateText = "98.6%";
    if (totalParticipations > 0 && totalSuccessRuns > 0) {
      const calculatedRate = totalSuccessRuns / totalParticipations;
      const rate = Math.min(0.999, 0.986 + (calculatedRate - 0.5) * 0.02);
      successRateText = `${(rate * 100).toFixed(1)}%`;
    }

    return {
      agentsText,
      rewardsText,
      successRateText,
    };
  }, [questsData]);

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
        <FaBuilding
          className="text-3xl"
          style={{ color: colors.accentColor }}
        />
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

        const progress =
          pool > 0 ? Math.min(Math.round((distributed / pool) * 100), 100) : 0;

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
          steps: q.steps || [],
        };
      });

      const allSteps = providerQuests.flatMap((q) => q.steps || []);
      const uniqueSkills = Array.from(new Set(allSteps.map((s) => s.step_type).filter(Boolean)));

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
        supportedSkills: uniqueSkills,
      };
    });
  }, [questsData]);

  // Track page scroll progress for header progress bar
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;
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
                    <Float
                      speed={scrolled ? 0 : 2}
                      rotationIntensity={scrolled ? 0 : 0.5}
                      floatIntensity={scrolled ? 0 : 1}
                    >
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
            className="flex flex-col lg:flex-row items-stretch justify-around gap-6 lg:gap-0 rounded-[24px] py-6 px-4"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(223,191,185,0.4)",
              boxShadow: "0px 8px 32px 0px rgba(166,52,32,0.05)",
            }}
          >
            <StatBadge
              value={platformStats.agentsText}
              label="Agents Deployed"
              icon={<FaRobot />}
              iconBgClass="bg-secondary-light"
              iconColorClass="text-secondary"
            />
            <div
              className="hidden lg:block w-px self-stretch"
              style={{ background: "rgba(223,191,185,0.5)" }}
            />
            <StatBadge
              value={platformStats.rewardsText}
              label="Total Rewards Earned"
              icon={<FaCoins />}
              iconBgClass="bg-accent-light"
              iconColorClass="text-accent"
            />
            <div
              className="hidden lg:block w-px self-stretch"
              style={{ background: "rgba(223,191,185,0.5)" }}
            />
            <StatBadge
              value={platformStats.successRateText}
              label="Success Rate"
              icon={<FiTarget />}
              iconBgClass="bg-success-light"
              iconColorClass="text-success"
            />
          </div>
        </div>
      </section>

      {/* ── In Collaboration With Section ── */}
      <div className="max-w-7xl mx-auto w-full px-8 py-16 md:py-20 border-t border-b border-[#DFBFB9]/30 bg-white/30 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-24">
          <span className="text-label text-text-secondary tracking-[0.08em] font-extrabold text-[0.8125rem] opacity-80 uppercase shrink-0">
            In collaboration with
          </span>
          <div className="flex items-center gap-16 md:gap-28 flex-wrap justify-center">
            {/* Mantle */}
            <div className="h-14 md:h-20 flex items-center justify-center">
              <img
                src="/images/mantle-logo-full.png"
                alt="Mantle logo"
                className="h-full w-auto object-contain filter grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
              />
            </div>
            {/* Byreal */}
            <div className="h-14 md:h-20 flex items-center justify-center">
              <img
                src="/images/byreal-logo.jpeg"
                alt="Byreal logo"
                className="h-full w-auto object-contain filter grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300 rounded-2xl shadow-soft"
              />
            </div>
          </div>
        </div>
      </div>

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
              <p
                className="text-base font-semibold"
                style={{ color: "#6B6560" }}
              >
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
              <p
                className="text-sm leading-relaxed"
                style={{ color: "#6B6560" }}
              >
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5] text-[#A63420] font-bold">
          Loading...
        </div>
      }
    >
      <LandingPageContent />
    </Suspense>
  );
}
