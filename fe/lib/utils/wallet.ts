declare global {
  interface Window {
    solana?: any;
  }
}

import { Buffer } from 'buffer';
import { QUPILOT_ADMIN_PUBKEY, QUPILOT_PROGRAM_ID, SOLANA_RPC_URL } from '@/config';

export type WalletType = 'phantom' | 'solflare' | 'backpack' | 'okx';

export function isLocalEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    process.env.NODE_ENV === "development"
  );
}


export function isSolanaWalletInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    isPhantomInstalled() ||
    isSolflareInstalled() ||
    isBackpackInstalled() ||
    isOkxInstalled() ||
    !!window.solana
  );
}

export function isPhantomInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    !!(window as any).phantom?.solana ||
    (!!window.solana && window.solana.isPhantom)
  );
}

export function isSolflareInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    !!(window as any).solflare || (!!window.solana && window.solana.isSolflare)
  );
}

export function isBackpackInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    !!(window as any).backpack || (!!window.solana && window.solana.isBackpack)
  );
}

export function isOkxInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    !!(window as any).okxwallet?.solana ||
    (!!window.solana && window.solana.isOkxwallet)
  );
}


export function getWalletProvider(walletType?: WalletType): any {
  if (typeof window === "undefined") return null;
  if (!walletType) {
    return (
      (window as any).phantom?.solana ||
      ((window as any).solana?.isPhantom ? window.solana : null) ||
      (window as any).solflare ||
      (window as any).backpack ||
      (window as any).okxwallet?.solana ||
      (window as any).ethereum
    );
  }
  switch (walletType) {
    case "phantom":
      return (
        (window as any).phantom?.solana ||
        ((window as any).solana?.isPhantom ? window.solana : null)
      );
    case "solflare":
      return (
        (window as any).solflare ||
        ((window as any).solana?.isSolflare ? window.solana : null)
      );
    case "backpack":
      return (
        (window as any).backpack ||
        ((window as any).solana?.isBackpack ? window.solana : null)
      );
    case "okx":
      return (
        (window as any).okxwallet?.solana ||
        ((window as any).solana?.isOkxwallet ? window.solana : null)
      );
    default:
      return window.solana;
  }
}

export async function connectWallet(walletType?: WalletType): Promise<string> {
  const provider = getWalletProvider(walletType);
  if (!provider) throw new Error(`${walletType || "Solana"} wallet not found`);

  const res = await provider.connect();
  const pubkey = res?.publicKey ?? provider.publicKey;
  if (!pubkey) throw new Error("No public key returned from wallet");
  return typeof pubkey === "string" ? pubkey : pubkey.toBase58();
}

export async function disconnectWallet(): Promise<void> {
  if (!window.solana || typeof window.solana.disconnect !== "function") return;
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

export async function signMessage(
  message: string,
  walletType?: WalletType,
): Promise<string> {
  const provider = getWalletProvider(walletType);
  if (!provider || typeof provider.signMessage !== "function") {
    throw new Error("Wallet does not support signMessage");
  }

  const encoded = new TextEncoder().encode(message);
  const res = await provider.signMessage(encoded, "utf8");
  const sig = res?.signature ?? res;
  const bs58 = (await import("bs58")).default;
  return bs58.encode(sig);
}

const sha256 = async (input: string): Promise<Uint8Array> => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes as any);
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
  const verifier = new PublicKey(QUPILOT_ADMIN_PUBKEY);

  const questIdBytes = await sha256(input.questUuid);
  const [questPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('quest'), provider.toBuffer(), Buffer.from(questIdBytes)],
    programId,
  );

  const discriminator = Uint8Array.from([112, 49, 32, 224, 255, 173, 5, 7]);
  const data = new Uint8Array(96);
  data.set(discriminator, 0);
  data.set(questIdBytes, 8);
  data.set(verifier.toBytes(), 40);
  const view = new DataView(data.buffer);

  const totalRewardPool = BigInt(String(input.totalRewardPoolLamports));
  const rewardPerUser = BigInt(String(input.rewardPerUserLamports));
  const expiresAt = BigInt(String(input.expiresAtUnixSeconds));

  encodeU64LE(view, 72, totalRewardPool);
  encodeU64LE(view, 80, rewardPerUser);
  encodeI64LE(view, 88, expiresAt);

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
  if (typeof signature !== 'string' || signature.trim().length === 0) {
    throw new Error('Invalid wallet signature response');
  }
  try {
    await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  } catch {
  }
  return signature;
}

export type ClaimRewardInput = {
  questPoolPda: string;
  participationPda: string;
};

export async function claimRewardTx(input: ClaimRewardInput): Promise<string> {
  if (!window.solana || typeof window.solana.signAndSendTransaction !== 'function') {
    throw new Error('Wallet does not support signAndSendTransaction');
  }

  const { Connection, PublicKey, Transaction, TransactionInstruction } = await import('@solana/web3.js');

  const conn = new Connection(SOLANA_RPC_URL, 'confirmed');
  const wallet = await connectWallet();
  const claimer = new PublicKey(wallet);
  const programId = new PublicKey(QUPILOT_PROGRAM_ID);
  const questPool = new PublicKey(input.questPoolPda);
  const participation = new PublicKey(input.participationPda);

  const discriminator = Uint8Array.from([149, 95, 181, 242, 94, 90, 158, 162]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: claimer, isSigner: true, isWritable: true },
      { pubkey: questPool, isSigner: false, isWritable: true },
      { pubkey: participation, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(discriminator),
  });

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: claimer }).add(ix);

  const res = await window.solana.signAndSendTransaction(tx);
  const signature = res?.signature ?? res;
  if (typeof signature !== 'string' || signature.trim().length === 0) {
    throw new Error('Invalid wallet signature response');
  }
  try {
    await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  } catch {
  }
  return signature;
}
