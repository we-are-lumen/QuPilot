"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Form,
  Input,
  TextArea,
  TextField,
  Label,
  Select,
  ListBox,
  Calendar,
  DateField,
  DatePicker,
  toast,
  cn,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { FiTarget, FiGift, FiSliders, FiPlus, FiTrash2, FiClock, FiCopy, FiCheck } from "react-icons/fi";
import { LuRocket } from "react-icons/lu";
import { createQuest } from "@/lib/api/quests";
import type { ICreateQuestPayload, Protocol, StepType } from "@/lib/types/quests";

interface StepParam {
  key: string;
  value: string;
}

interface ActionStep {
  step: number;
  stepType: StepType;
  params: StepParam[];
}

export default function CreateQuestPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  
  // Protocol selection
  const [protocol, setProtocol] = useState<Key>("byreal");
  
  // Rewards & Configuration
  const [totalRewardPool, setTotalRewardPool] = useState("");
  const [rewardPerUser, setRewardPerUser] = useState("");
  const [rewardToken, setRewardToken] = useState("");
  const [expiresAt, setExpiresAt] = useState<DateValue | null>(today(getLocalTimeZone()));
  
  // Transaction hash & Treasury copy state
  const [txHash, setTxHash] = useState("");
  const [txHashError, setTxHashError] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  
  // Validation Errors
  const [tokenError, setTokenError] = useState("");
  const [rewardPoolError, setRewardPoolError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");

  // Helper to pre-populate required keys based on StepType to prevent backend validation errors
  const getDefaultParamsForStepType = (stepType: StepType): StepParam[] => {
    if (stepType === "swap") {
      return [
        { key: "from_token_symbol", value: "" },
        { key: "to_token_symbol", value: "" },
      ];
    } else if (stepType === "clmm_open" || stepType === "clmm_close") {
      return [
        { key: "token0_mint", value: "" },
        { key: "token1_mint", value: "" },
        { key: "position_mint", value: "" },
      ];
    }
    return [];
  };

  // Dynamic Step Builder state
  const [steps, setSteps] = useState<ActionStep[]>([
    {
      step: 1,
      stepType: "swap",
      params: getDefaultParamsForStepType("swap"),
    },
  ]);

  // Handle Token Address change with custom EVM Address regex validation
  const handleTokenChange = (val: string) => {
    setRewardToken(val);
    if (val && !/^0x[a-fA-F0-9]{40}$/.test(val)) {
      setTokenError("Must be a valid 40-character EVM address (starting with 0x)");
    } else {
      setTokenError("");
    }
  };

  // Handle Transaction Hash change with custom regex validation
  const handleTxHashChange = (val: string) => {
    setTxHash(val);
    if (val && !/^0x[a-fA-F0-9]{64}$/.test(val)) {
      setTxHashError("Must be a valid 66-character EVM transaction hash (starting with 0x)");
    } else {
      setTxHashError("");
    }
  };

  // Copy Treasury Address to Clipboard
  const handleCopyTreasuryAddress = () => {
    const treasury = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "0x71C7656EC7ab88b098defB751B7401B5f6d5976F";
    navigator.clipboard.writeText(treasury);
    setIsCopied(true);
    toast.success("Treasury address copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Step-builder functions
  const addStep = () => {
    setSteps([
      ...steps,
      {
        step: steps.length + 1,
        stepType: "swap",
        params: getDefaultParamsForStepType("swap"),
      },
    ]);
  };

  const updateStepType = (index: number, val: StepType) => {
    const newSteps = [...steps];
    newSteps[index].stepType = val;
    newSteps[index].params = getDefaultParamsForStepType(val);
    setSteps(newSteps);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    const newSteps = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({
        ...s,
        step: i + 1,
      }));
    setSteps(newSteps);
  };

  const addParam = (stepIndex: number) => {
    const newSteps = [...steps];
    newSteps[stepIndex].params.push({ key: "", value: "" });
    setSteps(newSteps);
  };

  const removeParam = (stepIndex: number, paramIndex: number) => {
    const newSteps = [...steps];
    newSteps[stepIndex].params.splice(paramIndex, 1);
    setSteps(newSteps);
  };

  const updateParam = (stepIndex: number, paramIndex: number, field: "key" | "value", val: string) => {
    const newSteps = [...steps];
    newSteps[stepIndex].params[paramIndex][field] = val;
    setSteps(newSteps);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset general errors
    setRewardPoolError("");
    setTxHashError("");

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(rewardToken)) {
      setTokenError("Must be a valid 40-character EVM address (starting with 0x)");
      toast.danger("Please correct the validation errors before submitting.");
      return;
    }

    // Validate Transaction Hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      setTxHashError("Must be a valid 66-character EVM transaction hash (starting with 0x)");
      toast.danger("Please provide a valid transaction hash as proof of deposit.");
      return;
    }

    // Validate BigInt reward amounts
    try {
      const pool = BigInt(totalRewardPool);
      const perUser = BigInt(rewardPerUser);
      if (pool <= BigInt(0) || perUser <= BigInt(0)) {
        toast.danger("Reward pool and reward per user must be positive integers.");
        return;
      }
      if (pool < perUser) {
        setRewardPoolError("Total reward pool cannot be smaller than reward per user.");
        toast.danger("Validation Error: Total reward pool must be >= Reward per user.");
        return;
      }
    } catch {
      toast.danger("Invalid amount values. Please enter integer values.");
      return;
    }

    if (!expiresAt) {
      toast.danger("Expiration date is required.");
      return;
    }

    setIsLoading(true);
    setStatusText("Creating quest...");

    // Format steps array for the API payload
    const formattedSteps = steps.map((s) => {
      const stepObj: Record<string, any> = {};
      s.params.forEach((p) => {
        const key = p.key.trim();
        const rawVal = p.value.trim();
        if (key) {
          // Keep known string-only fields as strings, preventing unwanted number coercion
          const stringOnlyFields = [
            "from_token_symbol",
            "to_token_symbol",
            "token0_mint",
            "token1_mint",
            "position_mint",
          ];
          
          const isStringField = 
            stringOnlyFields.includes(key) || 
            key.endsWith("_symbol") || 
            key.endsWith("_mint") || 
            key.endsWith("_address") || 
            key.endsWith("_hash");

          if (isStringField) {
            stepObj[key] = rawVal;
          } else {
            // Coerce boolean or number values if possible, otherwise string
            if (rawVal === "true") stepObj[key] = true;
            else if (rawVal === "false") stepObj[key] = false;
            else if (!isNaN(Number(rawVal)) && rawVal !== "") stepObj[key] = Number(rawVal);
            else stepObj[key] = rawVal;
          }
        }
      });
      return {
        step_type: s.stepType,
        action_params: stepObj,
      };
    });

    // Construct expires_at ISO string (end of the chosen day in UTC to be safe)
    const expiresISO = new Date(`${expiresAt.toString()}T23:59:59.000Z`).toISOString();

    const payload: ICreateQuestPayload = {
      title,
      description,
      protocol: protocol as Protocol,
      steps: formattedSteps,
      total_reward_pool: totalRewardPool,
      reward_per_user: rewardPerUser,
      reward_token: rewardToken,
      tx_hash: txHash,
      expires_at: expiresISO,
    };

    try {
      await createQuest(payload);
      toast.success("Quest successfully launched!");
      router.push("/dashboard");
    } catch (err: any) {
      const backendError = err?.response?.data?.error;
      if (backendError?.code === "VALIDATION_ERROR" && backendError.issues) {
        const issuesMsg = backendError.issues
          .map((i: any) => `${i.path}: ${i.message}`)
          .join(", ");
        toast.danger(`Validation error: ${issuesMsg}`);
      } else {
        toast.danger(backendError?.message || "Failed to launch quest. Please check parameters.");
      }
    } finally {
      setIsLoading(false);
      setStatusText("");
    }
  };

  return (
    <div className="flex justify-center w-full max-w-7xl mx-auto pt-8 pb-32">
      <div className="flex flex-col w-full max-w-214 gap-10">
        {/* Header */}
        <div className="text-center flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl text-[#1f1b18] font-extrabold tracking-tight font-nunito">
            Launch a New Quest
          </h1>
          <p className="text-[#6b6560] text-base md:text-lg">
            Configure target protocols, design automated execution steps, and deposit rewards.
          </p>
        </div>

        {/* Form Container */}
        <Form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl border border-[#f5ddd9] p-8 md:p-12 shadow-sm flex flex-col gap-10"
        >
          {/* Section 1: Identity */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f5ddd9]">
              <FiTarget className="text-[#a63420] text-xl" />
              <h2 className="text-[#1f1b18] text-xl font-bold font-nunito">Quest Identity</h2>
            </div>

            <div className="flex flex-col gap-6">
              <TextField isRequired isDisabled={isLoading}>
                <Label className="text-[#1f1b18] text-sm font-bold tracking-wide mb-1">Quest Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., The Great Liquidity Migration"
                  className="rounded-md border border-[#e8e2d9] px-3 py-2.5 text-base shadow-sm focus-visible:border-[#a63420]"
                />
              </TextField>

              <TextField isRequired isDisabled={isLoading}>
                <Label className="text-[#1f1b18] text-sm font-bold tracking-wide mb-1">Detailed Description</Label>
                <TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the mission objectives, reward criteria, and developer guidelines..."
                  rows={4}
                  className="rounded-md border border-[#e8e2d9] px-3 py-2.5 text-base shadow-sm focus-visible:border-[#a63420] resize-none"
                  style={{ resize: "none" }}
                />
              </TextField>
            </div>
          </div>

          {/* Section 2: Protocol Details */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f5ddd9]">
              <FiSliders className="text-[#a63420] text-xl" />
              <h2 className="text-[#1f1b18] text-xl font-bold font-nunito">Target & Action Configuration</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Select
                isRequired
                isDisabled={isLoading}
                value={protocol}
                onChange={(key) => key && setProtocol(key)}
                className="w-full flex flex-col md:col-span-2"
              >
                <Label className="text-[#1f1b18] text-sm font-bold tracking-wide mb-1.5">Target Protocol</Label>
                <Select.Trigger className="rounded-md border border-[#dfbfb9] bg-white px-3 py-2.5 text-base shadow-sm focus-visible:border-[#a63420] flex items-center justify-between min-h-10.5 cursor-pointer">
                  <Select.Value />
                  <Select.Indicator className="ml-2" />
                </Select.Trigger>
                <Select.Popover className="bg-white border border-[#dfbfb9] rounded-md shadow-lg">
                  <ListBox className="p-1">
                    <ListBox.Item id="byreal" textValue="Byreal" className="px-3 py-2 text-base text-[#1f1b18] hover:bg-[#f5ddd9] rounded-md cursor-pointer flex items-center justify-between">
                      Byreal
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="bybit" textValue="Bybit" className="px-3 py-2 text-base text-[#1f1b18] hover:bg-[#f5ddd9] rounded-md cursor-pointer flex items-center justify-between">
                      Bybit
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="sui" textValue="Sui" className="px-3 py-2 text-base text-[#1f1b18] hover:bg-[#f5ddd9] rounded-md cursor-pointer flex items-center justify-between">
                      Sui (Aptos/Move-based)
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </div>

          {/* Section 3: Dynamic Step Builder */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f5ddd9]">
              <FiSliders className="text-[#008282] text-xl" />
              <h2 className="text-[#1f1b18] text-xl font-bold font-nunito">AI Execution Steps</h2>
            </div>
            
            <p className="text-xs text-[#6b6560] -mt-3">
              Define the sequential steps the AI Agent will execute. Add custom parameter keys and values representing constraints or actions.
            </p>

            <div className="flex flex-col gap-6">
              {steps.map((step, sIdx) => (
                <div key={step.step} className="bg-[#f8f4ef]/50 border border-[#dfbfb9]/40 rounded-2xl p-6 flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-[#dfbfb9]/30 pb-2">
                    <span className="font-nunito font-extrabold text-sm text-[#a63420] tracking-wider uppercase">
                      Step {step.step}
                    </span>
                    {steps.length > 1 && (
                      <Button
                        type="button"
                        variant="tertiary"
                        onPress={() => removeStep(sIdx)}
                        className="text-[#a63420] bg-transparent border-0 p-1 hover:text-[#8c2a1a] flex items-center gap-1 cursor-pointer text-xs"
                      >
                        <FiTrash2 /> Remove Step
                      </Button>
                    )}
                  </div>

                  {/* Step Type Selection */}
                  <div className="w-full">
                    <Select
                      isRequired
                      isDisabled={isLoading}
                      value={step.stepType}
                      onChange={(key) => key && updateStepType(sIdx, key as StepType)}
                      className="w-full flex flex-col"
                    >
                      <Label className="text-[#1f1b18] text-xs font-bold tracking-wide mb-1.5">Step Type</Label>
                      <Select.Trigger className="rounded-md border border-[#dfbfb9] bg-white px-3 py-2 text-sm shadow-sm focus-visible:border-[#a63420] flex items-center justify-between min-h-10 cursor-pointer">
                        <Select.Value />
                        <Select.Indicator className="ml-2" />
                      </Select.Trigger>
                      <Select.Popover className="bg-white border border-[#dfbfb9] rounded-md shadow-lg">
                        <ListBox className="p-1">
                          <ListBox.Item id="swap" textValue="Token Swap" className="px-3 py-2 text-sm text-[#1f1b18] hover:bg-[#f5ddd9] rounded-md cursor-pointer flex items-center justify-between">
                            Token Swap (swap)
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="clmm_open" textValue="Open CLMM Position" className="px-3 py-2 text-sm text-[#1f1b18] hover:bg-[#f5ddd9] rounded-md cursor-pointer flex items-center justify-between">
                            Open CLMM Position (clmm_open)
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="clmm_close" textValue="Close CLMM Position" className="px-3 py-2 text-sm text-[#1f1b18] hover:bg-[#f5ddd9] rounded-md cursor-pointer flex items-center justify-between">
                            Close CLMM Position (clmm_close)
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  {/* Step Parameter rows */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[#1f1b18] text-xs font-bold tracking-wide">Action Parameters</span>
                    {step.params.map((p, pIdx) => (
                      <div key={pIdx} className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-37.5">
                          <Input
                            placeholder="Parameter Key (e.g., min_amount)"
                            value={p.key}
                            onChange={(e) => updateParam(sIdx, pIdx, "key", e.target.value)}
                            disabled={isLoading}
                            className="rounded-md border border-[#e8e2d9] px-2 py-1 text-sm bg-white"
                          />
                        </div>
                        <div className="flex-2 min-w-50">
                          <Input
                            placeholder="Parameter Value (e.g., 100)"
                            value={p.value}
                            onChange={(e) => updateParam(sIdx, pIdx, "value", e.target.value)}
                            disabled={isLoading}
                            className="rounded-md border border-[#e8e2d9] px-2 py-1 text-sm bg-white"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="tertiary"
                          onPress={() => removeParam(sIdx, pIdx)}
                          className="text-[#a63420] hover:text-[#8c2a1a] p-2 bg-transparent min-w-0"
                          isDisabled={isLoading}
                        >
                          <FiTrash2 className="text-base" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-start">
                    <Button
                      type="button"
                      variant="secondary"
                      onPress={() => addParam(sIdx)}
                      className="bg-transparent border border-[#dfbfb9] text-[#1f1b18] hover:bg-[#dfbfb9]/20 text-xs px-3 py-1.5 rounded-full flex items-center gap-1 cursor-pointer"
                      isDisabled={isLoading}
                    >
                      <FiPlus /> Add Parameter Field
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  onPress={addStep}
                  className="bg-white border-2 border-[#a63420] text-[#a63420] hover:bg-[#a63420]/5 font-bold py-2.5 px-6 rounded-full flex items-center gap-2 transition-all cursor-pointer text-sm"
                  isDisabled={isLoading}
                >
                  <FiPlus className="text-lg" /> Add Next Step
                </Button>
              </div>
            </div>
          </div>

          {/* Section 4: Rewards */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f5ddd9]">
              <FiGift className="text-[#f59e0b] text-xl" />
              <h2 className="text-[#1f1b18] text-xl font-bold font-nunito">Reward & Treasury Allocation</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div>
                <TextField isRequired isDisabled={isLoading}>
                  <Label className="text-[#1f1b18] text-sm font-bold tracking-wide mb-1">Total Reward Pool</Label>
                  <Input
                    value={totalRewardPool}
                    onChange={(e) => setTotalRewardPool(e.target.value)}
                    placeholder="e.g., 10000000 (BigInt format)"
                    className="rounded-md border border-[#e8e2d9] px-3 py-2.5 text-base shadow-sm focus-visible:border-[#a63420] w-full"
                  />
                </TextField>
                {rewardPoolError && (
                  <p className="text-[11px] text-red-500 font-semibold mt-1">{rewardPoolError}</p>
                )}
              </div>

              <TextField isRequired isDisabled={isLoading}>
                <Label className="text-[#1f1b18] text-sm font-bold tracking-wide mb-1">Reward Per User</Label>
                <Input
                  value={rewardPerUser}
                  onChange={(e) => setRewardPerUser(e.target.value)}
                  placeholder="e.g., 1000000 (BigInt format)"
                  className="rounded-md border border-[#e8e2d9] px-3 py-2.5 text-base shadow-sm focus-visible:border-[#a63420]"
                />
              </TextField>

              <div className="md:col-span-2">
                <TextField isRequired isDisabled={isLoading}>
                  <Label className="text-[#1f1b18] text-sm font-bold tracking-wide mb-1">Reward Token Address (ERC-20)</Label>
                  <Input
                    value={rewardToken}
                    onChange={(e) => handleTokenChange(e.target.value)}
                    placeholder="e.g., 0x471ceac3d7de120... (40-char EVM Address)"
                    className="rounded-md border border-[#e8e2d9] px-3 py-2.5 text-base shadow-sm focus-visible:border-[#a63420] font-mono"
                  />
                </TextField>
                {tokenError && (
                  <p className="text-[11px] text-red-500 font-semibold mt-1">{tokenError}</p>
                )}
              </div>

              {/* Treasury Deposit Instructions */}
              <div className="md:col-span-2 bg-[#faf7f5] rounded-2xl border border-[#f5ddd9] p-6 flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-1">
                  <h3 className="text-[#1f1b18] text-sm font-bold tracking-wide">Manual Treasury Deposit Instructions</h3>
                  <p className="text-[#6b6560] text-xs leading-relaxed">
                    To secure the rewards for this quest, you must manually deposit <span className="font-bold text-[#1f1b18]">{totalRewardPool || "0"} units</span> of your token to the QuPilot Treasury. Ensure you use the exact token address specified above.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-[#a63420] tracking-wider uppercase">QuPilot Treasury Address</span>
                  <div className="flex items-center gap-2 bg-white border border-[#e8e2d9] rounded-xl p-3 justify-between shadow-sm">
                    <code className="text-[#1f1b18] font-mono text-xs md:text-sm select-all break-all pr-2">
                      {process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "0x71C7656EC7ab88b098defB751B7401B5f6d5976F"}
                    </code>
                    <Button
                      type="button"
                      onPress={handleCopyTreasuryAddress}
                      className="bg-[#a63420]/5 hover:bg-[#a63420]/10 text-[#a63420] p-2 rounded-lg cursor-pointer transition-all flex items-center justify-center shrink-0 border border-[#a63420]/10 size-9 min-w-9"
                    >
                      {isCopied ? <FiCheck className="text-base text-green-600 animate-bounce" /> : <FiCopy className="text-base" />}
                    </Button>
                  </div>
                </div>

                <p className="text-[#a63420] text-[11px] font-medium leading-normal flex items-start gap-1">
                  <span>⚠️</span>
                  <span>
                    Make sure the transaction has succeeded on the block explorer before submitting the transaction hash below. Incorrect hashes or failed transactions may result in the quest not activating or user execution failing.
                  </span>
                </p>
              </div>

              {/* Transaction Hash Input */}
              <div className="md:col-span-2">
                <TextField isRequired isDisabled={isLoading}>
                  <Label className="text-[#1f1b18] text-sm font-bold tracking-wide mb-1 flex items-center gap-1.5">
                    <span>Transaction Hash (Proof of Deposit)</span>
                  </Label>
                  <Input
                    value={txHash}
                    onChange={(e) => handleTxHashChange(e.target.value)}
                    placeholder="e.g., 0x2e06180556f8f5539fa5a9ebf552f44154c1bdf7f45778b0dbd2380f2d91b4ec (66-char hex)"
                    className="rounded-md border border-[#e8e2d9] px-3 py-2.5 text-base shadow-sm focus-visible:border-[#a63420] font-mono"
                  />
                </TextField>
                {txHashError ? (
                  <p className="text-[11px] text-red-500 font-semibold mt-1">{txHashError}</p>
                ) : (
                  <p className="text-[11px] text-[#6b6560] font-medium mt-1">
                    Paste the 66-character transaction hash (including 0x) of your successful treasury deposit transfer.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: Expiration Settings */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f5ddd9]">
              <FiClock className="text-[#008282] text-xl" />
              <h2 className="text-[#1f1b18] text-xl font-bold font-nunito">Quest Expiration</h2>
            </div>

            <div className="w-full">
              <DatePicker
                isRequired
                isDisabled={isLoading}
                minValue={today(getLocalTimeZone())}
                value={expiresAt}
                onChange={setExpiresAt}
                className="w-full flex flex-col gap-2"
              >
                <Label className="text-[#1f1b18] text-sm font-bold tracking-wide">Expiration Date</Label>
                <DateField.Group fullWidth className="rounded-md border border-[#dfbfb9] bg-white px-3 py-2.5 text-base shadow-sm flex items-center justify-between min-h-10.5">
                  <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateField.Suffix>
                    <DatePicker.Trigger className="bg-transparent border-0 cursor-pointer">
                      <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover className="bg-white border border-[#dfbfb9] rounded-md shadow-lg p-3">
                  <Calendar aria-label="Expiration date" minValue={today(getLocalTimeZone())}>
                    <Calendar.Header className="flex items-center justify-between mb-2">
                      <Calendar.YearPickerTrigger className="font-bold flex items-center gap-1 cursor-pointer">
                        <Calendar.YearPickerTriggerHeading />
                        <Calendar.YearPickerTriggerIndicator />
                      </Calendar.YearPickerTrigger>
                      <div className="flex items-center gap-1">
                        <Calendar.NavButton slot="previous" className="p-1 rounded hover:bg-[#f5ddd9] cursor-pointer" />
                        <Calendar.NavButton slot="next" className="p-1 rounded hover:bg-[#f5ddd9] cursor-pointer" />
                      </div>
                    </Calendar.Header>
                    <Calendar.Grid className="w-full border-collapse">
                      <Calendar.GridHeader>
                        {(day) => <Calendar.HeaderCell className="text-center font-bold text-xs p-1 text-[#6b6560]">{day}</Calendar.HeaderCell>}
                      </Calendar.GridHeader>
                      <Calendar.GridBody>
                        {(date) => (
                          <Calendar.Cell
                            date={date}
                            className={({ isDisabled, isSelected }) =>
                              cn(
                                "text-center text-sm p-1 rounded transition-colors flex items-center justify-center size-8",
                                isDisabled
                                  ? "text-[#dfbfb9]/40 cursor-not-allowed pointer-events-none opacity-40"
                                  : isSelected
                                  ? "bg-[#a63420] text-white font-bold"
                                  : "hover:bg-[#f5ddd9]/60 cursor-pointer text-[#1f1b18]"
                              ) || ""
                            }
                          />
                        )}
                      </Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                      <Calendar.YearPickerGridBody>
                        {({ year }) => (
                          <Calendar.YearPickerCell
                            year={year}
                            className="text-center p-2 hover:bg-[#f5ddd9] rounded cursor-pointer"
                          />
                        )}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                </DatePicker.Popover>
              </DatePicker>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-8 mt-2 flex justify-end border-t border-[#f5ddd9]">
            <Button
              type="submit"
              isDisabled={isLoading}
              className="bg-[#a63420] text-white font-bold py-3 px-8 rounded-full flex items-center gap-2 hover:bg-[#8c2a1a] transition-colors cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>{statusText || "Deploying Quest..."}</span>
                </div>
              ) : (
                <>
                  <LuRocket className="text-xl" />
                  <span>Launch Quest</span>
                </>
              )}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
