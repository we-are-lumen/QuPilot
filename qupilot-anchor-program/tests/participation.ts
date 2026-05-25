import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Qupilot } from "../target/types/qupilot";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { createHash, randomUUID } from "crypto";
import { expect } from "chai";

function uuidToBytes32(uuid: string): Buffer {
  return createHash("sha256").update(uuid).digest();
}

function uuidToBytes16(uuid: string): number[] {
  const hex = uuid.replace(/-/g, "");
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    out.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
}

function deriveQuestPool(programId: PublicKey, provider: PublicKey, questId: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("quest"), provider.toBuffer(), questId],
    programId,
  );
}

function deriveParticipation(programId: PublicKey, questPool: PublicKey, userWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("participation"), questPool.toBuffer(), userWallet.toBuffer()],
    programId,
  );
}

async function airdrop(conn: anchor.web3.Connection, to: PublicKey, sol: number) {
  const sig = await conn.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
  await conn.confirmTransaction(sig, "confirmed");
}

describe("participation", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Qupilot as Program<Qupilot>;
  const conn = provider.connection;

  it("happy path: join -> complete -> claim, and free capacity on fail", async () => {
    const questProvider = Keypair.generate();
    const admin = Keypair.generate();
    const user1 = Keypair.generate();
    const user2 = Keypair.generate();
    const agent = Keypair.generate();

    await airdrop(conn, questProvider.publicKey, 5);
    await airdrop(conn, admin.publicKey, 5);
    await airdrop(conn, user1.publicKey, 2);
    await airdrop(conn, user2.publicKey, 2);

    const questUuid = randomUUID();
    const questId = uuidToBytes32(questUuid);
    const [poolPda] = deriveQuestPool(program.programId, questProvider.publicKey, questId);

    const total = new BN(1 * LAMPORTS_PER_SOL);
    const perUser = new BN(0.1 * LAMPORTS_PER_SOL);
    const expires = new BN(Math.floor(Date.now() / 1000) + 3600);

    await program.methods
      .createQuest([...questId] as any, admin.publicKey, total, perUser, expires)
      .accounts({
        provider: questProvider.publicKey,
        questPool: poolPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([questProvider])
      .rpc();

    const part1Uuid = randomUUID();
    const [part1Pda] = deriveParticipation(program.programId, poolPda, user1.publicKey);
    await program.methods
      .joinQuest(uuidToBytes16(part1Uuid) as any, user1.publicKey, agent.publicKey)
      .accounts({
        verifier: admin.publicKey,
        questPool: poolPda,
        participation: part1Pda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    const part2Uuid = randomUUID();
    const [part2Pda] = deriveParticipation(program.programId, poolPda, user2.publicKey);
    await program.methods
      .joinQuest(uuidToBytes16(part2Uuid) as any, user2.publicKey, agent.publicKey)
      .accounts({
        verifier: admin.publicKey,
        questPool: poolPda,
        participation: part2Pda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    await program.methods
      .markParticipationComplete()
      .accounts({
        verifier: admin.publicKey,
        questPool: poolPda,
        participation: part1Pda,
      } as any)
      .signers([admin])
      .rpc();

    const user1BalBefore = await conn.getBalance(user1.publicKey);
    await program.methods
      .claimReward()
      .accounts({
        claimer: user1.publicKey,
        questPool: poolPda,
        participation: part1Pda,
      } as any)
      .signers([user1])
      .rpc();
    const user1BalAfter = await conn.getBalance(user1.publicKey);
    expect(user1BalAfter).to.be.greaterThan(user1BalBefore);

    await program.methods
      .markParticipationFailed()
      .accounts({
        verifier: admin.publicKey,
        questPool: poolPda,
        participation: part2Pda,
      } as any)
      .signers([admin])
      .rpc();

    const pool = await program.account.questPool.fetch(poolPda);
    expect(pool.allocatedAmount.toString()).to.equal(perUser.toString());
    expect(pool.claimedAmount.toString()).to.equal(perUser.toString());
  });

  it("rejects claim by non-owner wallet", async () => {
    const questProvider = Keypair.generate();
    const admin = Keypair.generate();
    const user = Keypair.generate();
    const attacker = Keypair.generate();
    const agent = Keypair.generate();

    await airdrop(conn, questProvider.publicKey, 5);
    await airdrop(conn, admin.publicKey, 5);
    await airdrop(conn, user.publicKey, 2);
    await airdrop(conn, attacker.publicKey, 2);

    const questUuid = randomUUID();
    const questId = uuidToBytes32(questUuid);
    const [poolPda] = deriveQuestPool(program.programId, questProvider.publicKey, questId);

    await program.methods
      .createQuest(
        [...questId] as any,
        admin.publicKey,
        new BN(1 * LAMPORTS_PER_SOL),
        new BN(0.1 * LAMPORTS_PER_SOL),
        new BN(Math.floor(Date.now() / 1000) + 3600),
      )
      .accounts({
        provider: questProvider.publicKey,
        questPool: poolPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([questProvider])
      .rpc();

    const partUuid = randomUUID();
    const [partPda] = deriveParticipation(program.programId, poolPda, user.publicKey);
    await program.methods
      .joinQuest(uuidToBytes16(partUuid) as any, user.publicKey, agent.publicKey)
      .accounts({
        verifier: admin.publicKey,
        questPool: poolPda,
        participation: partPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    await program.methods
      .markParticipationComplete()
      .accounts({
        verifier: admin.publicKey,
        questPool: poolPda,
        participation: partPda,
      } as any)
      .signers([admin])
      .rpc();

    try {
      await program.methods
        .claimReward()
        .accounts({
          claimer: attacker.publicKey,
          questPool: poolPda,
          participation: partPda,
        } as any)
        .signers([attacker])
        .rpc();
      expect.fail("expected to throw");
    } catch (e: any) {
      expect(e.toString()).to.match(/ConstraintAddress|custom program error|0x/i);
    }
  });

  it("rejects join when reward pool exhausted", async () => {
    const questProvider = Keypair.generate();
    const admin = Keypair.generate();
    const user1 = Keypair.generate();
    const user2 = Keypair.generate();
    const agent = Keypair.generate();

    await airdrop(conn, questProvider.publicKey, 5);
    await airdrop(conn, admin.publicKey, 5);

    const questUuid = randomUUID();
    const questId = uuidToBytes32(questUuid);
    const [poolPda] = deriveQuestPool(program.programId, questProvider.publicKey, questId);

    const total = new BN(0.1 * LAMPORTS_PER_SOL);
    const perUser = new BN(0.1 * LAMPORTS_PER_SOL);
    const expires = new BN(Math.floor(Date.now() / 1000) + 3600);

    await program.methods
      .createQuest([...questId] as any, admin.publicKey, total, perUser, expires)
      .accounts({
        provider: questProvider.publicKey,
        questPool: poolPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([questProvider])
      .rpc();

    const [p1] = deriveParticipation(program.programId, poolPda, user1.publicKey);
    await program.methods
      .joinQuest(uuidToBytes16(randomUUID()) as any, user1.publicKey, agent.publicKey)
      .accounts({
        verifier: admin.publicKey,
        questPool: poolPda,
        participation: p1,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    const [p2] = deriveParticipation(program.programId, poolPda, user2.publicKey);
    try {
      await program.methods
        .joinQuest(uuidToBytes16(randomUUID()) as any, user2.publicKey, agent.publicKey)
        .accounts({
          verifier: admin.publicKey,
          questPool: poolPda,
          participation: p2,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([admin])
        .rpc();
      expect.fail("expected to throw");
    } catch (e: any) {
      expect(e.toString()).to.match(/RewardPoolExhausted/);
    }
  });
});
