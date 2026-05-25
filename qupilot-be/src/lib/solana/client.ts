import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import { env } from '../../config/env';
import idl from './idl/qupilot.json';
import { getSolanaConnection } from '../solana';

let adminKeypair: Keypair | null = null;
let program: anchor.Program | null = null;

const parseKeypairArrayJson = (raw: string): Uint8Array | null => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return null;
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'number')) return null;
  return new Uint8Array(parsed);
};

const decodeEncodedKeypair = (encoded: string): Uint8Array | null => {
  const base64Bytes = Buffer.from(encoded, 'base64');
  if (base64Bytes.length === 32 || base64Bytes.length === 64) return new Uint8Array(base64Bytes);

  const maybeJson = base64Bytes.toString('utf8');
  const jsonBytes = parseKeypairArrayJson(maybeJson);
  if (jsonBytes) return jsonBytes;

  try {
    const base58Bytes = bs58.decode(encoded);
    if (base58Bytes.length === 32 || base58Bytes.length === 64) return new Uint8Array(base58Bytes);
  } catch {
    return null;
  }

  return null;
};

const resolveAdminKeypairBytes = (): Uint8Array => {
  if (env.QUPILOT_ADMIN_KEYPAIR_BASE64) {
    const decoded = decodeEncodedKeypair(env.QUPILOT_ADMIN_KEYPAIR_BASE64);
    if (!decoded) {
      throw new Error(
        'Invalid QUPILOT_ADMIN_KEYPAIR_BASE64 (expected base58/base64 of 64-byte secretKey, 32-byte seed, or base64(JSON array))',
      );
    }
    return decoded;
  }
  if (env.QUPILOT_ADMIN_KEYPAIR_PATH) {
    const raw = fs.readFileSync(env.QUPILOT_ADMIN_KEYPAIR_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'number')) {
      throw new Error('Invalid QUPILOT_ADMIN_KEYPAIR_PATH content');
    }
    return new Uint8Array(parsed);
  }
  throw new Error('Missing admin keypair');
};

export const getAdminKeypair = (): Keypair => {
  if (adminKeypair) return adminKeypair;
  const bytes = resolveAdminKeypairBytes();
  if (bytes.length === 64) adminKeypair = Keypair.fromSecretKey(bytes);
  else if (bytes.length === 32) adminKeypair = Keypair.fromSeed(bytes);
  else {
    throw new Error(`Invalid admin keypair size (got ${bytes.length}, expected 32 or 64 bytes)`);
  }
  return adminKeypair;
};

export const getAdminPubkey = (): PublicKey => getAdminKeypair().publicKey;

export const getProgram = (): anchor.Program => {
  if (program) return program;

  const conn = getSolanaConnection();
  const wallet = new anchor.Wallet(getAdminKeypair());
  const provider = new anchor.AnchorProvider(conn, wallet, { commitment: 'confirmed' });
  const idlAddress = (idl as unknown as { address?: unknown }).address;
  if (typeof idlAddress === 'string' && idlAddress !== env.QUPILOT_PROGRAM_ID) {
    throw new Error(`IDL address mismatch (expected ${env.QUPILOT_PROGRAM_ID}, got ${idlAddress})`);
  }
  program = new anchor.Program(idl as unknown as anchor.Idl, provider);
  return program;
};
