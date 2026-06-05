import { Connection, PublicKey, type ParsedTransactionWithMeta } from '@solana/web3.js';
import { env } from '../config/env';

// ---------------------------------------------------------------------------
// Connection (lazy singleton)
// ---------------------------------------------------------------------------

type SolanaRpcPurpose = 'qupilot' | 'byreal';

let qupilotConnection: Connection | null = null;
let byrealConnection: Connection | null = null;
let byrealGenesisHash: string | null = null;

// Solana doesn't have an EVM-like "chain id". The practical network identifier is the genesis hash.
// Mainnet-beta genesis hash (full):
// - getGenesisHash("https://api.mainnet-beta.solana.com")
// - https://docs.solana.com/clusters#cluster-rpc-endpoints
const MAINNET_BETA_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';

const hasEnv = (k: string): boolean => {
  const v = process.env[k];
  return typeof v === 'string' && v.trim().length > 0;
};

const resolveRpcUrl = (purpose: SolanaRpcPurpose): string => {
  if (purpose === 'byreal') {
    if (hasEnv('SOLANA_RPC_URL_BYREAL')) return env.SOLANA_RPC_URL_BYREAL;
    return env.SOLANA_RPC_URL_BYREAL;
  }

  if (hasEnv('SOLANA_RPC_URL_QUPILOT')) return env.SOLANA_RPC_URL_QUPILOT;
  if (hasEnv('SOLANA_RPC_URL')) return process.env.SOLANA_RPC_URL as string;
  return env.SOLANA_RPC_URL_QUPILOT;
};

export const getSolanaConnection = (purpose: SolanaRpcPurpose = 'qupilot'): Connection => {
  if (purpose === 'byreal') {
    if (!byrealConnection) {
      byrealConnection = new Connection(resolveRpcUrl('byreal'), 'confirmed');
    }
    return byrealConnection;
  }

  if (!qupilotConnection) {
    qupilotConnection = new Connection(resolveRpcUrl('qupilot'), 'confirmed');
  }
  return qupilotConnection;
};

// ---------------------------------------------------------------------------
// Static SPL token registry
// ---------------------------------------------------------------------------
// MVP scope: keep this in code. Provider/admin add new entries here when a
// quest needs a new token. Symbol is matched case-insensitively against
// quest.action_params[].from_token / to_token.
//
// `mint = null` is reserved for native SOL (handled separately via lamports).
// Decimals match the SPL mint exactly.

export type TokenInfo = {
  symbol: string;
  mint: string | null; // null = native SOL
  decimals: number;
};

const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  SOL: { symbol: 'SOL', mint: null, decimals: 9 },
  // USDC mainnet mint. Devnet uses a different mint
  // (Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr) — swap in if running on devnet.
  USDC: { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
};

export const resolveToken = (symbol: string): TokenInfo | null => {
  if (!symbol) return null;
  return TOKEN_REGISTRY[symbol.toUpperCase()] ?? null;
};

// ---------------------------------------------------------------------------
// Program allowlist (Byreal on Solana)
// ---------------------------------------------------------------------------
// TODO(byreal): confirm the actual on-chain program IDs from Byreal docs and
// replace these placeholders. Keeping the list non-empty would block all
// verifications with INVALID_PROGRAM until the real IDs are filled in, so for
// MVP we treat an empty list as "skip allowlist check" — explicit, opt-in.

const BYREAL_PROGRAM_IDS: string[] = [
  // 'BYRExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // <- fill in
];

const isAllowlistEnabled = (): boolean => BYREAL_PROGRAM_IDS.length > 0;

// ---------------------------------------------------------------------------
// Verifier
// ---------------------------------------------------------------------------

export type VerifySwapInput = {
  signature: string;
  userWallet: string; // base58 pubkey of the user (signer)
  fromTokenSymbol: string;
  toTokenSymbol: string;
};

export type VerifySwapResult =
  | { ok: true; tokenInDelta: bigint; tokenOutDelta: bigint }
  | { ok: false; reason: VerifySwapFailure };

