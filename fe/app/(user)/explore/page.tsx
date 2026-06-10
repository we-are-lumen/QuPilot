"use client";

import React from "react";
import Link from "next/link";
import { Card, Button, Chip, Avatar, Skeleton } from "@heroui/react";
import { FaFire, FaCoins, FaAward, FaChevronRight } from "react-icons/fa6";
import { FiClock as FiClockIcon, FiCpu as FiCpuIcon, FiCompass as FiCompassIcon } from "react-icons/fi";
import { useQuery } from "@tanstack/react-query";
import { getPublicHighlights } from "@/lib/api/quests";

const THEME_COLORS = [
  { accentColor: "#3898FF", accentBg: "rgba(56,152,255,0.1)" }, // Sui Blue
  { accentColor: "#F7A600", accentBg: "rgba(247,166,0,0.1)" }, // Bybit Orange
  { accentColor: "#E05D45", accentBg: "rgba(166,52,32,0.1)" }, // QuPilot Red
  { accentColor: "#10B981", accentBg: "rgba(16,185,129,0.1)" }, // Emerald Green
  { accentColor: "#8B5CF6", accentBg: "rgba(139,92,246,0.1)" }, // Violet
];

const formatReward = (rewardStr: string) => {
  try {
    const lamports = BigInt(rewardStr);
    const parsed = Number(lamports) / 1e9; // Divided by 1e9 as requested by the user
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(parsed);
  } catch (error) {
    return rewardStr;
  }
};

