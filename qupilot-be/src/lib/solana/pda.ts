import { PublicKey } from '@solana/web3.js';

export const deriveQuestPoolPda = (
  programId: PublicKey,
  provider: PublicKey,
  questIdBytes: Buffer,
): [PublicKey, number] =>
  PublicKey.findProgramAddressSync([Buffer.from('quest'), provider.toBuffer(), questIdBytes], programId);

export const deriveParticipationPda = (
  programId: PublicKey,
  questPool: PublicKey,
  userWallet: PublicKey,
): [PublicKey, number] =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('participation'), questPool.toBuffer(), userWallet.toBuffer()],
    programId,
  );