export type VerifySwapFailure =
  | 'INVALID_SIGNATURE_FORMAT'
  | 'INVALID_USER_WALLET'
  | 'UNKNOWN_FROM_TOKEN'
  | 'UNKNOWN_TO_TOKEN'
  | 'TX_NOT_FOUND'
  | 'RPC_TX_UNAVAILABLE'
  | 'RPC_NETWORK_MISMATCH'
  | 'TX_FAILED'
  | 'WRONG_SIGNER'
  | 'PROGRAM_NOT_ALLOWED'
  | 'TOKEN_IN_NOT_DECREASED'
  | 'TOKEN_OUT_NOT_INCREASED';

export type VerifySwapBasicInput = {
  signature: string;
  expectedSigner: string;
  // Prefer deterministic mint-based verification when provided.
  // For SOL, use wrapped SOL mint: So11111111111111111111111111111111111111112
  fromMint?: string;
  toMint?: string;

  // Backward-compat: symbol-based verification (uses TOKEN_REGISTRY above).
  fromTokenSymbol?: string;
  toTokenSymbol?: string;
};

export type VerifySwapBasicFailure =
  | 'INVALID_SIGNATURE_FORMAT'
  | 'UNKNOWN_FROM_TOKEN'
  | 'UNKNOWN_TO_TOKEN'
  | 'TX_NOT_FOUND'
  | 'RPC_TX_UNAVAILABLE'
  | 'RPC_NETWORK_MISMATCH'
  | 'TX_FAILED'
  | 'TOKEN_IN_NOT_DECREASED'
  | 'TOKEN_OUT_NOT_INCREASED';

export type VerifySwapBasicResult =
  | { ok: true; tokenInDelta: bigint; tokenOutDelta: bigint }
  | { ok: false; reason: VerifySwapBasicFailure };

const isValidPubkey = (s: string): boolean => {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
};

const isValidSignature = (s: string): boolean => {
  // Solana signatures are base58, typically 87-88 chars. Light validation only;
  // RPC will reject malformed ones anyway.
  return typeof s === 'string' && s.length >= 64 && s.length <= 128 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
};

const getParsedTxWithRetry = async (
  conn: Connection,
  signature: string,
): Promise<
  | { ok: true; tx: ParsedTransactionWithMeta }
  | { ok: false; reason: 'TX_NOT_FOUND' | 'RPC_TX_UNAVAILABLE' | 'RPC_NETWORK_MISMATCH' }
> => {
  // RPCs can lag even when explorers show "finalized". Retry a bit before declaring TX_NOT_FOUND.
  const delaysMs = [0, 1000, 2000, 4000, 8000];

  // Best-effort network check for Byreal verification (should be mainnet-beta).
  // If the RPC points to devnet, we'll never find mainnet tx signatures.
  try {
    if (conn === byrealConnection) {
      if (!byrealGenesisHash) {
        byrealGenesisHash = await conn.getGenesisHash();
      }
      if (byrealGenesisHash && byrealGenesisHash !== MAINNET_BETA_GENESIS_HASH) {
        return { ok: false, reason: 'RPC_NETWORK_MISMATCH' };
      }
    }
  } catch {
    // Ignore genesis hash errors; proceed with tx fetch attempts.
  }

  for (const d of delaysMs) {
    if (d > 0) await new Promise((r) => setTimeout(r, d));
    const tx = await conn.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (tx) return { ok: true, tx };
  }

  // Distinguish "tx truly not found" vs "RPC can't return tx details".
  // Some RPCs have limited transaction history; signature exists, but getParsedTransaction returns null.
  try {
    const st = await conn.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const s0 = st?.value?.[0];
    if (s0) return { ok: false, reason: 'RPC_TX_UNAVAILABLE' };
  } catch {
    // ignore
  }

  return { ok: false, reason: 'TX_NOT_FOUND' };
};

