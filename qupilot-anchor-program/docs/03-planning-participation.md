# QuPilot Anchor Program — Planning: Participation & Reward Allocation

Status: Draft
Pasangan dari: `01-planning-reward-pool.md`, `02-be-integration.md`
Audience: Solana/Anchor engineer di `qupilot-anchor-program`, BE engineer di `qupilot-be`

---

## 1) Konteks & tujuan

Setelah MVP `create_quest` (escrow SOL) jadi, fase berikut adalah **distribusi reward** ke user yang quest-nya berhasil dikerjakan oleh agent AI. Tiga kejadian baru harus on-chain agar reward bisa diaudit:

| Event off-chain                              | Instruction on-chain      |
|----------------------------------------------|---------------------------|
| Agent AI panggil `POST /agent/participations`| `join_quest`              |
| BE verifikasi semua step → status `success`  | `mark_participation_complete` |
| User klik "Claim my rewards" di website      | `claim_reward`            |

Karakteristik penting yang harus dijaga:

1. **User wallet, bukan agent wallet, yang menerima reward.**
   Konsisten dengan SKILL.md: *"rewards go to that user's wallet_address, not the agent"*. Agent wallet dicatat untuk audit, tapi tidak pernah jadi penerima dana.
2. **BE adalah authority untuk `join_quest` + `mark_participation_complete` + `mark_participation_failed`.**
   Provider tidak mungkin sign tiap mark_complete (UX), dan agent tidak boleh sign (trust). BE menyimpan keypair admin (`QUPILOT_ADMIN_KEYPAIR`) yang ditetapkan saat `create_quest` sebagai `verifier`.
3. **Allocate-then-claim.** `mark_participation_complete` cuma me-reserve dana di state PDA `Participation` (idempotent, hemat compute, audit-friendly). Transfer lamports terjadi di `claim_reward` yang ditandatangani user.
4. **Single-channel claim — hanya user yang sign claim, lewat website.**
   - **claimer = signer = recipient = `participation.user_wallet`.** Tidak ada relay, tidak ada auto-claim oleh BE, tidak ada agent yang sign claim.
   - Anchor mengenforce dua hal: (a) signer wajib `participation.user_wallet` via constraint `address = participation.user_wallet` di account `claimer`, (b) lamports keluar dari PDA hanya bisa ke `claimer` itu sendiri (akun yang sama, jadi tidak ada parameter recipient terpisah yang bisa disalahgunakan).
   - Konsekuensi: tidak ada endpoint API `claim` di BE. Tidak ada flow di mana agent/BE sign claim atas nama user. Reward muncul "siap di-claim" di profile page user; user yang connect wallet dan klik tombol claim.

---

## 2) Account model

### 2.1 `QuestPool` — ekstensi field baru

Tambah satu field tanpa mengubah seed yang sudah ada:

```rust
#[account]
#[derive(InitSpace)]
pub struct QuestPool {
    pub version: u8,
    pub provider: Pubkey,
    pub verifier: Pubkey,            // 🆕 BE admin pubkey yang berhak join + mark complete/failed
    pub quest_id: [u8; 32],
    pub total_reward_pool: u64,
    pub reward_per_user: u64,
    pub allocated_amount: u64,       // 🆕 jumlah lamports yang masih ter-reserve untuk participation aktif
    pub claimed_amount: u64,         // tetap; diisi di claim_reward
    pub created_at: i64,
    pub expires_at: i64,
    pub status: u8,
    pub bump: u8,
}
```

Konsekuensi:

- `version` naik ke `2` di `create_quest` (atau buat instruction baru `migrate_quest_pool_v2` kalau sudah ada quest live di devnet — di MVP cukup bump `CURRENT_VERSION = 2` dan rebuild).
- `create_quest` signature ditambah satu argumen `verifier: Pubkey`. FE provider create flow harus inject `QUPILOT_ADMIN_PUBKEY` (dari env publik FE) saat ngirim instruction. BE saat verifikasi `tx_hash` juga match field `verifier` event ke `QUPILOT_ADMIN_PUBKEY` miliknya.
- Invariant: `claimed_amount <= allocated_amount <= total_reward_pool` selalu. `allocated_amount` naik di `join_quest`, turun di `mark_participation_failed`. `claimed_amount` naik di `claim_reward`.

