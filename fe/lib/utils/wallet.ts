declare global {
  interface Window {
    solana?: any;
  }
}

import { Buffer } from 'buffer';
import { QUPILOT_PROGRAM_ID, SOLANA_RPC_URL } from '@/config';

export function isSolanaWalletInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.solana && (window.solana.isPhantom || typeof window.solana.connect === 'function');
}

export async function connectWallet(): Promise<string> {
  if (!window.solana) throw new Error('Solana wallet not found');
  const res = await window.solana.connect();
  const pubkey = res?.publicKey ?? window.solana.publicKey;
  if (!pubkey) throw new Error('No public key returned from wallet');
  return typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
}

export async function disconnectWallet(): Promise<void> {
  if (!window.solana || typeof window.solana.disconnect !== 'function') return;
  await window.solana.disconnect();
}

export function buildSignInMessage(walletAddress: string): string {
  return (
    `Sign in to QuPilot\n\n` +
    `Wallet: ${walletAddress}\n` +
    `Timestamp: ${new Date().toISOString()}\n\n` +
    `This request will not trigger a blockchain transaction or cost any fees.`
  );
}

export async function signMessage(message: string): Promise<string> {
  if (!window.solana || typeof window.solana.signMessage !== 'function') {
    throw new Error('Wallet does not support signMessage');
  }
  const encoded = new TextEncoder().encode(message);
  const res = await window.solana.signMessage(encoded, 'utf8');
  const sig = res?.signature ?? res;
  const bs58 = (await import('bs58')).default;
  return bs58.encode(sig);
}

const sha256 = async (input: string): Promise<Uint8Array> => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
};

const encodeU64LE = (view: DataView, offset: number, value: bigint) => {
  view.setBigUint64(offset, value, true);
};

const encodeI64LE = (view: DataView, offset: number, value: bigint) => {
  view.setBigInt64(offset, value, true);
};

export type CreateQuestDepositInput = {
  questUuid: string;
  totalRewardPoolLamports: string | number | bigint;
  rewardPerUserLamports: string | number | bigint;
  expiresAtUnixSeconds: string | number | bigint;
};

export async function createQuestDepositTx(input: CreateQuestDepositInput): Promise<string> {
  if (!window.solana || typeof window.solana.signAndSendTransaction !== 'function') {
    throw new Error('Wallet does not support signAndSendTransaction');
  }

  const { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } = await import('@solana/web3.js');

  const conn = new Connection(SOLANA_RPC_URL, 'confirmed');

  const wallet = await connectWallet();
  const provider = new PublicKey(wallet);
  const programId = new PublicKey(QUPILOT_PROGRAM_ID);

  const questIdBytes = await sha256(input.questUuid);
  const [questPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('quest'), provider.toBuffer(), Buffer.from(questIdBytes)],
    programId,
  );

  const discriminator = Uint8Array.from([112, 49, 32, 224, 255, 173, 5, 7]);
  const data = new Uint8Array(64);
  data.set(discriminator, 0);
  data.set(questIdBytes, 8);
  const view = new DataView(data.buffer);

  const totalRewardPool = BigInt(String(input.totalRewardPoolLamports));
  const rewardPerUser = BigInt(String(input.rewardPerUserLamports));
  const expiresAt = BigInt(String(input.expiresAtUnixSeconds));

  encodeU64LE(view, 40, totalRewardPool);
  encodeU64LE(view, 48, rewardPerUser);
  encodeI64LE(view, 56, expiresAt);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: provider, isSigner: true, isWritable: true },
      { pubkey: questPoolPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: provider }).add(ix);

  const res = await window.solana.signAndSendTransaction(tx);
  const signature = res?.signature ?? res;
  await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  return signature;
}
