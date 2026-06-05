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