### 2.2 `Participation` — PDA baru

Satu PDA per (quest, user_wallet). Catat juga agent wallet yang mengeksekusi.

**Seeds:**
```
["participation", quest_pool_pubkey, user_wallet_pubkey]
```

> Note: seed pakai **user wallet**, bukan agent wallet. Alasan: user wallet adalah natural key dari "siapa yang berhak claim". Satu user hanya boleh punya satu participation per quest (sejajar dengan constraint `PARTICIPATION_INPROGRESS_EXISTS` di BE).

**Fields:**

| Field              | Type       | Keterangan                                                       |
|--------------------|------------|------------------------------------------------------------------|
| `version`          | `u8`       | Forward-compat (`= 1`).                                          |
| `quest_pool`       | `Pubkey`   | PDA `QuestPool` yang di-join.                                    |
| `user_wallet`      | `Pubkey`   | **Penerima reward + satu-satunya yang berhak sign claim.**       |
| `agent_wallet`     | `Pubkey`   | Wallet agent yang mengeksekusi. Catatan audit. Boleh = user.     |
| `participation_uuid`| `[u8; 16]`| Off-chain participation UUID v4 dari BE (16 bytes raw).          |
| `status`           | `u8`       | `0=joined`, `1=success`, `2=failed`, `3=claimed`.                |
| `reward_amount`    | `u64`      | Diisi saat `join_quest` = `quest_pool.reward_per_user`.          |
| `joined_at`        | `i64`      |                                                                  |
| `completed_at`     | `i64`      | `0` kalau belum complete.                                        |
| `claimed_at`       | `i64`      | `0` kalau belum claim.                                           |
| `bump`             | `u8`       |                                                                  |

`participation_uuid` simpan **raw 16 bytes** (UUID v4 binary), bukan sha256 — karena uniqueness sudah dijaga oleh seed `(quest_pool, user_wallet)`. Field ini cuma untuk cross-reference ke baris DB BE.

**Space rough:** `8 + 1 + 32 + 32 + 32 + 16 + 1 + 8 + 8 + 8 + 8 + 1 = 155 bytes`. Pakai `INIT_SPACE` macro.

---

## 3) Instructions

### 3.1 `join_quest`

Dipanggil saat agent AI panggil `POST /agent/participations`. BE yang relay tx (signer = BE admin, payer = BE admin). User wallet dan agent wallet di-inject sebagai field, bukan sebagai signer — user tidak perlu sign untuk join (mereka cuma kasih API key).

**Argumen:**
```rust
pub fn join_quest(
    ctx: Context<JoinQuest>,
    participation_uuid: [u8; 16],
    user_wallet: Pubkey,
    agent_wallet: Pubkey,
) -> Result<()>
```

**Accounts:**
```rust
#[derive(Accounts)]
#[instruction(participation_uuid: [u8; 16], user_wallet: Pubkey, agent_wallet: Pubkey)]
pub struct JoinQuest<'info> {
    #[account(mut, address = quest_pool.verifier)]
    pub verifier: Signer<'info>,             // BE admin

    #[account(mut)]
    pub quest_pool: Account<'info, QuestPool>,

    #[account(
        init,
        payer = verifier,
        space = 8 + Participation::INIT_SPACE,
        seeds = [b"participation", quest_pool.key().as_ref(), user_wallet.as_ref()],
        bump
    )]
    pub participation: Account<'info, Participation>,

    pub system_program: Program<'info, System>,
}
```

