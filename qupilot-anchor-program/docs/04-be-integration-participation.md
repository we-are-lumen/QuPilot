# QuPilot Anchor Program — BE Integration: Participation & Reward Allocation

Status: Draft
Pasangan dari: `03-planning-participation.md`
Audience: Backend engineer di `qupilot-be`

---

## 1) Ringkasan apa yang berubah di BE

Setelah anchor program di-extend dengan `join_quest` / `mark_participation_complete` / `mark_participation_failed` / `claim_reward`, BE jadi **operator** dari tiga instruction pertama. Yang tadinya cuma verifikasi `tx_hash` (read-only), sekarang BE juga harus **kirim transaksi** (write).

| BE endpoint                                                  | On-chain instruction yang BE panggil | Signer    |
|--------------------------------------------------------------|--------------------------------------|-----------|
| `POST /agent/participations`                                 | `join_quest`                         | BE admin  |
| `POST /agent/participations/:uuid/complete` (semua step ok)  | `mark_participation_complete`        | BE admin  |
| `POST /agent/participations/:uuid/complete` (ada step gagal) | `mark_participation_failed`          | BE admin  |
| `GET /agent/participations/:uuid/claim-tx` (agent-assisted)  | (build tx `claim_reward`)            | — (unsigned) |
| `POST /agent/participations/sync-claim` (agent-assisted)     | (none — read-only, parse claim tx)   | —         |
| `POST /me/participations/sync-claim` (opsional)              | (none — read-only, parse claim tx)   | —         |
| (FE user / agent wallet)                                     | `claim_reward`                       | `participation.user_wallet` |

**Catatan (align dengan kebutuhan sekarang):**
- Tidak ada endpoint `POST /agent/claim` “claim-all” (itu membingungkan dan rawan salah persepsi).
- Kita dukung **agent-assisted claim** lewat pattern yang lebih aman & eksplisit:
  1) BE membangun tx claim (unsigned) per participation (`GET /agent/participations/:uuid/claim-tx`)
  2) Agent sign + broadcast menggunakan **wallet penerima reward** (`participation.user_wallet`)
  3) BE sync status claim (`POST /agent/participations/sync-claim`)

Dengan desain ini, reward **tetap** masuk ke wallet user (recipient), dan agent hanya membantu menjalankan transaksi bila ia mengontrol wallet tersebut.

---

## 2) Env vars baru

```
# .env (BE)
QUPILOT_ADMIN_KEYPAIR_BASE64=<base64-encoded 64-byte secret key>
# atau
QUPILOT_ADMIN_KEYPAIR_PATH=/secrets/qupilot-admin.json
```

Catatan eksplisit:
- Tidak ada `QUPILOT_AUTOCLAIM_ON_SUCCESS`. Fitur itu sengaja tidak ada.
- Tidak ada keypair user di BE. BE hanya punya admin keypair untuk `join_quest` + `mark_complete` + `mark_failed`. Admin keypair **tidak punya kuasa apapun** atas `claim_reward` (lihat constraint di `03-planning-participation.md` §3.3 — `claimer` wajib `participation.user_wallet`).

`QUPILOT_ADMIN_KEYPAIR_*` adalah secret kelas-tinggi. Aturan:
- Tidak boleh masuk repo. `.env` di-gitignore (sudah).
- Production: ambil dari secret manager (Supabase Vault / Doppler / Vercel encrypted env).
- Devnet: keypair file di `~/.config/solana/qupilot-admin.json` cukup, asal `chmod 600`.

`QUPILOT_ADMIN_PUBKEY` (publik) di-derive saat boot dari keypair di atas. Pubkey ini juga harus disebar ke FE provider sebagai `NEXT_PUBLIC_QUPILOT_ADMIN_PUBKEY` supaya FE bisa pass `verifier` saat create quest.

---

## 3) Komponen baru di BE

### 3.1 Solana client singleton

`qupilot-be/src/lib/solana/client.ts`:

