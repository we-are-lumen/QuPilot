# QuPilot Anchor Program — BE Integration: Verifikasi `tx_hash` Create Quest

Status: Draft  
Pasangan dari: `01-planning-reward-pool.md`  
Audience: Backend engineer di `qupilot-be`

---

## 1) Konteks singkat

Provider create quest = **deposit on-chain dulu, baru daftar ke BE**. Yang dipercaya BE adalah on-chain state, bukan input form. BE harus memverifikasi `tx_hash` yang dikirim provider sebelum quest tersimpan ke DB.

Skema body yang sudah ada di `qupilot-be/src/modules/quests/quests.schema.ts`:

```ts
{
  title, description, protocol, steps,
  total_reward_pool: string,  // lamports
  reward_per_user:   string,  // lamports
  reward_token:      "SOL",
  tx_hash:           string,  // base58 signature
  expires_at:        ISO string
}
```

BE harus tambah:
- Decode `tx_hash` → fetch transaction → parse `QuestCreated` event.
- Match field event dengan field body. Jika mismatch → reject.
- Simpan `quest_pool_pda` dan `quest_id_onchain` ke DB.

---

## 2) Dependencies

```json
{
  "@coral-xyz/anchor": "^0.30.x",
  "@solana/web3.js": "^1.95.x"
}
```

IDL Anchor dari `qupilot-anchor-program/target/idl/qupilot.json` di-copy/symlink ke `qupilot-be/src/lib/solana/idl/qupilot.json`.

Env vars baru:
```
SOLANA_RPC_URL=https://api.devnet.solana.com
QUPILOT_PROGRAM_ID=<program id setelah deploy>
```

---

## 3) Service: `solana-verifier.ts`

Lokasi yang diusulkan: `qupilot-be/src/lib/solana/verify-create-quest.ts`.

### 3.1 Interface

```ts
type VerifyCreateQuestInput = {
  txSignature: string;
  expected: {
    provider: string;            // base58 pubkey dari authenticated user
    questIdUuid: string;         // UUID v4 dari payload
    totalRewardPool: bigint;
    rewardPerUser: bigint;
    expiresAt: Date;
  };
};

type VerifyCreateQuestResult =
  | { ok: true; questPoolPda: string; questIdBytes: Buffer }
  | { ok: false; reason: string };
```

### 3.2 Algoritma

1. **Fetch tx** dengan `connection.getTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })`. Retry dengan backoff (3x, 1s/2s/4s) — Solana sering belum landed di RPC saat user submit.
2. **Cek `meta.err === null`**. Kalau error, reject.
3. **Cek program invoked**: scan `transaction.message.compiledInstructions` (atau pakai `loadedAddresses` untuk v0). Pastikan ada instruction dengan `programId === QUPILOT_PROGRAM_ID`.
4. **Parse event** dari `meta.logMessages`:
   - Anchor mem-emit event sebagai `Program data: <base64>` di log.
   - Pakai `anchor.EventParser(programId, coder).parseLogs(logs)` untuk iterate.
   - Cari event `QuestCreated`.
5. **Hash quest_id**: convert `questIdUuid` ke 32 bytes (lihat §4).
6. **Match fields:**
   - `event.provider === expected.provider`
   - `event.quest_id` (32 bytes) === hash(`expected.questIdUuid`)
   - `event.total_reward_pool === expected.totalRewardPool`
   - `event.reward_per_user === expected.rewardPerUser`
   - `event.expires_at === Math.floor(expected.expiresAt.getTime() / 1000)` (toleransi ±1s)
7. **Derive PDA** untuk disimpan ke DB:
   ```ts
   const [pda] = PublicKey.findProgramAddressSync(
     [Buffer.from('quest'), providerPubkey.toBuffer(), questIdBytes],
     programId,
   );
   ```
8. Return `{ ok: true, questPoolPda: pda.toBase58(), questIdBytes }`.

### 3.3 Pseudocode

```ts
export async function verifyCreateQuestTx(
  conn: Connection,
  programId: PublicKey,
  coder: anchor.BorshCoder,
  input: VerifyCreateQuestInput,
): Promise<VerifyCreateQuestResult> {
  const tx = await fetchWithRetry(conn, input.txSignature);
  if (!tx) return { ok: false, reason: 'tx not found' };
  if (tx.meta?.err) return { ok: false, reason: 'tx failed on-chain' };

  const parser = new anchor.EventParser(programId, coder);
  const events = [...parser.parseLogs(tx.meta?.logMessages ?? [])];
  const created = events.find((e) => e.name === 'QuestCreated');
  if (!created) return { ok: false, reason: 'QuestCreated event missing' };

  const questIdBytes = uuidToBytes32(input.expected.questIdUuid);
  const d = created.data as QuestCreatedEvent;

  if (d.provider.toBase58() !== input.expected.provider)
    return { ok: false, reason: 'provider mismatch' };
  if (!d.questId.equals(questIdBytes))
    return { ok: false, reason: 'quest_id mismatch' };
  if (BigInt(d.totalRewardPool.toString()) !== input.expected.totalRewardPool)
    return { ok: false, reason: 'total_reward_pool mismatch' };
  if (BigInt(d.rewardPerUser.toString()) !== input.expected.rewardPerUser)
    return { ok: false, reason: 'reward_per_user mismatch' };
  const expectedTs = Math.floor(input.expected.expiresAt.getTime() / 1000);
  if (Math.abs(Number(d.expiresAt) - expectedTs) > 1)
    return { ok: false, reason: 'expires_at mismatch' };

  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('quest'), new PublicKey(input.expected.provider).toBuffer(), questIdBytes],
    programId,
  );
  return { ok: true, questPoolPda: pda.toBase58(), questIdBytes };
}
```

