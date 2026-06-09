"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Chip, ProgressBar, Skeleton } from "@heroui/react";
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
	FiClock,
	FiExternalLink,
	FiRepeat,
	FiPlusCircle,
	FiMinusCircle,
	FiCopy,
	FiUsers,
} from "react-icons/fi";
import { SOLANA_RPC_URL } from "@/config";

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
				<Skeleton className="h-48 w-full rounded-xl" />
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
						We encountered an issue fetching this quest&apos;s analytical data. Make sure you are
						authenticated and have permission to manage this quest.
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

	const { quest, analytics, participants } = data;
	const isActive = new Date(quest.expires_at) > new Date();

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
			<div className="bg-surface border-2 border-surface-variant rounded-xl p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden shadow-soft">
				{/* Decorative Blob */}
				<div className="absolute -right-10 -top-10 w-64 h-64 bg-[#ffdad3] rounded-full blur-3xl opacity-60 pointer-events-none" />

				{/* Content Info */}
				<div className="flex-1 flex flex-col gap-4 z-10 w-full">
					<div className="flex flex-wrap gap-2 items-center">
						<Chip
							color={isActive ? "success" : "default"}
							variant="soft"
							className={`${
								isActive
									? "bg-emerald-50 text-emerald-700 border-emerald-200/50"
									: "bg-stone-50 text-stone-600 border-stone-200"
							} font-bold border flex items-center gap-1.5 shrink-0`}
						>
							<span
								className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-stone-400"} inline-block`}
							/>
							<Chip.Label>{isActive ? "Active" : "Expired"}</Chip.Label>
						</Chip>
						<Chip
							variant="soft"
							className="bg-secondary-fixed text-on-secondary-fixed font-bold border border-secondary-container/20 capitalize"
						>
							<Chip.Label>{quest.protocol}</Chip.Label>
						</Chip>
						<Chip
							variant="soft"
							className="bg-surface-raised text-text-secondary font-bold border border-border capitalize"
						>
							<Chip.Label>{quest.steps?.[0]?.step_type}</Chip.Label>
						</Chip>
						<Chip
							variant="soft"
							className="bg-surface-raised text-text-secondary font-bold border border-border flex items-center gap-1.5"
						>
							<FiClock className="text-xs shrink-0" />
							<Chip.Label>Expires {new Date(quest.expires_at).toLocaleDateString()}</Chip.Label>
						</Chip>
					</div>

					<h1 className="text-h1 text-text-primary font-extrabold leading-tight mt-1">
						{quest.title}
					</h1>
					<p className="text-body-lg text-text-secondary">{quest.description}</p>

					{/* Separator and Pool Info */}
					<div className="w-full border-t border-surface-variant pt-6 mt-2 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
						{/* Reward Pool */}
						<div className="flex flex-col gap-1">
							<span className="text-label text-text-muted font-bold tracking-wider">
								TOTAL REWARD POOL
							</span>
							<div className="flex items-center gap-2 text-[#a63420] font-heading font-bold text-[17px]">
								<FiTrendingUp className="text-lg" />
								<span>{formatReward(quest.total_reward_pool)}</span>
							</div>
						</div>

						{/* Vertical Divider */}
						<div className="hidden sm:block h-10 w-px bg-surface-variant" />

						{/* Reward Per User */}
						<div className="flex flex-col gap-1">
							<span className="text-label text-text-muted font-bold tracking-wider">
								REWARD PER PILOT
							</span>
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
								<div className="flex flex-col pt-1">
									{[...quest.steps]
										.sort((a, b) => a.order_index - b.order_index)
										.map((step, i, arr) => {
											const stepMeta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
												swap:       { label: "Swap",       icon: <FiRepeat />,      color: "text-violet-600 bg-violet-50 border-violet-200" },
												clmm_open:  { label: "CLMM Open",  icon: <FiPlusCircle />,  color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
												clmm_close: { label: "CLMM Close", icon: <FiMinusCircle />, color: "text-rose-700 bg-rose-50 border-rose-200" },
												clmm_copy:  { label: "CLMM Copy",  icon: <FiCopy />,        color: "text-sky-700 bg-sky-50 border-sky-200" },
											};
											const meta = stepMeta[step.step_type] ?? { label: step.step_type, icon: <FiTerminal />, color: "text-text-secondary bg-surface-raised border-outline-variant" };
											const isLast = i === arr.length - 1;
											return (
												<div key={step.uuid} className="flex gap-3">
													{/* Rail */}
													<div className="flex flex-col items-center">
														<div className="w-7 h-7 rounded-full bg-surface border-2 border-primary flex items-center justify-center shrink-0 z-10">
															<span className="text-primary text-[10px] font-extrabold">{step.order_index + 1}</span>
														</div>
														{!isLast && <div className="w-px flex-1 bg-outline-variant my-1 min-h-5" />}
													</div>
													{/* Content */}
													<div className={`flex flex-col gap-2 ${isLast ? "pb-0" : "pb-5"} min-w-0 flex-1`}>
														<div className={`inline-flex items-center gap-1.5 self-start text-[11px] font-bold border rounded-full px-2.5 py-0.5 ${meta.color}`}>
															{meta.icon}
															<span className="uppercase tracking-wide">{meta.label}</span>
														</div>
														{Object.keys(step.action_params).length > 0 && (
															<div className="bg-surface-raised border border-outline-variant rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
																{Object.entries(step.action_params).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => (
																	<div key={key} className="flex items-baseline gap-2 min-w-0">
																		<span className="text-[10px] font-bold text-text-muted uppercase tracking-wider shrink-0">{key}</span>
																		<span className="font-mono text-[11px] text-text-secondary truncate">{String(val)}</span>
																	</div>
																))}
															</div>
														)}
													</div>
												</div>
											);
										})}
								</div>
							</div>
						</Card.Content>
					</Card>
				</div>

				{/* Right Column: Stats (takes 1 col on lg) */}
				<div className="flex flex-col gap-8">
					{/* Total Agents Badge (Red/Coral Card) */}
					<div className="bg-[#c84b35] rounded-xl p-6 text-white flex flex-col gap-2 relative overflow-hidden shadow-medium select-none border border-outline-variant">
						<div className="absolute -right-5 -bottom-5 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
						<span className="text-label text-white/80 font-bold tracking-wider">
							TOTAL AGENTS DEPLOYED
						</span>
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
									<span className="text-text-primary">
										{(analytics.success_rate * 100).toFixed(1)}% Complete
									</span>
								</div>
								<ProgressBar
									aria-label="Quest Completion Stats"
									value={analytics.success_rate * 100}
									className="w-full"
								>
									<ProgressBar.Track className="bg-[#ffe9e5] h-3.5 rounded-full overflow-hidden border border-[#f5ddd9]">
										<ProgressBar.Fill
											className="bg-accent rounded-full h-full"
											style={{ width: `${analytics.success_rate * 100}%` }}
										/>
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

				{/* Parameters Card — full width */}
				<Card className="lg:col-span-3 bg-[#f8f4ef] border border-outline-variant shadow-soft p-6 flex flex-col gap-4">
						<div className="flex items-center gap-2.5 text-text-primary border-b border-outline-variant pb-3">
							<FiCpu className="text-primary text-lg" />
							<h2 className="text-h3 font-bold font-heading">Technical Parameters</h2>
						</div>
						<Card.Content className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-0">
							<div className="bg-surface border border-outline-variant rounded-lg p-4 flex flex-col gap-1.5 shadow-sm">
								<span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
									Reward Token
								</span>
								<div className="flex items-center justify-between text-text-primary font-mono text-[13px] font-bold">
									<div className="flex items-center gap-2">
										<FiLock className="text-primary" />
										<span>{quest.reward_token}</span>
									</div>
								</div>
							</div>

							{/* Transaction Hash */}
							{quest.tx_hash && (
								<div className="bg-surface border border-outline-variant rounded-lg p-4 flex flex-col gap-1.5 shadow-sm">
									<span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
										Creation Transaction
									</span>
									<div className="flex items-center justify-between text-text-primary font-mono text-[13px] font-bold">
										<a
											href={`https://solscan.io/tx/${quest.tx_hash}${SOLANA_RPC_URL.includes("devnet") ? "?cluster=devnet" : ""}`}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-2 text-[#a63420] hover:underline"
										>
											<FiActivity className="text-secondary shrink-0" />
											<span>
												{quest.tx_hash.slice(0, 6)}...{quest.tx_hash.slice(-4)}
											</span>
											<FiExternalLink className="text-[11px] shrink-0" />
										</a>
									</div>
								</div>
							)}

							{quest.quest_pool_pda && (
								<div className="bg-surface border border-outline-variant rounded-lg p-4 flex flex-col gap-1.5 shadow-sm">
									<span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
										Quest Pool PDA
									</span>
									<div className="flex items-center justify-between text-text-primary font-mono text-[13px] font-bold">
										<a
											href={`https://solscan.io/account/${quest.quest_pool_pda}${SOLANA_RPC_URL.includes("devnet") ? "?cluster=devnet" : ""}`}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-2 text-[#a63420] hover:underline"
										>
											<FiCheckCircle className="text-success shrink-0" />
											<span>
												{quest.quest_pool_pda.slice(0, 6)}...{quest.quest_pool_pda.slice(-4)}
											</span>
											<FiExternalLink className="text-[11px] shrink-0" />
										</a>
									</div>
								</div>
							)}

							{quest.quest_id_onchain && (
								<div className="bg-surface border border-outline-variant rounded-lg p-4 flex flex-col gap-1.5 shadow-sm">
									<span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
										Quest ID On-chain
									</span>
									<div className="flex items-center justify-between text-text-primary font-mono text-[13px] font-bold">
										<a
											href={`https://solscan.io/account/${quest.quest_id_onchain}${SOLANA_RPC_URL.includes("devnet") ? "?cluster=devnet" : ""}`}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-2 text-[#a63420] hover:underline"
										>
											<FiCheckCircle className="text-success shrink-0" />
											<span>
												{quest.quest_id_onchain.slice(0, 10)}...{quest.quest_id_onchain.slice(-6)}
											</span>
											<FiExternalLink className="text-[11px] shrink-0" />
										</a>
									</div>
								</div>
							)}
						</Card.Content>
				</Card>

				{/* Agent Participants Card — full width */}
				<Card className="lg:col-span-3 bg-surface border border-surface-variant shadow-soft p-6 flex flex-col gap-4">
					<div className="flex items-center justify-between border-b border-surface-variant pb-3">
						<div className="flex items-center gap-2.5 text-text-primary">
							<FiUsers className="text-primary text-lg" />
							<h2 className="text-h3 font-bold font-heading">Agent Participants</h2>
						</div>
						<span className="text-xs font-bold text-text-muted bg-surface-raised border border-outline-variant px-2.5 py-1 rounded-full">
							{participants.length} agent{participants.length !== 1 ? "s" : ""}
						</span>
					</div>

					{participants.length === 0 ? (
						<p className="text-body-md text-text-muted text-center py-8">
							No agents have joined this quest yet.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="min-w-full text-sm">
								<thead>
									<tr className="text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">
										<th className="pb-3 pr-4">Agent Wallet</th>
										<th className="pb-3 pr-4">User</th>
										<th className="pb-3 pr-4">Status</th>
										<th className="pb-3 pr-4">Reward</th>
										<th className="pb-3 pr-4">Claimed</th>
										<th className="pb-3 pr-4">Join Tx</th>
										<th className="pb-3 pr-4">Started</th>
										<th className="pb-3">Completed</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-surface-variant">
									{participants.map((p) => {
										const statusMeta: Record<string, { label: string; className: string }> = {
											inprogress: { label: "In Progress", className: "bg-amber-50 text-amber-700 border-amber-200" },
											success:    { label: "Success",     className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
											failed:     { label: "Failed",      className: "bg-rose-50 text-rose-700 border-rose-200" },
										};
										const sm = statusMeta[p.status] ?? { label: p.status, className: "bg-surface-raised text-text-secondary border-outline-variant" };
										const clusterSuffix = SOLANA_RPC_URL.includes("devnet") ? "?cluster=devnet" : "";
										const userLabel = p.user?.display_name ?? (p.user?.wallet_address ? `${p.user.wallet_address.slice(0, 4)}...${p.user.wallet_address.slice(-4)}` : "—");
										const agentLabel = p.agent_wallet_address ? `${p.agent_wallet_address.slice(0, 4)}...${p.agent_wallet_address.slice(-4)}` : "—";

										return (
											<tr key={p.uuid} className="hover:bg-surface-raised transition-colors">
												<td className="py-3 pr-4 font-mono text-[12px] text-text-secondary">{agentLabel}</td>
												<td className="py-3 pr-4 text-[12px] text-text-secondary">{userLabel}</td>
												<td className="py-3 pr-4">
													<span className={`inline-flex items-center text-[11px] font-bold border rounded-full px-2.5 py-0.5 ${sm.className}`}>
														{sm.label}
													</span>
												</td>
												<td className="py-3 pr-4 font-heading font-bold text-[13px] text-text-primary">
													{formatReward(p.reward_amount)}
												</td>
												<td className="py-3 pr-4">
													{p.reward_claimed
														? <FiCheckCircle className="text-success text-base" />
														: <FiClock className="text-text-muted text-base" />}
												</td>
												<td className="py-3 pr-4">
													{p.join_tx_hash ? (
														<a
															href={`https://solscan.io/tx/${p.join_tx_hash}${clusterSuffix}`}
															target="_blank"
															rel="noopener noreferrer"
															className="flex items-center gap-1.5 text-[#a63420] hover:underline font-mono text-[12px]"
														>
															<span>{p.join_tx_hash.slice(0, 6)}...{p.join_tx_hash.slice(-4)}</span>
															<FiExternalLink className="text-[10px] shrink-0" />
														</a>
													) : <span className="text-text-muted">—</span>}
												</td>
												<td className="py-3 pr-4 text-[12px] text-text-secondary">
													{new Date(p.started_at).toLocaleDateString()}
												</td>
												<td className="py-3 text-[12px] text-text-secondary">
													{p.completed_at ? new Date(p.completed_at).toLocaleDateString() : "—"}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</Card>
			</div>
		</div>
	);
}
