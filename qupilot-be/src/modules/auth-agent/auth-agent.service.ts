import crypto from 'crypto';
import { supabase } from '../../config/supabase';
import { verifySolanaSignature } from '../../lib/wallet-signature';
import { AppError } from '../../lib/errors';
import { generateForUser } from '../api-keys/api-keys.service';

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type ChallengeRow = {
  id: number;
  wallet_address: string;
  nonce: string;
  message: string;
  expires_at: string;
  used_at: string | null;
};

const nowIso = (): string => new Date().toISOString();

const buildChallengeMessage = (input: {
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}): string => {
  // IMPORTANT: the agent must sign this exact string (byte-for-byte).
  return [
    'QuPilot Agent Registration',
    '',
    `Wallet: ${input.walletAddress}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expires At: ${input.expiresAt}`,
  ].join('\n');
};

export const createChallenge = async (
  walletAddress: string,
): Promise<{ message: string; expires_at: string }> => {
  const issuedAt = nowIso();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const message = buildChallengeMessage({ walletAddress, nonce, issuedAt, expiresAt });

  const inserted = await supabase
    .from('agent_auth_challenges')
    .insert({
      wallet_address: walletAddress,
      nonce,
      message,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (inserted.error) throw inserted.error;
  return { message, expires_at: expiresAt };
};

const resolveValidChallenge = async (
  walletAddress: string,
  message: string,
): Promise<ChallengeRow> => {
  const row = await supabase
    .from('agent_auth_challenges')
    .select('id, wallet_address, nonce, message, expires_at, used_at')
    .eq('wallet_address', walletAddress)
    .eq('message', message)
    .maybeSingle();

  if (row.error) throw row.error;
  if (!row.data) {
    throw new AppError(400, 'CHALLENGE_NOT_FOUND', 'Challenge not found. Request a new challenge first.');
  }

  const c = row.data as unknown as ChallengeRow;
  if (c.used_at) {
    throw new AppError(409, 'CHALLENGE_ALREADY_USED', 'Challenge already used. Request a new challenge first.');
  }
  if (Date.parse(c.expires_at) <= Date.now()) {
    throw new AppError(400, 'CHALLENGE_EXPIRED', 'Challenge expired. Request a new challenge first.');
  }
  return c;
};

type UserRow = { uuid: string; wallet_address: string };

const resolveOrCreateUserByWallet = async (walletAddress: string): Promise<UserRow> => {
  const { data, error } = await supabase
    .from('users')
    .select('uuid, wallet_address')
    .eq('wallet_address', walletAddress)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as unknown as UserRow;

  // Agent self-register: auto-create a user row if it doesn't exist yet.
  const inserted = await supabase
    .from('users')
    .insert({
      wallet_address: walletAddress,
      role: 'user',
    })
    .select('uuid, wallet_address')
    .single();

  if (!inserted.error) return inserted.data as unknown as UserRow;

  // Race-condition: another request inserted between SELECT and INSERT.
  if (inserted.error.code === '23505') {
    const refetch = await supabase
      .from('users')
      .select('uuid, wallet_address')
      .eq('wallet_address', walletAddress)
      .single();
    if (refetch.error) throw refetch.error;
    return refetch.data as unknown as UserRow;
  }

  throw inserted.error;
};

export const register = async (input: {
  wallet_address: string;
  signature: string;
  message: string;
  label?: string;
}): Promise<Awaited<ReturnType<typeof generateForUser>>> => {
  // 1) Challenge must exist and be fresh (anti-replay)
  const challenge = await resolveValidChallenge(input.wallet_address, input.message);

  // 2) Verify wallet signature over EXACT challenge message
  const ok = verifySolanaSignature(input.wallet_address, input.message, input.signature);
  if (!ok) {
    throw new AppError(401, 'INVALID_SIGNATURE', 'Wallet signature is invalid');
  }

  // 3) Ensure a user row exists for this wallet (auto-create on first register)
  const user = await resolveOrCreateUserByWallet(input.wallet_address);

  // 4) Mark challenge used (best-effort gate; we do it before key generation to
  //    reduce replay window). If this fails, we abort.
  const used = await supabase
    .from('agent_auth_challenges')
    .update({ used_at: nowIso() })
    .eq('id', challenge.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle();
  if (used.error) throw used.error;
  if (!used.data) {
    throw new AppError(409, 'CHALLENGE_ALREADY_USED', 'Challenge already used. Request a new challenge first.');
  }

  // 5) Generate (and rotate) API key for this user
  return generateForUser(user.uuid, input.label);
};