export default function ExploreFeedPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-highlights"],
    queryFn: () => getPublicHighlights(),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-12 max-w-7xl mx-auto px-2">
        {/* Header Section */}
        <div className="flex flex-col gap-3 py-5 border-b border-[#f5ddd9]/60">
          <Skeleton className="h-10 w-48 rounded-lg" />
          <Skeleton className="h-5 w-full md:w-192 rounded-lg" />
        </div>

        {/* Bento Grid Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 bg-white border border-[#f8f4ef] rounded-3xl p-8">
            <div className="flex justify-between items-start mb-6">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-64 rounded-lg mb-4" />
            <Skeleton className="h-4 w-full rounded-lg mb-2" />
            <Skeleton className="h-4 w-5/6 rounded-lg mb-6" />
            <div className="flex justify-between items-center border-t border-[#f8f4ef] pt-5">
              <Skeleton className="h-10 w-32 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </Card>

          <Card className="bg-[#f8f4ef] border-transparent rounded-3xl p-8 flex flex-col justify-between">
            <Skeleton className="h-5 w-32 rounded-lg mb-6" />
            <div className="flex flex-col items-center gap-3 mb-6">
              <Skeleton className="w-20 h-20 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-lg" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-full" />
          </Card>
        </div>

        {/* Bottom Grid Section */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-[#f5ddd9]/60 pb-3">
            <Skeleton className="h-8 w-40 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-white border border-[#f8f4ef] rounded-3xl p-6 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-3 w-2/3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex flex-col gap-1.5 w-1/2">
                      <Skeleton className="h-3 w-full rounded-lg" />
                      <Skeleton className="h-3 w-2/3 rounded-lg" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <div className="flex flex-col gap-2 mb-6">
                  <Skeleton className="h-5 w-3/4 rounded-lg" />
                  <Skeleton className="h-3.5 w-full rounded-lg" />
                </div>
                <div className="flex justify-between items-center border-t border-[#f8f4ef] pt-4">
                  <Skeleton className="h-4 w-20 rounded-lg" />
                  <Skeleton className="h-4 w-12 rounded-lg" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-12 max-w-7xl mx-auto px-2 py-10">
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-[#fff5f5] border border-[#ffc1c1] rounded-3xl">
          <p className="text-xl font-bold text-[#e53e3e]">Failed to load recommendations</p>
          <p className="text-sm text-[#6b6560] max-w-128">
            We encountered an error while retrieving the highlight missions and providers. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  const topQuests = data?.top_quests || [];
  const topProviders = data?.top_providers || [];

  const hotQuest = topQuests[0];
  const featuredProvider = topProviders[0];

  const hasHighlights = topQuests.length > 0 || topProviders.length > 0;

  if (!hasHighlights) {
    return (
      <div className="flex flex-col gap-12 max-w-7xl mx-auto px-2 py-10">
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-[#fcfbfa] border border-[#dfbfb94d] rounded-3xl">
          <FiCompassIcon className="text-4xl text-[#dfbfb9]" />
          <p className="text-lg font-bold text-[#e05d45]">No recommendations found</p>
          <p className="text-sm text-[#6b6560]">
            There are currently no featured quests or providers. Check back later for new updates!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 max-w-7xl mx-auto px-2">
      {/* 1. Header Section */}
      <div className="flex flex-col gap-3 py-5 border-b border-[#f5ddd9]/60">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#e05d45] tracking-tight font-sans">
          Discover Missions
        </h1>
        <p className="text-base md:text-lg text-[#6b6560] max-w-192 leading-relaxed">
          Explore new frontiers, connect with top providers, and embark on personalized quests
          designed for your journey across the Web3 galaxy.
        </p>
      </div>

      {/* 2. Bento Grid Section: Recommended for You */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Hero Bento Item (Spans 2 cols on desktop) */}
        {hotQuest ? (
          <Card 
            variant="default" 
            className="lg:col-span-2 relative overflow-hidden bg-white border border-[#f8f4ef] rounded-3xl p-8 hover:shadow-md transition-all duration-300"
          >
            {/* Subtle cosmic background pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-orange-100/30 via-transparent to-transparent pointer-events-none" />
            
            <Card.Header className="flex flex-row items-center justify-between z-10 p-0 mb-6">
              <Chip color="danger" variant="soft" className="bg-[#ffffff] border border-[#f5ddd9] text-[#e05d45] rounded-full px-3 py-1 flex items-center gap-1.5">
                <FaFire size={12} className="text-[#e05d45] animate-bounce" />
                <Chip.Label className="text-xs font-bold uppercase tracking-wider">Hot Quest</Chip.Label>
              </Chip>
              
              <div className="p-2 bg-[#f8f4ef] rounded-full text-[#6b6560]">
                <FiCompassIcon size={18} />
              </div>
            </Card.Header>

            <Card.Content className="flex flex-col gap-4 z-10 p-0 mb-6">
              <h2 className="text-2xl font-bold text-[#e05d45] tracking-tight">
                {hotQuest.title}
              </h2>
              <p className="text-[#6b6560] text-sm md:text-base leading-relaxed max-w-128 line-clamp-2">
                {hotQuest.description}
              </p>
            </Card.Content>

            <Card.Footer className="flex flex-row items-center justify-between z-10 p-0 border-t border-[#f8f4ef] pt-5">
              <Link href={`/quests/${hotQuest.uuid}`}>
                <Button className="bg-[#e05d45] text-white hover:bg-[#c94d35] transition-all text-xs font-bold px-6 py-2.5 rounded-full shadow-sm">
                  Start Mission
                </Button>
              </Link>
              
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#e05d45] bg-[#f3efff] px-3 py-1.5 rounded-full border border-[#e5dcff]">
                <FaAward size={14} />
                <span>{formatReward(hotQuest.reward_per_user)} SOL</span>
              </div>
            </Card.Footer>
          </Card>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center p-8 bg-white border border-[#f8f4ef] rounded-3xl text-[#6b6560]">
            No hot quests available
          </div>
        )}

        {/* Side Bento Item: Top Provider */}
        {featuredProvider ? (
          <Card 
            variant="secondary" 
            className="bg-[#f8f4ef] border-transparent rounded-3xl p-8 flex flex-col justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-[#fbe3df] rounded-full opacity-40 blur-xl pointer-events-none" />

            <Card.Header className="p-0">
              <h3 className="text-sm font-bold text-[#1f1b18] uppercase tracking-wider mb-6">
                Featured Provider
              </h3>
            </Card.Header>

            <Card.Content className="flex flex-col items-center gap-3 p-0 mb-6 text-center">
              <div className="w-20 h-20 bg-[#fbe3df] rounded-full border-4 border-white shadow-sm flex items-center justify-center overflow-hidden">
                {featuredProvider.logo_url ? (
                  <img src={featuredProvider.logo_url} alt={featuredProvider.display_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#fbe3df] flex items-center justify-center text-[#e05d45] text-xl font-bold">
                    {featuredProvider.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              <h4 className="text-lg font-bold text-[#e05d45] tracking-tight">
                {featuredProvider.display_name}
              </h4>
              
              <div className="bg-[#ffffff] border border-[#f5ddd9] rounded-full px-3 py-1 text-xs font-bold text-[#6b6560] tracking-wide">
                {formatReward(featuredProvider.total_deposit_reward_pool)} SOL Pool
              </div>
            </Card.Content>

            <Card.Footer className="p-0 flex justify-center w-full">
              <Link href={`/quests?provider=${encodeURIComponent(featuredProvider.display_name)}`} className="w-full">
                <Button 
                  variant="outline" 
                  className="w-full bg-white text-[#e05d45] hover:bg-[#ffffff] border border-[#c9c1b6] hover:border-[#e05d45] transition-all text-xs font-bold py-2.5 rounded-full shadow-sm"
                >
                  Explore Quests
                </Button>
              </Link>
            </Card.Footer>
          </Card>
        ) : (
          <div className="flex items-center justify-center p-8 bg-[#f8f4ef] rounded-3xl text-[#6b6560]">
            No featured provider available
          </div>
        )}
      </div>

      {/* 3. Top Providers Section */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-[#f5ddd9]/60 pb-3">
          <h2 className="text-xl md:text-2xl font-bold text-[#e05d45]">
            Top Providers
          </h2>
          <Link 
            href="/quests" 
            className="text-xs font-bold text-[#6b6560] hover:text-[#e05d45] flex items-center gap-1 transition-colors uppercase tracking-wider"
          >
            View All Quests
            <FaChevronRight size={10} />
          </Link>
        </div>

        {/* Grid of Top Providers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topProviders.map((provider, index) => {
            const colors = THEME_COLORS[index % THEME_COLORS.length];
            return (
              <Card key={provider.uuid} className="bg-white border border-[#f8f4ef] rounded-3xl p-6 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                <Card.Header className="flex flex-row items-center justify-between p-0 mb-5">
                  <div className="flex items-center gap-3">
                    {provider.logo_url ? (
                      <img
                        src={provider.logo_url}
                        alt={provider.display_name}
                        className="w-10 h-10 rounded-full object-cover bg-[#f8f4ef] border border-[#f5ddd9]/60"
                      />
                    ) : (
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
                        style={{ backgroundColor: colors.accentColor }}
                      >
                        {provider.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#6b6560]">Provider</span>
                      <span className="text-[10px] text-[#6b6560b2] flex items-center gap-1">
                        <FiClockIcon size={10} />
                        Active Now
                      </span>
                    </div>
                  </div>
                  
                  <Chip className="bg-[#ffffff] border border-[#f5ddd9] text-[#e05d45] rounded-full text-[10px] font-bold px-2 py-0.5">
                    <Chip.Label>Featured</Chip.Label>
                  </Chip>
                </Card.Header>

                <Card.Content className="flex flex-col gap-2 p-0 mb-6">
                  <h3 className="text-base font-bold text-[#1f1b18] hover:text-[#e05d45] transition-colors leading-snug">
                    {provider.display_name}
                  </h3>
                  <p className="text-[#6b6560] text-xs leading-relaxed line-clamp-2">
                    Verified DeFi protocol offering automated smart agent tasks and high yield reward pools on QuPilot.
                  </p>
                </Card.Content>

                <Card.Footer className="flex items-center justify-between p-0 border-t border-[#f8f4ef] pt-4 mt-auto">
                  <div className="flex items-center gap-1 text-[#f59e0b] font-bold text-xs">
                    <FaCoins size={12} />
                    <span>{formatReward(provider.total_deposit_reward_pool)} SOL Pool</span>
                  </div>
                  
                  <Link 
                    href={`/quests?provider=${encodeURIComponent(provider.display_name)}`} 
                    className="text-xs font-bold text-[#e05d45] hover:text-[#c94d35] flex items-center gap-1 transition-colors group"
                  >
                    Explore
                    <FaChevronRight size={8} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Card.Footer>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
