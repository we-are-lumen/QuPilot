"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AuthGate from "@/app/components/AuthGate";
import { getUserData } from "@/lib/utils/auth";
import type { IUser } from "@/lib/types/auth";
import {
  Button,
  Card,
  Avatar,
  Badge,
  Chip,
  ProgressBar,
  Tabs,
  Skeleton,
} from "@heroui/react";
import {
  FaUserAstronaut,
  FaRocket,
  FaFire,
  FaAward,
  FaBolt,
  FaTrophy,
  FaCompass,
  FaWater,
  FaSpinner,
  FaCheck,
  FaLock,
  FaChevronRight,
  FaGift,
} from "react-icons/fa6";
import {
  useUserParticipations,
  useSyncClaimReward,
} from "@/lib/hooks/useParticipations";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";
import { claimRewardTx } from "@/lib/utils/wallet";

export default function UserProfilePage() {
  const [activeTab, setActiveTab] = useState<string>("active");
  const [user] = useState<IUser | null>(() => getUserData());
  const [isClaiming, setIsClaiming] = useState(false);

  const formatLamportsToSol = (lamports: bigint): string => {
    const sol = Number(lamports) / 1e9;
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }).format(sol) + " SOL"
    );
  };

  const walletAddress = user?.wallet_address || "";
  const displayName = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "AstroExplorer";
  const activeSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
    : "";

  const { data: participationsData, isLoading: isLoadingParticipations } =
    useUserParticipations();
  const { data: leaderboardData, isLoading: isLoadingLeaderboard } =
    useLeaderboard();
  const { mutateAsync: syncClaimRewardMutate } = useSyncClaimReward();

  const participations = participationsData?.participations || [];
  const activeQuests = participations.filter((p) => p.status === "inprogress");
  const completedQuests = participations.filter((p) => p.status === "success");
  const claimedQuests = completedQuests.filter((p) => p.reward_claimed);
  const unclaimedQuests = completedQuests.filter((p) => !p.reward_claimed);

  const questsDone = completedQuests.length;

  const totalEarnedLamports = claimedQuests.reduce(
    (acc, p) => acc + BigInt(String(p.quest.reward_per_user ?? 0)),
    BigInt(0),
  );
  const totalUnclaimedLamports = unclaimedQuests.reduce(
    (acc, p) => acc + BigInt(String(p.quest.reward_per_user ?? 0)),
    BigInt(0),
  );
  const formattedTotalEarned = formatLamportsToSol(totalEarnedLamports);
  const formattedTotalUnclaimed = formatLamportsToSol(totalUnclaimedLamports);

  const completionRate =
    participations.length > 0
      ? (completedQuests.length / participations.length) * 100
      : 0;
  const formattedCompletion = isLoadingParticipations
    ? "..."
    : `${completionRate.toFixed(1)}%`;

  let globalRank = "-";
  if (leaderboardData?.entries) {
    const index = leaderboardData.entries.findIndex(
      (e) => e.wallet_address === walletAddress,
    );
    if (index !== -1) {
      globalRank = `#${index + 1}`;
    } else if (completedQuests.length > 0) {
      globalRank = "> 100";
    } else {
      globalRank = "Unranked";
    }
  }

  const handleClaimRewards = async () => {
    if (unclaimedQuests.length === 0) return;
    setIsClaiming(true);
    try {
      for (const p of unclaimedQuests) {
        if (!p.quest_pool_pda || !p.participation_pda) {
          console.warn(`Missing PDA for participation ${p.uuid}`);
          continue;
        }
        // Call the on-chain claim reward transaction
        const txHash = await claimRewardTx({
          questPoolPda: p.quest_pool_pda,
          participationPda: p.participation_pda,
        });

        // Sync with the backend
        await syncClaimRewardMutate({
          participation_uuid: p.uuid,
          claim_tx_hash: txHash,
        });
      }
      alert("Successfully claimed rewards!");
    } catch (err: unknown) {
      console.error("Claim rewards failed:", err);
      alert(
        (err instanceof Error ? err.message : undefined) ||
          "Failed to claim rewards on-chain. Please make sure your wallet is connected and has enough SOL for transaction fees.",
      );
    } finally {
      setIsClaiming(false);
    }
  };


  const newLocal =
    "rounded-xl border border-[#dfbfb94d] bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-md";
  return (
    <AuthGate allowedRoles={["user"]}>
      <div className="flex flex-col gap-8 max-w-7xl mx-auto py-6 px-4 md:px-6">
        {/* 1. Header Profile Card */}
        <Card className={newLocal}>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 justify-between">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left flex-1 w-full min-w-0">
              {/* Avatar block with active status dot anchor */}
              <div className="relative shrink-0">
                <Badge.Anchor>
                  <Avatar className="w-32 h-32 rounded-full border-4 border-white shadow-lg bg-[#fff8f6]">
                    <Avatar.Image
                      src={
                        user?.logo_url ||
                        "https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=250"
                      }
                      alt={displayName}
                    />
                    <Avatar.Fallback className="bg-secondary-light">
                      <FaUserAstronaut className="text-secondary text-5xl" />
                    </Avatar.Fallback>
                  </Avatar>
                  <Badge
                    color="success"
                    placement="bottom-right"
                    className="w-8 h-8 rounded-full border-4 border-white bg-[#10b981] text-white flex items-center justify-center p-0 shadow-md -translate-x-1.5 -translate-y-1.5"
                  >
                    <FaCheck className="text-[10px]" />
                  </Badge>
                </Badge.Anchor>
              </div>

              {/* Profile Info details - with full width to allow bio wrapping beautifully */}
              <div className="flex flex-col gap-3 w-full flex-1 min-w-0">
                <div>
                  <h1 className="text-3xl font-extrabold text-[#1f1b18] tracking-tight font-display mb-1">
                    {displayName}
                  </h1>
                  <p className="text-sm text-[#6b6560] font-sans">
                    Active since {activeSince || "May 2026"}
                  </p>
                </div>

                {/* Bio block wrapped inside a standard full-width block div to prevent flexbox narrow word-wrapping */}
                <div className="w-full">
                  <p className="text-sm text-[#6b6560] leading-relaxed italic font-sans font-medium">
                    &ldquo;Navigating the Web3 cosmos, one liquidity pool and
                    cross-chain bridge at a time. Searching for data residues.&rdquo;
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Header Mini-Stats overview */}
            <div className="w-full md:w-auto flex justify-around md:justify-end gap-6 md:gap-8 border-t md:border-t-0 md:border-l border-[#dfbfb94d] pt-6 md:pt-2 md:pl-8 shrink-0">
              <div className="flex flex-col text-center md:text-right">
                <span className="text-[10px] text-[#a39d97] font-bold uppercase tracking-wider mb-0.5">
                  Completion
                </span>
                <span className="text-xl font-extrabold text-[#10b981]">
                  {formattedCompletion}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Grid Columns layout: Stats/Achievements left, Quests right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Mission Stats & Achievements */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            {/* Mission Stats card */}
            <Card className="rounded-xl border border-[#dfbfb94d] bg-white p-6 shadow-sm">
              <Card.Header className="flex items-center gap-2.5 pb-4">
                <FaAward className="text-[#a63420] text-xl" />
                <Card.Title className="text-lg font-extrabold text-[#1f1b18]">
                  Mission Stats
                </Card.Title>
              </Card.Header>
              <Card.Content className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Quests Done Card */}
                  <div className="bg-[#f8f4ef] border border-[#dfbfb94d] rounded-xl p-4 flex flex-col gap-1 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xs">
                    <span className="text-[10px] text-[#6b6560] font-bold uppercase tracking-wider">
                      Quests Done
                    </span>
                    {isLoadingParticipations ? (
                      <Skeleton className="w-12 h-8 rounded-lg mt-1" />
                    ) : (
                      <span className="text-2xl font-extrabold text-[#a63420]">
                        {questsDone}
                      </span>
                    )}
                  </div>

                  <div className="bg-[#f8f4ef] border border-[#dfbfb94d] rounded-xl p-4 flex flex-col gap-1 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xs">
                    <span className="text-[10px] text-[#6b6560] font-bold uppercase tracking-wider">
                      Total Earned
                    </span>
                    {isLoadingParticipations ? (
                      <Skeleton className="w-16 h-8 rounded-lg mt-1" />
                    ) : (
                      <span className="text-2xl font-extrabold text-[#6746c5]">
                        {formattedTotalEarned}
                      </span>
                    )}
                  </div>
                </div>

                {/* Global Rank full width card */}
                <div className="bg-[#f8f4ef] border border-[#dfbfb94d] rounded-xl p-4 flex items-center justify-between transition-all duration-200 hover:scale-[1.02] hover:shadow-2xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#6b6560] font-bold uppercase tracking-wider">
                      Global Rank
                    </span>
                    {isLoadingLeaderboard ? (
                      <Skeleton className="w-20 h-8 rounded-lg mt-1" />
                    ) : (
                      <span className="text-2xl font-extrabold text-[#1f1b18]">
                        {globalRank}
                      </span>
                    )}
                  </div>
                  <FaTrophy
                    className="text-[#f59e0b] text-3xl opacity-90 animate-bounce"
                    style={{ animationDuration: "3s" }}
                  />
                </div>
              </Card.Content>
            </Card>

            {/* Achievements Card list */}
            <Card className="rounded-xl border border-[#dfbfb94d] bg-white p-6 shadow-sm">
              <Card.Header className="flex items-center gap-2.5 pb-4">
                <FaTrophy className="text-[#f59e0b] text-xl" />
                <Card.Title className="text-lg font-extrabold text-[#1f1b18]">
                  My Achievements
                </Card.Title>
              </Card.Header>
              <Card.Content className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-3.5">
                  {/* Achievement 1 */}
                  <div className="bg-[#f8f4ef] border border-[#dfbfb94d] rounded-xl p-3.5 flex flex-col gap-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xs">
                    <div className="w-9 h-9 rounded-lg bg-white border border-[#dfbfb94d] flex items-center justify-center text-sm shadow-2xs">
                      <FaRocket className="text-[#a63420]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-[#1f1b18]">
                        First Blood
                      </h4>
                      <p className="text-[9px] text-[#6b6560] mt-0.5 leading-tight font-medium">
                        Complete your first quest.
                      </p>
                    </div>
                  </div>
                  {/* Achievement 2 */}
                  <div className="bg-[#f8f4ef] border border-[#dfbfb94d] rounded-xl p-3.5 flex flex-col gap-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xs">
                    <div className="w-9 h-9 rounded-lg bg-white border border-[#dfbfb94d] flex items-center justify-center text-sm shadow-2xs">
                      <FaWater className="text-[#6746c5]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-[#1f1b18]">
                        DeFi Degen
                      </h4>
                      <p className="text-[9px] text-[#6b6560] mt-0.5 leading-tight font-medium">
                        Provide $1,000+ pool liquidity.
                      </p>
                    </div>
                  </div>
                  {/* Achievement 3 */}
                  <div className="bg-[#f8f4ef] border border-[#dfbfb94d] rounded-xl p-3.5 flex flex-col gap-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xs">
                    <div className="w-9 h-9 rounded-lg bg-white border border-[#dfbfb94d] flex items-center justify-center text-sm shadow-2xs">
                      <FaFire className="text-[#006767]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-[#1f1b18]">
                        Guardian
                      </h4>
                      <p className="text-[9px] text-[#6b6560] mt-0.5 leading-tight font-medium">
                        Maintain a 15+ day streak easily.
                      </p>
                    </div>
                  </div>
                  {/* Achievement 4 */}
                  <div className="bg-[#f8f4ef] border border-[#dfbfb94d] rounded-xl p-3.5 flex flex-col gap-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xs">
                    <div className="w-9 h-9 rounded-lg bg-white border border-[#dfbfb94d] flex items-center justify-center text-sm shadow-2xs">
                      <FaBolt className="text-[#f59e0b]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-[#1f1b18]">
                        Speedster
                      </h4>
                      <p className="text-[9px] text-[#6b6560] mt-0.5 leading-tight font-medium">
                        Bridge tokens in under 30 seconds.
                      </p>
                    </div>
                  </div>
                  {/* Locked Achievement Slot 5 */}
                  <div className="bg-[#ffe9e5] border border-[#ffdad3] rounded-xl p-3.5 flex flex-col gap-2 items-center justify-center transition-all duration-200 hover:scale-[1.02] opacity-80 select-none">
                    <div className="w-9 h-9 rounded-full bg-white border border-[#ffdad3] flex items-center justify-center text-xs shadow-2xs">
                      <FaLock className="text-[#a63420] text-[10px]" />
                    </div>
                    <span className="text-[9px] font-extrabold text-[#a63420] uppercase tracking-wider font-sans">
                      Locked
                    </span>
                  </div>
                  {/* Locked Achievement Slot 6 */}
                  <div className="bg-[#ffe9e5] border border-[#ffdad3] rounded-xl p-3.5 flex flex-col gap-2 items-center justify-center transition-all duration-200 hover:scale-[1.02] opacity-80 select-none">
                    <div className="w-9 h-9 rounded-full bg-white border border-[#ffdad3] flex items-center justify-center text-xs shadow-2xs">
                      <FaLock className="text-[#a63420] text-[10px]" />
                    </div>
                    <span className="text-[9px] font-extrabold text-[#a63420] uppercase tracking-wider font-sans">
                      Locked
                    </span>
                  </div>
                </div>

                {/* View Leaderboard action */}
                <Link href="/leaderboard" className="w-full mt-2 block">
                  <Button className="w-full bg-[#f8f4ef] hover:bg-[#ffdad3]/60 border border-[#ffdad3] text-[#a63420] font-extrabold py-3 rounded-full text-xs shadow-2xs transition-colors flex items-center justify-center gap-1.5">
                    View Leaderboard <FaChevronRight className="text-[9px]" />
                  </Button>
                </Link>
              </Card.Content>
            </Card>
          </div>

          {/* Right Column: Quest Tabs & List content */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card className="rounded-xl border border-[#dfbfb94d] bg-white p-6 shadow-sm min-h-125">
              <Card.Header className="flex items-center gap-2.5 pb-6">
                <FaCompass className="text-[#6746c5] text-xl" />
                <Card.Title className="text-lg font-extrabold text-[#1f1b18]">
                  My Quests
                </Card.Title>
              </Card.Header>
              <Card.Content>
                <Tabs
                  variant="secondary"
                  selectedKey={activeTab}
                  onSelectionChange={(key) => setActiveTab(key as string)}
                  className="w-full flex flex-col gap-6"
                >
                  <Tabs.ListContainer>
                    <Tabs.List aria-label="Quest filters">
                      <Tabs.Tab
                        id="active"
                        className="text-sm font-bold text-[#6b6560] data-[selected=true]:text-[#a63420] data-[selected=true]:shadow-[inset_0_-2px_0_0_#a63420] cursor-pointer outline-none"
                      >
                        Active (
                        {isLoadingParticipations ? "..." : activeQuests.length}
                        )
                      </Tabs.Tab>

                      <Tabs.Tab
                        id="completed"
                        className="text-sm font-bold text-[#6b6560] data-[selected=true]:text-[#a63420] data-[selected=true]:shadow-[inset_0_-2px_0_0_#a63420] cursor-pointer outline-none"
                      >
                        Completed (
                        {isLoadingParticipations ? "..." : completedQuests.length}
                        )
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>

                  {/* Tab Panel: Active Quests */}
                  <Tabs.Panel id="active" className="flex flex-col gap-4 mt-2">
                    {isLoadingParticipations ? (
                      Array(3)
                        .fill(0)
                        .map((_, i) => (
                          <Skeleton
                            key={i}
                            className="w-full h-32 rounded-xl"
                          />
                        ))
                    ) : activeQuests.length === 0 ? (
                      <div className="flex items-center justify-center py-12 text-[#6b6560] text-sm">
                        No active quests found. Go explore and start some
                        quests!
                      </div>
                    ) : (
                      activeQuests.map((participation) => {
                        return (
                          <div
                            key={participation.uuid}
                            className="bg-[#f8f4ef] border border-[#dfbfb94d] rounded-xl p-5 flex flex-col md:flex-row gap-5 items-stretch justify-between transition-all duration-200 hover:border-[#ebdcd6] hover:shadow-2xs"
                          >
                            <div className="flex gap-4 items-start flex-1">
                              <div className="w-12 h-12 rounded-lg bg-white border border-[#dfbfb94d] flex items-center justify-center text-xl shrink-0 shadow-3xs overflow-hidden">
                                {participation.quest.provider?.logo_url ? (
                                  <Image
                                    src={participation.quest.provider.logo_url}
                                    alt={participation.quest.provider.display_name || "Provider"}
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-[#ffdad3] text-[#a63420] font-bold text-lg">
                                    {(participation.quest.provider?.display_name || "P").charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 flex flex-col gap-2">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-[9px] font-extrabold tracking-wider bg-[#ffe9e5] text-[#a63420] px-2 py-0.5 rounded-[4px] uppercase font-sans border border-[#ffdad3]">
                                    {participation.quest.protocol}
                                  </span>
                                  <h3 className="text-base font-extrabold text-[#1f1b18]">
                                    {participation.quest.title}
                                  </h3>
                                </div>
                                <p className="text-xs text-[#6b6560] leading-relaxed">
                                  {participation.quest.description}
                                </p>

                                <div className="mt-2 w-full max-w-md">
                                  <div className="flex justify-between text-[10px] text-[#6b6560] font-bold mb-1.5 font-sans">
                                    <span className="whitespace-nowrap">
                                      Progress: In Progress
                                    </span>
                                    <span className="whitespace-nowrap">
                                      Reward:{" "}
                                      {formatLamportsToSol(
                                        BigInt(
                                          participation.quest.reward_per_user,
                                        ),
                                      )}
                                    </span>
                                  </div>
                                  <ProgressBar
                                    value={50}
                                    aria-label="Quest Progress"
                                    className="w-full"
                                  >
                                    <ProgressBar.Track className="h-2 w-full bg-[#f5ddd9] rounded-full overflow-hidden">
                                      <ProgressBar.Fill
                                        className="h-full bg-[#a63420] rounded-full transition-all duration-300"
                                        style={{ width: "50%" }}
                                      />
                                    </ProgressBar.Track>
                                  </ProgressBar>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center shrink-0 self-center md:self-auto">
                              <Chip className="bg-[#e8ddff] text-[#20005e] border border-[#cebdff] font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs shadow-3xs">
                                <FaSpinner className="animate-spin text-[10px]" />
                                <Chip.Label>In Progress</Chip.Label>
                              </Chip>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </Tabs.Panel>

                  {/* Tab Panel: Completed Quests */}
                  <Tabs.Panel
                    id="completed"
                    className="flex flex-col gap-4 mt-2"
                  >
                    {unclaimedQuests.length > 0 && (
                      <div className="bg-[#ecfdf5] border border-[#10b98133] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-[#065f46] font-bold uppercase tracking-wider">
                            Unclaimed Rewards
                          </span>
                          <span className="text-sm font-extrabold text-[#065f46]">
                            {formattedTotalUnclaimed} • {unclaimedQuests.length}{" "}
                            quest
                            {unclaimedQuests.length > 1 ? "s" : ""}
                          </span>
                          <span className="text-[11px] text-[#047857] font-medium">
                            Disclaimer: claim will submit an on-chain transaction
                            and may require SOL for fees.
                          </span>
                        </div>

                        <Button
                          onPress={handleClaimRewards}
                          isDisabled={isClaiming}
                          className="bg-[#10b981] hover:bg-[#0f9d78] text-white font-bold py-2 px-4 rounded-full text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer font-sans w-full sm:w-auto"
                        >
                          {isClaiming ? (
                            <>
                              <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                              <span>Claiming...</span>
                            </>
                          ) : (
                            <>
                              <FaGift className="text-[12px]" />
                              <span>Claim now</span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {isLoadingParticipations ? (
                      Array(3)
                        .fill(0)
                        .map((_, i) => (
                          <Skeleton
                            key={i}
                            className="w-full h-32 rounded-xl"
                          />
                        ))
                    ) : completedQuests.length === 0 ? (
                      <div className="flex items-center justify-center py-12 text-[#6b6560] text-sm">
                        No completed quests yet.
                      </div>
                    ) : (
                      completedQuests.map((participation) => {
                        return (
                          <div
                            key={participation.uuid}
                            className="bg-[#f8f4ef] border border-[#dfbfb94d] rounded-xl p-5 flex flex-col md:flex-row gap-5 items-stretch justify-between transition-all duration-200 hover:border-[#ebdcd6] hover:shadow-2xs"
                          >
                            <div className="flex gap-4 items-start flex-1">
                              <div className="w-12 h-12 rounded-lg bg-white border border-[#dfbfb94d] flex items-center justify-center text-xl shrink-0 shadow-3xs overflow-hidden">
                                {participation.quest.provider?.logo_url ? (
                                  <Image
                                    src={participation.quest.provider.logo_url}
                                    alt={participation.quest.provider.display_name || "Provider"}
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-[#ffdad3] text-[#a63420] font-bold text-lg">
                                    {(participation.quest.provider?.display_name || "P").charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 flex flex-col gap-2">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-[9px] font-extrabold tracking-wider bg-[#d1f7c4] text-[#1a5f08] px-2 py-0.5 rounded-[4px] uppercase font-sans border border-[#a2e88a]">
                                    {participation.quest.protocol}
                                  </span>
                                  <h3 className="text-base font-extrabold text-[#1f1b18] line-through decoration-1 opacity-75">
                                    {participation.quest.title}
                                  </h3>
                                </div>
                                <p className="text-xs text-[#6b6560] leading-relaxed opacity-75">
                                  {participation.quest.description}
                                </p>

                                <div className="mt-2 w-full max-w-md">
                                  <div className="flex justify-between text-[10px] text-[#6b6560] font-bold mb-1.5 font-sans">
                                    <span className="whitespace-nowrap">
                                      Completed •{" "}
                                      {new Date(
                                        participation.completed_at || "",
                                      ).toLocaleDateString()}
                                    </span>{" "}
                                    <span className="whitespace-nowrap">
                                      Reward:{" "}
                                      {formatLamportsToSol(
                                        BigInt(
                                          participation.quest.reward_per_user,
                                        ),
                                      )}
                                    </span>
                                  </div>
                                  <ProgressBar
                                    value={100}
                                    aria-label="Quest Progress"
                                    className="w-full"
                                  >
                                    <ProgressBar.Track className="h-2 w-full bg-[#d1f7c4] rounded-full overflow-hidden">
                                      <ProgressBar.Fill
                                        className="h-full bg-[#10b981] rounded-full"
                                        style={{ width: "100%" }}
                                      />
                                    </ProgressBar.Track>
                                  </ProgressBar>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center shrink-0 self-center md:self-auto gap-2">
                              {participation.reward_claimed ? (
                                <Chip className="bg-[#d1f7c4] text-[#1a5f08] border border-[#a2e88a] font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1 text-xs shadow-3xs">
                                  <FaCheck className="text-[10px]" />
                                  <Chip.Label>CLAIMED</Chip.Label>
                                </Chip>
                              ) : (
                                <Chip className="bg-[#fff3d6] text-[#b25e00] border border-[#ffe1a8] font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1 text-xs shadow-3xs">
                                  <Chip.Label>UNCLAIMED</Chip.Label>
                                </Chip>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </Tabs.Panel>
                </Tabs>
              </Card.Content>
            </Card>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