**Logic:**
1. `require!(quest_pool.status == STATUS_ACTIVE, QuestNotActive)`.
2. `require!(Clock::now < quest_pool.expires_at, QuestExpired)`.
3. **Reward pool capacity check:** `quest_pool.allocated_amount + quest_pool.reward_per_user <= quest_pool.total_reward_pool`. Kalau gagal → `RewardPoolExhausted`.
   > Kita reserve capacity **di join, bukan di complete**, supaya tidak terjadi race di mana 10 agent join lalu hanya 5 yang muat. Trade-off: kalau participation flip ke `failed`, BE wajib panggil `mark_participation_failed` untuk free capacity (§3.4).
4. Init `Participation` dengan `status = joined`, `reward_amount = quest_pool.reward_per_user`, `joined_at = now`, `claimed_at = 0`, `completed_at = 0`.
5. `quest_pool.allocated_amount += quest_pool.reward_per_user`.
6. Emit `QuestJoined`.

### 3.2 `mark_participation_complete`

Dipanggil dari BE setelah `verifyTxBasic` di `POST /agent/participations/:uuid/complete` selesai dan semua step `success`.

**Argumen:**
```rust
pub fn mark_participation_complete(ctx: Context<MarkComplete>) -> Result<()>
```

**Accounts:**
```rust
#[derive(Accounts)]
pub struct MarkComplete<'info> {
    #[account(address = quest_pool.verifier)]
    pub verifier: Signer<'info>,             // BE admin

    #[account(mut)]
    pub quest_pool: Account<'info, QuestPool>,

    #[account(
        mut,
        has_one = quest_pool,
        seeds = [b"participation", quest_pool.key().as_ref(), participation.user_wallet.as_ref()],
        bump = participation.bump
    )]
    pub participation: Account<'info, Participation>,
}
```

**Logic:**
1. `require!(participation.status == STATUS_JOINED, InvalidParticipationStatus)`.
2. `require!(participation.reward_amount == quest_pool.reward_per_user, RewardAmountMismatch)`.
   > Lindungi terhadap kasus quest yang diubah-ubah; sebenarnya quest immutable, tapi defensive.
3. `participation.status = STATUS_SUCCESS`.
4. `participation.completed_at = Clock::now`.
5. Emit `ParticipationCompleted`.

**Tidak ada transfer SOL di sini.** Capacity sudah di-reserve di join; status flip ke `success` adalah sinyal bahwa user boleh claim via website.

### 3.3 `claim_reward`

Dipanggil **hanya oleh user, dari website**, setelah `participation.status == success`. Tidak ada channel lain — BE tidak relay, agent tidak sign. User yang connect wallet dan klik "Claim".

**Argumen:**
```rust
pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()>
```

**Accounts:**
```rust
#[derive(Accounts)]
pub struct ClaimReward<'info> {
    /// User wallet yang punya participation ini. Sekaligus signer, payer fee, dan recipient.
    #[account(
        mut,
        address = participation.user_wallet,
    )]
    pub claimer: Signer<'info>,

    #[account(mut)]
    pub quest_pool: Account<'info, QuestPool>,

    #[account(
        mut,
        has_one = quest_pool,
        seeds = [b"participation", quest_pool.key().as_ref(), claimer.key().as_ref()],
        bump = participation.bump
    )]
    pub participation: Account<'info, Participation>,
}
```

> Perhatikan: tidak ada account `user_wallet` terpisah dari `claimer`. Recipient = `claimer` = signer. Anchor melakukan tiga jaminan sekaligus di constraint:
> - `claimer` wajib sign (Anchor `Signer`).
> - `claimer.key() == participation.user_wallet` (constraint `address = participation.user_wallet`).
> - PDA `participation` di-derive ulang dengan seed `claimer.key()` — jadi user yang sign **harus** sama dengan user di seed PDA, tidak bisa pass `Participation` milik orang lain.

