"use client";

import React from "react";
import { Avatar, Card, Table, Skeleton } from "@heroui/react";
import { FaCrown, FaTrophy, FaMedal, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";
import { formatReward } from "@/lib/utils/format";

// Helpers for wallets and identifiers
const truncateAddress = (addr: string) => {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const getInitial = (addr: string) => {
  if (!addr) return "";
  return addr.slice(0, 1).toUpperCase() || "S";
};

export default function LeaderboardPage() {
  const { data, isLoading, error } = useLeaderboard(100);
  const entries = data?.entries || [];

  // Podium configurations for ranks 1, 2, 3
  const rankConfigs = {
    1: {
      bgColor: "bg-[#ffdad3]",
      badgeBg: "bg-[#f59e0b]",
      textColor: "text-[#a63420]",
      pointsColor: "text-[#c84b35]",
      accentColor: "text-[#f59e0b]",
      avatarBg: "bg-[#fbe3df]",
      cardHeight: "h-40 md:h-[175px]",
      badgeIcon: <FaCrown className="text-white text-sm animate-bounce" />,
      tier: "Gold Tier",
    },
    2: {
      bgColor: "bg-[#f5ddd9]",
      badgeBg: "bg-[#6746c5]",
      textColor: "text-[#1f1b18]",
      pointsColor: "text-[#6b6560]",
      accentColor: "text-[#6746c5]",
      avatarBg: "bg-[#ecd5d1]",
      cardHeight: "h-30 md:h-[130px]",
      badgeIcon: <FaTrophy className="text-white text-xs" />,
      tier: "Silver Tier",
    },
    3: {
      bgColor: "bg-[#fbe3df]",
      badgeBg: "bg-[#006767]",
      textColor: "text-[#1f1b18]",
      pointsColor: "text-[#6b6560]",
      accentColor: "text-[#006767]",
      avatarBg: "bg-[#fbe3df]",
      cardHeight: "h-25 md:h-[110px]",
      badgeIcon: <FaMedal className="text-white text-xs" />,
      tier: "Bronze Tier",
    },
  };

  // Build the podium data from dynamic backend response
  // Array format: [Silver (Rank 2), Gold (Rank 1), Bronze (Rank 3)]
  const silverEntry = entries[1];
  const goldEntry = entries[0];
  const bronzeEntry = entries[2];

  const podiumData = [];
  if (silverEntry) {
    podiumData.push({
      rank: 2,
      entry: silverEntry,
      ...rankConfigs[2],
    });
  }
  if (goldEntry) {
    podiumData.push({
      rank: 1,
      entry: goldEntry,
      ...rankConfigs[1],
    });
  }
  if (bronzeEntry) {
    podiumData.push({
      rank: 3,
      entry: bronzeEntry,
      ...rankConfigs[3],
    });
  }

  // The remaining entries go to the table list.
  const tableData = entries.slice(3);

  return (
    <div className="flex flex-col gap-10 max-w-6xl mx-auto px-4 md:px-8 py-6">
      {/* Header Section */}
      <div className="text-center max-w-168 mx-auto flex flex-col gap-3">
        <h1 className="text-display text-[#a63420] text-4xl md:text-5xl font-extrabold tracking-tight">
          Global Rankings
        </h1>
        <p className="text-body-lg text-[#6b6560] leading-relaxed">
          Climb the ranks, complete quests, and become the top explorer in the QuPilot universe.
        </p>
      </div>

      {/* Loading Skeleton State */}
      {isLoading && (
        <>
          {/* Skeleton Podium Section */}
          <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-4 max-w-4xl mx-auto w-full mt-10">
            {[2, 1, 3].map((rank) => (
              <div
                key={rank}
                className={`flex flex-col items-center w-full max-w-55 relative ${
                  rank === 1 ? "order-1 md:order-2 z-10" : rank === 2 ? "order-2 md:order-1" : "order-3"
                }`}
              >
                {/* Top Wallet Badge Skeleton */}
                <div className="bg-[#fff8f6] border border-[#f5ddd9] rounded-2xl p-2 px-4 shadow-soft flex flex-col items-center justify-center mb-6 w-full text-center relative z-20 animate-pulse">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-3 w-16 rounded mt-1" />
                </div>

                {/* Avatar Skeleton */}
                <div className="relative -mb-6 z-20 flex items-center justify-center animate-pulse">
                  <Skeleton className={`border-4 border-[#fff8f6] shadow-medium rounded-full ${
                    rank === 1 ? "h-30 w-30" : "h-22 w-22"
                  }`} />
                </div>

                {/* Content card Skeleton */}
                <Card
                  className={`w-full bg-[#ffdad3]/10 rounded-t-none rounded-b-[24px] shadow-medium flex flex-col justify-end items-center text-center p-6 pt-10 ${
                    rank === 1 ? "h-40 md:h-43.75" : rank === 2 ? "h-30 md:h-32.5" : "h-25 md:h-27.5"
                  } animate-pulse`}
                >
                  <div className="flex flex-col gap-2 w-full items-center mt-auto">
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                </Card>
              </div>
            ))}
          </div>

          {/* Skeleton Table Section */}
          <div className="bg-white border border-[#f8f4ef] rounded-xl overflow-hidden shadow-soft mt-6 animate-pulse">
            <Table className="w-full">
              <Table.ScrollContainer>
                <Table.Content aria-label="Leaderboard Table Loading">
                  <Table.Header className="bg-[#f8f4ef] border-b border-[#f5ddd9]">
                    <Table.Column className="py-4 px-6 text-[12px] text-[#6b6560] font-bold text-center w-25">Rank</Table.Column>
                    <Table.Column className="py-4 px-6 text-[12px] text-[#6b6560] font-bold text-left">Explorer</Table.Column>
                    <Table.Column className="py-4 px-6 text-[12px] text-[#6b6560] font-bold text-left">Wallet</Table.Column>
                    <Table.Column className="py-4 px-6 text-[12px] text-[#6b6560] font-bold text-right">Points</Table.Column>
                    <Table.Column className="py-4 px-6 text-[12px] text-[#6b6560] font-bold text-right">Success Rate</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {[4, 5, 6].map((rank) => (
                      <Table.Row key={rank}>
                        <Table.Cell className="py-4 px-6 text-center">
                          <Skeleton className="h-4 w-4 rounded mx-auto" />
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <Skeleton className="size-10 rounded-full" />
                            <Skeleton className="h-4 w-24 rounded" />
                          </div>
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6">
                          <Skeleton className="h-4 w-28 rounded" />
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6">
                          <Skeleton className="h-4 w-16 rounded ml-auto" />
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6">
                          <div className="flex items-center justify-end gap-3">
                            <Skeleton className="h-4 w-8 rounded" />
                            <Skeleton className="w-16 h-2 rounded-full" />
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
        </>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-[#fff5f5] border border-[#ffc1c1] rounded-2xl max-w-4xl mx-auto w-full">
          <p className="text-lg font-bold text-[#e53e3e]">Failed to load rankings</p>
          <p className="text-sm text-[#6b6560]">
            We encountered an error while retrieving the global leaderboard. Please try again later.
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-[#fcfbfa] border border-[#dfbfb94d] rounded-2xl max-w-4xl mx-auto w-full">
          <p className="text-lg font-bold text-[#a63420]">Leaderboard is empty</p>
          <p className="text-sm text-[#6b6560]">
            There are currently no active explorer records in the system. Start completing quests to appear on the board!
          </p>
        </div>
      )}

      {/* Dynamic Main Leaderboard Content */}
      {!isLoading && !error && entries.length > 0 && (
        <>
          {/* Podium Section (Top 3) */}
          <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-4 max-w-4xl mx-auto w-full mt-10">
            {podiumData.map((pilot) => (
              <div
                key={pilot.rank}
                className={`flex flex-col items-center w-full max-w-55 relative ${
                  pilot.rank === 1 ? "order-1 md:order-2 z-10" : pilot.rank === 2 ? "order-2 md:order-1" : "order-3"
                }`}
              >
                {/* Top Wallet Badge */}
                <div className="bg-[#fff8f6] border border-[#f5ddd9] rounded-2xl p-2 px-4 shadow-soft flex flex-col items-center justify-center mb-6 w-full text-center relative z-20">
                  <span className={`text-body-sm font-bold ${pilot.accentColor} font-mono`}>
                    {truncateAddress(pilot.entry.wallet_address)}
                  </span>
                  <span className="text-[10px] text-[#6b6560] font-bold uppercase tracking-wider mt-0.5">
                    {pilot.tier}
                  </span>
                </div>

                {/* Avatar & Floating Badge */}
                <div className="relative -mb-6 z-20 flex items-center justify-center">
                  <Avatar
                    className={`border-4 border-[#fff8f6] shadow-medium ${pilot.avatarBg} ${
                      pilot.rank === 1 ? "h-30 w-30" : "h-22 w-22"
                    }`}
                  >
                    <Avatar.Fallback className={`font-bold ${pilot.rank === 1 ? "text-2xl" : "text-lg"} text-[#1f1b18]`}>
                      {getInitial(pilot.entry.wallet_address)}
                    </Avatar.Fallback>
                  </Avatar>
                  
                  {/* Position Icon Badge */}
                  <div
                    className={`absolute bottom-0 right-0 ${pilot.badgeBg} p-2 rounded-full border-2 border-[#fff8f6] shadow-soft flex items-center justify-center`}
                  >
                    {pilot.badgeIcon}
                  </div>

                  {/* Gold Crown floating decorator for Rank 1 */}
                  {pilot.rank === 1 && (
                    <div className="absolute -top-6 -right-2 transform rotate-12 z-30">
                      <FaCrown className="text-[#f59e0b] text-2xl drop-shadow-md animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Content card (staggered height) */}
                <Card
                  className={`w-full ${pilot.bgColor} rounded-t-none rounded-b-[24px] shadow-medium flex flex-col justify-end items-center text-center p-6 pt-10 ${pilot.cardHeight} transition-transform hover:-translate-y-1 duration-200`}
                >
                  <div className="flex flex-col gap-1 w-full mt-auto">
                    <span className={`font-bold tracking-tight ${pilot.textColor} ${pilot.rank === 1 ? "text-xl md:text-2xl" : "text-base md:text-lg"} truncate w-full`}>
                      {truncateAddress(pilot.entry.wallet_address)}
                    </span>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${pilot.pointsColor}`}>
                      {formatReward(pilot.entry.total_reward)}
                    </span>
                  </div>
                </Card>
              </div>
            ))}
          </div>

          {/* Table Section */}
          {tableData.length > 0 && (
            <div className="bg-white border border-[#f8f4ef] rounded-xl overflow-hidden shadow-soft mt-6">
              <Table className="w-full">
                <Table.ScrollContainer>
                  <Table.Content aria-label="Explorer Leaderboard Table">
                    <Table.Header className="bg-[#f8f4ef] border-b border-[#f5ddd9]">
                      <Table.Column className="py-4 px-6 text-[12px] text-[#6b6560] font-bold text-center w-25">
                        Rank
                      </Table.Column>
                      <Table.Column className="py-4 px-6 text-[12px] text-[#6b6560] font-bold text-left">
                        Explorer
                      </Table.Column>
                      <Table.Column className="py-4 px-6 text-[12px] text-[#6b6560] font-bold text-left">
                        Wallet
                      </Table.Column>
                      <Table.Column className="py-4 px-6 text-[12px] text-[#6b6560] font-bold text-right">
                        Points
                      </Table.Column>
                      <Table.Column className="py-4 px-6 text-[12px] text-[#6b6560] font-bold text-right">
                        Success Rate
                      </Table.Column>
                    </Table.Header>

                    <Table.Body className="divide-y divide-[#f5ddd9]/40">
                      {tableData.map((row, idx) => (
                        <Table.Row key={row.user_uuid} className="hover:bg-[#f8f4ef]/30 transition-colors">
                          {/* Rank */}
                          <Table.Cell className="py-4 px-6 font-bold text-[#6b6560] text-center">
                            {idx + 4}
                          </Table.Cell>

                          {/* Explorer (Avatar + Name) */}
                          <Table.Cell className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <Avatar className="size-10 bg-[#ecd5d1] border-2 border-white shadow-soft">
                                <Avatar.Fallback className="text-sm font-bold text-[#1f1b18]">
                                  {getInitial(row.wallet_address)}
                                </Avatar.Fallback>
                              </Avatar>
                              <span className="font-bold text-[#1f1b18] text-body-md">
                                {truncateAddress(row.wallet_address)}
                              </span>
                            </div>
                          </Table.Cell>

                          {/* Wallet */}
                          <Table.Cell className="py-4 px-6 text-[#6b6560] font-mono text-body-sm">
                            {truncateAddress(row.wallet_address)}
                          </Table.Cell>

                          {/* Points */}
                          <Table.Cell className="py-4 px-6 text-right font-bold text-[#a63420] text-body-md">
                            {formatReward(row.total_reward)}
                          </Table.Cell>

                          {/* Success Rate with progress bar */}
                          <Table.Cell className="py-4 px-6">
                            <div className="flex items-center justify-end gap-3">
                              <span
                                className={`font-bold text-body-sm ${
                                  row.success_rate >= 0.9 ? "text-[#10b981]" : "text-[#f59e0b]"
                                }`}
                              >
                                {Math.round(row.success_rate * 100)}%
                              </span>
                              
                              {/* Custom visual progress bar matching Figma 64px width */}
                              <div className="w-16 h-2 bg-[#f5ddd9] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    row.success_rate >= 0.9 ? "bg-[#10b981]" : "bg-[#f59e0b]"
                                  }`}
                                  style={{ width: `${row.success_rate * 100}%` }}
                                />
                              </div>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>

              {/* Custom Styled Pagination Footer */}
              <div className="bg-[#f8f4ef] border-t border-[#f5ddd9] py-4 px-8 flex items-center justify-between">
                <span className="text-body-sm text-[#6b6560]">
                  Showing 1-{entries.length} of {entries.length}
                </span>
                <div className="flex items-center gap-2">
                  <button className="h-8 w-8 rounded-lg bg-[#fff8f6] border border-[#f5ddd9] text-[#6b6560] hover:text-[#1f1b18] hover:border-[#1f1b18]/30 transition-all flex items-center justify-center">
                    <FaChevronLeft className="text-[10px]" />
                  </button>
                  <button className="h-8 w-8 rounded-lg bg-[#fff8f6] border border-[#f5ddd9] text-[#1f1b18] hover:bg-[#a63420] hover:text-white hover:border-[#a63420] transition-all flex items-center justify-center font-bold">
                    <FaChevronRight className="text-[10px]" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
