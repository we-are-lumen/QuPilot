import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Qupilot } from "../target/types/qupilot";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { createHash, randomUUID } from "crypto";
import { assert, expect } from "chai";

function uuidToBytes32(uuid: string): Buffer {
  return createHash("sha256").update(uuid).digest();
}

function randomQuestId(): Buffer {
  return uuidToBytes32(randomUUID());
}

function deriveQuestPool(
  programId: PublicKey,
  provider: PublicKey,
  questId: Buffer,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("quest"), provider.toBuffer(), questId],
    programId,
  );
}

async function airdrop(
  conn: anchor.web3.Connection,
  to: PublicKey,
  sol: number,
) {
  const sig = await conn.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
  await conn.confirmTransaction(sig, "confirmed");
}

describe("create_quest", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Qupilot as Program<Qupilot>;
  const conn = provider.connection;

  async function freshProvider(): Promise<Keypair> {
    const kp = Keypair.generate();
    await airdrop(conn, kp.publicKey, 5);
    return kp;
  }

  it("happy path: creates quest, transfers SOL, emits event", async () => {
    const providerKp = await freshProvider();
    const questId = randomQuestId();
    const [poolPda] = deriveQuestPool(
      program.programId,
      providerKp.publicKey,
      questId,
    );

    const total = new BN(2 * LAMPORTS_PER_SOL);
    const perUser = new BN(0.1 * LAMPORTS_PER_SOL);
    const expires = new BN(Math.floor(Date.now() / 1000) + 3600);

    const balanceBefore = await conn.getBalance(providerKp.publicKey);

    // capture event
    let captured: any = null;
    const listener = program.addEventListener("questCreated", (ev) => {
      captured = ev;
    });

    await program.methods
      .createQuest([...questId] as any, total, perUser, expires)
      .accounts({
        provider: providerKp.publicKey,
        questPool: poolPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([providerKp])
      .rpc();

    // give listener a tick
    await new Promise((r) => setTimeout(r, 500));
    await program.removeEventListener(listener);

    const pool = await program.account.questPool.fetch(poolPda);
    expect(pool.version).to.equal(1);
    expect(pool.provider.toBase58()).to.equal(providerKp.publicKey.toBase58());
    expect(Buffer.from(pool.questId).equals(questId)).to.equal(true);
    expect(pool.totalRewardPool.toString()).to.equal(total.toString());
    expect(pool.rewardPerUser.toString()).to.equal(perUser.toString());
    expect(pool.claimedAmount.toString()).to.equal("0");
    expect(pool.status).to.equal(0);
    expect(pool.expiresAt.toString()).to.equal(expires.toString());

    const poolBalance = await conn.getBalance(poolPda);
    // PDA balance = rent-exempt + total reward
    expect(poolBalance).to.be.greaterThanOrEqual(total.toNumber());

    const balanceAfter = await conn.getBalance(providerKp.publicKey);
    // provider paid at least the total reward (plus rent & fee)
    expect(balanceBefore - balanceAfter).to.be.greaterThanOrEqual(
      total.toNumber(),
    );

    expect(captured, "questCreated event not captured").to.not.be.null;
    expect(captured.questPool.toBase58()).to.equal(poolPda.toBase58());
    expect(captured.totalRewardPool.toString()).to.equal(total.toString());
  });

  it("rejects total_reward_pool = 0", async () => {
    const providerKp = await freshProvider();
    const questId = randomQuestId();
    const [poolPda] = deriveQuestPool(
      program.programId,
      providerKp.publicKey,
      questId,
    );
    try {
      await program.methods
        .createQuest(
          [...questId] as any,
          new BN(0),
          new BN(1),
          new BN(Math.floor(Date.now() / 1000) + 60),
        )
        .accounts({
          provider: providerKp.publicKey,
          questPool: poolPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([providerKp])
        .rpc();
      assert.fail("expected to throw");
    } catch (e: any) {
      expect(e.toString()).to.match(/InvalidTotalReward/);
    }
  });

  it("rejects reward_per_user > total_reward_pool", async () => {
    const providerKp = await freshProvider();
    const questId = randomQuestId();
    const [poolPda] = deriveQuestPool(
      program.programId,
      providerKp.publicKey,
      questId,
    );
    try {
      await program.methods
        .createQuest(
          [...questId] as any,
          new BN(100),
          new BN(200),
          new BN(Math.floor(Date.now() / 1000) + 60),
        )
        .accounts({
          provider: providerKp.publicKey,
          questPool: poolPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([providerKp])
        .rpc();
      assert.fail("expected to throw");
    } catch (e: any) {
      expect(e.toString()).to.match(/RewardPoolTooSmall/);
    }
  });

  it("rejects expires_at in the past", async () => {
    const providerKp = await freshProvider();
    const questId = randomQuestId();
    const [poolPda] = deriveQuestPool(
      program.programId,
      providerKp.publicKey,
      questId,
    );
    try {
      await program.methods
        .createQuest(
          [...questId] as any,
          new BN(1000),
          new BN(100),
          new BN(1),
        )
        .accounts({
          provider: providerKp.publicKey,
          questPool: poolPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([providerKp])
        .rpc();
      assert.fail("expected to throw");
    } catch (e: any) {
      expect(e.toString()).to.match(/ExpiresAtInPast/);
    }
  });

  it("rejects duplicate (provider, quest_id)", async () => {
    const providerKp = await freshProvider();
    const questId = randomQuestId();
    const [poolPda] = deriveQuestPool(
      program.programId,
      providerKp.publicKey,
      questId,
    );

    const args = {
      total: new BN(LAMPORTS_PER_SOL),
      per: new BN(LAMPORTS_PER_SOL / 10),
      expires: new BN(Math.floor(Date.now() / 1000) + 3600),
    };

    await program.methods
      .createQuest([...questId] as any, args.total, args.per, args.expires)
      .accounts({
        provider: providerKp.publicKey,
        questPool: poolPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([providerKp])
      .rpc();

    try {
      await program.methods
        .createQuest(
          [...questId] as any,
          args.total,
          args.per,
          args.expires,
        )
        .accounts({
          provider: providerKp.publicKey,
          questPool: poolPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([providerKp])
        .rpc();
      assert.fail("expected to throw on duplicate init");
    } catch (e: any) {
      // SystemProgram raises "already in use" when init runs on existing PDA
      expect(e.toString()).to.match(/already in use|custom program error/i);
    }
  });

  it("two providers can use the same quest_id (different PDA)", async () => {
    const p1 = await freshProvider();
    const p2 = await freshProvider();
    const questId = randomQuestId();
    const [pda1] = deriveQuestPool(program.programId, p1.publicKey, questId);
    const [pda2] = deriveQuestPool(program.programId, p2.publicKey, questId);
    expect(pda1.toBase58()).to.not.equal(pda2.toBase58());

    const common = {
      total: new BN(LAMPORTS_PER_SOL),
      per: new BN(LAMPORTS_PER_SOL / 10),
      expires: new BN(Math.floor(Date.now() / 1000) + 3600),
    };

    await program.methods
      .createQuest([...questId] as any, common.total, common.per, common.expires)
      .accounts({
        provider: p1.publicKey,
        questPool: pda1,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([p1])
      .rpc();

    await program.methods
      .createQuest([...questId] as any, common.total, common.per, common.expires)
      .accounts({
        provider: p2.publicKey,
        questPool: pda2,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([p2])
      .rpc();

    const a = await program.account.questPool.fetch(pda1);
    const b = await program.account.questPool.fetch(pda2);
    expect(a.provider.toBase58()).to.equal(p1.publicKey.toBase58());
    expect(b.provider.toBase58()).to.equal(p2.publicKey.toBase58());
  });
});