**Logic:**
1. `require!(participation.status == STATUS_SUCCESS, NotClaimable)`.
2. Transfer lamports dari PDA pool → claimer:
   ```rust
   **quest_pool.to_account_info().try_borrow_mut_lamports()? -= participation.reward_amount;
   **claimer.to_account_info().try_borrow_mut_lamports()? += participation.reward_amount;
   ```
   > Pakai sub_lamports/add_lamports karena PDA-nya bukan System Account; CPI `system_program::transfer` tidak bisa.
3. `participation.status = STATUS_CLAIMED`.
4. `participation.claimed_at = Clock::now`.
5. `quest_pool.claimed_amount += participation.reward_amount`.
6. Emit `RewardClaimed`.

**Invariant cek post-transfer:**
```rust
require!(
    quest_pool.to_account_info().lamports() >= rent_exempt_minimum,
    InsufficientPoolLamports
);
```
Pastikan rent-exempt minimum tetap terjaga supaya PDA tidak ke-close prematurely.

### 3.3.x Flow claim — single channel via website

Cuma satu jalur, sengaja sederhana:

1. User buka website, connect wallet (Phantom/Backpack). Wallet ini **wajib sama** dengan `users.wallet_address` yang tersimpan saat register — kalau bukan, FE tidak menampilkan participation apa pun.
2. FE call BE: `GET /me/participations?status=success&reward_claimed=false` → daftar participation yang siap di-claim. Setiap item mengandung `participation_pda`, `quest_pool_pda`, `reward_amount`.
3. User klik "Claim" pada salah satu (atau "Claim all"). FE build instruction `claim_reward` per participation:
   - `claimer` = wallet yang connected (sign-er-nya).
   - `quest_pool` = `quest_pool_pda` dari response.
   - `participation` = `participation_pda` dari response.
4. Wallet user sign tx, FE submit ke RPC langsung (tidak lewat BE).
5. Setelah confirmed, FE call `POST /me/participations/sync-claim` dengan `{ participation_uuid, claim_tx_hash }` supaya BE update DB (`reward_claimed=true, claim_tx_hash=...`). Alternatif jangka panjang: BE pakai event listener `RewardClaimed` untuk auto-sync — endpoint manual ini cuma jaring pengaman.

**Yang tidak ada (deliberate scope cut):**
- ❌ Tidak ada endpoint `POST /agent/claim`. Agent **tidak** punya cara untuk claim atas nama user.
- ❌ Tidak ada flow auto-claim di BE saat `mark_complete` sukses (`QUPILOT_AUTOCLAIM_ON_SUCCESS` env var dihapus).
- ❌ Tidak ada keypair user di BE — BE tidak pernah punya kunci untuk sign atas nama user.

Konsekuensi UX yang dapat diterima: user **wajib** balik ke website untuk klaim. Trade-off-nya: tidak ada surface attack berupa "BE / agent diam-diam claim", dan tidak ada beban fee tersembunyi di treasury BE atau agent.

### 3.4 `mark_participation_failed`

Dipanggil dari BE saat verification `complete` mendeteksi salah satu step gagal. Tujuannya: free reservasi `allocated_amount` supaya quest masih bisa di-join user lain.

**Argumen:**
```rust
pub fn mark_participation_failed(ctx: Context<MarkFailed>) -> Result<()>
```

**Accounts:** sama seperti `MarkComplete`.

**Logic:**
1. `require!(participation.status == STATUS_JOINED, InvalidParticipationStatus)`.
2. `participation.status = STATUS_FAILED`.
3. `participation.completed_at = Clock::now`.
4. `quest_pool.allocated_amount -= participation.reward_amount` (free capacity).
5. Emit `ParticipationFailed`.

### 3.5 (Roadmap) `release_expired_participation`

Untuk participation yang stuck di `joined` setelah `expires_at` lewat. Permissionless (siapa saja boleh trigger), efek: status → `failed`, capacity freed. Tidak masuk fase ini, tapi disebut supaya account model di atas tidak menutup jalan.