```ts
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import idl from "./idl/qupilot.json";

let _program: anchor.Program | null = null;
let _adminKeypair: Keypair | null = null;

export function getAdminKeypair(): Keypair {
  if (_adminKeypair) return _adminKeypair;
  const raw = process.env.QUPILOT_ADMIN_KEYPAIR_BASE64;
  if (!raw) throw new Error("QUPILOT_ADMIN_KEYPAIR_BASE64 not set");
  _adminKeypair = Keypair.fromSecretKey(Buffer.from(raw, "base64"));
  return _adminKeypair;
}

export function getProgram(): anchor.Program {
  if (_program) return _program;
  const conn = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
  const wallet = new anchor.Wallet(getAdminKeypair());
  const provider = new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" });
  _program = new anchor.Program(idl as anchor.Idl, new PublicKey(process.env.QUPILOT_PROGRAM_ID!), provider);
  return _program;
}
```

Pakai `getProgram()` semua tempat — jangan instansiasi `anchor.Program` di handler.

### 3.2 PDA derivation helpers

`qupilot-be/src/lib/solana/pda.ts`:

```ts
import { PublicKey } from "@solana/web3.js";

export function deriveQuestPoolPda(
  programId: PublicKey,
  provider: PublicKey,
  questIdBytes: Buffer, // 32 bytes (sha256(uuid))
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("quest"), provider.toBuffer(), questIdBytes],
    programId,
  );
}

export function deriveParticipationPda(
  programId: PublicKey,
  questPool: PublicKey,
  userWallet: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("participation"), questPool.toBuffer(), userWallet.toBuffer()],
    programId,
  );
}
```

Catatan: seed `participation` pakai **user wallet**, bukan agent wallet. Ini sumber kebenaran — kalau ditulis salah di BE, FE tidak akan ketemu PDA yang sama saat user claim.

### 3.3 `tx-builder.ts` (ix builders + send helper)

`qupilot-be/src/lib/solana/tx-builder.ts`:

```ts
export async function buildJoinQuestTx(input: {
  questPoolPda: PublicKey;
  userWallet: PublicKey;
  agentWallet: PublicKey;
  participationUuid: string; // uuid v4
}): Promise<Transaction> {
  const program = getProgram();
  const admin = getAdminKeypair();
  const participationUuidBytes = uuidParse(input.participationUuid); // 16 bytes
  const [participationPda] = deriveParticipationPda(
    program.programId,
    input.questPoolPda,
    input.userWallet,
  );

  const ix = await program.methods
    .joinQuest(
      Array.from(participationUuidBytes),
      input.userWallet,
      input.agentWallet,
    )
    .accounts({
      verifier: admin.publicKey,
      questPool: input.questPoolPda,
      participation: participationPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return new Transaction().add(ix);
}

export async function sendAdminTx(tx: Transaction): Promise<string> {
  const conn = getProgram().provider.connection;
  const admin = getAdminKeypair();
  const sig = await conn.sendTransaction(tx, [admin], {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}
```

Builder serupa untuk `mark_participation_complete` dan `mark_participation_failed`. **Tidak ada** builder `claim_reward` di BE — BE bukan signer untuk instruction itu.

---

## 4) Perubahan per-endpoint

### 4.1 `POST /agent/participations` (join)

Existing flow:
1. Validate body.
2. Cek quest exists, belum expired, user belum punya participation aktif.
3. Insert `participations` row.
4. Return `{ participation: { uuid, status, started_at } }`.

Flow baru:
1–3. (sama, tapi step 3 belum commit transaction DB)
4. **Build & send `join_quest` tx.**
   - `agent_wallet_address` dari body.
   - `user_wallet` dari `users.wallet_address` (yang punya API key).
   - `quest_pool_pda` dari `quests.quest_pool_pda` (sudah diisi di create quest verify).
   - `participation_uuid` dari row yang baru di-insert (UUID v4).
5. Tunggu confirm. Kalau success → commit DB row + simpan `join_tx_hash` di kolom baru.
6. Kalau on-chain reject (mis. `RewardPoolExhausted`) → rollback DB, return `409 REWARD_POOL_EXHAUSTED` ke client.
7. Response: tambah `quest_pool_pda` dan `participation_pda` ke `participation` object — supaya nanti dipakai di endpoint `complete` response juga, dan supaya FE user bisa langsung tahu PDA-nya untuk debugging.

**Schema DB** — tambah kolom:
```sql
ALTER TABLE participations
  ADD COLUMN participation_pda TEXT,        -- PDA address (base58)
  ADD COLUMN join_tx_hash TEXT UNIQUE,      -- signature tx join_quest
  ADD COLUMN complete_tx_hash TEXT,         -- signature tx mark_complete (atau mark_failed)
  ADD COLUMN claim_tx_hash TEXT,            -- signature tx claim_reward (filled by sync-claim endpoint)
  ADD COLUMN reward_claimed BOOLEAN NOT NULL DEFAULT FALSE;
```

