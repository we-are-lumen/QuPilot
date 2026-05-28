import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { getAdminKeypair, getProgram } from './client';
import { deriveParticipationPda } from './pda';

const parseUuidToBytes16 = (uuid: string): Uint8Array => {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (hex.length !== 32 || !/^[0-9a-f]+$/.test(hex)) {
    throw new Error('Invalid participation_uuid (expected UUID v4)');
  }
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

export const buildJoinQuestTx = async (input: {
  questPoolPda: PublicKey;
  userWallet: PublicKey;
  agentWallet: PublicKey;
  participationUuid: string;
}): Promise<{ tx: Transaction; participationPda: PublicKey }> => {
  const program = getProgram() as any;
  const admin = getAdminKeypair();
  const participationUuidBytes = parseUuidToBytes16(input.participationUuid);
  const [participationPda] = deriveParticipationPda(program.programId, input.questPoolPda, input.userWallet);

  const ix = await program.methods
    .joinQuest(Array.from(participationUuidBytes) as any, input.userWallet, input.agentWallet)
    .accounts({
      verifier: admin.publicKey,
      questPool: input.questPoolPda,
      participation: participationPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return { tx: new Transaction().add(ix), participationPda };
};

export const buildMarkParticipationCompleteTx = async (input: {
  questPoolPda: PublicKey;
  participationPda: PublicKey;
}): Promise<Transaction> => {
  const program = getProgram() as any;
  const admin = getAdminKeypair();

  const ix = await program.methods
    .markParticipationComplete()
    .accounts({
      verifier: admin.publicKey,
      questPool: input.questPoolPda,
      participation: input.participationPda,
    })
    .instruction();

  return new Transaction().add(ix);
};

export const buildMarkParticipationFailedTx = async (input: {
  questPoolPda: PublicKey;
  participationPda: PublicKey;
}): Promise<Transaction> => {
  const program = getProgram() as any;
  const admin = getAdminKeypair();

  const ix = await program.methods
    .markParticipationFailed()
    .accounts({
      verifier: admin.publicKey,
      questPool: input.questPoolPda,
      participation: input.participationPda,
    })
    .instruction();

  return new Transaction().add(ix);
};

export const buildClaimRewardTx = async (input: {
  questPoolPda: PublicKey;
  claimer: PublicKey;
}): Promise<{
  tx: Transaction;
  participationPda: PublicKey;
  blockhash: string;
  lastValidBlockHeight: number;
}> => {
  const program = getProgram() as any;
  const [participationPda] = deriveParticipationPda(program.programId, input.questPoolPda, input.claimer);

  const ix = await program.methods
    .claimReward()
    .accounts({
      claimer: input.claimer,
      questPool: input.questPoolPda,
      participation: participationPda,
    })
    .instruction();

  const conn = program.provider.connection;
  const latest = await conn.getLatestBlockhash('confirmed');

  const tx = new Transaction().add(ix);
  tx.feePayer = input.claimer;
  tx.recentBlockhash = latest.blockhash;

  return { tx, participationPda, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight };
};

export const sendAdminTx = async (tx: Transaction): Promise<string> => {
  const program = getProgram() as any;
  const admin = getAdminKeypair();
  const conn = program.provider.connection;
  const sig = await conn.sendTransaction(tx, [admin], { skipPreflight: false, preflightCommitment: 'confirmed' });
  await conn.confirmTransaction(sig, 'confirmed');
  return sig as string;
};