### 3.6 (Roadmap) `close_quest` / `refund_unallocated`

Provider tarik kembali `total_reward_pool - allocated_amount - rent` setelah `expires_at`. Tidak masuk fase ini.

---

## 4) Events

```rust
#[event]
pub struct QuestJoined {
    pub quest_pool: Pubkey,
    pub participation: Pubkey,
    pub user_wallet: Pubkey,
    pub agent_wallet: Pubkey,
    pub participation_uuid: [u8; 16],
    pub joined_at: i64,
}

#[event]
pub struct ParticipationCompleted {
    pub quest_pool: Pubkey,
    pub participation: Pubkey,
    pub user_wallet: Pubkey,
    pub reward_amount: u64,
    pub completed_at: i64,
}

#[event]
pub struct ParticipationFailed {
    pub quest_pool: Pubkey,
    pub participation: Pubkey,
    pub user_wallet: Pubkey,
    pub failed_at: i64,
}

#[event]
pub struct RewardClaimed {
    pub quest_pool: Pubkey,
    pub participation: Pubkey,
    pub user_wallet: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
}
```

> Catatan: `RewardClaimed` tidak lagi punya field `agent_wallet` karena claim tidak melibatkan agent. Audit "siapa agent yang quest-nya nyumbang" tetap ada di `Participation.agent_wallet` (queryable on-chain) + di event `QuestJoined`.

BE memparse event-event ini untuk update DB (mirror state on-chain → off-chain).

---

## 5) Error codes (tambahan)

```rust
#[error_code]
pub enum QuestError {
    // ... existing ...
    #[msg("quest pool is not active")]
    QuestNotActive,
    #[msg("quest has expired")]
    QuestExpired,
    #[msg("reward pool capacity exhausted")]
    RewardPoolExhausted,
    #[msg("invalid participation status for this operation")]
    InvalidParticipationStatus,
    #[msg("reward amount on participation doesn't match quest pool")]
    RewardAmountMismatch,
    #[msg("participation is not in claimable state")]
    NotClaimable,
    #[msg("insufficient pool lamports after transfer")]
    InsufficientPoolLamports,
}
```

> `UnauthorizedClaimer` dihapus — claim sekarang dijaga oleh Anchor constraint `address = participation.user_wallet` di account `claimer`, bukan runtime check. Anchor mengembalikan error generic `ConstraintAddress` / `RawConstraintViolated` saat mismatch; BE mapping di `04-be-integration-participation.md` §6 punya entry untuk ini.

---

## 6) Test plan tambahan

### 6.1 Happy path end-to-end (devnet/localnet)

1. `create_quest` dengan `verifier = ADMIN.publicKey`, total=1 SOL, reward_per_user=0.1 SOL.
2. 3x `join_quest` untuk 3 user wallet berbeda (signer = admin tiap kali). Expect: `allocated_amount = 0.3 SOL`, 3 Participation PDA terbentuk.
3. `mark_participation_complete` untuk dua dari tiga participation. Expect: status = `success`, `allocated_amount` tetap 0.3 (tidak berubah).
4. `claim_reward` untuk participation #1 (signer = user1). Expect: user1 balance naik 0.1 SOL minus fee, `claimed_amount = 0.1 SOL`, status = `claimed`.
5. `claim_reward` untuk participation #2 (signer = user2). Expect: user2 balance naik 0.1 SOL minus fee, `claimed_amount = 0.2 SOL`.
6. `mark_participation_failed` untuk participation #3. Expect: status = `failed`, `allocated_amount` turun ke 0.2 SOL.

### 6.2 Negative cases