`participation_pda` boleh di-derive on-the-fly, tapi disimpan untuk audit & query log.

### 4.2 `POST /agent/participations/:uuid/complete`

Existing: `verifyTxBasic` per step → kalau semua sukses, set `participations.status=success`.

Flow baru, dua sub-case:

**4.2.a Semua step success:**
1. Set `participation.status=success` di DB (transaction terbuka).
2. Build & send `mark_participation_complete` tx (signer = admin).
3. Save `complete_tx_hash`.
4. Commit DB.
5. Response:
   ```jsonc
   {
     "participation": {
       "uuid": "...",
       "status": "success",
       "completed_at": "...",
       "quest_pool_pda": "...",
       "participation_pda": "...",
       "complete_tx_hash": "..."
       // tidak ada claim_tx_hash di sini — claim adalah aksi terpisah oleh user
     }
   }
   ```

   > Catatan eksplisit untuk agent runner skill: agent harus **memberitahu user** bahwa reward sekarang siap di-claim di website QuPilot, bukan melakukan claim sendiri. Update `qupilot-agent-skills/skills/qupilot-quest-runner/SKILL.md` Phase 4 untuk mencerminkan ini.

**4.2.b Ada step yang gagal:**
1. Set `participation.status=failed` di DB.
2. Build & send `mark_participation_failed` tx (untuk free capacity di pool).
3. Save `complete_tx_hash` (signature tx mark_failed).
4. Commit DB.
5. Response shape sama, `status=failed`.

**Penting:** jangan return 5xx kalau on-chain side gagal padahal off-chain verifikasi sudah success. Strategi:
- Coba 3x dengan backoff.
- Kalau tetap gagal, simpan participation dengan `status=success` tapi `complete_tx_hash=null` + flag `requires_onchain_sync=true`. Tambahkan background worker yang retry. Client tetap dapat response success.
- Idempotency: `mark_participation_complete` di-design idempotent (cek `status==joined`); replay aman.

### 4.3 `POST /me/participations/sync-claim` — NEW

Endpoint baru, **session auth** (cookie / JWT user, bukan x-api-key). Dipanggil oleh FE user setelah berhasil sign & submit `claim_reward` tx sendiri.

Body:
```jsonc
{
  "participation_uuid": "...",
  "claim_tx_hash": "<base58 sig>"
}
```

Logic:
1. Verify session user owns the participation (`participations.user_id == session.user_id`).
2. `getTransaction(claim_tx_hash, { commitment: "confirmed" })`. Retry 3x backoff.
3. Pastikan `meta.err === null`.
4. Parse log → cari event `RewardClaimed`.
5. Match:
   - `event.participation === derive_participation_pda(...)`.
   - `event.user_wallet === users.wallet_address`.
   - `event.amount === participations.reward_amount`.
6. Kalau match → update DB `reward_claimed=true, claim_tx_hash=<sig>`.
7. Kalau tidak match → 400 + reason.

> **Kenapa endpoint terpisah, bukan auto-listen?** Karena hackathon. Endpoint manual cukup; FE submit tx + ping endpoint = state consistent. Roadmap: ganti dengan Helius webhook / RPC websocket `programSubscribe` ke event `RewardClaimed` supaya DB sync tanpa interaksi user.

> **Auth pakai session, bukan x-api-key**, karena ini aksi web-only milik user, bukan aksi agent. API key adalah kapabilitas agent — dan agent secara desain tidak punya hak claim.

### 4.4 (NEW) `GET /me/participations`

Endpoint baru, session auth, untuk halaman claim di FE.

Query params:
- `status` — `success | failed | claimed | inprogress` (default: all).
- `reward_claimed` — `true | false` (filter).

Response:
```jsonc
{
  "participations": [
    {
      "uuid": "...",
      "quest": { "uuid": "...", "title": "...", "reward_per_user": "..." },
      "status": "success",
      "reward_claimed": false,
      "participation_pda": "...",
      "quest_pool_pda": "...",
      "reward_amount": "100000000",
      "joined_at": "...",
      "completed_at": "..."
    }
  ]
}
```

FE user pakai endpoint ini untuk render tombol "Claim". Sekali user sukses sign+submit `claim_reward`, FE call `sync-claim`, lalu refresh list.

