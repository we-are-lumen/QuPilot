declare global {
  interface Window {
    solana?: any;
  }
}

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

export async function sendTreasuryDepositTx(toAddress?: string): Promise<string> {
  if (!window.solana || typeof window.solana.signAndSendTransaction !== 'function') {
    throw new Error('Wallet does not support signAndSendTransaction');
  }

  const { Connection, PublicKey, SystemProgram, Transaction } = await import('@solana/web3.js');
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const conn = new Connection(rpc, 'confirmed');

  const wallet = await connectWallet();
  const from = new PublicKey(wallet);

  const destination =
    (toAddress && toAddress.trim().length > 0 ? toAddress : undefined) || process.env.NEXT_PUBLIC_TREASURY_ADDRESS || wallet;
  const to = new PublicKey(destination);

  const { blockhash } = await conn.getLatestBlockhash('confirmed');
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: from }).add(
    SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: 1 }),
  );

  const res = await window.solana.signAndSendTransaction(tx);
  return res?.signature ?? res;
}