---

## 4) Cara hash `quest_id` UUID → `[u8; 32]`

Karena UUID v4 = 16 bytes dan seed kita 32 bytes, dua opsi:

**Opsi A — sha256(uuid).** Deterministik, simpel, tahan collision.
```ts
function uuidToBytes32(uuid: string): Buffer {
  return createHash('sha256').update(uuid).digest(); // 32 bytes
}
```

**Opsi B — pad UUID 16-byte ke 32 byte.** Lebih cheap (no hash), tapi sisa 16 byte cuma 0 — agak boros.

**Rekomendasi: Opsi A** (sha256). UI dan BE harus pakai fungsi yang sama persis.

---

## 5) Perubahan di module `quests`

### 5.1 Schema DB (Supabase / Prisma)

Tambah kolom ke tabel `quests`:
```sql
ALTER TABLE quests
  ADD COLUMN quest_pool_pda TEXT NOT NULL,
  ADD COLUMN quest_id_onchain BYTEA NOT NULL,
  ADD COLUMN deposit_tx_hash TEXT NOT NULL UNIQUE;

CREATE UNIQUE INDEX quests_pool_pda_uniq ON quests (quest_pool_pda);
```

`UNIQUE` pada `deposit_tx_hash` dan `quest_pool_pda` mencegah double-registration tx yang sama untuk dua quest berbeda.

### 5.2 Controller flow (`quests.controller.ts` create)

```
1. Validate body (existing zod).
2. Get provider pubkey dari session auth.
3. Call verifyCreateQuestTx(...).
4. Kalau ok=false → 400 dengan reason.
5. Kalau ok=true → INSERT quest row dengan quest_pool_pda + quest_id_onchain + deposit_tx_hash.
6. Return quest detail.
```

### 5.3 Error mapping

| reason                            | HTTP | Pesan ke client                                  |
|-----------------------------------|------|--------------------------------------------------|
| `tx not found`                    | 400  | "Transaction not yet confirmed, retry shortly."  |
| `tx failed on-chain`              | 400  | "Deposit transaction failed."                    |
| `QuestCreated event missing`      | 400  | "Transaction did not invoke QuPilot program."    |
| `provider mismatch`               | 403  | "Transaction signer doesn't match your wallet."  |
| `quest_id mismatch`               | 400  | "quest_id in tx doesn't match request."          |
| `*_mismatch` (amount/expiry)      | 400  | Spesifik per field.                              |

---

## 6) Testing

### 6.1 Unit (BE, mock RPC)
- Mock `getTransaction` mengembalikan log dengan event valid → `ok: true`.
- Mock log tanpa event → `QuestCreated event missing`.
- Mock dengan amount beda 1 lamport → mismatch.
- Mock `meta.err != null` → reject.

### 6.2 Integration (devnet)
- Spawn keypair, airdrop, panggil `create_quest` via test script.
- Submit ke BE `POST /api/quests` dengan tx signature → expect 201.
- Replay tx signature yang sama untuk quest lain → expect 409 (unique constraint).

---

## 7) Hal yang BUKAN tanggung jawab verifier ini

- Tidak mengecek apakah PDA balance match. PDA balance bisa berubah karena distribusi reward nanti. Yang dicek: **event saat create**.
- Tidak melakukan refund / withdraw. Itu instruction terpisah di fase berikutnya.
- Tidak verifikasi SPL token mint — MVP SOL only.

---

## 8) Checklist implementasi BE

- [x] Tambah env `SOLANA_RPC_URL`, `QUPILOT_PROGRAM_ID`.
- [x] Import IDL Anchor + bangun `BorshCoder` saat boot.
- [x] Tulis `verify-create-quest.ts` + unit test.
- [x] Migrasi DB tambah `quest_pool_pda`, `quest_id_onchain`, `deposit_tx_hash`.
- [x] Update `quests.controller.ts` create flow → panggil verifier.
- [x] Update `quests.schema.ts` response → expose `quest_pool_pda` ke client.
- [x] Update `API.md` dokumentasi field baru + alur "deposit dulu, daftar kemudian".