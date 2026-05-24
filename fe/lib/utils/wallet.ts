declare global {
  interface Window {
    solana?: any;
  }
}

import { Buffer } from 'buffer';
import { QUPILOT_PROGRAM_ID, SOLANA_RPC_URL } from '@/config';

export type WalletType = 'phantom' | 'solflare' | 'backpack' | 'okx' | 'metamask';

export function isLocalEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    process.env.NODE_ENV === "development"
  );
}

export function isMetaMaskSandboxActive(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("qupilot_metamask_sandbox_active") === "true";
}

export async function getOrCreateSandboxKeypair(): Promise<any> {
  const { Keypair } = await import('@solana/web3.js');
  if (typeof window === "undefined") {
    return Keypair.generate();
  }
  const keyStr = localStorage.getItem("qupilot_sandbox_keypair");
  if (keyStr) {
    try {
      const secretKey = new Uint8Array(JSON.parse(keyStr));
      return Keypair.fromSecretKey(secretKey);
    } catch (e) {
      console.error("Failed to parse stored sandbox keypair, generating a new one:", e);
    }
  }
  const keypair = Keypair.generate();
  localStorage.setItem("qupilot_sandbox_keypair", JSON.stringify(Array.from(keypair.secretKey)));
  return keypair;
}

export function isSolanaWalletInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    isPhantomInstalled() ||
    isSolflareInstalled() ||
    isBackpackInstalled() ||
    isOkxInstalled() ||
    isMetaMaskInstalled() ||
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

export function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as any).solana?.isMetaMask) return true;
  const ethereum = (window as any).ethereum;
  if (!ethereum) return false;
  if (ethereum.providers && Array.isArray(ethereum.providers)) {
    return ethereum.providers.some((p: any) => p.isMetaMask);
  }
  return !!ethereum.isMetaMask;
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
    case "metamask": {
      if ((window as any).solana?.isMetaMask) {
        return (window as any).solana;
      }
      const ethereum = (window as any).ethereum;
      if (!ethereum) return null;
      // If multiple wallets are injected into the ethereum object, find the one with isMetaMask
      if (ethereum.providers && Array.isArray(ethereum.providers)) {
        const mm = ethereum.providers.find(
          (p: any) => p.isMetaMask && !p.isPhantom && !p.isOkxWallet,
        );
        if (mm) return mm;
      }
      if (ethereum.isMetaMask && !ethereum.isPhantom && !ethereum.isOkxWallet) {
        return ethereum;
      }
      if (ethereum.providers && Array.isArray(ethereum.providers)) {
        const mm = ethereum.providers.find((p: any) => p.isMetaMask);
        if (mm) return mm;
      }
      return ethereum;
    }
    default:
      return window.solana;
  }
}

export async function connectWallet(walletType?: WalletType): Promise<string> {
  if (walletType === "metamask") {
    if ((window as any).solana?.isMetaMask) {
      const res = await (window as any).solana.connect();
      const pubkey = res?.publicKey ?? (window as any).solana.publicKey;
      if (!pubkey) throw new Error("No public key returned from MetaMask");
      return typeof pubkey === "string" ? pubkey : pubkey.toBase58();
    }

    const ethereum = getWalletProvider("metamask");
    if (!ethereum) throw new Error("MetaMask not installed");

    try {
      await ethereum.request({
        method: "wallet_requestSnaps",
        params: {
          "npm:@solflare-wallet/solana-snap": {},
        },
      });

      const res = await ethereum.request({
        method: "wallet_invokeSnap",
        params: {
          snapId: "npm:@solflare-wallet/solana-snap",
          request: {
            method: "connect",
          },
        },
      });

      if (!res?.publicKey) {
        throw new Error(
          "No Solana public key returned from MetaMask Solflare Snap",
        );
      }
      localStorage.removeItem("qupilot_metamask_sandbox_active");
      return res.publicKey;
    } catch (err: any) {
      console.error("MetaMask Solana Snap connection failed:", err);

      // Sandbox Fallback
      if (isLocalEnvironment()) {
        console.warn("[QuPilot Sandbox Mode] MetaMask Solana Snap failed. Activating Sandbox Fallback.");
        localStorage.setItem("qupilot_metamask_sandbox_active", "true");
        const keypair = await getOrCreateSandboxKeypair();
        const address = keypair.publicKey.toBase58();

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("qupilot_sandbox_activated", {
            detail: { address }
          }));
        }
        return address;
      }

      let errorMsg =
        err?.message ||
        "MetaMask Solana Snap connection failed. Please approve the snap request.";
      if (errorMsg.includes("Invalid origin")) {
        errorMsg =
          'MetaMask Solana Snap "Invalid origin" error. To fix this, please go to MetaMask Settings -> Snaps, remove the "Solana Wallet" snap, and reconnect.';
      }
      throw new Error(errorMsg);
    }
  }

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
  if (walletType === "metamask") {
    if ((window as any).solana?.isMetaMask) {
      const encoded = new TextEncoder().encode(message);
      const res = await (window as any).solana.signMessage(encoded, "utf8");
      const sig = res?.signature ?? res;
      const bs58 = (await import("bs58")).default;
      return bs58.encode(sig);
    }

    if (isMetaMaskSandboxActive()) {
      const keypair = await getOrCreateSandboxKeypair();
      const nacl = await import("tweetnacl");
      const encoded = new TextEncoder().encode(message);
      const sig = nacl.default.sign.detached(encoded, keypair.secretKey);
      const bs58 = (await import("bs58")).default;
      return bs58.encode(sig);
    }

    const ethereum = getWalletProvider("metamask");
    if (!ethereum) throw new Error("MetaMask not installed");

    try {
      const res = await ethereum.request({
        method: "wallet_invokeSnap",
        params: {
          snapId: "npm:@solflare-wallet/solana-snap",
          request: {
            method: "signMessage",
            params: {
              message: message,
            },
          },
        },
      });

      if (!res?.signature) {
        throw new Error("No signature returned from MetaMask Solflare Snap");
      }
      return res.signature;
    } catch (err: any) {
      console.error("MetaMask Solana Snap signing failed:", err);
      let errorMsg =
        err?.message ||
        "MetaMask Solana Snap signing failed. Please approve the signing request.";
      if (errorMsg.includes("Invalid origin")) {
        errorMsg =
          'MetaMask Solana Snap "Invalid origin" error. To fix this, please go to MetaMask Settings -> Snaps, remove the "Solana Wallet" snap, and reconnect.';
      }
      throw new Error(errorMsg);
    }
  }

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
  if (typeof signature !== 'string' || signature.trim().length === 0) {
    throw new Error('Invalid wallet signature response');
  }
  try {
    await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  } catch {
  }
  return signature;
}