export const verifySolanaTxBasic = async (signature: string): Promise<boolean> => {
  if (!isValidSignature(signature)) return false;

  // Generic helper: default to Byreal/mainnet because most external tx checks are swaps.
  const conn = getSolanaConnection('byreal');
  const out = await getParsedTxWithRetry(conn, signature);
  if (!out.ok) return false;
  const tx = out.tx;

  if (!tx || !tx.meta) return false;
  return tx.meta.err === null;
};

const computeTokenDeltaByOwnerMint = (
  tx: ParsedTransactionWithMeta,
  owner: string,
  mint: string,
): bigint => {
  const pre = (tx.meta?.preTokenBalances ?? []).filter((b) => b.owner === owner && b.mint === mint);
  const post = (tx.meta?.postTokenBalances ?? []).filter((b) => b.owner === owner && b.mint === mint);
  const sum = (arr: typeof pre): bigint => arr.reduce<bigint>((acc, b) => acc + BigInt(b.uiTokenAmount.amount), 0n);
  return sum(post) - sum(pre);
};

const computeNativeDeltaByWallet = (tx: ParsedTransactionWithMeta, wallet: string): bigint => {
  const accountKeys = tx.transaction.message.accountKeys;
  const idx = accountKeys.findIndex((k) => k.pubkey.toBase58() === wallet);
  if (idx < 0) return 0n;
  const pre = BigInt(tx.meta?.preBalances?.[idx] ?? 0);
  const post = BigInt(tx.meta?.postBalances?.[idx] ?? 0);
  return post - pre;
};

/**
 * Verify a Solana swap transaction matches the quest contract:
 *  1. tx exists and confirmed
 *  2. meta.err === null (on-chain success)
 *  3. fee payer (signer[0]) === userWallet
 *  4. at least one instruction (outer or inner) calls a program in the Byreal
 *     allowlist (skipped if BYREAL_PROGRAM_IDS is empty — see TODO above)
 *  5. directional balance check for the user's wallet:
 *       - fromToken balance decreased (> 0 delta out)
 *       - toToken balance increased (> 0 delta in)
 *     Notional ($) is NOT enforced here for MVP — `min_notional_usd` from the
 *     quest is treated as guidance for the agent, not a verification rule.
 */
