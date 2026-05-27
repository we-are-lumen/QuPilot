"use client";

import React, { useState, Suspense } from "react";
import { Card, Button, Spinner, Skeleton } from "@heroui/react";
import { FiArrowRight, FiCompass } from "react-icons/fi";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { getPublicQuests } from "@/lib/api/quests";

const formatReward = (rewardStr: string) => {
  try {
    const lamports = BigInt(rewardStr);
    const parsed = Number(lamports) / 1e9;
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(parsed);
  } catch (error) {
    return rewardStr;
  }
};

function QuestExplorerPageContent() {
  const searchParams = useSearchParams();
  const providerParam = searchParams.get("provider");
  const [activeFilter, setActiveFilter] = useState(providerParam || "All Quests");

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-quests"],
    queryFn: () => getPublicQuests(),
  });

  const quests = data?.quests || [];

  // Extract unique protocols and providers for filters dynamically
  const protocols = Array.from(new Set(quests.map((q) => q.protocol).filter(Boolean)));
  const providers = Array.from(new Set(quests.map((q) => q.provider?.display_name).filter(Boolean)));
  const FILTERS = ["All Quests", ...Array.from(new Set([...protocols, ...providers]))];

  const filteredQuests = activeFilter === "All Quests"
    ? quests
    : quests.filter((q) => 
        q.protocol?.toLowerCase() === activeFilter.toLowerCase() || 
        q.provider?.display_name?.toLowerCase() === activeFilter.toLowerCase()
      );

  return (
    <div className="flex flex-col gap-10">
      {/* Header Section */}
      <section className="flex flex-col gap-3">
        <h1 className="text-4xl font-extrabold text-[#a63420] tracking-tight">Quest Explorer</h1>
        <p className="text-[17px] text-[#6b6560] max-w-200 leading-relaxed">
          Explore new frontiers, connect with top providers, and embark on personalized quests
          designed for your journey across the Web3 galaxy.
        </p>
      </section>

      {/* Filters Section */}
      <section className="flex flex-wrap items-center justify-between gap-6">
        <h2 className="text-2xl font-bold text-[#a63420]">Active Missions</h2>
        {!isLoading && !error && FILTERS.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 p-1 bg-white border border-[#dfbfb94d] rounded-full">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap capitalize ${
                  activeFilter === filter
                    ? "bg-[#ffdad3] text-[#3f0400]"
                    : "text-[#6b6560] hover:bg-[#f8f4ef]"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Loading State (Skeletons) */}
      {isLoading && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 border border-transparent shadow-sm rounded-2xl flex flex-col gap-4">
              <Card.Header className="flex justify-between items-start p-0">
                <div className="flex items-center gap-3 w-full">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex flex-col gap-2 w-1/2">
                    <Skeleton className="h-3 w-2/3 rounded" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16 rounded-full shrink-0" />
              </Card.Header>
              <Card.Content className="p-0 flex flex-col gap-2.5 grow">
                <Skeleton className="h-5 w-3/4 rounded animate-pulse" />
                <div className="flex flex-col gap-1.5 mt-1">
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-4/5 rounded" />
                </div>
              </Card.Content>
              <Card.Footer className="p-0 pt-4 mt-auto border-t border-[#f5ddd9] flex justify-between items-center">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
              </Card.Footer>
            </Card>
          ))}
        </section>
      )}

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-[#fff5f5] border border-[#ffc1c1] rounded-2xl">
          <p className="text-lg font-bold text-[#e53e3e]">Failed to load quests</p>
          <p className="text-sm text-[#6b6560] w-full">
            We encountered an error while retrieving the active missions. Please try again later.
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredQuests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-[#fcfbfa] border border-[#dfbfb94d] rounded-2xl">
          <FiCompass className="text-4xl text-[#dfbfb9]" />
          <p className="text-lg font-bold text-[#a63420]">No missions found</p>
          <p className="text-sm text-[#6b6560]">
            There are currently no active quests for this category. Check back later for new updates!
          </p>
        </div>
      )}

      {/* Quests Grid */}
      {!isLoading && !error && filteredQuests.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuests.map((quest) => (
            <Card key={quest.uuid} className="p-5 border border-transparent hover:border-[#dfbfb94d] shadow-sm hover:shadow-md transition-all rounded-2xl flex flex-col gap-4">
              <Card.Header className="flex flex-col gap-y-3 items-start p-0">
                <div className="flex items-center gap-3">
                  {quest.provider?.logo_url ? (
                    <img
                      src={quest.provider.logo_url}
                      alt={quest.provider?.display_name || "Provider"}
                      className="w-10 h-10 rounded-full object-cover bg-[#f8f4ef]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#ffdad3] text-[#a63420] font-bold">
                      {(quest.provider?.display_name || "P").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-[#1f1b18]">
                      {quest.provider?.display_name || "Unknown Provider"}
                    </span>
                    <span className="text-xs text-[#6b6560] capitalize">
                      Protocol: {quest.protocol}
                    </span>
                  </div>
                </div>
                
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#f8f4ef] text-[#6b6560] border border-[#dfbfb94d] capitalize">
                  {quest.steps[0]?.step_type || "General"}
                </span>
              </Card.Header>
              <Card.Content className="p-0 flex flex-col gap-1.5 grow">
                <h3 className="text-lg font-bold text-[#a63420]">{quest.title}</h3>
                <p className="text-[13px] text-[#6b6560] leading-relaxed line-clamp-3">
                  {quest.description}
                </p>
              </Card.Content>
              <Card.Footer className="p-0 pt-4 mt-auto border-t border-[#f5ddd9] flex justify-between items-center">
                <span className="font-bold font-mono text-[13px] text-[#f59e0b]">
                  {formatReward(quest.reward_per_user)} SOL
                </span>
                <Link
                  href={`/quests/${quest.uuid}`}
                  className="flex items-center gap-1 text-xs font-bold text-[#a63420] hover:text-[#891e0c] transition-colors group"
                >
                  Join <FiArrowRight className="transition-transform group-hover:translate-x-1" />
                </Link>
              </Card.Footer>
            </Card>
          ))}
        </section>
      )}

      {/* Load More Button (static placeholder for future pagination) */}
      {/* {!isLoading && !error && filteredQuests.length > 0 && (
        <div className="flex justify-center mt-4">
          <Button className="bg-white border border-[#dfbfb9] text-[#a63420] font-bold px-8 py-3 rounded-full hover:bg-[#fffbf5] transition-colors shadow-sm">
            Load More Missions
          </Button>
        </div>
      )} */}
    </div>
  );
}

export default function QuestExplorerPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <h1 className="text-4xl font-extrabold text-[#a63420] tracking-tight animate-pulse">Loading Quests...</h1>
        </section>
      </div>
    }>
      <QuestExplorerPageContent />
    </Suspense>
  );
}
