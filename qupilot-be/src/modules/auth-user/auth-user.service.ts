import { supabase } from '../../config/supabase';
import { verifySolanaSignature } from '../../lib/wallet-signature';
import { signProviderJwt, signUserJwt } from '../../lib/jwt';
import { AppError } from '../../lib/errors';
import type { WalletLoginBody } from './auth-user.schema';

export type UserPublic = {
  uuid: string;
  wallet_address: string;
  role: 'user' | 'user_provider';
  display_name: string | null;
  logo_url: string | null;
  created_at: string;
};

type UserRow = UserPublic & { id: number };

const USER_PUBLIC_COLS = 'uuid, wallet_address, role, display_name, logo_url, created_at';

const signByRole = (user: Pick<UserPublic, 'uuid' | 'wallet_address' | 'role'>): string => {
  if (user.role === 'user_provider') return signProviderJwt({ sub: user.uuid, wallet_address: user.wallet_address });
  return signUserJwt({ sub: user.uuid, wallet_address: user.wallet_address });
};

export const walletLogin = async (
  body: WalletLoginBody,
): Promise<
  | { registered: false }
  | { registered: true; token: string; user: UserPublic; created: boolean }
> => {
  const ok = verifySolanaSignature(body.wallet_address, body.message, body.signature);
  if (!ok) {
    throw new AppError(401, 'INVALID_SIGNATURE', 'Wallet signature is invalid');
  }

  // Try existing first.
  const existing = await supabase
    .from('users')
    .select(`id, ${USER_PUBLIC_COLS}`)
    .eq('wallet_address', body.wallet_address)
    .maybeSingle();
  if (existing.error) throw existing.error;

  let row: UserRow;
  let created = false;

  if (existing.data) {
    row = existing.data as unknown as UserRow;
    if (body.role && body.role !== row.role) {
      throw new AppError(409, 'ROLE_MISMATCH', 'Wallet already registered with a different role');
    }
  } else {
    if (!body.role) return { registered: false };

    const isProvider = body.role === 'user_provider';
    if (isProvider && (!body.display_name || body.display_name.trim().length === 0)) {
      throw new AppError(400, 'DISPLAY_NAME_REQUIRED', 'display_name is required for user_provider');
    }

    const inserted = await supabase
      .from('users')
      .insert({
        wallet_address: body.wallet_address,
        role: body.role,
        display_name: isProvider ? (body.display_name ?? null) : null,
        logo_url: isProvider ? (body.logo_url ?? null) : null,
      })
      .select(`id, ${USER_PUBLIC_COLS}`)
      .single();
    if (inserted.error) {
      // Race: another request inserted between SELECT and INSERT — re-fetch.
      if (inserted.error.code === '23505') {
        const refetch = await supabase
          .from('users')
          .select(`id, ${USER_PUBLIC_COLS}`)
          .eq('wallet_address', body.wallet_address)
          .single();
        if (refetch.error) throw refetch.error;
        row = refetch.data as unknown as UserRow;
        if (body.role !== row.role) {
          throw new AppError(409, 'ROLE_MISMATCH', 'Wallet already registered with a different role');
        }
      } else {
        throw inserted.error;
      }
    } else {
      row = inserted.data as unknown as UserRow;
      created = true;
    }
  }

  const token = signByRole(row);
  const { id: _id, ...user } = row;
  return { registered: true, token, user, created };
};