export const verifySolanaSwapTx = async (input: VerifySwapInput): Promise<VerifySwapResult> => {
  if (!isValidSignature(input.signature)) {
    return { ok: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  }
  if (!isValidPubkey(input.userWallet)) {
    return { ok: false, reason: 'INVALID_USER_WALLET' };
  }

  const fromTok = resolveToken(input.fromTokenSymbol);
  const toTok = resolveToken(input.toTokenSymbol);
  if (!fromTok) return { ok: false, reason: 'UNKNOWN_FROM_TOKEN' };
  if (!toTok) return { ok: false, reason: 'UNKNOWN_TO_TOKEN' };

  const conn = getSolanaConnection('byreal');
  const fetched = await getParsedTxWithRetry(conn, input.signature);
  if (!fetched.ok) return { ok: false, reason: fetched.reason };
  const tx = fetched.tx;

  if (!tx || !tx.meta) return { ok: false, reason: 'TX_NOT_FOUND' };
  if (tx.meta.err !== null) return { ok: false, reason: 'TX_FAILED' };

  // (3) signer check — accountKeys[0] is the fee payer / primary signer
  const accountKeys = tx.transaction.message.accountKeys;
  const feePayer = accountKeys[0]?.pubkey?.toBase58();
  if (!feePayer || feePayer !== input.userWallet) {
    return { ok: false, reason: 'WRONG_SIGNER' };
  }

  // (4) program allowlist — outer + inner instructions
  if (isAllowlistEnabled()) {
    const allowSet = new Set(BYREAL_PROGRAM_IDS);
    const outerProgramIds = tx.transaction.message.instructions.map((ix) => ix.programId.toBase58());
    const innerProgramIds = (tx.meta.innerInstructions ?? []).flatMap((g) =>
      g.instructions.map((ix) => ix.programId.toBase58()),
    );
    const allProgramIds = [...outerProgramIds, ...innerProgramIds];
    const hit = allProgramIds.some((id) => allowSet.has(id));
    if (!hit) return { ok: false, reason: 'PROGRAM_NOT_ALLOWED' };
  }

  // (5) balance diff per token, scoped to userWallet
  const userWallet = input.userWallet;

  const computeSplDelta = (mint: string): bigint => {
    const pre = (tx.meta?.preTokenBalances ?? []).filter((b) => b.owner === userWallet && b.mint === mint);
    const post = (tx.meta?.postTokenBalances ?? []).filter((b) => b.owner === userWallet && b.mint === mint);
    const sum = (arr: typeof pre): bigint =>
      arr.reduce<bigint>((acc, b) => acc + BigInt(b.uiTokenAmount.amount), 0n);
    return sum(post) - sum(pre);
  };

  const computeNativeDelta = (): bigint => {
    // For native SOL we look at the user's lamport balance change.
    // accountKeys order matches meta.preBalances / postBalances.
    const idx = accountKeys.findIndex((k) => k.pubkey.toBase58() === userWallet);
    if (idx < 0) return 0n;
    const pre = BigInt(tx.meta?.preBalances?.[idx] ?? 0);
    const post = BigInt(tx.meta?.postBalances?.[idx] ?? 0);
    // For the fee payer this includes the tx fee paid — but we only care
    // about direction (decreased / increased), so a small fee offset doesn't
    // change the sign for any non-trivial swap.
    return post - pre;
  };

  const fromDelta = fromTok.mint ? computeSplDelta(fromTok.mint) : computeNativeDelta();
  const toDelta = toTok.mint ? computeSplDelta(toTok.mint) : computeNativeDelta();

  if (fromDelta >= 0n) return { ok: false, reason: 'TOKEN_IN_NOT_DECREASED' };
  if (toDelta <= 0n) return { ok: false, reason: 'TOKEN_OUT_NOT_INCREASED' };

  return { ok: true, tokenInDelta: fromDelta, tokenOutDelta: toDelta };
};

export const verifySolanaSwapTxBasic = async (input: VerifySwapBasicInput): Promise<VerifySwapBasicResult> => {
  if (!isValidSignature(input.signature)) {
    return { ok: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  }
  if (!isValidPubkey(input.expectedSigner)) {
    return { ok: false, reason: 'TX_FAILED' };
  }

  const hasMints = Boolean(input.fromMint) || Boolean(input.toMint);
  const hasSymbols = Boolean(input.fromTokenSymbol) || Boolean(input.toTokenSymbol);

  if (hasMints) {
    if (!input.fromMint || !input.toMint) return { ok: false, reason: 'TX_FAILED' };
    if (!isValidPubkey(input.fromMint) || !isValidPubkey(input.toMint)) return { ok: false, reason: 'TX_FAILED' };
  } else if (hasSymbols) {
    const fromTok = input.fromTokenSymbol ? resolveToken(input.fromTokenSymbol) : null;
    const toTok = input.toTokenSymbol ? resolveToken(input.toTokenSymbol) : null;
    if (!fromTok) return { ok: false, reason: 'UNKNOWN_FROM_TOKEN' };
    if (!toTok) return { ok: false, reason: 'UNKNOWN_TO_TOKEN' };
  } else {
    return { ok: false, reason: 'TX_FAILED' };
  }

  const conn = getSolanaConnection('byreal');
  const fetched = await getParsedTxWithRetry(conn, input.signature);
  if (!fetched.ok) return { ok: false, reason: fetched.reason };
  const tx = fetched.tx;

  if (!tx || !tx.meta) return { ok: false, reason: 'TX_NOT_FOUND' };
  if (tx.meta.err !== null) return { ok: false, reason: 'TX_FAILED' };

  const accountKeys = tx.transaction.message.accountKeys;
  const feePayer = accountKeys[0]?.pubkey?.toBase58();
  if (!feePayer || feePayer !== input.expectedSigner) return { ok: false, reason: 'TX_FAILED' };

  const fromDelta = hasMints
    ? computeTokenDeltaByOwnerMint(tx, feePayer, input.fromMint!)
    : (() => {
        const t = resolveToken(input.fromTokenSymbol!);
        return t?.mint ? computeTokenDeltaByOwnerMint(tx, feePayer, t.mint) : computeNativeDeltaByWallet(tx, feePayer);
      })();
  const toDelta = hasMints
    ? computeTokenDeltaByOwnerMint(tx, feePayer, input.toMint!)
    : (() => {
        const t = resolveToken(input.toTokenSymbol!);
        return t?.mint ? computeTokenDeltaByOwnerMint(tx, feePayer, t.mint) : computeNativeDeltaByWallet(tx, feePayer);
      })();

  if (fromDelta >= 0n) return { ok: false, reason: 'TOKEN_IN_NOT_DECREASED' };
  if (toDelta <= 0n) return { ok: false, reason: 'TOKEN_OUT_NOT_INCREASED' };

  return { ok: true, tokenInDelta: fromDelta, tokenOutDelta: toDelta };
};

export type VerifyClmmOpenInput = {
  signature: string;
  expectedSigner: string;
  token0Mint: string;
  token1Mint: string;
  positionMint: string;
};

export type VerifyClmmCloseInput = VerifyClmmOpenInput;

export type VerifyClmmCopyBasicInput = {
  signature: string;
  expectedSigner: string;
  token0Mint: string;
  token1Mint: string;
};

export type VerifyClmmComprehensiveFailure =
  | 'INVALID_SIGNATURE_FORMAT'
  | 'INVALID_SIGNER'
  | 'INVALID_MINT'
  | 'TX_NOT_FOUND'
  | 'RPC_TX_UNAVAILABLE'
  | 'RPC_NETWORK_MISMATCH'
  | 'TX_FAILED'
  | 'WRONG_SIGNER'
  | 'POSITION_NFT_NOT_MINTED'
  | 'POSITION_NFT_NOT_BURNED'
  | 'NO_TOKEN_OUTFLOW'
  | 'NO_TOKEN_INFLOW';

export type VerifyClmmComprehensiveResult = { ok: true } | { ok: false; reason: VerifyClmmComprehensiveFailure };

const isValidMint = (s: string): boolean => isValidPubkey(s);

export const verifySolanaClmmOpenTx = async (input: VerifyClmmOpenInput): Promise<VerifyClmmComprehensiveResult> => {
  if (!isValidSignature(input.signature)) return { ok: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  if (!isValidPubkey(input.expectedSigner)) return { ok: false, reason: 'INVALID_SIGNER' };
  if (!isValidMint(input.token0Mint) || !isValidMint(input.token1Mint) || !isValidMint(input.positionMint)) {
    return { ok: false, reason: 'INVALID_MINT' };
  }

  const conn = getSolanaConnection('byreal');
  const fetched = await getParsedTxWithRetry(conn, input.signature);
  if (!fetched.ok) return { ok: false, reason: fetched.reason };
  const tx = fetched.tx;
  if (!tx || !tx.meta) return { ok: false, reason: 'TX_NOT_FOUND' };
  if (tx.meta.err !== null) return { ok: false, reason: 'TX_FAILED' };

  const feePayer = tx.transaction.message.accountKeys[0]?.pubkey?.toBase58();
  if (!feePayer) return { ok: false, reason: 'TX_FAILED' };
  if (feePayer !== input.expectedSigner) return { ok: false, reason: 'WRONG_SIGNER' };

  const posDelta = computeTokenDeltaByOwnerMint(tx, feePayer, input.positionMint);
  if (posDelta <= 0n) return { ok: false, reason: 'POSITION_NFT_NOT_MINTED' };

  const d0 = computeTokenDeltaByOwnerMint(tx, feePayer, input.token0Mint);
  const d1 = computeTokenDeltaByOwnerMint(tx, feePayer, input.token1Mint);
  if (d0 >= 0n && d1 >= 0n) return { ok: false, reason: 'NO_TOKEN_OUTFLOW' };

  return { ok: true };
};

export const verifySolanaClmmCloseTx = async (input: VerifyClmmCloseInput): Promise<VerifyClmmComprehensiveResult> => {
  if (!isValidSignature(input.signature)) return { ok: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  if (!isValidPubkey(input.expectedSigner)) return { ok: false, reason: 'INVALID_SIGNER' };
  if (!isValidMint(input.token0Mint) || !isValidMint(input.token1Mint) || !isValidMint(input.positionMint)) {
    return { ok: false, reason: 'INVALID_MINT' };
  }

  const conn = getSolanaConnection('byreal');
  const fetched = await getParsedTxWithRetry(conn, input.signature);
  if (!fetched.ok) return { ok: false, reason: fetched.reason };
  const tx = fetched.tx;
  if (!tx || !tx.meta) return { ok: false, reason: 'TX_NOT_FOUND' };
  if (tx.meta.err !== null) return { ok: false, reason: 'TX_FAILED' };

  const feePayer = tx.transaction.message.accountKeys[0]?.pubkey?.toBase58();
  if (!feePayer) return { ok: false, reason: 'TX_FAILED' };
  if (feePayer !== input.expectedSigner) return { ok: false, reason: 'WRONG_SIGNER' };

  const posDelta = computeTokenDeltaByOwnerMint(tx, feePayer, input.positionMint);
  if (posDelta >= 0n) return { ok: false, reason: 'POSITION_NFT_NOT_BURNED' };

  const d0 = computeTokenDeltaByOwnerMint(tx, feePayer, input.token0Mint);
  const d1 = computeTokenDeltaByOwnerMint(tx, feePayer, input.token1Mint);
  if (d0 <= 0n && d1 <= 0n) return { ok: false, reason: 'NO_TOKEN_INFLOW' };

  return { ok: true };
};

/**
 * Basic verification for "copy strategy" CLMM operations.
 *
 * Unlike our `clmm_open` contract, Byreal's `positions copy` CLI does not let us
 * pre-specify the resulting position NFT mint. So we verify the invariant parts:
 * - tx exists + succeeded
 * - signer matches expected agent wallet
 * - at least one of token0/token1 decreases (liquidity deposit requires outflow)
 */
export const verifySolanaClmmCopyTxBasic = async (
  input: VerifyClmmCopyBasicInput,
): Promise<{ ok: true } | { ok: false; reason: VerifyClmmComprehensiveFailure }> => {
  if (!isValidSignature(input.signature)) return { ok: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  if (!isValidPubkey(input.expectedSigner)) return { ok: false, reason: 'INVALID_SIGNER' };
  if (!isValidMint(input.token0Mint) || !isValidMint(input.token1Mint)) {
    return { ok: false, reason: 'INVALID_MINT' };
  }

  const conn = getSolanaConnection('byreal');
  const fetched = await getParsedTxWithRetry(conn, input.signature);
  if (!fetched.ok) return { ok: false, reason: fetched.reason };
  const tx = fetched.tx;
  if (!tx || !tx.meta) return { ok: false, reason: 'TX_NOT_FOUND' };
  if (tx.meta.err !== null) return { ok: false, reason: 'TX_FAILED' };

  const feePayer = tx.transaction.message.accountKeys[0]?.pubkey?.toBase58();
  if (!feePayer) return { ok: false, reason: 'TX_FAILED' };
  if (feePayer !== input.expectedSigner) return { ok: false, reason: 'WRONG_SIGNER' };

  const d0 = computeTokenDeltaByOwnerMint(tx, feePayer, input.token0Mint);
  const d1 = computeTokenDeltaByOwnerMint(tx, feePayer, input.token1Mint);
  if (d0 >= 0n && d1 >= 0n) return { ok: false, reason: 'NO_TOKEN_OUTFLOW' };

  return { ok: true };
};
