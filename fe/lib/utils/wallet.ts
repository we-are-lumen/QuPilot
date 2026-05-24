import { connect, disconnect, signMessage as wagmiSignMessage, sendTransaction as wagmiSendTransaction } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi';
import { injected } from 'wagmi/connectors';

declare global {
  interface Window {
    ethereum?: any;
  }
}

/** Check whether an EVM wallet (like MetaMask) is installed in the browser */
export function isEvmWalletInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.ethereum;
}

/**
 * Connect to an EVM wallet using wagmi.
 * Returns the wallet address.
 */
export async function connectWallet(): Promise<string> {
  // If already connected, get the first account
  const state = wagmiConfig.state;
  const currentConnection = state.connections.get(state.current || '');
  if (currentConnection?.accounts?.[0]) {
    return currentConnection.accounts[0];
  }

  const result = await connect(wagmiConfig, {
    connector: injected(),
  });
  
  if (!result.accounts || result.accounts.length === 0) {
    throw new Error('No accounts found after connecting.');
  }
  
  return result.accounts[0];
}

/**
 * Disconnect the wallet.
 */
export async function disconnectWallet(): Promise<void> {
  const state = wagmiConfig.state;
  const currentConnection = state.connections.get(state.current || '');
  if (currentConnection) {
    await disconnect(wagmiConfig, {
      connector: currentConnection.connector,
    });
  }
}

/**
 * Build the canonical sign-in message that will be signed by the wallet.
 */
export function buildSignInMessage(walletAddress: string): string {
  return (
    `Sign in to QuPilot\n\n` +
    `Wallet: ${walletAddress}\n` +
    `Timestamp: ${new Date().toISOString()}\n\n` +
    `This request will not trigger a blockchain transaction or cost any fees.`
  );
}

/**
 * Ask the connected wallet to sign a message and return the hex signature.
 */
export async function signMessage(message: string): Promise<string> {
  const signature = await wagmiSignMessage(wagmiConfig, {
    message,
  });
  return signature;
}

/**
 * Send a 0-value transaction to the treasury address (or any valid EVM address)
 * to generate a valid, on-chain transaction hash (tx_hash) for quest creation.
 */
export async function sendTreasuryDepositTx(toAddress?: string): Promise<string> {
  // Make sure we have a connected wallet
  const currentAddress = await connectWallet();
  
  // Use user-supplied address if it is not the zero address
  const safeAddress = (toAddress && toAddress !== '0x0000000000000000000000000000000000000000') ? toAddress : undefined;
  
  // Use safeAddress, then environment variable, then fallback to currentAddress or valid checksummed address
  const destination = safeAddress || process.env.NEXT_PUBLIC_TREASURY_ADDRESS || currentAddress || '0x71C7656EC7ab88b098defB751B7401B5f6d5976F';

  const hash = await wagmiSendTransaction(wagmiConfig, {
    to: destination as `0x${string}`,
    value: BigInt(0),
  });
  
  return hash;
}