### 4.5 `POST /agent/claim` — tidak dipakai

Kita **tidak menggunakan** endpoint “claim-all” tipe `POST /agent/claim`.

Sebagai gantinya, gunakan flow yang lebih eksplisit dan cocok untuk agent runner:
- `GET /agent/participations/:uuid/claim-tx` → build unsigned tx untuk `claim_reward`
- agent sign + broadcast dengan wallet penerima (`participation.user_wallet`)
- `POST /agent/participations/sync-claim` → sync status claim ke DB

---

## 5) `create_quest` — adjust verifier field

Karena `QuestPool` punya field baru `verifier`, flow create quest juga harus update:

1. FE provider saat build instruction `create_quest`, **wajib** pass `verifier = NEXT_PUBLIC_QUPILOT_ADMIN_PUBKEY`. Kalau tidak, BE saat verifikasi `tx_hash` akan deteksi mismatch.
2. BE saat parse event `QuestCreated`, tambah match:
   ```ts
   if (event.verifier.toBase58() !== ADMIN_PUBKEY.toBase58())
     return { ok: false, reason: "verifier mismatch — quest pool not controlled by QuPilot admin" };
   ```
3. Tanpa cek ini, provider bisa create quest dengan `verifier` = wallet sendiri → BE tidak akan bisa `mark_complete` atau `mark_failed` (karena `verifier` constraint di program). Ini sabotase yang harus ditolak di create time.

---

## 6) Mapping Anchor error → HTTP

Anchor program me-return error code numeric. BE harus map ke HTTP & message yang berguna:

| Anchor error / constraint    | HTTP | Konteks                          | Message ke client                                              |
|------------------------------|------|----------------------------------|----------------------------------------------------------------|
| `QuestNotActive`             | 409  | join                             | "Quest is not active."                                         |
| `QuestExpired`               | 400  | join                             | "Quest has expired; cannot join."                              |
| `RewardPoolExhausted`        | 409  | join                             | "Reward pool exhausted — all slots taken."                     |
| `InvalidParticipationStatus` | 409  | mark_complete / mark_failed      | "Participation is not in a valid state for this action."       |
| `RewardAmountMismatch`       | 500  | mark_complete                    | "Internal: reward amount mismatch between PDA and pool."       |
| `NotClaimable`               | 409  | claim (user-side, surfaced via sync-claim parsing) | "Reward is not yet claimable (participation not success)." |
| `InsufficientPoolLamports`   | 500  | claim                            | "Internal: pool would breach rent-exempt minimum."             |
| `ConstraintAddress` on `claimer` | 403 | claim                          | "Only the participation owner's wallet can claim this reward." |
| `ConstraintSeeds` on participation | 400 | claim                         | "Participation PDA mismatch with claimer."                     |

Parse via `anchor.AnchorError.parse(logs)` di handler catch block. Untuk `sync-claim`, parse error dari log tx yang user submit (tx user mungkin sudah revert sebelum sampai ke BE — BE perlu surface error itu kalau user nge-submit ulang).

Kalau bukan AnchorError (RPC error, network), return 503 + retry hint.

---

## 7) Testing

### 7.1 Unit (mocked program)

- `buildJoinQuestTx` produces correct accounts + args. Snapshot test.
- `buildMarkCompleteTx` & `buildMarkFailedTx` snapshot test.
- PDA derivation matches anchor program (cross-check dengan PDA dari test localnet).
- BE **tidak** punya `buildClaimRewardTx` — kalau ada, hapus. Pastikan no-import.

### 7.2 Integration (devnet)

Spawn 3 keypairs (provider, user, agent). Airdrop. Lalu jalankan skenario lengkap via HTTP ke BE staging:

1. Provider buat quest via FE → BE.
2. Agent (pakai API key user) call `POST /agent/participations` → BE call `join_quest` → confirm.
3. Agent submit `complete` dengan tx hash mock yang valid → BE call `mark_participation_complete` → confirm. Response berisi `complete_tx_hash`, **bukan** `claim_tx_hash`.
4. (Claim — agent-assisted) Agent call `GET /agent/participations/:uuid/claim-tx` → dapat `tx_base64` (unsigned).
5. Agent sign + submit tx claim ke RPC menggunakan **wallet penerima reward** (`participation.user_wallet`), lalu call `POST /agent/participations/sync-claim`.
6. Verifikasi: balance user naik = `reward_per_user - tx_fee`, `reward_claimed=true`, `claim_tx_hash` terisi.
7. (Alternatif UX) User claim lewat FE, lalu `POST /me/participations/sync-claim`.

