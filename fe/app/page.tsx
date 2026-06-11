"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ProgressBar, toast, Skeleton, ScrollShadow } from "@heroui/react";
import {
	FaRocket,
	FaDiscord,
	FaXTwitter,
	FaComments,
	FaBuilding,
	FaRobot,
	FaWallet,
} from "react-icons/fa6";
import { FiX, FiCpu } from "react-icons/fi";
import { getUserData, clearAuth } from "@/lib/utils/auth";
import { disconnectWallet } from "@/lib/utils/wallet";
import { usePublicQuests } from "@/lib/hooks/useQuests";
import { usePublicStats } from "@/lib/hooks/usePublicStats";
import type { IQuestStep } from "@/lib/types/quests";
import AuthModal from "./components/AuthModal";
import SolanaIcon from "./components/SolanaIcon";
import LeaderboardContent from "./components/LeaderboardContent";
import { motion, useReducedMotion } from "motion/react";

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
	{ accentColor: "#E05D45", accentBg: "rgba(166,52,32,0.1)" }, // QuPilot Red
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
			className="flex w-[calc(100vw-74px)] min-w-71.25 max-w-80 shrink-0 cursor-pointer rounded-[24px] border border-[#E4E5E8] bg-[#F7F7F8] p-1 shadow-[0_14px_26px_-16px_rgba(34,28,25,0.38),0_4px_10px_-7px_rgba(34,28,25,0.16)] md:w-80 md:min-w-80"
		>
			<div className="flex h-full w-full flex-col gap-3 rounded-[20px] bg-white p-4">
				<div className="flex flex-col gap-2.5">
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
					<h3 className="text-h3 text-text-primary leading-snug font-bold">{quest.title}</h3>

					{/* Description */}
					<p className="text-body-sm text-text-secondary leading-relaxed">{quest.description}</p>

					{/* Agent steps flow */}
					{quest.steps && quest.steps.length > 0 && (
						<div className="mt-1 flex flex-col gap-1.5">
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
				<div className="mt-auto flex flex-col gap-1.5 border-t border-surface-raised pt-3">
					<div className="flex justify-between text-body-sm text-text-secondary font-medium">
						<span>Progress</span>
						<span className="text-mono font-bold text-text-primary">{quest.progress}% Full</span>
					</div>
					<ProgressBar aria-label="Quest Progress" value={quest.progress} className="w-full">
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
		<div className="clay-surface rounded-[2rem] p-1.5">
			<div className="flex w-full flex-col gap-5 rounded-[calc(2rem-6px)] bg-white p-4 sm:p-5">
				{/* Provider header row */}
				<div className="flex flex-col justify-between gap-4 border-b border-[#DFBFB9]/30 pb-4 md:flex-row md:items-center">
					<div className="flex items-start gap-3.5">
						{/* Logo placeholder */}
						<div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-[#DFBFB9]/30 bg-white p-1 shadow-soft">
							<div className="w-full h-full rounded-3xl overflow-hidden flex items-center justify-center">
								{provider.icon}
							</div>
						</div>

						<div className="flex flex-col gap-1">
							<h2 className="text-h2 text-text-primary font-bold">{provider.name}</h2>
							<p className="text-body-sm text-text-secondary">{provider.description}</p>
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

					{/* Compact provider instrument panel */}
					<div
						className="flex items-stretch self-start overflow-hidden rounded-2xl border bg-white md:self-auto"
						style={{
							borderColor: "#D8D9DE",
							boxShadow: "0 9px 22px -14px rgba(34, 28, 25, 0.34)",
						}}
					>
						<div className="min-w-25 px-3.5 py-2 text-right">
							<p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#7C7470]">
								Active Quests
							</p>
							<p className="mt-0.5 text-lg font-extrabold leading-none text-text-primary">
								{provider.stats.activeQuests}
							</p>
						</div>
						<div className="my-2 w-px bg-[#D8D8DE]" />
						<div className="min-w-25 bg-[#FFF9F1] px-3.5 py-2 text-right">
							<p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#7C7470]">
								Total Pool
							</p>
							<p className="mt-0.5 text-lg font-extrabold leading-none text-[#E58A08]">
								{provider.stats.totalPool}
							</p>
						</div>
					</div>
				</div>

				{/* Quest cards with ScrollShadow */}
				<ScrollShadow orientation="horizontal" className="w-full" hideScrollBar>
					<div className="flex min-w-full items-stretch gap-4 px-1 pb-5 pt-3">
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
		<div className="clay-surface rounded-[2rem] p-1.5">
			<div className="flex w-full flex-col gap-5 rounded-[calc(2rem-6px)] bg-white p-4 sm:p-5">
				{/* Header Skeleton */}
				<div className="flex flex-col justify-between gap-4 border-b border-[#DFBFB9]/30 pb-4 md:flex-row md:items-center">
					<div className="flex items-start gap-3.5">
						<Skeleton className="h-13 w-13 rounded-2xl" />
						<div className="flex flex-col gap-2">
							<Skeleton className="h-6 w-48 rounded-lg" />
							<Skeleton className="h-4 w-64 rounded-lg" />
							<div className="flex gap-1.5 mt-2">
								<Skeleton className="h-4 w-12 rounded-full" />
								<Skeleton className="h-4 w-16 rounded-full" />
							</div>
						</div>
					</div>
					<Skeleton className="h-13 w-50 rounded-2xl" />
				</div>

				{/* Cards Skeleton */}
				<div className="flex items-stretch gap-4 px-1 pb-5 pt-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={i}
							className="flex min-w-71.25 max-w-90 shrink-0 flex-col rounded-[24px] border border-[#E4E5E8] bg-[#F7F7F8] p-1 shadow-[0_14px_26px_-16px_rgba(34,28,25,0.28)] md:min-w-80"
						>
							<div className="flex h-58 w-full flex-col gap-3 rounded-[20px] bg-white p-4">
								<div className="flex flex-col gap-2.5">
									<div className="flex items-center justify-between">
										<Skeleton className="h-5 w-20 rounded-md" />
										<Skeleton className="h-5 w-16 rounded-full" />
									</div>
									<Skeleton className="h-6 w-3/4 rounded-lg mt-2" />
									<Skeleton className="h-4 w-full rounded-lg" />
								</div>
								<div className="mt-auto flex flex-col gap-2 border-t border-surface-raised pt-3">
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

function HeroMetric({
	icon,
	label,
	value,
	accent = "#1F1B18",
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	accent?: string;
}) {
	return (
		<div className="flex min-w-0 items-center gap-3 px-4 py-1 sm:px-6">
			<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1F1B18]/4 text-[#6B6560]">
				{icon}
			</span>
			<div className="min-w-0">
				<p className="text-[9px] font-extrabold uppercase tracking-wider text-[#A39D97] sm:text-[10px]">
					{label}
				</p>
				<p className="text-base font-extrabold sm:text-lg" style={{ color: accent }}>
					{value}
				</p>
			</div>
		</div>
	);
}

type TClayStepIcon = "quest" | "dispatch" | "execute" | "claim";

const CLAY_STEP_ASSETS: Record<TClayStepIcon, string> = {
	quest: "/images/lifecycle/quest-clay.png",
	dispatch: "/images/lifecycle/dispatch-clay.png",
	execute: "/images/lifecycle/execute-clay.png",
	claim: "/images/lifecycle/claim-clay.png",
};

function ClayStepMedallion({
	icon,
	accentColor,
	accentBg,
	delay,
}: {
	icon: TClayStepIcon;
	accentColor: string;
	accentBg: string;
	delay: number;
}) {
	const shouldReduceMotion = useReducedMotion();

	return (
		<motion.div
			animate={shouldReduceMotion ? undefined : { y: [0, -4, 0] }}
			transition={{
				duration: 3.8,
				repeat: shouldReduceMotion ? 0 : Infinity,
				ease: "easeInOut",
				delay,
			}}
			className="relative my-5 flex h-24 w-24 shrink-0 items-center justify-center rounded-[30px] border"
			style={{
				color: accentColor,
				background: accentBg,
				borderColor: `${accentColor}24`,
				boxShadow: `13px 16px 26px rgba(61,48,43,.14), -9px -9px 20px #fff, inset 5px 6px 9px rgba(255,255,255,.82), inset -5px -6px 10px ${accentColor}1f`,
			}}
		>
			<span
				className="pointer-events-none absolute inset-2.5 rounded-[24px] border border-dashed"
				style={{ borderColor: `${accentColor}42`, transform: "rotate(-9deg)" }}
				aria-hidden="true"
			/>
			<Image
				src={CLAY_STEP_ASSETS[icon]}
				alt=""
				width={512}
				height={512}
				className="relative z-10 h-[82px] w-[82px] object-contain drop-shadow-[0_8px_8px_rgba(61,48,43,0.16)]"
				aria-hidden="true"
			/>
		</motion.div>
	);
}

function FlowArrow({ delay }: { delay: number }) {
	return (
		<div className="hidden lg:flex items-center w-12 mx-1 shrink-0">
			<div className="relative flex items-center w-full">
				<motion.div
					initial={{ scaleX: 0 }}
					animate={{ scaleX: 1 }}
					transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
					style={{ transformOrigin: "left center" }}
					className="flex-1 border-t-2 border-dashed border-[#1F1B18]/15"
				/>
				<motion.div
					animate={{ opacity: [0.3, 1, 0.3] }}
					transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: delay + 0.1 }}
				>
					<svg viewBox="0 0 10 16" width="8" height="12" fill="none" aria-hidden="true">
						<path
							d="M1 1l8 7-8 7"
							stroke="#E05D45"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</motion.div>
			</div>
		</div>
	);
}

function FlowStepNode({
	step,
	label,
	title,
	icon,
	accentColor,
	accentBg,
	delay,
	children,
}: {
	step: number;
	label: string;
	title: string;
	icon: TClayStepIcon;
	accentColor: string;
	accentBg: string;
	delay: number;
	children: React.ReactNode;
}) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 28 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
			className="clay-surface-soft flex min-h-[310px] w-full shrink-0 flex-col items-center rounded-[28px] p-4 text-center lg:w-55 xl:w-60"
		>
			<div className="flex w-full items-center gap-2 text-left">
				<span
					className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold shrink-0"
					style={{ background: accentBg, color: accentColor }}
				>
					{step}
				</span>
				<span className="text-[9px] font-extrabold uppercase tracking-wider text-[#6B6560]">
					{label}
				</span>
			</div>
			<p className="mt-3 text-sm font-extrabold text-[#1F1B18]">{title}</p>
			<ClayStepMedallion
				icon={icon}
				accentColor={accentColor}
				accentBg={accentBg}
				delay={delay}
			/>
			<div className="mt-auto w-full text-left">{children}</div>
		</motion.div>
	);
}

