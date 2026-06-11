"use client";

import React from "react";
import LeaderboardContent from "@/app/components/LeaderboardContent";

export default function LeaderboardPage() {
  return (
    <div className="flex flex-col gap-10 max-w-6xl mx-auto px-4 md:px-8 py-6">
      {/* Header Section */}
      <div className="text-center max-w-2xl mx-auto flex flex-col gap-3">
        <h1 className="text-display text-[#f97316] text-4xl md:text-5xl font-extrabold tracking-tight">
          Global Rankings
        </h1>
        <p className="text-body-lg text-[#6b6560] leading-relaxed">
          Climb the ranks, complete quests, and become the top explorer in the QuPilot universe.
        </p>
      </div>

      <LeaderboardContent limit={100} />
    </div>
  );
}
