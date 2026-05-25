import * as anchor from '@coral-xyz/anchor';

export const parseAnchorErrorCode = (err: unknown): string | null => {
  const e = err as { logs?: unknown; error?: unknown; message?: unknown } | null;
  const logs = e && Array.isArray(e.logs) ? (e.logs as string[]) : null;
  if (logs) {
    const parsed = anchor.AnchorError.parse(logs);
    if (parsed) return parsed.error.errorCode.code;
  }

  const direct = err as { error?: { errorCode?: { code?: unknown } } } | null;
  if (direct?.error?.errorCode?.code && typeof direct.error.errorCode.code === 'string') {
    return direct.error.errorCode.code;
  }

  return null;
};

