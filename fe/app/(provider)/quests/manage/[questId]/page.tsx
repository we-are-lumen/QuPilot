"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Chip, Avatar, ProgressBar, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { getProviderQuestDetail } from "@/lib/api/quests";
import { formatReward } from "@/lib/utils/format";
import { 
  FiArrowLeft, 
  FiBookOpen, 
  FiCpu, 
  FiTrendingUp, 
  FiTerminal, 
  FiActivity, 
  FiCheckCircle, 
  FiAlertTriangle, 
  FiLock, 
  FiCopy,
  FiClock
} from "react-icons/fi";

export default function ProviderQuestDetailPage() {
  const { questId } = useParams();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["providerQuest", questId],
    queryFn: () => getProviderQuestDetail(questId as string),
    enabled: !!questId,
  });

  // Handle Loading State with Skeletons
  if (isLoading) {
    return (
      <div className="flex flex-col gap-8 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/dashboard"
            className="text-body-sm text-text-secondary hover:text-primary transition-all flex items-center gap-2 font-bold font-heading"
          >
            <FiArrowLeft className="text-sm shrink-0" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* Hero Skeleton */}
        <div className="bg-surface border-2 border-surface-variant rounded-xl p-6 md:p-8 flex flex-col lg:flex-row gap-8 items-center relative overflow-hidden shadow-soft">
          <Skeleton className="w-full lg:w-97.75 h-65 lg:h-97.75 rounded-lg shrink-0" />
          <div className="flex-1 flex flex-col gap-4 w-full">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-10 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <div className="w-full border-t border-surface-variant pt-6 mt-2 flex flex-col sm:flex-row gap-6">
              <div className="flex flex-col gap-2 flex-1">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-6 w-32 rounded" />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-6 w-32 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Bento Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-8">
            <Card className="p-6 flex flex-col gap-4">
              <Skeleton className="h-7 w-48 rounded" />
              <div className="flex flex-col gap-2 mt-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-5/6 rounded" />
              </div>
            </Card>
            <Card className="p-6 flex flex-col gap-4">
              <Skeleton className="h-7 w-48 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            </Card>
          </div>
          <div className="flex flex-col gap-8">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Card className="p-6 flex flex-col gap-6">
              <Skeleton className="h-7 w-48 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Handle Error State
  if (isError || !data) {
    return (
      <div className="flex flex-col gap-6 items-center justify-center min-h-[60vh] max-w-7xl mx-auto px-4">
        <div className="text-center flex flex-col gap-3 max-w-md bg-surface border border-surface-variant p-8 rounded-2xl shadow-soft">
          <div className="w-16 h-16 rounded-full bg-[#fdf2f2] flex items-center justify-center text-danger mx-auto mb-2">
            <FiAlertTriangle className="text-2xl" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">Failed to load quest details</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            We encountered an issue fetching this quest's analytical data. Make sure you are authenticated and have permission to manage this quest.
          </p>
          <div className="flex gap-4 justify-center mt-4">
            <Link
              href="/dashboard"
              className="border border-outline-variant hover:bg-surface-raised font-bold text-xs rounded-full px-6 py-3 shadow-sm transition-all"
            >
              Back to Dashboard
            </Link>
            <button 
              onClick={() => refetch()}
              className="bg-[#a63420] hover:bg-[#a63420]/90 text-white font-bold text-xs rounded-full px-6 py-3 shadow-sm transition-all"
            >
              Retry Fetch
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { quest, analytics } = data;
  const isActive = new Date(quest.expires_at) > new Date();

  // Dynamic Cosmic Gradients based on Protocol
  let gradient = "from-[#0d091a] via-[#1c133a] to-[#301c63]"; // Sui/default
  if (quest.protocol === "byreal") {
    gradient = "from-[#1a0c08] via-[#3a130c] to-[#631c0f]";
  } else if (quest.protocol === "bybit") {
    gradient = "from-[#0a1820] via-[#0d2a3a] to-[#12425c]";
  }

  return (
    <div className="flex flex-col gap-8 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Back Navigation */}
      <div>
        <Link
          href="/dashboard"
          className="text-body-sm text-text-secondary hover:text-primary transition-all flex items-center gap-2 font-bold font-heading"
        >
          <FiArrowLeft className="text-sm shrink-0" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Quest Header Hero */}
      <div className="bg-surface border-2 border-surface-variant rounded-xl p-6 md:p-8 flex flex-col lg:flex-row gap-8 items-center relative overflow-hidden shadow-soft">
        {/* Decorative Blob */}
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-[#ffdad3] rounded-full blur-3xl opacity-60 pointer-events-none" />

        {/* Nebula Illustration */}
        <div className="relative w-full lg:w-97.75 h-65 lg:h-97.75 rounded-lg bg-[#f5ddd9] shrink-0 overflow-hidden flex items-center justify-center border border-outline-variant shadow-inner">
          <div className={`absolute inset-0 bg-linear-to-tr ${gradient} animate-pulse opacity-85`} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-white/10 via-transparent to-black/30" />
          {/* Star dust effect */}
          <div className="absolute w-2 h-2 rounded-full bg-white top-12 left-16 animate-ping duration-1000" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-white bottom-20 right-24 animate-ping duration-700" />
          <div className="absolute w-1 h-1 rounded-full bg-white top-32 right-12 animate-pulse" />
          <div className="absolute w-2 h-2 rounded-full bg-yellow-200 bottom-12 left-32 animate-pulse" />

          <span className="text-display text-white drop-shadow-lg text-center select-none font-extrabold z-10 px-4">
            {quest.uuid.slice(0, 8).toUpperCase()}
          </span>

          {/* Overlay Status Badge */}
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm border border-surface-variant rounded-full py-1.5 px-3.5 flex items-center gap-2 shadow-soft">
            <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-success animate-pulse' : 'bg-text-muted'}`} />
            <span className={`text-xs font-sans font-bold ${isActive ? 'text-success' : 'text-text-muted'} capitalize`}>
              {isActive ? "Active" : "Expired"}
            </span>
          </div>
        </div>

        {/* Content Info */}
        <div className="flex-1 flex flex-col gap-4 z-10 w-full">
          <div className="flex flex-wrap gap-2">
            <Chip variant="soft" className="bg-secondary-fixed text-on-secondary-fixed font-bold border border-secondary-container/20 capitalize">
              <Chip.Label>{quest.protocol}</Chip.Label>
            </Chip>
            <Chip variant="soft" className="bg-surface-raised text-text-secondary font-bold border border-border capitalize">
              <Chip.Label>{quest.steps?.[0]?.step_type}</Chip.Label>
            </Chip>
            <Chip variant="soft" className="bg-surface-raised text-text-secondary font-bold border border-border flex items-center gap-1.5">
              <FiClock className="text-xs shrink-0" />
              <Chip.Label>Expires {new Date(quest.expires_at).toLocaleDateString()}</Chip.Label>
            </Chip>
          </div>

          <h1 className="text-h1 text-text-primary font-extrabold leading-tight mt-1">
            {quest.title}
          </h1>
          <p className="text-body-lg text-text-secondary">
            {quest.description}
          </p>

          {/* Separator and Pool Info */}
          <div className="w-full border-t border-surface-variant pt-6 mt-2 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {/* Reward Pool */}
            <div className="flex flex-col gap-1">
              <span className="text-label text-text-muted font-bold tracking-wider">TOTAL REWARD POOL</span>
              <div className="flex items-center gap-2 text-[#a63420] font-heading font-bold text-[17px]">
                <FiTrendingUp className="text-lg" />
                <span>{formatReward(quest.total_reward_pool)}</span>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="hidden sm:block h-10 w-px bg-surface-variant" />

            {/* Reward Per User */}
            <div className="flex flex-col gap-1">
              <span className="text-label text-text-muted font-bold tracking-wider">REWARD PER PILOT</span>
              <div className="flex items-center gap-2 text-text-primary font-heading font-bold text-[17px]">
                <span>{formatReward(quest.reward_per_user)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid Layout for Details & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Details & Technical Info (takes 2 cols on lg) */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Description Card */}
          <Card className="bg-surface border border-surface-variant shadow-soft p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2.5 text-text-primary border-b border-surface-variant pb-3">
              <FiBookOpen className="text-secondary text-lg" />
              <h2 className="text-h3 font-bold font-heading">Mission Briefing</h2>
            </div>
            <Card.Content className="flex flex-col gap-4 p-0">
              <p className="text-body-md text-text-secondary leading-relaxed">
                {quest.description}
              </p>
              
              <div className="flex flex-col gap-3 mt-2">
                <span className="text-body-md font-bold text-text-primary font-heading flex items-center gap-2">
                  <FiTerminal className="text-primary text-sm" />
                  <span>Agent Configuration Details</span>
                </span>
                <div className="bg-surface-raised border border-outline-variant rounded-lg p-4 font-mono text-xs text-text-secondary overflow-x-auto shadow-inner max-h-60">
                  <pre>{JSON.stringify(quest.steps, null, 2)}</pre>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Parameters Card */}
          <Card className="bg-[#f8f4ef] border border-outline-variant shadow-soft p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2.5 text-text-primary border-b border-outline-variant pb-3">
              <FiCpu className="text-primary text-lg" />
              <h2 className="text-h3 font-bold font-heading">Technical Parameters</h2>
            </div>
            <Card.Content className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-0">
              {/* Reward Token Contract */}
              <div className="bg-surface border border-outline-variant rounded-lg p-4 flex flex-col gap-1.5 shadow-sm">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Reward Token Contract</span>
                <div className="flex items-center justify-between text-text-primary font-mono text-[13px] font-bold">
                  <div className="flex items-center gap-2">
                    <FiLock className="text-primary" />
                    <span>{quest.reward_token.slice(0, 6)}...{quest.reward_token.slice(-4)}</span>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(quest.reward_token);
                      alert("Reward token address copied!");
                    }} 
                    className="text-text-muted hover:text-primary transition-colors p-1"
                  >
                    <FiCopy />
                  </button>
                </div>
              </div>

              {/* Transaction Hash */}
              {quest.tx_hash && (
                <div className="bg-surface border border-outline-variant rounded-lg p-4 flex flex-col gap-1.5 shadow-sm">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Creation Transaction</span>
                  <div className="flex items-center justify-between text-text-primary font-mono text-[13px] font-bold">
                    <div className="flex items-center gap-2">
                      <FiActivity className="text-secondary" />
                      <span>{quest.tx_hash.slice(0, 6)}...{quest.tx_hash.slice(-4)}</span>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(quest.tx_hash || "");
                        alert("Transaction hash copied!");
                      }} 
                      className="text-text-muted hover:text-primary transition-colors p-1"
                    >
                      <FiCopy />
                    </button>
                  </div>
                </div>
              )}
            </Card.Content>
          </Card>

        </div>

        {/* Right Column: Stats (takes 1 col on lg) */}
        <div className="flex flex-col gap-8">
          
          {/* Total Agents Badge (Red/Coral Card) */}
          <div className="bg-[#c84b35] rounded-xl p-6 text-white flex flex-col gap-2 relative overflow-hidden shadow-medium select-none border border-outline-variant">
            <div className="absolute right-[-20px] bottom-[-20px] w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <span className="text-label text-white/80 font-bold tracking-wider">TOTAL AGENTS DEPLOYED</span>
            <div className="flex items-baseline gap-2.5 mt-1">
              <span className="text-display text-white font-extrabold leading-none">
                {analytics.total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Completion Stats Card */}
          <Card className="bg-surface border border-surface-variant shadow-soft p-6 flex flex-col gap-6">
            <div className="flex items-center gap-2.5 text-text-primary border-b border-surface-variant pb-3">
              <FiActivity className="text-accent text-lg" />
              <h3 className="text-h3 font-bold font-heading">Completion Stats</h3>
            </div>
            <Card.Content className="flex flex-col gap-5 p-0">
              
              {/* Progress Bar */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-body-sm font-bold font-heading">
                  <span className="text-text-secondary">Success Rate</span>
                  <span className="text-text-primary">{(analytics.success_rate * 100).toFixed(1)}% Complete</span>
                </div>
                <ProgressBar aria-label="Quest Completion Stats" value={analytics.success_rate * 100} className="w-full">
                  <ProgressBar.Track className="bg-[#ffe9e5] h-3.5 rounded-full overflow-hidden border border-[#f5ddd9]">
                    <ProgressBar.Fill className="bg-accent rounded-full h-full" style={{ width: `${analytics.success_rate * 100}%` }} />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-raised border border-surface-variant rounded-lg p-4 text-center shadow-sm">
                  <span className="text-success font-extrabold text-h2 font-heading leading-tight block">
                    {analytics.success}
                  </span>
                  <span className="text-xs font-bold text-text-secondary font-sans tracking-wide uppercase mt-1 block">
                    Success
                  </span>
                </div>
                <div className="bg-surface-raised border border-surface-variant rounded-lg p-4 text-center shadow-sm">
                  <span className="text-danger font-extrabold text-h2 font-heading leading-tight block">
                    {analytics.failed}
                  </span>
                  <span className="text-xs font-bold text-text-secondary font-sans tracking-wide uppercase mt-1 block">
                    Failed
                  </span>
                </div>
              </div>
            </Card.Content>
          </Card>

        </div>
      </div>
    </div>
  );
}
