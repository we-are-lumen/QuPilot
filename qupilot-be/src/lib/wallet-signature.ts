import bs58 from 'bs58';
import nacl from 'tweetnacl';

const toUtf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

export const verifySolanaSignature = (walletAddress: string, message: string, signatureBase58: string): boolean => {
  try {
    const pubkey = bs58.decode(walletAddress);
    const sig = bs58.decode(signatureBase58);
    return nacl.sign.detached.verify(toUtf8(message), sig, pubkey);
  } catch {
    return false;
  }
};
