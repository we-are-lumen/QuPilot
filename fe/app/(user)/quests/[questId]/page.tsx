"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Button, Spinner } from "@heroui/react";
import {
  FiArrowLeft,
  FiCopy,
  FiCheck,
  FiBookOpen,
  FiCpu,
  FiAward,
  FiClock,
  FiExternalLink,
  FiRepeat,
  FiPlusCircle,
  FiMinusCircle,
  FiTerminal,
} from "react-icons/fi";
import { SOLANA_RPC_URL } from "@/config";
import { FaCoins } from "react-icons/fa6";
import { useQuery } from "@tanstack/react-query";
import { getPublicQuestDetail } from "@/lib/api/quests";

const formatReward = (rewardStr?: string) => {
  if (!rewardStr) return "0 SOL";
  try {
    const lamports = BigInt(rewardStr);
    const parsed = Number(lamports) / 1e9;
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }).format(parsed) + " SOL"
    );
  } catch {
    return rewardStr || "0 SOL";
  }
};

function TokenPill({ symbol, logoUri, mint }: { symbol?: string; logoUri?: string; mint?: string }) {
  const [imgError, setImgError] = useState(false);
  const truncatedMint = mint && mint.length > 12 ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : mint;
  const label = symbol ?? truncatedMint ?? "?";
  const showMintSubtitle = !!symbol && !!truncatedMint;
  return (
    <div className="flex items-center gap-2.5 bg-white border border-[#e8e0d8] rounded-xl px-3 py-2.5 min-w-0 flex-1">
      {logoUri && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUri}
          alt={label}
          className="w-8 h-8 rounded-full object-cover shrink-0 bg-[#f8f4ef]"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[#c84b351a] flex items-center justify-center shrink-0 text-[#a63420] font-extrabold text-sm select-none">
          {label.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-[13px] font-bold text-[#1f1b18] leading-tight">{label}</span>
        {showMintSubtitle && (
          <span className="font-mono text-[10px] text-[#6b6560] truncate">{truncatedMint}</span>
        )}
      </div>
    </div>
  );
}

export default function UserQuestDetailPage() {
  const { questId } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-quest-detail", questId],
    queryFn: () => getPublicQuestDetail(questId as string),
    enabled: !!questId,
  });

  const [copiedId, setCopiedId] = useState(false);

  const quest = data?.quest;

  const handleCopyId = () => {
    if (!quest) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(quest.uuid);
      }
    } catch (err) {
      console.warn(
        "Clipboard copy failed, state will still update visually",
        err,
      );
    }
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Spinner color="danger" size="lg" />
        <p className="text-sm text-[#6b6560] font-medium">
          Loading quest details...
        </p>
      </div>
    );
  }

  if (error || !quest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 bg-[#fff5f5] border border-[#ffc1c1] rounded-2xl mx-auto my-10 p-10">
        <p className="text-lg font-bold text-[#e53e3e]">Failed to load quest</p>
        <p className="text-sm text-[#6b6560]">
          We encountered an error while retrieving the quest details. Please
          verify the Quest ID or try again later.
        </p>
        <Link
          href="/quests"
          className="text-body-sm text-[#a63420] hover:underline flex items-center gap-1.5 font-bold uppercase tracking-wider mt-4"
        >
          <FiArrowLeft className="w-4 h-4" /> Back to Quests
        </Link>
      </div>
    );
  }

  const briefingParagraphs = quest.description
    ? quest.description.split("\n").filter((p) => p.trim() !== "")
    : [];

  const formattedExpiresAt = quest.expires_at
    ? new Date(quest.expires_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }) +
      " at " +
      new Date(quest.expires_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto px-4 py-6">
      {/* 1. Back Navigation & Title Header */}
      <div className="flex flex-col gap-4 w-full">
        <div>
          <Link
            href="/quests"
            className="text-body-sm text-[#6b6560] hover:text-[#a63420] transition-colors flex items-center gap-1.5 font-bold uppercase tracking-wider"
          >
            <FiArrowLeft className="w-4 h-4" /> Back to Quests
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          <div className="flex flex-col gap-2 grow">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-label font-bold bg-[#c84b351a] text-[#a63420] capitalize">
                {quest.protocol} Protocol
              </span>
              <span className="px-3 py-1 rounded-full text-label font-bold bg-[#fbe3df] text-[#6b6560] flex items-center gap-1.5">
                <FiCpu className="w-3.5 h-3.5 text-[#6b6560]" />
                {quest.participation_count} Agents Active
              </span>
            </div>
            <h1 className="text-display text-[#1f1b18] tracking-tight mt-1">
              {quest.title}
            </h1>
            <p className="text-body-md text-[#6b6560] leading-relaxed mt-1">
              Review the quest details, requirements, and rewards below.
            </p>
          </div>

          {/* Quest ID Pill Header */}
          {quest.quest_pool_pda ? (
            <div className="flex items-center gap-2 bg-white border border-[#f8f4ef] rounded-full px-4 py-2 self-start md:self-auto shadow-soft">
              <span className="text-xs text-[#6b6560] font-bold uppercase tracking-wider select-none mr-1">
                Pool PDA:
              </span>
              <a
                href={`https://solscan.io/account/${quest.quest_pool_pda}${SOLANA_RPC_URL.includes("devnet") ? "?cluster=devnet" : ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-mono text-[#a63420] hover:underline font-bold flex items-center gap-1.5"
              >
                <span className="tracking-wide text-xs">
                  {quest.quest_pool_pda.slice(0, 6)}...{quest.quest_pool_pda.slice(-4)}
                </span>
                <FiExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white border border-[#f8f4ef] rounded-full px-4 py-2 self-start md:self-auto shadow-soft">
              <span className="text-mono text-[#6b6560] tracking-wide font-medium">
                {quest.uuid}
              </span>
              <Button
                isIconOnly
                onPress={handleCopyId}
                variant="tertiary"
                className="w-8 h-8 rounded-full bg-[#f8f4ef] hover:bg-[#fbe3df] transition-all flex items-center justify-center p-0"
                aria-label="Copy Quest ID"
              >
                {copiedId ? (
                  <FiCheck className="w-4 h-4 text-[#10B981]" />
                ) : (
                  <FiCopy className="w-4 h-4 text-[#a63420]" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
        {/* Left Column: Briefing & Technical Parameters */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* Mission Briefing Card */}
          <Card className="bg-white border border-[#f8f4ef] rounded-xl p-8 shadow-soft">
            <Card.Header className="flex items-center gap-2.5 p-0 mb-6 border-b border-[#f8f4ef] pb-4">
              <FiBookOpen className="w-6 h-6 text-[#a63420]" />
              <Card.Title className="text-h2 text-[#1f1b18] font-bold">
                Mission Briefing
              </Card.Title>
            </Card.Header>
            <Card.Content className="p-0 flex flex-col gap-4">
              {briefingParagraphs.length > 0 ? (
                briefingParagraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-body-lg font-medium text-[#6b6560] leading-relaxed"
                  >
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="text-body-lg font-medium text-[#6b6560] leading-relaxed italic">
                  No briefing available for this mission.
                </p>
              )}
            </Card.Content>
          </Card>

          {/* Agent Configuration Details Card */}
          <Card className="bg-white border border-[#f8f4ef] rounded-xl p-8 shadow-soft">
            <Card.Header className="flex items-center gap-2.5 p-0 mb-6 border-b border-[#f8f4ef] pb-4">
              <FiCpu className="w-6 h-6 text-[#a63420]" />
              <Card.Title className="text-h2 text-[#1f1b18] font-bold">
                Agent Configuration Details
              </Card.Title>
            </Card.Header>
            <Card.Content className="p-0">
              {quest.steps && quest.steps.length > 0 ? (
                <div className="flex flex-col">
                  {[...quest.steps]
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((step, i, arr) => {
                      const stepMeta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
                        swap:       { label: "Swap",       icon: <FiRepeat />,      color: "text-violet-600 bg-violet-50 border-violet-200" },
                        clmm_open:  { label: "CLMM Open",  icon: <FiPlusCircle />,  color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                        clmm_close: { label: "CLMM Close", icon: <FiMinusCircle />, color: "text-rose-700 bg-rose-50 border-rose-200" },
                        clmm_copy:  { label: "CLMM Copy",  icon: <FiCopy />,        color: "text-sky-700 bg-sky-50 border-sky-200" },
                      };
                      const meta = stepMeta[step.step_type] ?? { label: step.step_type, icon: <FiTerminal />, color: "text-[#6b6560] bg-[#f8f4ef] border-[#e8e0d8]" };
                      const isLast = i === arr.length - 1;
                      return (
                        <div key={step.uuid} className="flex gap-3">
                          {/* Rail */}
                          <div className="flex flex-col items-center">
                            <div className="w-7 h-7 rounded-full bg-[#f8f4ef] border-2 border-[#a63420] flex items-center justify-center shrink-0 z-10">
                              <span className="text-[#a63420] text-[10px] font-extrabold">{step.order_index + 1}</span>
                            </div>
                            {!isLast && <div className="w-px flex-1 bg-[#e8e0d8] my-1 min-h-5" />}
                          </div>
                          {/* Content */}
                          <div className={`flex flex-col gap-2 ${isLast ? "pb-0" : "pb-5"} min-w-0 flex-1`}>
                            <div className={`inline-flex items-center gap-1.5 self-start text-[11px] font-bold border rounded-full px-2.5 py-0.5 ${meta.color}`}>
                              {meta.icon}
                              <span className="uppercase tracking-wide">{meta.label}</span>
                            </div>
                            {Object.keys(step.action_params).length > 0 && (() => {
                              const p = step.action_params;
                              const CLMM_TOKEN_KEYS = new Set(["token0_mint","token0_symbol","token0_logo_uri","token1_mint","token1_symbol","token1_logo_uri"]);

                              if (step.step_type === "swap" && (p.from_token_symbol || p.to_token_symbol)) {
                                return (
                                  <div className="bg-[#f8f4ef] border border-[#e8e0d8] rounded-lg p-3 flex items-center gap-2">
                                    <TokenPill symbol={p.from_token_symbol} logoUri={p.from_logo_uri} mint={p.from_token} />
                                    <FiRepeat className="text-[#a63420] text-lg shrink-0" />
                                    <TokenPill symbol={p.to_token_symbol} logoUri={p.to_logo_uri} mint={p.to_token} />
                                  </div>
                                );
                              }

                              if ((step.step_type === "clmm_open" || step.step_type === "clmm_close" || step.step_type === "clmm_copy") && (p.token0_mint || p.token1_mint)) {
                                const remainingEntries = Object.entries(p)
                                  .filter(([key, val]) => !CLMM_TOKEN_KEYS.has(key) && val !== "")
                                  .sort(([a], [b]) => a.localeCompare(b));
                                return (
                                  <div className="flex flex-col gap-2">
                                    <div className="bg-[#f8f4ef] border border-[#e8e0d8] rounded-lg p-3 flex items-center gap-2">
                                      <TokenPill symbol={p.token0_symbol} logoUri={p.token0_logo_uri} mint={p.token0_mint} />
                                      {step.step_type === "clmm_open"
                                        ? <FiPlusCircle className="text-emerald-600 text-lg shrink-0" />
                                        : step.step_type === "clmm_close"
                                        ? <FiMinusCircle className="text-rose-600 text-lg shrink-0" />
                                        : <FiCopy className="text-sky-600 text-lg shrink-0" />}
                                      <TokenPill symbol={p.token1_symbol} logoUri={p.token1_logo_uri} mint={p.token1_mint} />
                                    </div>
                                    {remainingEntries.length > 0 && (
                                      <div className="bg-[#f8f4ef] border border-[#e8e0d8] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                                        {remainingEntries.map(([key, val]) => (
                                          <div key={key} className="flex items-baseline gap-2 min-w-0">
                                            <span className="text-[10px] font-bold text-[#6b6560] uppercase tracking-wider shrink-0">{key}</span>
                                            <span className="font-mono text-[11px] text-[#1f1b18] truncate">{String(val)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              const filteredEntries = Object.entries(p)
                                .filter(([key]) => !/_logo_uri$/.test(key))
                                .sort(([a], [b]) => a.localeCompare(b));
                              return (
                                <div className="bg-[#f8f4ef] border border-[#e8e0d8] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                                  {filteredEntries.map(([key, val]) => {
                                    const logoKey = key.replace(/_symbol$/, "_logo_uri");
                                    const logoUri = /_symbol$/.test(key) ? p[logoKey] : undefined;
                                    return (
                                      <div key={key} className="flex items-center gap-2 min-w-0">
                                        <span className="text-[10px] font-bold text-[#6b6560] uppercase tracking-wider shrink-0">{key}</span>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {logoUri && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              src={logoUri}
                                              alt={String(val)}
                                              className="w-4 h-4 rounded-full object-cover shrink-0 bg-[#f8f4ef]"
                                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                          )}
                                          <span className="font-mono text-[11px] text-[#1f1b18] truncate">{String(val)}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-body-md text-[#6b6560] italic">
                  No configuration steps available.
                </p>
              )}
            </Card.Content>
          </Card>
        </div>

        {/* Right Column: Rewards & Actions */}
        <div className="flex flex-col gap-6">
          {/* Expected Rewards Card */}
          <Card className="bg-white border border-[#f8f4ef] rounded-xl p-8 shadow-soft">
            <Card.Header className="flex items-center gap-2.5 p-0 mb-6 border-b border-[#f8f4ef] pb-4">
              <FiAward className="w-6 h-6 text-[#f59e0b]" />
              <Card.Title className="text-h2 text-[#1f1b18] font-bold">
                Expected Rewards
              </Card.Title>
            </Card.Header>

            <Card.Content className="p-0 flex flex-col gap-4">
              {/* Primary Reward */}
              <div className="flex items-center gap-4 bg-[#f8f4ef] rounded-2xl p-4">
                <div className="w-12 h-12 bg-[#f59e0b33] rounded-full flex items-center justify-center text-[#f59e0b] shrink-0">
                  <FaCoins className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-h3 font-bold text-[#1f1b18]">
                    {formatReward(quest.reward_per_user)}
                  </span>
                  <span className="text-label font-bold text-[#6b6560]">
                    Base Token Payout
                  </span>
                </div>
              </div>

              {/* Secondary Reward */}
              <div className="flex items-center gap-4 bg-[#f8f4ef] rounded-2xl p-4">
                <div className="w-12 h-12 bg-[#6746c51a] rounded-full flex items-center justify-center text-[#6746c5] shrink-0">
                  <FiAward className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-h3 font-bold text-[#1f1b18]">
                    {formatReward(quest.total_reward_pool)}
                  </span>
                  <span className="text-label font-bold text-[#6b6560]">
                    Total Reward Pool
                  </span>
                </div>
              </div>
            </Card.Content>
          </Card>

          <Card className="bg-white border border-[#f8f4ef] rounded-xl p-8 shadow-soft">
            <Card.Header className="flex items-center gap-2.5 p-0 mb-6 border-b border-[#f8f4ef] pb-4">
              <FiClock className="w-6 h-6 text-[#f59e0b]" />
              <Card.Title className="text-h2 text-[#1f1b18] font-bold">
                Mission Timeline
              </Card.Title>
            </Card.Header>

            <Card.Content className="p-0 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-xs text-[#6b6560] uppercase font-semibold">
                  Expires At
                </p>
                <p className="text-body-sm text-[#1f1b18] leading-relaxed font-bold">
                  {formattedExpiresAt}
                </p>
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
