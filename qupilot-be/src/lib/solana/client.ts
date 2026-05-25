import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import { env } from '../../config/env';
import idl from './idl/qupilot.json';
import { getSolanaConnection } from '../solana';

let adminKeypair: Keypair | null = null;
let program: anchor.Program | null = null;

const resolveAdminKeypairBytes = (): Uint8Array => {
  if (env.QUPILOT_ADMIN_KEYPAIR_BASE64) {
    const raw = Buffer.from(env.QUPILOT_ADMIN_KEYPAIR_BASE64, 'base64');
    return new Uint8Array(raw);
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
  adminKeypair = Keypair.fromSecretKey(bytes);
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