### 7.3 Adversarial

- Agent (pakai keypair yang **bukan** `participation.user_wallet`) coba sign `claim_reward` untuk `Participation` milik user lain. Expect: tx revert di constraint `address = participation.user_wallet` pada account `claimer`. Tidak ada lamports berpindah.
- BE admin (kalau seseorang punya keypair-nya) coba sign `claim_reward`. Expect: revert sama (admin pubkey ≠ user_wallet).
- User coba `sync-claim` dengan `claim_tx_hash` punya user lain. Expect: 400 — event `user_wallet` tidak match session user.
- User coba `sync-claim` dua kali. Expect: idempotent — kedua call → state akhir `reward_claimed=true`, tidak menambah amount.
- Endpoint lama `POST /agent/claim` dipanggil. Expect: 404 (kalau full delete) atau 410 Gone (kalau pakai response transisi).
- Replay `mark_complete` 5x via admin. Expect: 1 sukses, 4 gagal `InvalidParticipationStatus`. State akhir sama.

---

## 8) Checklist implementasi BE

- [ ] Tambah env `QUPILOT_ADMIN_KEYPAIR_BASE64`. **Pastikan tidak ada** `QUPILOT_AUTOCLAIM_ON_SUCCESS` di config.
- [ ] Re-import IDL `qupilot.json` dari `qupilot-anchor-program/target/idl/` ke `src/lib/solana/idl/`.
- [ ] Implement `client.ts`, `pda.ts`, `tx-builder.ts` (hanya `join_quest`, `mark_complete`, `mark_failed`).
- [ ] Update verify `create_quest` flow → match `verifier` event ke admin pubkey.
- [ ] Migrasi DB: tambah `participations.participation_pda`, `join_tx_hash`, `complete_tx_hash`, `claim_tx_hash`, `reward_claimed`.
- [ ] Update `POST /agent/participations` → call `join_quest`.
- [ ] Update `POST /agent/participations/:uuid/complete` → call `mark_participation_complete` / `mark_participation_failed`. Tambah `participation_pda` + `complete_tx_hash` ke response.
- [ ] Implement endpoint agent claim:
  - [ ] `GET /agent/participations/:uuid/claim-tx` (build unsigned tx `claim_reward`)
  - [ ] `POST /agent/participations/sync-claim` (sync status claim dari tx hash)
- [ ] (Opsional UX) Implement `POST /me/participations/sync-claim` (session/JWT user) untuk update DB setelah user claim on-chain.
- [ ] **Hapus** `POST /agent/claim` (route, handler, schema, dokumentasi).
- [ ] Error mapping per §6.
- [ ] Background worker `retry-onchain-sync` untuk participation `requires_onchain_sync=true`.
- [ ] Test §7.1, §7.2, §7.3 hijau.
- [ ] Update `API.md`: hapus `POST /agent/claim`, tambah `GET /me/participations` + `POST /me/participations/sync-claim`.
- [ ] Update FE provider create form: pass `verifier = NEXT_PUBLIC_QUPILOT_ADMIN_PUBKEY` ke instruction `create_quest`.
- [ ] Update FE user profile: section "Claim Rewards" yang build → sign → submit RPC → sync ke BE.
- [ ] Update `qupilot-agent-skills/skills/qupilot-quest-runner/SKILL.md` dan `references/qupilot-api.md` bila perlu:
  - Pastikan Phase 4 memakai flow `claim-tx` → sign/broadcast → `sync-claim`
  - Tegaskan bahwa signer harus wallet penerima reward (`participation.user_wallet`)

---

## 9) Hal yang BUKAN tanggung jawab BE di fase ini

- Bukan tanggung jawab BE untuk merefund provider kalau quest expire dengan sisa pool. Itu instruction `refund_unallocated` di anchor (roadmap).
- Bukan tanggung jawab BE untuk meng-handle SPL token reward. Sementara hard-coded SOL.
- Bukan tanggung jawab BE untuk sign `claim_reward` (BE tidak memegang private key user). BE hanya build unsigned tx (opsional) dan/atau sync status claim.
