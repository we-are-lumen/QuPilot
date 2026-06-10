"use client";

import React, { useMemo, useState } from "react";
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
  Autocomplete,
  SearchField,
  useFilter,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { FiTarget, FiGift, FiSliders, FiPlus, FiTrash2, FiClock } from "react-icons/fi";
import { LuRocket } from "react-icons/lu";
import { createQuest } from "@/lib/api/quests";
import type { ICreateQuestPayload, Protocol, StepType } from "@/lib/types/quests";
import type { IByrealToken } from "@/lib/types/byreal";
import { useByrealTokens } from "@/lib/hooks/useByrealTokens";
import { parseSolToLamports } from "@/lib/utils/format";
import { createQuestDepositTx, isSolanaWalletInstalled } from "@/lib/utils/wallet";
import { QUPILOT_PROGRAM_ID } from "@/config";

interface StepParam {
  key: string;
  value: string;
}

interface ActionStep {
  step: number;
  stepType: StepType;
  params: StepParam[];
}

const BYREAL_TOKEN_PARAM_KEYS = new Set([
  "from_token",
  "to_token",
  "from_mint",
  "to_mint",
  "token0_mint",
  "token1_mint",
]);

interface ITokenMetaCompanions {
  symbol: string;
  logo: string;
}

const TOKEN_META_COMPANIONS: Record<string, ITokenMetaCompanions> = {
  from_token:  { symbol: "from_token_symbol", logo: "from_logo_uri"   },
  to_token:    { symbol: "to_token_symbol",   logo: "to_logo_uri"     },
  from_mint:   { symbol: "from_token_symbol", logo: "from_logo_uri"   },
  to_mint:     { symbol: "to_token_symbol",   logo: "to_logo_uri"     },
  token0_mint: { symbol: "token0_symbol",     logo: "token0_logo_uri" },
  token1_mint: { symbol: "token1_symbol",     logo: "token1_logo_uri" },
};

const HIDDEN_AUTO_PARAMS = new Set([
  "from_token_symbol",
  "to_token_symbol",
  "from_logo_uri",
  "to_logo_uri",
  "token0_symbol",
  "token1_symbol",
  "token0_logo_uri",
  "token1_logo_uri",
]);

const isByrealTokenParam = (key: string) => BYREAL_TOKEN_PARAM_KEYS.has(key.trim());