- `join_quest` setelah `expires_at` → `QuestExpired`.
- `join_quest` saat `allocated_amount + reward_per_user > total_reward_pool` → `RewardPoolExhausted`.
- `join_quest` dengan `(quest_pool, user_wallet)` yang sudah ada → PDA `init` gagal (Anchor native).
- `mark_complete` dengan signer ≠ verifier → constraint address mismatch.
- `mark_complete` pada participation `status=success` → `InvalidParticipationStatus` (idempotent guard).
- `claim_reward` saat `status=joined` (belum complete) → `NotClaimable`.
- `claim_reward` dua kali (replay) → kedua call gagal di `NotClaimable` karena status sudah `claimed`.

### 6.2.1 Authorization test (claim — KRITIS, single channel)

Inti security model "hanya user yang sign claim":

- `claim_reward` dengan `claimer=user_wallet` (sign sendiri) → ✅ success, lamports naik ke user.
- `claim_reward` dengan `claimer=agent_wallet` (agent coba sign atas nama user) → ❌ Anchor constraint `address = participation.user_wallet` revert.
- `claim_reward` dengan `claimer=verifier (BE admin)` → ❌ constraint revert. BE secara teknis tidak punya jalan untuk claim atas nama user.
- `claim_reward` dengan `claimer=provider` → ❌ constraint revert.
- `claim_reward` dengan `claimer=random_keypair` → ❌ constraint revert.
- `claim_reward` di mana attacker coba pass `Participation` PDA milik user lain sambil signer-nya dirinya sendiri → ❌ seed derivation di `participation` constraint (`seeds = [..., claimer.key()]`) tidak match dengan PDA yang dipassing → `ConstraintSeeds` revert.

### 6.3 Invariant test (property)

- Untuk setiap urutan random {join, complete, fail, claim}, akhir test: `claimed_amount <= allocated_amount <= total_reward_pool`.
- `lamports(pool) >= total_reward_pool - claimed_amount + rent_exempt_min`.

---

## 7) Migration & rollout

1. **Anchor program upgrade**: tambah field `verifier` + `allocated_amount` ke `QuestPool` → ini *breaking* untuk akun yang sudah live. Strategi devnet:
   - Reset devnet quests (tidak ada user real yet).
   - Bump `declare_id!` kalau perlu, atau pakai feature `--skip-existing` di `anchor deploy` dan reinitialize semua test data.
2. **IDL re-export** ke `qupilot-be/src/lib/solana/idl/qupilot.json` setelah build.
3. **Env baru** di BE: `QUPILOT_ADMIN_KEYPAIR_PATH` (atau base64 env). Lihat `04-be-integration-participation.md` untuk detail. **Tidak ada** `QUPILOT_AUTOCLAIM_ON_SUCCESS` — fitur itu dibatalkan.
4. **Env baru** di FE provider: `NEXT_PUBLIC_QUPILOT_ADMIN_PUBKEY` — supaya saat provider create quest, FE bisa pass `verifier` ke instruction `create_quest`. Pubkey, bukan secret.
5. **FE user**: tambah halaman / section "Claim Rewards" di profile (sudah ada `fe/app/(user)/profile/page.tsx`) untuk membangun & sign instruction `claim_reward`.

---

## 8) Definition of Done — fase participation

- [ ] `QuestPool` di-extend dengan `verifier`, `allocated_amount`.
- [ ] `Participation` PDA defined dengan seed `(b"participation", quest_pool, user_wallet)`.
- [ ] Instructions: `join_quest`, `mark_participation_complete`, `mark_participation_failed`, `claim_reward` (single-signer = user).
- [ ] Events: `QuestJoined`, `ParticipationCompleted`, `ParticipationFailed`, `RewardClaimed`.
- [ ] Error codes baru.
- [ ] Test plan §6.1 + §6.2 + §6.2.1 hijau di localnet.
- [ ] Deploy ke devnet, program ID dicatat ulang kalau berubah.
- [ ] IDL re-export ke BE.
- [ ] Dokumen `04-be-integration-participation.md` ditulis (sibling dari `02-be-integration.md`).
- [ ] FE user: halaman claim functional (build → sign → submit RPC → POST sync ke BE).
