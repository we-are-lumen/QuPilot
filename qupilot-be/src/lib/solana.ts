import { Connection, PublicKey, type ParsedTransactionWithMeta } from '@solana/web3.js';
import { env } from '../config/env';

// ---------------------------------------------------------------------------
// Connection (lazy singleton)
// ---------------------------------------------------------------------------

let connection: Connection | null = null;

export const getSolanaConnection = (): Connection => {
  if (!connection) {
    connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');
  }
  return connection;
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
  | 'TX_FAILED'
  | 'WRONG_SIGNER'
  | 'PROGRAM_NOT_ALLOWED'
  | 'TOKEN_IN_NOT_DECREASED'
  | 'TOKEN_OUT_NOT_INCREASED';

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

  const conn = getSolanaConnection();
  const tx: ParsedTransactionWithMeta | null = await conn.getParsedTransaction(input.signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

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

// ---------------------------------------------------------------------------
// CLMM verifiers (stubs)
// ---------------------------------------------------------------------------
// Proper CLMM verification needs Byreal-specific knowledge:
//   - decode the position NFT mint emitted by the open instruction
//   - confirm the pool, tick range, and liquidity values match action_params
//   - for close: confirm the position NFT was burned / liquidity drained
// Until we have Byreal's program IDs and IDLs wired up, these stubs do the
// universal "tx-basic" checks (exists, succeeded, fee payer = user) so the
// MVP can score these quests without lying about deeper guarantees.

export type VerifyClmmInput = {
  signature: string;
  userWallet: string;
};

export type VerifyClmmFailure =
  | 'INVALID_SIGNATURE_FORMAT'
  | 'INVALID_USER_WALLET'
  | 'TX_NOT_FOUND'
  | 'TX_FAILED'
  | 'WRONG_SIGNER'
  | 'PROGRAM_NOT_ALLOWED';

export type VerifyClmmResult =
  | { ok: true; note: string }
  | { ok: false; reason: VerifyClmmFailure };

const verifyTxBasicSolana = async (input: VerifyClmmInput): Promise<VerifyClmmResult> => {
  if (!isValidSignature(input.signature)) {
    return { ok: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  }
  if (!isValidPubkey(input.userWallet)) {
    return { ok: false, reason: 'INVALID_USER_WALLET' };
  }

  const conn = getSolanaConnection();
  const tx = await conn.getParsedTransaction(input.signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx || !tx.meta) return { ok: false, reason: 'TX_NOT_FOUND' };
  if (tx.meta.err !== null) return { ok: false, reason: 'TX_FAILED' };

  const feePayer = tx.transaction.message.accountKeys[0]?.pubkey?.toBase58();
  if (!feePayer || feePayer !== input.userWallet) {
    return { ok: false, reason: 'WRONG_SIGNER' };
  }

  if (isAllowlistEnabled()) {
    const allowSet = new Set(BYREAL_PROGRAM_IDS);
    const outer = tx.transaction.message.instructions.map((ix) => ix.programId.toBase58());
    const inner = (tx.meta.innerInstructions ?? []).flatMap((g) =>
      g.instructions.map((ix) => ix.programId.toBase58()),
    );
    if (![...outer, ...inner].some((id) => allowSet.has(id))) {
      return { ok: false, reason: 'PROGRAM_NOT_ALLOWED' };
    }
  }

  return { ok: true, note: 'tx-basic only — CLMM state verification not yet implemented' };
};

/** Open a CLMM position. MVP: tx-basic verification only. */
export const verifySolanaOpenClmm = (input: VerifyClmmInput): Promise<VerifyClmmResult> =>
  verifyTxBasicSolana(input);

/** Close a CLMM position. MVP: tx-basic verification only. */
export const verifySolanaCloseClmm = (input: VerifyClmmInput): Promise<VerifyClmmResult> =>
  verifyTxBasicSolana(input);