const getTokenLabel = (token: IByrealToken) => `${token.symbol} - ${token.name}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const stringifyUnknownError = (err: unknown) => {
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

const getUnknownErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  const raw = stringifyUnknownError(err);
  return raw || fallback;
};

const getBackendError = (err: unknown) => {
  if (!isRecord(err)) return undefined;
  const response = err.response;
  if (!isRecord(response)) return undefined;
  const data = response.data;
  if (!isRecord(data)) return undefined;
  const error = data.error;
  return isRecord(error) ? error : undefined;
};

const getBackendErrorMessage = (backendError: Record<string, unknown> | undefined, fallback: string) =>
  typeof backendError?.message === "string" ? backendError.message : fallback;

const formatValidationIssue = (issue: unknown) => {
  if (!isRecord(issue)) return "Unknown validation issue";
  const path = typeof issue.path === "string" ? issue.path : "payload";
  const message = typeof issue.message === "string" ? issue.message : "Invalid value";
  return `${path}: ${message}`;
};

export default function CreateQuestPage() {
  const router = useRouter();
  const byrealTokensQuery = useByrealTokens();
  const { contains } = useFilter({ sensitivity: "base" });
  const byrealTokens = useMemo(
    () => byrealTokensQuery.data?.tokens ?? [],
    [byrealTokensQuery.data?.tokens],
  );
  const hasByrealTokenDropdown = byrealTokens.length > 0;
  const sortedByrealTokens = useMemo(
    () => [...byrealTokens].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [byrealTokens],
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Protocol selection
  const [protocol, setProtocol] = useState<Key>("byreal");

  // Rewards & Configuration
  const [totalRewardPool, setTotalRewardPool] = useState("");
  const [rewardPerUser, setRewardPerUser] = useState("");
  const rewardToken = "SOL";
  const [expiresAt, setExpiresAt] = useState<DateValue | null>(today(getLocalTimeZone()));

  // Transaction hash (deposit signature) state
  const [txHash, setTxHash] = useState("");
  const [txHashError, setTxHashError] = useState("");

  // Validation Errors
  const [tokenError, setTokenError] = useState("");
  const [rewardPoolError, setRewardPoolError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");

  // Helper to pre-populate required keys based on StepType to prevent backend validation errors
  const getDefaultParamsForStepType = (stepType: StepType): StepParam[] => {
    if (stepType === "swap") {
      return [
        { key: "from_token",        value: "" },
        { key: "from_token_symbol", value: "" },
        { key: "from_logo_uri",     value: "" },
        { key: "to_token",          value: "" },
        { key: "to_token_symbol",   value: "" },
        { key: "to_logo_uri",       value: "" },
      ];
    } else if (stepType === "clmm_open") {
      return [
        { key: "pool",            value: "" },
        { key: "token0_mint",     value: "" },
        { key: "token0_symbol",   value: "" },
        { key: "token0_logo_uri", value: "" },
        { key: "token1_mint",     value: "" },
        { key: "token1_symbol",   value: "" },
        { key: "token1_logo_uri", value: "" },
        { key: "position_mint",   value: "" },
        { key: "tick_lower",      value: "" },
        { key: "tick_upper",      value: "" },
      ];
    } else if (stepType === "clmm_close") {
      return [
        { key: "pool",            value: "" },
        { key: "token0_mint",     value: "" },
        { key: "token0_symbol",   value: "" },
        { key: "token0_logo_uri", value: "" },
        { key: "token1_mint",     value: "" },
        { key: "token1_symbol",   value: "" },
        { key: "token1_logo_uri", value: "" },
        { key: "position_mint",   value: "" },
      ];
    } else if (stepType === "clmm_copy") {
      return [
        { key: "source_position", value: "" },
        { key: "token0_mint",     value: "" },
        { key: "token0_symbol",   value: "" },
        { key: "token0_logo_uri", value: "" },
        { key: "token1_mint",     value: "" },
        { key: "token1_symbol",   value: "" },
        { key: "token1_logo_uri", value: "" },
        { key: "amount_usd",      value: "" },
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


  // Handle Transaction Hash change with custom regex validation
  const handleTxHashChange = (val: string) => {
    setTxHash(val);
    if (val && !/^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(val.trim())) {
      setTxHashError("Must be a base58 Solana signature (64-128 chars)");
    } else setTxHashError("");
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

  const updateParam = (stepIndex: number, paramIndex: number, field: "key" | "value", val: string) => {
    const newSteps = [...steps];
    newSteps[stepIndex].params[paramIndex][field] = val;
    setSteps(newSteps);
  };

  const updateParamWithMeta = (stepIndex: number, paramIndex: number, mintOrAddress: string) => {
    const newSteps = [...steps];
    const step = newSteps[stepIndex];
    const paramKey = step.params[paramIndex].key.trim();

    step.params[paramIndex].value = mintOrAddress;

    const companions = TOKEN_META_COMPANIONS[paramKey];
    if (companions) {
      const selectedToken = mintOrAddress
        ? sortedByrealTokens.find((t) => t.mint === mintOrAddress)
        : undefined;

      const symbolIdx = step.params.findIndex((p) => p.key === companions.symbol);
      if (symbolIdx >= 0) step.params[symbolIdx].value = selectedToken?.symbol ?? "";

      const logoIdx = step.params.findIndex((p) => p.key === companions.logo);
      if (logoIdx >= 0) step.params[logoIdx].value = selectedToken?.logo_uri ?? "";
    }

    setSteps(newSteps);
  };

  const renderParamValueControl = (stepIndex: number, paramIndex: number, param: StepParam) => {
    if (isByrealTokenParam(param.key) && hasByrealTokenDropdown) {
      return (
        <Autocomplete
          aria-label={`Select ${param.key} token`}
          isDisabled={isLoading || byrealTokensQuery.isLoading}
          value={param.value}
          onChange={(key) => updateParamWithMeta(stepIndex, paramIndex, key ? String(key) : "")}
          className="w-full flex flex-col"
          selectionMode="single"
        >
          <Autocomplete.Trigger className="clay-field text-sm flex items-center justify-between cursor-pointer">
            <Autocomplete.Value />
            <Autocomplete.ClearButton />
            <Autocomplete.Indicator />
          </Autocomplete.Trigger>
          <Autocomplete.Popover className="bg-white border border-[#dfbfb9] rounded-md shadow-lg max-h-80 overflow-auto w-(--trigger-width)">
            <Autocomplete.Filter filter={contains}>
              <SearchField autoFocus name="search" variant="secondary" className="p-1">
                <SearchField.Group className="flex items-center gap-1 border border-[#dfbfb9] rounded-md px-2 py-1 bg-white">
                  <SearchField.SearchIcon className="text-gray-400 size-4" />
                  <SearchField.Input placeholder="Search tokens..." className="w-full text-xs outline-none bg-transparent" />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <ListBox className="p-1" renderEmptyState={() => <div className="p-2 text-xs text-gray-500">No results found</div>}>
                {sortedByrealTokens.map((token) => (
                  <ListBox.Item
                    key={token.mint}
                    id={token.mint}
                    textValue={getTokenLabel(token)}
                    className="px-3 py-2 text-sm text-[#1f1b18] hover:bg-[#f5ddd9] rounded-md cursor-pointer flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      {token.logo_uri ? (
                        <span
                          aria-hidden="true"
                          className="size-6 shrink-0 rounded-full bg-[#f8f4ef] border border-[#e8e2d9] bg-cover bg-center"
                          style={{ backgroundImage: `url(${token.logo_uri})` }}
                        />
                      ) : (
                        <span className="size-6 rounded-full bg-[#f5ddd9] text-[#e05d45] text-[10px] font-extrabold flex items-center justify-center">
                          {token.symbol.slice(0, 2)}
                        </span>
                      )}
                      <span className="flex flex-col min-w-0">
                        <span className="font-bold truncate">{token.symbol}</span>
                        <span className="text-[11px] text-[#6b6560] truncate">{token.name}</span>
                      </span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Autocomplete.Filter>
          </Autocomplete.Popover>
        </Autocomplete>
      );
    }

    return (
      <Input
        placeholder="Parameter Value (e.g., 100)"
        value={param.value}
        onChange={(e) => updateParam(stepIndex, paramIndex, "value", e.target.value)}
        disabled={isLoading}
        className="clay-field text-sm w-full"
      />
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset general errors
    setRewardPoolError("");
    setTxHashError("");

    if (rewardToken.trim().toUpperCase() !== "SOL") {
      setTokenError('Reward token harus "SOL"');
      toast.danger("Please correct the validation errors before submitting.");
      return;
    }
    if (txHash.trim().length > 0 && !/^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(txHash.trim())) {
      setTxHashError("Must be a base58 Solana signature (64-128 chars)");
      toast.danger("Please provide a valid deposit signature or leave it empty to deposit via wallet.");
      return;
    }

    // Validate BigInt reward amounts
    try {
      const pool = parseSolToLamports(totalRewardPool);
      const perUser = parseSolToLamports(rewardPerUser);
      if (pool <= BigInt(0) || perUser <= BigInt(0)) {
        toast.danger("Reward pool dan reward per user harus > 0 (dalam SOL).");
        return;
      }
      if (pool < perUser) {
        setRewardPoolError("Total reward pool tidak boleh lebih kecil dari reward per user.");
        toast.danger("Validasi gagal: total reward pool harus >= reward per user.");
        return;
      }
    } catch {
      toast.danger("Invalid amount values. Masukkan angka SOL yang valid (contoh: 1 atau 0.5).");
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
      const stepObj: Record<string, unknown> = {};
      s.params.forEach((p) => {
        const key = p.key.trim();
        const rawVal = p.value.trim();
        if (key) {
          // Keep known string-only fields as strings, preventing unwanted number coercion
          const stringOnlyFields = [
            "from_token_symbol",
            "to_token_symbol",
            "from_token",
            "to_token",
            "from_mint",
            "to_mint",
            "pool",
            "token0_mint",
            "token1_mint",
            "position_mint",
            "source_position",
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
    const expiresUnix = Math.floor(new Date(expiresISO).getTime() / 1000);

    const questUuid = crypto.randomUUID();

    // Convert UI SOL inputs -> lamports for on-chain + backend storage.
    let poolLamports: bigint;
    let perUserLamports: bigint;
    try {
      poolLamports = parseSolToLamports(totalRewardPool);
      perUserLamports = parseSolToLamports(rewardPerUser);
    } catch {
      toast.danger("Invalid amount values. Masukkan angka SOL yang valid (contoh: 1 atau 0.5).");
      setIsLoading(false);
      setStatusText("");
      return;
    }

    let depositSignature = txHash.trim();
    try {
      if (!depositSignature) {
        if (!isSolanaWalletInstalled()) {
          toast.danger("Solana wallet not found. Install Phantom or paste a valid deposit signature.");
          setIsLoading(false);
          setStatusText("");
          return;
        }
        setStatusText("Depositing rewards on-chain...");
        depositSignature = await createQuestDepositTx({
          questUuid,
          totalRewardPoolLamports: poolLamports.toString(),
          rewardPerUserLamports: perUserLamports.toString(),
          expiresAtUnixSeconds: String(expiresUnix),
        });
        setTxHash(depositSignature);
      }
    } catch (err: unknown) {
      toast.danger(getUnknownErrorMessage(err, "Failed to deposit on-chain. Please try again."));
      setIsLoading(false);
      setStatusText("");
      return;
    }

    const payload: ICreateQuestPayload = {
      quest_uuid: questUuid,
      title,
      description,
      protocol: protocol as Protocol,
      steps: formattedSteps,
      total_reward_pool: poolLamports.toString(),
      reward_per_user: perUserLamports.toString(),
      reward_token: rewardToken,
      tx_hash: depositSignature,
      expires_at: expiresISO,
    };

    try {
      setStatusText("Registering quest on backend...");
      await createQuest(payload);
      toast.success("Quest successfully launched!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const backendError = getBackendError(err);
      if (backendError?.code === "VALIDATION_ERROR" && Array.isArray(backendError.issues)) {
        const issuesMsg = backendError.issues
          .map(formatValidationIssue)
          .join(", ");
        toast.danger(`Validation error: ${issuesMsg}`);
      } else if (backendError?.code === "DEPOSIT_TX_SIGNER_MISMATCH") {
        toast.danger(getBackendErrorMessage(backendError, "Deposit transaction signer doesn't match your provider wallet."));
      } else {
        toast.danger(getBackendErrorMessage(backendError, "Failed to launch quest. Please check parameters."));
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
          className="clay-surface bg-white rounded-[40px] p-8 md:p-12 flex flex-col gap-10"
        >
          {/* Section 1: Identity */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f5ddd9]">
              <FiTarget className="text-[#e05d45] text-xl" />
              <h2 className="text-[#1f1b18] text-xl font-bold font-nunito">Quest Identity</h2>
            </div>

            <div className="flex flex-col gap-6">
              <TextField isRequired isDisabled={isLoading}>
                <Label className="text-[#1f1b18] text-sm font-bold tracking-wide mb-1">Quest Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., The Great Liquidity Migration"
                  className="clay-field text-base"
                />
              </TextField>

              <TextField isRequired isDisabled={isLoading}>
                <Label className="text-[#1f1b18] text-sm font-bold tracking-wide mb-1">Detailed Description</Label>
                <TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the mission objectives, reward criteria, and developer guidelines..."
                  rows={4}
                  className="clay-field text-base resize-none"
                  style={{ resize: "none" }}
                />
              </TextField>
            </div>
          </div>

          {/* Section 2: Protocol Details */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f5ddd9]">
              <FiSliders className="text-[#e05d45] text-xl" />
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
                <Select.Trigger className="clay-field text-base flex items-center justify-between cursor-pointer">
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

            <div className="flex flex-col">
              {steps.map((step, sIdx) => (
                <div key={step.step} className="relative pl-10 pb-8">
                  {/* Connecting Line */}
                  <div className="absolute left-3.75 top-8 bottom-0 w-0.5 border-l-2 border-dashed border-[#dfbfb9]" />

                  {/* Timeline Dot */}
                  <div className="absolute left-0 top-0 size-8 rounded-full bg-[#008282] text-white flex items-center justify-center font-nunito font-extrabold text-sm shadow-sm border-2 border-white ring-4 ring-white">
                    {step.step}
                  </div>

                  {/* Step Container Box */}
                  <div className="clay-surface-soft rounded-[28px] p-6 flex flex-col gap-5">
                    <div className="flex items-center justify-between border-b border-[#dfbfb9]/30 pb-2">
                      <span className="font-nunito font-extrabold text-sm text-[#008282] tracking-wider uppercase">
                        Configure Step {step.step}
                      </span>
                      {steps.length > 1 && (
                        <Button
                          type="button"
                          variant="tertiary"
                          onPress={() => removeStep(sIdx)}
                          className="text-[#e05d45] bg-transparent border-0 p-1 hover:text-[#8c2a1a] flex items-center gap-1 cursor-pointer text-xs"
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
                        <Select.Trigger className="clay-field text-sm flex items-center justify-between cursor-pointer">
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
                            <ListBox.Item id="clmm_copy" textValue="Copy Strategy" className="px-3 py-2 text-sm text-[#1f1b18] hover:bg-[#f5ddd9] rounded-md cursor-pointer flex items-center justify-between">
                              Copy Strategy (clmm_copy)
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                    {/* Step Parameter rows */}
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[#1f1b18] text-xs font-bold tracking-wide">Action Parameters</span>
                        {byrealTokensQuery.isError && (
                          <span className="text-[11px] text-[#e05d45] font-semibold">
                            Byreal token list unavailable. Manual mint input is active.
                          </span>
                        )}
                      </div>
                      {step.params.map((p, pIdx) => {
                        if (HIDDEN_AUTO_PARAMS.has(p.key.trim())) return null;
                        return (
                        <div key={pIdx} className="flex flex-wrap items-center gap-3">
                          <div className="flex-1 min-w-37.5">
                            <Input
                              placeholder="Parameter Key (e.g., min_amount)"
                              value={p.key}
                              onChange={(e) => updateParam(sIdx, pIdx, "key", e.target.value)}
                              disabled={isLoading}
                              className="clay-field text-sm w-full"
                            />
                          </div>
                          <div className="flex-2 min-w-50">
                            {renderParamValueControl(sIdx, pIdx, p)}
                          </div>

                        </div>
                        );
                      })}
                    </div>

                  </div>
                </div>
              ))}

              <div className="relative pl-10 pb-4">
                {/* Timeline Dot placeholder for next step */}
                <div className="absolute left-1.5 top-2.5 size-5 rounded-full border-2 border-dashed border-[#008282] bg-white" />

                <Button
                  type="button"
                  onPress={addStep}
                  className="bg-white border-2 border-[#e05d45] text-[#e05d45] hover:bg-[#e05d45]/5 font-bold py-2 px-5 rounded-full flex items-center gap-2 transition-all cursor-pointer text-sm shadow-sm"
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
                    placeholder="e.g., 1 (SOL)"
                    className="clay-field text-base w-full"
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
                  placeholder="e.g., 0.1 (SOL)"
                  className="clay-field text-base"
                />
              </TextField>

              <div className="md:col-span-2">
                <TextField isReadOnly isDisabled={isLoading}>
                  <Label className="text-[#1f1b18] text-sm font-bold tracking-wide mb-1">Reward Token</Label>
                  <Input
                    value={rewardToken}
                    readOnly
                    placeholder="SOL"
                    className="clay-field text-base font-mono cursor-not-allowed text-[#6b6560]"
                  />
                </TextField>
                {tokenError && (
                  <p className="text-[11px] text-red-500 font-semibold mt-1">{tokenError}</p>
                )}
              </div>

              <div className="md:col-span-2 bg-[#faf7f5] rounded-2xl border border-[#f5ddd9] p-6 flex flex-col gap-2 mt-2">
                <h3 className="text-[#1f1b18] text-sm font-bold tracking-wide">On-chain Deposit</h3>
                <p className="text-[#6b6560] text-xs leading-relaxed">
                  When you submit this form, QuPilot will create an on-chain deposit via the QuPilot program using your connected wallet. If you already deposited, you can paste the deposit signature below.
                </p>
                <code className="text-[#1f1b18] font-mono text-[11px] select-all break-all">
                  Program: {QUPILOT_PROGRAM_ID}
                </code>
              </div>

              <div className="md:col-span-2">
                <TextField isDisabled={isLoading}>
                  <Label className="text-[#1f1b18] text-sm font-bold tracking-wide mb-1 flex items-center gap-1.5">
                    <span>Deposit Signature (Optional)</span>
                  </Label>
                  <Input
                    value={txHash}
                    onChange={(e) => handleTxHashChange(e.target.value)}
                    placeholder="e.g., 4QG8... (base58 signature)"
                    className="clay-field text-base font-mono"
                  />
                </TextField>
                {txHashError ? (
                  <p className="text-[11px] text-red-500 font-semibold mt-1">{txHashError}</p>
                ) : (
                  <p className="text-[11px] text-[#6b6560] font-medium mt-1">
                    Leave empty to deposit via wallet on submit.
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
                <DateField.Group fullWidth className="clay-field text-base flex items-center justify-between">
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
                                  ? "bg-[#e05d45] text-white font-bold"
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
              className="bg-[#e05d45] text-white font-bold py-3 px-8 rounded-full flex items-center gap-2 hover:bg-[#8c2a1a] transition-colors cursor-pointer"
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
