import { useQuery } from '@tanstack/react-query';
import { Connection, PublicKey } from '@solana/web3.js';
import { SOLANA_RPC_URL } from '@/config';

export const SOL_BALANCE_QUERY_KEY = ['sol-balance'];

let conn: Connection | null = null;
const getConnection = () => {
  if (!conn) conn = new Connection(SOLANA_RPC_URL, 'confirmed');
  return conn;
};

export function useSolBalance(walletAddress?: string | null) {
  return useQuery<{ lamports: number; sol: number }>({
    queryKey: [...SOL_BALANCE_QUERY_KEY, walletAddress],
    enabled: !!walletAddress,
    queryFn: async () => {
      const address = walletAddress;
      if (!address) return { lamports: 0, sol: 0 };
      const balance = await getConnection().getBalance(new PublicKey(address), 'confirmed');
      return { lamports: balance, sol: balance / 1e9 };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