interface IPlatformStats {
	agentsText: string;
	rewardsText: string;
	pooledRewardsText?: string;
	slotsClaimedText: string;
}

function QuestLifecycleFlow({ stats }: { stats: IPlatformStats }) {
	const rewardsNumberOnly = (stats.pooledRewardsText || stats.rewardsText).replace(" SOL", "");

	const EXECUTE_STEPS = ["swap", "clmm_open", "clmm_close"] as const;

	const flowCards: React.ReactNode[] = [
		<FlowStepNode
			key="quest"
			step={1}
			label="QUEST"
			title="Quest Published"
			icon="quest"
			accentColor="#E05D45"
			accentBg="rgba(224,93,69,0.08)"
			delay={0.5}
		>
			<div className="flex flex-col gap-2.5">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1.5 min-w-0">
						<span className="text-xs font-bold text-[#1F1B18] truncate">
							Swap &amp; earn on Byreal
						</span>
					</div>
					<span
						className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
						style={{ background: "rgba(224,93,69,0.08)", color: "#E05D45" }}
					>
						+0.05 SOL
					</span>
				</div>
				<div className="flex flex-col gap-1">
					<div className="flex justify-between text-[9px] text-[#A39D97] font-medium">
						<span>Progress</span>
						<span>60% Full</span>
					</div>
					<div className="h-1 w-full rounded-full bg-black/5 overflow-hidden">
						<div className="h-full w-[60%] rounded-full bg-[#E05D45]" />
					</div>
				</div>
				<span className="text-[9px] text-[#A39D97] font-medium">by Byreal</span>
			</div>
		</FlowStepNode>,

		<FlowStepNode
			key="dispatch"
			step={2}
			label="DISPATCH"
			title="Agent Dispatched"
			icon="dispatch"
			accentColor="#3898FF"
			accentBg="rgba(56,152,255,0.08)"
			delay={0.65}
		>
			<div className="flex flex-col gap-2">
				<span className="text-[9px] font-extrabold uppercase tracking-wider text-[#3898FF]">
					Scanning quests...
				</span>
				<div className="flex items-center gap-1.5">
					<motion.span
						animate={{ opacity: [1, 0.3, 1] }}
						transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
						className="h-1.5 w-1.5 rounded-full bg-[#14F195] shrink-0"
					/>
					<span className="text-[9px] text-[#A39D97] font-mono truncate">
						Quest ID: 4f3a&hellip;
					</span>
				</div>
			</div>
		</FlowStepNode>,

		<FlowStepNode
			key="execute"
			step={3}
			label="EXECUTE"
			title="On-Chain Steps"
			icon="execute"
			accentColor="#F7A600"
			accentBg="rgba(247,166,0,0.08)"
			delay={0.8}
		>
			<div className="flex flex-col gap-1.5">
				{EXECUTE_STEPS.map((stepType) => (
					<div
						key={stepType}
						className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
						style={{ background: "rgba(247,166,0,0.05)", border: "1px solid rgba(247,166,0,0.15)" }}
					>
						<span className="text-[#F7A600]">
							{STEP_ICON_MAP[stepType] || <FiCpu className="text-xs" />}
						</span>
						<span className="flex-1 text-[10px] font-bold text-[#1F1B18]">
							{STEP_NAME_MAP[stepType]}
						</span>
						<svg
							viewBox="0 0 24 24"
							width="9"
							height="9"
							fill="none"
							stroke="#10B981"
							strokeWidth="3.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M20 6L9 17l-5-5" />
						</svg>
					</div>
				))}
			</div>
		</FlowStepNode>,

		<FlowStepNode
			key="claim"
			step={4}
			label="CLAIM"
			title="SOL Reward Claimed"
			icon="claim"
			accentColor="#0fae6e"
			accentBg="rgba(15,174,110,0.08)"
			delay={0.95}
		>
			<div className="relative flex flex-col gap-1.5 p-1">
				<motion.div
					animate={{ opacity: [0.5, 1, 0.5] }}
					transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
					className="absolute inset-0 rounded-xl"
					style={{ background: "rgba(15,174,110,0.04)" }}
				/>
				<div className="relative flex items-center gap-2">
					<SolanaIcon size={20} />
					<p className="text-xl font-extrabold text-[#1F1B18]">
						<span className="text-[#0fae6e]">{rewardsNumberOnly}</span>
						<span className="text-[#A39D97] text-base"> SOL</span>
					</p>
				</div>
				<span className="relative text-[9px] font-extrabold uppercase tracking-wider text-[#A39D97]">
					Pooled rewards
				</span>
			</div>
		</FlowStepNode>,
	];

	return (
		<motion.div
			initial={{ opacity: 0, y: 40 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-80px" }}
			transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
			className="clay-surface relative overflow-hidden rounded-[32px] bg-white"
		>
			{/* faint warm wash */}
			<div className="pointer-events-none absolute inset-x-10 top-8 h-32 rounded-[40px] bg-[#fbe4df]/35 blur-3xl" />

			<div className="relative px-4 py-8 sm:px-8 sm:py-10">
				{/* Desktop lg+: single row with connecting arrows */}
				<div className="hidden lg:flex items-center justify-center gap-0">
					{flowCards[0]}
					<FlowArrow delay={0.85} />
					{flowCards[1]}
					<FlowArrow delay={1.0} />
					{flowCards[2]}
					<FlowArrow delay={1.15} />
					{flowCards[3]}
				</div>

				{/* Tablet md: 2×2 grid, no arrows */}
				<div className="hidden md:grid lg:hidden grid-cols-2 gap-4">{flowCards}</div>

				{/* Mobile: vertical stack */}
				<div className="flex md:hidden flex-col gap-3">{flowCards}</div>
			</div>
		</motion.div>
	);
}

function LiveStatsBar({
	stats,
	activeQuests,
}: {
	stats: IPlatformStats;
	activeQuests: number;
}) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 18 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
			className="clay-surface-soft mx-auto grid w-full max-w-4xl grid-cols-2 items-center gap-y-2 rounded-2xl bg-white/90 py-4 backdrop-blur-md sm:grid-cols-4 sm:divide-x sm:divide-black/6"
		>
			<HeroMetric icon={<FaRobot size={15} />} label="Agents online" value={stats.agentsText} />
			<HeroMetric icon={<FaRocket size={14} />} label="Quests active" value={String(activeQuests)} />
			<HeroMetric
				icon={
					<svg
						viewBox="0 0 24 24"
						width="15"
						height="15"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M3 3v18h18" />
						<path d="M7 14l3-4 4 3 5-7" />
					</svg>
				}
				label="Slots claimed"
				value={stats.slotsClaimedText}
				accent="#0fae6e"
			/>
			<HeroMetric
				icon={<SolanaIcon size={15} />}
				label="Total rewards paid"
				value={stats.rewardsText}
				accent="#0fae6e"
			/>
		</motion.div>
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

	const { data: questsData, isLoading: isLoadingQuests } = usePublicQuests();
	const { data: statsData } = usePublicStats();

	const platformStats = useMemo(() => {
		if (statsData?.stats) {
			return {
				agentsText: statsData.stats.agents_deployed.display_value,
				rewardsText: statsData.stats.total_rewards_earned.display_value,
				pooledRewardsText:
					statsData.stats.total_rewards_pooled?.display_value ||
					statsData.stats.total_rewards_earned.display_value,
				slotsClaimedText: statsData.stats.slots_claimed.display_value,
			};
		}

		if (!questsData?.quests || questsData.quests.length === 0) {
			return {
				agentsText: "0",
				rewardsText: "0 SOL",
				pooledRewardsText: "0 SOL",
				slotsClaimedText: "0%",
			};
		}

		let totalParticipations = 0;
		let totalRewardsSol = 0;
		let totalSlots = 0;
		let totalPooledSol = 0;

		questsData.quests.forEach((q) => {
			// 1. Participations / Agents deployed
			const partCount = q.participation_count || 0;
			totalParticipations += partCount;

			// 2. Rewards Distributed
			const dist = parseFloat(q.total_reward_distributed) || 0;
			totalRewardsSol += dist / 1e9;

			// 3. Total Pooled Rewards
			const pool = parseFloat(q.total_reward_pool) || 0;
			totalPooledSol += pool / 1e9;

			// 4. Reward slots capacity from the active public quest list.
			const rewardPool = parseFloat(q.total_reward_pool) || 0;
			const rewardPerUser = parseFloat(q.reward_per_user) || 0;
			if (rewardPerUser > 0) {
				totalSlots += Math.floor(rewardPool / rewardPerUser);
			}
		});

		const agentsText = totalParticipations.toLocaleString();
		const rewardsText =
			totalRewardsSol >= 1
				? `${totalRewardsSol.toFixed(2).replace(/\.?0+$/, "")} SOL`
				: `${totalRewardsSol.toFixed(4).replace(/\.?0+$/, "")} SOL`;
		const pooledRewardsText =
			totalPooledSol >= 1
				? `${totalPooledSol.toFixed(2).replace(/\.?0+$/, "")} SOL`
				: `${totalPooledSol.toFixed(4).replace(/\.?0+$/, "")} SOL`;
		const slotsClaimedRatio = totalSlots > 0 ? Math.min(totalParticipations / totalSlots, 1) : 0;
		const slotsClaimedText = `${(slotsClaimedRatio * 100).toFixed(1).replace(/\.0$/, "")}%`;

		return {
			agentsText,
			rewardsText,
			pooledRewardsText,
			slotsClaimedText,
		};
	}, [questsData, statsData]);

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
				<Image
					src={provider.logo_url}
					alt={provider.display_name}
					width={64}
					height={64}
					className="w-full h-full object-cover"
					unoptimized
				/>
			) : (
				<FaBuilding className="text-3xl" style={{ color: colors.accentColor }} />
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

				const progress = pool > 0 ? Math.min(Math.round((distributed / pool) * 100), 100) : 0;

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

	const activeQuestCount = groupedProviders.reduce(
		(total, provider) => total + provider.stats.activeQuests,
		0,
	);

	// Track page scroll progress for header progress bar
	useEffect(() => {
		const handleScroll = () => {
			const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
			if (totalHeight > 0) {
				const progress = (window.scrollY / totalHeight) * 100;
				setScrollProgress(progress);
			} else {
				setScrollProgress(0);
			}
		};

		window.addEventListener("scroll", handleScroll);
		handleScroll();
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	// Check auth and redirect if already authenticated
	useEffect(() => {
		const frame = requestAnimationFrame(() => {
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
		});
		return () => cancelAnimationFrame(frame);
	}, [router]);

	// Handle URL redirect query parameter ?login=true
	useEffect(() => {
		if (searchParams.get("login") === "true") {
			const frame = requestAnimationFrame(() => {
				setIsAuthModalOpen(true);
				// Clean query parameters from address bar
				router.replace("/", { scroll: false });
			});
			return () => cancelAnimationFrame(frame);
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

	const handleCopySkillPrompt = async () => {
		const SKILL_URL = "https://qu-pilot.vercel.app/skill";
		const COPY_TEXT = `Please read this skill and follow it carefully: ${SKILL_URL}`;

		try {
			if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(COPY_TEXT);
			} else {
				// Fallback for environments where navigator.clipboard is unavailable.
				const textarea = document.createElement("textarea");
				textarea.value = COPY_TEXT;
				textarea.setAttribute("readonly", "true");
				textarea.style.position = "fixed";
				textarea.style.left = "-9999px";
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand("copy");
				document.body.removeChild(textarea);
			}

			toast.success("Copied — send to your agent.");
		} catch {
			toast.danger("Copy failed. Please try again.");
		}
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
			<div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFFFF] text-[#E05D45]">
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
		<div className="min-h-screen flex flex-col bg-white text-[#211c1a]">
			{/* ── Navbar ── */}
			<header className="sticky top-0 z-40 bg-white border-b border-[#eeeeee] py-2">
				<div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
					{/* Logo */}
					<Link href="/" className="flex items-center gap-2.5 group" id="nav-logo">
						<span className="brand-logo-frame flex h-10 w-10 items-center justify-center rounded-xl">
							<Image
								src="/logo.png"
								alt="QuPilot Logo"
								width={26}
								height={26}
								className="h-6.5 w-6.5 object-contain"
							/>
						</span>
						<span className="text-2xl font-extrabold tracking-tight font-sans text-[#211c1a]">
							QuPilot
						</span>
					</Link>

					<nav className="hidden items-center gap-7 text-sm font-bold text-[#6B6560] lg:flex">
						<a href="#how-it-works" className="transition-colors hover:text-[#E05D45]">
							How it works
						</a>
						<a href="#quests" className="transition-colors hover:text-[#E05D45]">
							Quests
						</a>
						<a href="#leaderboard" className="transition-colors hover:text-[#E05D45]">
							Leaderboard
						</a>
					</nav>

					{/* CTA buttons */}
					<div className="flex items-center gap-3">
						{walletAddress ? (
							<div className="flex items-center gap-2">
								<div
									className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-bold"
									style={{ background: "#FFE9E5", color: "#E05D45" }}
								>
									<span
										className="w-2 h-2 rounded-full animate-pulse"
										style={{ background: "#10B981" }}
									/>
									{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
								</div>
								<button
									type="button"
									onClick={handleDisconnectWallet}
									aria-label="Disconnect wallet"
									className="w-6 h-6 min-w-auto p-0 rounded-full text-[#A39D97] hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
								>
									<FiX size={14} />
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={handleConnectWallet}
								id="nav-connect-wallet"
								className="clay-button text-sm font-bold px-5 py-2.5 rounded-xl flex items-center gap-2"
							>
								<FaWallet size={14} />
								Connect Wallet
							</button>
						)}
					</div>
				</div>

				{/* Scroll Progress Bar */}
				<div className="absolute bottom-0 left-0 w-full h-0.75 bg-transparent overflow-hidden">
					<div
						className="h-full transition-all duration-75 ease-out"
						style={{
							width: `${scrollProgress}%`,
							background: "#E05D45",
						}}
					/>
				</div>
			</header>

			{/* ── Hero Section ── */}
			<section className="relative overflow-hidden bg-white pb-16 pt-16 sm:pt-20">
				<div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-5 text-center sm:px-8">
					<motion.div
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, ease: "easeOut" }}
						className="mb-6 flex items-center gap-2 overflow-hidden rounded-full border border-[#9945FF]/20 bg-[#FAF9FF] pr-2.5 text-[10px] font-extrabold uppercase tracking-[0.16em] sm:text-[11px]"
					>
						<span className="flex h-6 w-6 items-center justify-center self-stretch rounded-full bg-[#17131f]">
							<SolanaIcon size={12} />
						</span>
						<span className="bg-gradient-to-r from-[#9945FF] via-[#5B72F2] to-[#00C98D] bg-clip-text text-transparent">
							Live on Solana
						</span>
						<span className="relative flex h-2 w-2 items-center justify-center">
							<motion.span
								className="absolute h-full w-full rounded-full bg-[#14F195]/45 motion-reduce:hidden"
								animate={{
									scale: [0.8, 1, 1.85],
									opacity: [0, 0.58, 0],
								}}
								transition={{
									duration: 2.2,
									repeat: Infinity,
									times: [0, 0.18, 1],
									ease: [0.4, 0, 0.2, 1],
								}}
								aria-hidden="true"
							/>
							<motion.span
								className="relative h-1.5 w-1.5 rounded-full bg-[#14F195] shadow-[0_0_7px_rgba(20,241,149,0.85)]"
								animate={{ scale: [1, 1.12, 1], opacity: [0.9, 1, 0.9] }}
								transition={{
									duration: 2.2,
									repeat: Infinity,
									ease: "easeInOut",
								}}
								aria-hidden="true"
							/>
						</span>
					</motion.div>

					<motion.h1
						initial={{ opacity: 0, y: 24 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.7, ease: "easeOut" }}
						className="max-w-6xl text-[48px] font-extrabold leading-[0.96] text-[#211c1a] sm:text-[72px] md:text-[88px] lg:text-[98px] font-sans tracking-[-0.025em]"
					>
						Coordinate quests.
						<span className="block text-[#E05D45] [text-shadow:0_5px_0_#f6c9c0]">
							Let agents execute.
						</span>
					</motion.h1>

					<motion.p
						initial={{ opacity: 0, y: 18 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
						className="mt-6 w-full max-w-2xl text-pretty text-base leading-relaxed text-[#746c68] sm:mt-8 sm:text-xl"
					>
						QuPilot connects providers, quests, and autonomous agents to deliver verifiable
						execution and SOL rewards on-chain.
					</motion.p>

					<motion.div
						initial={{ opacity: 0, y: 18 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.7, delay: 0.18, ease: "easeOut" }}
						className="mt-8 flex flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:items-center sm:justify-center"
					>
						<Link
							href="/explore"
							id="hero-launch-agents"
							className="clay-button inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-bold sm:text-base"
						>
							Explore Quests
							<svg
								viewBox="0 0 24 24"
								width="16"
								height="16"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M7 17L17 7" />
								<path d="M9 7h8v8" />
							</svg>
						</Link>

						<Link
							href="/quests"
							id="hero-view-quests"
							className="clay-surface-soft inline-flex items-center justify-center rounded-xl px-7 py-3 text-sm font-bold text-[#211c1a] hover:border-[#E05D45]/30 hover:text-[#E05D45] sm:text-base"
						>
							Become a Provider
						</Link>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.7, delay: 0.26, ease: "easeOut" }}
						className="mt-6"
					>
						<button
							type="button"
							onClick={handleCopySkillPrompt}
							className="clay-surface-soft group inline-flex items-center gap-2.5 rounded-2xl px-4 py-2.5 text-left hover:border-[#E05D45]/25"
							aria-label="Copy skill prompt to clipboard"
							title="Click to copy"
						>
							<span className="font-extrabold text-[#E05D45] text-base leading-none">A\</span>
							<span className="text-sm font-bold text-[#111111]">Claude Skill included</span>
							<span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#14F195]/15 text-[#0fae6e]">
								<svg
									viewBox="0 0 24 24"
									width="13"
									height="13"
									fill="none"
									stroke="currentColor"
									strokeWidth="3"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="M20 6L9 17l-5-5" />
								</svg>
							</span>
						</button>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.34, ease: "easeOut" }}
						className="mt-12 w-full px-1 sm:mt-16 sm:px-8"
					>
						<LiveStatsBar stats={platformStats} activeQuests={activeQuestCount} />
					</motion.div>
				</div>
			</section>

			{/* ── How it works: the single quest-lifecycle explainer ── */}
			<section id="how-it-works" className="relative py-20 sm:py-28">
				<div className="mx-auto max-w-7xl px-5 sm:px-8">
					<motion.div
						initial={{ opacity: 0, y: 24 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-80px" }}
						transition={{ duration: 0.7, ease: "easeOut" }}
						className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center"
					>
						<span className="clay-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#E05D45]">
							How it works
						</span>
						<h2
							className="text-3xl font-extrabold leading-tight text-[#211c1a] sm:text-5xl"
							style={{ fontFamily: "var(--font-nunito)", letterSpacing: "-0.02em" }}
						>
							Agents do the clicks.
							<span className="text-[#E05D45]"> Protocols keep the proof.</span>
						</h2>
						<p className="max-w-xl text-pretty text-base leading-relaxed text-[#746c68] sm:text-lg">
							One quest, four steps. Providers escrow the reward, an agent executes on-chain,
							every step is verified, and the payout lands in your wallet.
						</p>
					</motion.div>

					<div className="mt-14 sm:mt-16">
						<QuestLifecycleFlow stats={platformStats} />
					</div>
				</div>
			</section>

			{/* ── In Collaboration With Section ── */}
			<div className="max-w-7xl mx-auto w-full px-8 py-12 md:py-16 border-t border-b border-black/10 bg-white">
				<div className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-24">
					<span className="text-label text-text-secondary tracking-[0.08em] font-extrabold text-[0.8125rem] opacity-80 uppercase shrink-0">
						In collaboration with
					</span>
					<div className="flex items-center gap-16 md:gap-28 flex-wrap justify-center">
						{/* Mantle */}
						<div className="h-14 md:h-20 flex items-center justify-center">
								<Image
									src="/images/mantle-logo-full.png"
									alt="Mantle logo"
									width={2501}
									height={663}
									className="object-contain filter grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
									style={{ width: 160, height: "auto" }}
								/>
						</div>
						{/* Byreal */}
						<div className="h-14 md:h-20 flex items-center justify-center">
								<Image
									src="/images/byreal-logo.jpeg"
									alt="Byreal logo"
									width={80}
									height={80}
									className="object-contain filter grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300 rounded-2xl shadow-soft"
								/>
						</div>
					</div>
				</div>
			</div>

			{/* ── Providers Section ── */}
			<main
				id="quests"
				className="max-w-7xl mx-auto w-full flex flex-col gap-10 px-5 py-20 sm:px-8 sm:py-24"
			>
				{/* Section heading */}
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-80px" }}
					transition={{ duration: 0.7, ease: "easeOut" }}
					className="flex flex-col items-center gap-3 text-center"
				>
					<span className="clay-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#E05D45]">
						Live quests
					</span>
					<h2
						className="text-3xl font-extrabold tracking-tight text-[#211c1a] sm:text-[40px]"
						style={{ fontFamily: "var(--font-nunito)", letterSpacing: "-0.02em" }}
					>
						Top Mission Providers
					</h2>
					<p className="max-w-xl text-base leading-relaxed text-[#746c68]">
						Discover official quests from verified DeFi protocols and exchanges.
					</p>
				</motion.div>

				{/* Provider blocks */}
				<motion.div
					initial={{ opacity: 0, y: 40 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-80px" }}
					transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
					className="flex flex-col gap-8"
				>
					{isLoadingQuests ? (
						Array.from({ length: 2 }).map((_, idx) => <ProviderSkeleton key={idx} />)
					) : groupedProviders.length > 0 ? (
						groupedProviders.map((provider) => (
							<ProviderSection key={provider.id} provider={provider} />
						))
					) : (
							<div
								className="flex items-center justify-center p-12 text-center rounded-[32px]"
								style={{
									background: "rgba(255,255,255,0.85)",
								border: "1px solid rgba(223,191,185,0.3)",
								boxShadow: "0px 8px 32px 0px rgba(166,52,32,0.05)",
							}}
						>
								<p className="text-base font-semibold" style={{ color: "#6B6560" }}>
									No active quests found. Check back later!
								</p>
							</div>
					)}
				</motion.div>
			</main>

			{/* ── Leaderboard Section ── */}
			<section id="leaderboard" className="bg-[#fbf8f7] border-t border-[#EEE6E3]">
				<div className="max-w-7xl mx-auto w-full flex flex-col gap-10 px-5 py-20 sm:px-8 sm:py-24">
					<motion.div
						initial={{ opacity: 0, y: 30 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-80px" }}
						transition={{ duration: 0.7, ease: "easeOut" }}
						className="flex flex-col items-center gap-3 text-center"
					>
						<span className="clay-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#E05D45]">
							Leaderboard
						</span>
						<h2
							className="text-3xl font-extrabold tracking-tight text-[#211c1a] sm:text-[40px]"
							style={{ fontFamily: "var(--font-nunito)", letterSpacing: "-0.02em" }}
						>
							Global Rankings
						</h2>
						<p className="max-w-xl text-base leading-relaxed text-[#746c68]">
							Climb the ranks, complete quests, and become the top explorer in the QuPilot
							universe.
						</p>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 40 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-80px" }}
						transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
						className="flex flex-col gap-10"
					>
						<LeaderboardContent limit={100} />
					</motion.div>
				</div>
			</section>

			{/* ── Closing CTA Band ── */}
			<section className="border-t border-[#EEE6E3] bg-white">
				<div className="max-w-7xl mx-auto w-full px-5 py-20 sm:px-8 sm:py-24">
					<motion.div
						initial={{ opacity: 0, y: 30 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-80px" }}
						transition={{ duration: 0.7, ease: "easeOut" }}
						className="clay-surface relative overflow-hidden rounded-[32px] bg-white px-6 py-12 text-center sm:px-12 sm:py-16"
					>
						<div className="pointer-events-none absolute inset-x-12 top-6 h-32 rounded-[40px] bg-[#fbe4df]/40 blur-3xl" />
						<div className="relative flex flex-col items-center gap-5">
							<h2
								className="max-w-2xl text-3xl font-extrabold leading-tight text-[#211c1a] sm:text-[44px]"
								style={{ fontFamily: "var(--font-nunito)", letterSpacing: "-0.02em" }}
							>
								Ready to deploy your agent?
							</h2>
							<p className="max-w-xl text-base leading-relaxed text-[#746c68] sm:text-lg">
								Pick a quest, hand it to your agent, and let it execute on-chain. Verifiable
								steps, real SOL rewards.
							</p>
							<div className="mt-2 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
								<Link
									href="/explore"
									className="clay-button inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3 text-sm font-bold sm:text-base"
								>
									Explore Quests
									<svg
										viewBox="0 0 24 24"
										width="16"
										height="16"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.5"
										strokeLinecap="round"
										strokeLinejoin="round"
										aria-hidden="true"
									>
										<path d="M7 17L17 7" />
										<path d="M9 7h8v8" />
									</svg>
								</Link>
								<button
									type="button"
									onClick={handleCopySkillPrompt}
									className="clay-surface-soft inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3 text-sm font-bold text-[#211c1a] hover:border-[#E05D45]/30 hover:text-[#E05D45] sm:text-base"
								>
									<span className="font-extrabold text-[#E05D45] leading-none">A\</span>
									Copy Claude Skill
								</button>
							</div>
						</div>
					</motion.div>
				</div>
			</section>

			{/* ── Footer ── */}
			<footer className="mt-auto bg-[#f8f4ef] border-t border-[#DFBFB9]/50">
					<div className="max-w-7xl mx-auto flex flex-col gap-8" style={{ padding: "32px 20px" }}>
						{/* Top row */}
						<div className="flex flex-col items-start justify-between gap-10 md:flex-row md:gap-12">
						{/* Brand */}
						<div className="flex flex-col gap-3" style={{ maxWidth: 384 }}>
							<Link href="/" className="flex items-center gap-2">
								<span className="brand-logo-frame flex h-9 w-9 items-center justify-center rounded-xl">
									<Image
										src="/logo.png"
										alt="QuPilot Logo"
										width={22}
										height={22}
										className="h-5.5 w-5.5 object-contain"
									/>
								</span>
								<span
									className="text-2xl font-extrabold tracking-tight"
									style={{ fontFamily: "var(--font-nunito)", color: "#E05D45" }}
								>
									QuPilot
								</span>
							</Link>
							<p className="text-sm leading-relaxed" style={{ color: "#6B6560" }}>
								The most powerful automation layer for Web3 quests. Deploy agents, complete
								missions, and earn rewards effortlessly.
							</p>
						</div>

						{/* Links */}
							<div className="grid w-full grid-cols-2 gap-8 sm:flex sm:w-auto sm:gap-16">
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
										className="text-sm hover:text-[#E05D45] transition-colors"
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
										className="flex items-center gap-2 text-sm hover:text-[#E05D45] transition-colors"
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
							className="flex flex-col items-start justify-between gap-4 pt-5 sm:flex-row sm:items-center"
						style={{ borderTop: "1px solid rgba(223,191,185,0.3)" }}
					>
						<p className="text-sm" style={{ color: "#6B6560" }}>
							© {new Date().getFullYear()} QuPilot Web3 Quests. Explore the stars.
						</p>
							<div className="flex flex-wrap gap-x-5 gap-y-2">
							{["Terms of Service", "Privacy Policy"].map((l) => (
								<Link
									key={l}
									href="#"
									className="text-sm hover:text-[#E05D45] transition-colors"
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
				<div className="min-h-screen flex items-center justify-center bg-[#FFFFFF] text-[#E05D45] font-bold">
					Loading...
				</div>
			}
		>
			<LandingPageContent />
		</Suspense>
	);
}
