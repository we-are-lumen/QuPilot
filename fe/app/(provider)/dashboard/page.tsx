"use client";

import React from "react";
import Link from "next/link";
import { Card, Chip, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { getProviderQuests } from "@/lib/api/quests";
import { formatReward } from "@/lib/utils/format";
import { 
  LuPlus, 
  LuActivity, 
  LuBot, 
  LuCircleCheck, 
  LuArrowRight, 
  LuSparkles,
  LuExternalLink
} from "react-icons/lu";
import { SOLANA_RPC_URL } from "@/config";

const truncateAddress = (addr?: string | null) => {
  if (!addr) return "-";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

export default function ProviderDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["providerQuests"],
    queryFn: getProviderQuests,
  });

  // Handle Loading State with Skeletons Exclusively
  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-2 w-full sm:w-1/3">
            <Skeleton className="h-9 w-48 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-[#ffffffb2] border border-white/80 rounded-xl p-5 shadow-sm backdrop-blur-md">
              <Card.Content className="flex flex-row items-center gap-4 p-0">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-6 w-12 rounded" />
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>

        {/* Hosted Quests Title Skeleton */}
        <div className="flex flex-col gap-1 border-b border-[#fdba744d] pb-2">
          <Skeleton className="h-7 w-32 rounded" />
        </div>

        {/* Quests List Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="bg-white border border-[#fdba744d] rounded-xl overflow-hidden shadow-sm">
              <Skeleton className="h-40 w-full" />
              <Card.Content className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-6 w-2/3 rounded" />
                  <Skeleton className="h-5 w-16 rounded" />
                </div>
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-5/6 rounded" />
                
                {/* Metric row skeleton */}
                <div className="border border-[#fdba744d] rounded-lg p-3 grid grid-cols-3 gap-2">
                  <Skeleton className="h-10 w-full rounded" />
                  <Skeleton className="h-10 w-full rounded" />
                  <Skeleton className="h-10 w-full rounded" />
                </div>

                <Skeleton className="h-9 w-full rounded-full" />
              </Card.Content>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Handle Error State
  if (isError) {
    return (
      <div className="flex flex-col gap-6 items-center justify-center min-h-100">
        <div className="text-center flex flex-col gap-3 max-w-md">
          <h2 className="text-xl font-bold text-[#1f1b18]">Failed to load dashboard</h2>
          <p className="text-sm text-[#6b6560]">
            We encountered an issue fetching your quests. Please make sure your wallet is connected as a provider and try again.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 bg-[#f97316] hover:bg-[#f97316]/90 text-white font-bold text-xs rounded-full px-6 py-3.5 shadow-sm inline-flex items-center gap-1.5 justify-center transition-all self-center"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const quests = data?.quests || [];

  // Handle Empty State
  if (quests.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold text-[#1f1b18] tracking-tight font-sans">
              Provider Dashboard
            </h1>
            <p className="text-sm text-[#6b6560]">
              Manage your active quests and monitor fleet performance.
            </p>
          </div>
          <Link
            href="/quests/new"
            className="bg-[#f97316] hover:bg-[#f97316]/90 text-white font-bold text-xs rounded-full px-6 py-3.5 shadow-sm inline-flex items-center gap-1.5 justify-center transition-all text-center"
          >
            <LuPlus className="text-sm" />
            Register New Quest
          </Link>
        </div>

        {/* Empty State Card */}
        <Card className="bg-white border border-[#fdba744d] rounded-2xl p-12 text-center shadow-sm">
          <Card.Content className="flex flex-col items-center gap-4 mx-auto p-0">
            <div className="w-16 h-16 rounded-full bg-[#ffffff] border border-[#fdba744d] flex items-center justify-center text-[#f97316] mb-2">
              <LuSparkles className="text-2xl animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-[#1f1b18]">No Quests Registered Yet</h3>
            <p className="text-xs text-[#6b6560] leading-relaxed">
              Create your first quest to deploy AI agents, automate transactions, and reward your users with custom token distributions.
            </p>
            <Link
              href="/quests/new"
              className="mt-2 bg-[#f97316] hover:bg-[#f97316]/90 text-white font-bold text-xs rounded-full px-6 py-2.5 shadow-sm inline-flex items-center gap-1.5 justify-center transition-all text-center"
            >
              <LuPlus className="text-xs" />
              Create Your First Quest
            </Link>
          </Card.Content>
        </Card>
      </div>
    );
  }

  // Calculate stats dynamically
  const activeQuests = quests.filter(
    (q) => new Date(q.expires_at) > new Date()
  );
  
  const totalAgents = quests.reduce(
    (acc, q) => acc + q.participation_count, 
    0
  );

  let totalSuccesses = 0;
  quests.forEach((q) => {
    try {
      const perUser = BigInt(q.reward_per_user);
      const distributed = BigInt(q.total_reward_distributed);
      if (perUser > BigInt(0)) {
        totalSuccesses += Number(distributed / perUser);
      }
    } catch (e) {
      console.error("Error computing successes", e);
    }
  });

  const avgCompletionRate = totalAgents > 0 
    ? (totalSuccesses / totalAgents) * 100 
    : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Provider Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-[#1f1b18] tracking-tight font-sans">
            Provider Dashboard
          </h1>
          <p className="text-sm text-[#6b6560]">
            Manage your active quests and monitor fleet performance.
          </p>
        </div>
        <Link
          href="/quests/new"
          className="bg-[#f97316] hover:bg-[#f97316]/90 text-white font-bold text-xs rounded-full px-6 py-3.5 shadow-sm inline-flex items-center gap-1.5 justify-center transition-all text-center"
        >
          <LuPlus className="text-sm" />
          Register New Quest
        </Link>
      </div>

      {/* Dashboard Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stat 1: Active Quests */}
        <Card className="bg-[#ffffffb2] border border-white/80 rounded-xl p-5 shadow-sm backdrop-blur-md">
          <Card.Content className="flex flex-row items-center gap-4 p-0">
            <div className="w-12 h-12 rounded-full bg-[#c2410c33] flex items-center justify-center text-[#f97316]">
              <LuActivity className="text-xl" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#6b6560] font-bold tracking-wider uppercase">
                Active Quests
              </span>
              <span className="text-2xl font-extrabold text-[#1f1b18]">
                {activeQuests.length}
              </span>
            </div>
          </Card.Content>
        </Card>

        {/* Stat 2: Total Agents Deployed */}
        <Card className="bg-[#ffffffb2] border border-white/80 rounded-xl p-5 shadow-sm backdrop-blur-md">
          <Card.Content className="flex flex-row items-center gap-4 p-0">
            <div className="w-12 h-12 rounded-full bg-[#ea580c33] flex items-center justify-center text-[#f97316]">
              <LuBot className="text-xl" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#6b6560] font-bold tracking-wider uppercase">
                Total Agents Deployed
              </span>
              <span className="text-2xl font-extrabold text-[#1f1b18]">
                {totalAgents.toLocaleString()}
              </span>
            </div>
          </Card.Content>
        </Card>

        {/* Stat 3: Avg Completion Rate */}
        <Card className="bg-[#ffffffb2] border border-white/80 rounded-xl p-5 shadow-sm backdrop-blur-md">
          <Card.Content className="flex flex-row items-center gap-4 p-0">
            <div className="w-12 h-12 rounded-full bg-[#10b98133] flex items-center justify-center text-[#10b981]">
              <LuCircleCheck className="text-xl" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#6b6560] font-bold tracking-wider uppercase">
                Avg Completion Rate
              </span>
              <span className="text-2xl font-extrabold text-[#1f1b18]">
                {avgCompletionRate.toFixed(1)}%
              </span>
            </div>
          </Card.Content>
        </Card>
      </div>

      {/* Hosted Quests Title */}
      <div className="flex flex-col gap-1 border-b border-[#fdba744d] pb-2">
        <h2 className="text-xl font-bold text-[#1f1b18]">Hosted Quests</h2>
      </div>

      {/* Quest Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {quests.map((quest) => {
          const perUser = BigInt(quest.reward_per_user);
          const distributed = BigInt(quest.total_reward_distributed);
          const successes = perUser > BigInt(0) ? Number(distributed / perUser) : 0;
          const completionRate = quest.participation_count > 0 
            ? (successes / quest.participation_count) * 100 
            : 0;

          const isActive = new Date(quest.expires_at) > new Date();

          return (
            <Card key={quest.uuid} className="bg-white border border-[#fdba744d] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Quest Details */}
              <Card.Content className="p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-[#1f1b18] hover:text-[#f97316] transition-colors leading-snug">
                        <Link href={`/quests/manage/${quest.uuid}`}>{quest.title}</Link>
                      </h3>
                      <Chip 
                        size="sm"
                        className={`${
                          isActive 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-stone-50 text-stone-600 border-stone-200"
                        } font-bold border px-2 py-0.5 shrink-0 flex items-center gap-1.5`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'} inline-block`} />
                        <Chip.Label>{isActive ? "Active" : "Expired"}</Chip.Label>
                      </Chip>
                    </div>
                  </div>
                  <Chip size="sm" className="bg-[#fff7ed] text-[#f97316] border-[#f97316]/20 border font-bold px-2 py-0.5 capitalize shrink-0">
                    {quest.protocol}
                  </Chip>
                </div>

                <p className="text-xs text-[#6b6560] leading-relaxed line-clamp-2">
                  {quest.description}
                </p>

                <div className="bg-[#fcfbfa] border border-[#fdba744d] rounded-lg p-3 flex items-center justify-between">
                  <span className="text-[10px] text-[#6b6560] uppercase tracking-wider font-bold">Pool PDA</span>
                  <a
                    href={`https://solscan.io/account/${quest.quest_pool_pda}${SOLANA_RPC_URL.includes("devnet") ? "?cluster=devnet" : ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono font-bold text-[#f97316] hover:underline flex items-center gap-1"
                  >
                    {truncateAddress(quest.quest_pool_pda)}
                    <LuExternalLink className="text-[10px] shrink-0" />
                  </a>
                </div>

                {/* Metrics Row */}
                <div className="bg-[#ffffff] border border-[#fdba744d] rounded-lg p-3 flex items-center justify-between">
                  {/* Metric 1: Agents */}
                  <div className="flex flex-col items-center flex-1 text-center">
                    <span className="text-[10px] text-[#6b6560] uppercase tracking-wider">Agents</span>
                    <span className="text-sm font-bold text-[#1f1b18] font-mono mt-0.5">
                      {quest.participation_count.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="w-px h-8 bg-[#fdba744d]" />

                  {/* Metric 2: Completion */}
                  <div className="flex flex-col items-center flex-1 text-center">
                    <span className="text-[10px] text-[#6b6560] uppercase tracking-wider">Completion</span>
                    <span className={`text-sm font-bold ${
                      completionRate >= 80 
                        ? 'text-[#10b981]' 
                        : completionRate >= 50 
                        ? 'text-[#f59e0b]' 
                        : 'text-[#ef4444]'
                    } font-mono mt-0.5`}>
                      {completionRate.toFixed(0)}%
                    </span>
                  </div>

                  <div className="w-px h-8 bg-[#fdba744d]" />

                  {/* Metric 3: Reward Pool */}
                  <div className="flex flex-col items-center flex-1 text-center">
                    <span className="text-[10px] text-[#6b6560] uppercase tracking-wider">Per User</span>
                    <span className="text-sm font-bold text-[#f97316] font-mono mt-0.5">
                      {formatReward(quest.reward_per_user).split(" ")[0]}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/quests/manage/${quest.uuid}`}
                  className="w-full border border-[#f97316] text-[#f97316] hover:bg-[#fff7ed] font-bold rounded-full py-2.5 text-xs transition-colors inline-flex items-center justify-center gap-1.5 text-center"
                >
                  View Analytics
                  <LuArrowRight className="text-sm" />
                </Link>
              </Card.Content>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
