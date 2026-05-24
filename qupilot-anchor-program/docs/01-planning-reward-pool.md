# QuPilot Anchor Program — Planning: Reward Pool per Quest

Status: Draft  
Scope: MVP — use case **Provider create quest + deposit reward pool**  
Network target: Solana Devnet (mainnet later)  
Framework: Anchor (Rust)

---

## 1) Tujuan & Konteks

QuPilot adalah platform PilotQuests dimana **provider** membuat quest dan menyiapkan **reward pool** dalam SOL. User/agent yang berhasil menyelesaikan quest akan menerima bagian reward dari pool tersebut.

Saat ini backend (`qupilot-be`) sudah punya endpoint create quest yang menerima:
- `total_reward_pool` (bigint, lamports)
- `reward_per_user` (bigint, lamports)
- `reward_token: "SOL"`
- `tx_hash` (signature Solana, base58)

Artinya alur yang sudah disepakati: **provider deposit on-chain terlebih dahulu → kirim `tx_hash` ke BE → BE verifikasi → quest dibuat di DB**.

Anchor program ini berperan sebagai **escrow/vault on-chain** yang:
1. Menerima setoran SOL dari provider sesuai amount yang dideklarasikan.
2. Mengikat setoran tersebut ke sebuah `quest_id` deterministik (PDA).
3. Menyediakan basis untuk distribusi reward (di fase berikutnya — bukan fokus dokumen ini).

> **Out of scope dokumen ini**: klaim reward oleh user, refund unclaimed, pause/cancel quest, SPL token (non-SOL). Akan dibahas di dokumen planning lanjutan.

---

## 2) Use case fokus MVP

**UC-1: Provider create quest dengan reward pool**

Aktor: Provider (wallet Solana).

Flow yang diinginkan:
1. Provider menyiapkan metadata quest off-chain (title, description, steps) di UI.
2. UI memanggil instruction `create_quest` di Anchor program dengan parameter:
   - `quest_id` (identifier yang juga akan dipakai BE — bisa UUID di-hash, atau provider-generated string yang unik per provider)
   - `total_reward_pool` (lamports)
   - `reward_per_user` (lamports)
   - `expires_at` (unix timestamp)
3. Program membuat PDA `QuestPool` dan **memindahkan SOL** dari wallet provider ke PDA vault sebesar `total_reward_pool`.
4. Provider mendapat `tx_signature` dari hasil transaksi.
5. UI kirim payload ke BE (`POST /api/quests`) menyertakan `tx_hash` dan semua field lain.
6. BE memverifikasi tx tersebut on-chain (cek program id, signer, amount, quest_id) sebelum menyimpan quest ke DB.

---

## 3) Desain account & PDA

### 3.1 `QuestPool` (PDA)
PDA yang menyimpan state quest sekaligus berfungsi sebagai vault SOL.

**Seeds:**
```
["quest", provider_pubkey, quest_id_bytes]
```

> `quest_id_bytes` direkomendasikan **fixed-length 32 bytes** (hash dari quest_id string, atau langsung UUID 16 bytes di-pad ke 32). Hindari seed dengan length variabel agar derivation di BE deterministik dan stabil.

**Fields:**
| Field              | Type       | Keterangan                                                |
|--------------------|------------|-----------------------------------------------------------|
| `provider`         | `Pubkey`   | Wallet yang membuat quest. Authority.                     |
| `quest_id`         | `[u8; 32]` | Identifier deterministik.                                 |
| `total_reward_pool`| `u64`      | Lamports total yang di-deposit.                           |
| `reward_per_user`  | `u64`      | Lamports per user (untuk distribusi nanti).               |
| `claimed_amount`   | `u64`      | Sudah diklaim (reserved untuk fase berikut, mulai 0).     |
| `created_at`       | `i64`      | `Clock::unix_timestamp` saat create.                      |
| `expires_at`       | `i64`      | Batas waktu quest. Setelah ini, refund flow akan aktif.   |
| `status`           | `u8`       | Enum: 0=Active, 1=Closed, 2=Refunded. (MVP: hanya Active) |
| `bump`             | `u8`       | PDA bump.                                                 |

**Space (rough):** `8 (discriminator) + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 = 114 bytes`. Pakai `#[account]` + `INIT_SPACE` macro biar gak salah hitung.

### 3.2 Vault SOL
**Opsi A — Vault = QuestPool PDA itu sendiri (rekomendasi MVP).**  
PDA QuestPool langsung jadi penampung SOL. Saldo lamports PDA = `rent-exempt + total_reward_pool`. Withdraw via `**ctx.accounts.quest_pool.sub_lamports()` + `to.add_lamports()`.

Pros: simpel, 1 account saja.  
Cons: harus hati-hati membedakan lamports rent-exempt vs reward yang bisa di-withdraw.

**Opsi B — Vault terpisah (`SystemAccount` PDA dengan seed berbeda).**  
Seeds: `["vault", quest_pool_key]`. Lebih bersih secara konsep, tapi nambah 1 account dan 1 rent.

**Keputusan MVP:** **Opsi A**. Lebih ringkas untuk hackathon. Migrasi ke Opsi B mudah kalau perlu.

---

## 4) Instruction: `create_quest`

### 4.1 Signature
```rust
pub fn create_quest(
    ctx: Context<CreateQuest>,
    quest_id: [u8; 32],
    total_reward_pool: u64,
    reward_per_user: u64,
    expires_at: i64,
) -> Result<()>
```

### 4.2 Accounts
```rust
#[derive(Accounts)]
#[instruction(quest_id: [u8; 32])]
pub struct CreateQuest<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,

    #[account(
        init,
        payer = provider,
        space = 8 + QuestPool::INIT_SPACE,
        seeds = [b"quest", provider.key().as_ref(), quest_id.as_ref()],
        bump
    )]
    pub quest_pool: Account<'info, QuestPool>,

    pub system_program: Program<'info, System>,
}
```

### 4.3 Logic
1. Validasi input:
   - `total_reward_pool > 0`
   - `reward_per_user > 0`
   - `total_reward_pool >= reward_per_user`
   - `expires_at > Clock::unix_timestamp`
   - (Opsional MVP) `total_reward_pool % reward_per_user == 0` — pastikan habis dibagi.
2. Isi field `QuestPool`.
3. **Transfer SOL** dari `provider` → `quest_pool` PDA sebesar `total_reward_pool` via CPI ke System Program (`system_program::transfer`).
4. Emit event `QuestCreated`.

### 4.4 Event
```rust
#[event]
pub struct QuestCreated {
    pub quest_pool: Pubkey,
    pub provider: Pubkey,
    pub quest_id: [u8; 32],
    pub total_reward_pool: u64,
    pub reward_per_user: u64,
    pub expires_at: i64,
}
```

Event ini krusial — BE bisa parse log untuk verifikasi tanpa decode account.

---

## 5) Error codes

```rust
#[error_code]
pub enum QuestError {
    #[msg("total_reward_pool must be greater than zero")]
    InvalidTotalReward,
    #[msg("reward_per_user must be greater than zero")]
    InvalidRewardPerUser,
    #[msg("total_reward_pool must be >= reward_per_user")]
    RewardPoolTooSmall,
    #[msg("expires_at must be in the future")]
    ExpiresAtInPast,
}
```

---

## 6) Integrasi dengan Backend (verifikasi `tx_hash`)

Setelah `create_quest` sukses, BE harus memverifikasi `tx_hash` yang dikirim provider:

1. **Fetch transaction** via RPC (`getTransaction`) dengan `commitment: confirmed` minimal.
2. Cek:
   - `transaction.meta.err === null` (sukses).
   - Salah satu instruction memanggil **program ID kita** (`QUPILOT_PROGRAM_ID`).
   - Decode instruction args → `quest_id`, `total_reward_pool`, `reward_per_user`, `expires_at` cocok dengan payload BE.
   - Signer = `provider_wallet` yang sedang authenticated di BE.
   - Atau (lebih simpel) parse **event `QuestCreated`** dari log dan match field-nya.
3. Derive PDA `quest_pool` di BE menggunakan seeds yang sama, simpan address-nya ke DB (kolom `quest_pool_pda` baru).
4. Simpan quest ke DB hanya kalau semua verifikasi pass.

**Catatan:** strategi event-based verification lebih stabil daripada decode instruction (lihat `quest-model.md` §3.B). Anchor IDL bisa dipakai BE untuk decode event.

---

## 7) Test plan (Anchor mocha/ts)

Minimum test untuk MVP:
- ✅ Happy path: provider create quest, PDA terbuat, lamports PDA == rent + total_reward_pool.
- ✅ Event `QuestCreated` ter-emit dengan field benar.
- ❌ Reject: `total_reward_pool == 0`.
- ❌ Reject: `reward_per_user > total_reward_pool`.
- ❌ Reject: `expires_at` di masa lalu.
- ❌ Reject: re-create quest dengan `(provider, quest_id)` yang sama → PDA sudah init.
- ✅ Multiple quests dari provider yang sama (quest_id berbeda) → masing-masing PDA terpisah.
- ✅ Provider berbeda boleh pakai `quest_id` yang sama → PDA berbeda (karena seed memasukkan provider key).

---

## 8) Struktur folder yang diusulkan

```
qupilot-anchor-program/
├── Anchor.toml
├── Cargo.toml
├── package.json
├── tsconfig.json
├── programs/
│   └── qupilot/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs               # program entrypoint + instruction handlers
│           ├── state.rs             # QuestPool struct
│           ├── instructions/
│           │   ├── mod.rs
│           │   └── create_quest.rs  # CreateQuest accounts + handler
│           ├── events.rs            # QuestCreated
│           └── errors.rs            # QuestError
├── tests/
│   └── create-quest.ts              # mocha tests
└── docs/
    └── 01-planning-reward-pool.md   # dokumen ini
```

---

## 9) Roadmap setelah MVP create_quest

Bukan untuk dikerjakan sekarang, tapi disebut supaya desain MVP tidak menutup jalan:

1. **`distribute_reward(user, amount)`** — provider/admin signer transfer dari vault ke user yang menyelesaikan quest. Update `claimed_amount`.
2. **`claim_reward`** — alternatif: user yang klaim sendiri dengan bukti dari backend (signature/PDA voucher).
3. **`close_quest`** — provider close quest sebelum expires, refund sisa.
4. **`refund_expired`** — siapa saja boleh trigger refund ke provider setelah `expires_at`.
5. **SPL token support** — generalisasi `reward_token` ke SPL mint, butuh `TokenAccount` vault & `Token` program CPI.
6. **Multi-admin / authority delegation** — biar BE bisa execute distribute atas nama provider tanpa minta sign tiap kali (PDA-as-authority + admin signer pattern).

---

## 10) Open questions

1. **`quest_id` di-generate dimana?**  
   - Opsi A: UI generate UUID v4, hash ke 32 bytes sebelum ke program. BE simpan UUID yang sama.  
   - Opsi B: BE generate UUID dulu, lalu UI baru sign. Tapi ini bikin alur jadi 2 trip (request id → sign).  
   - **Rekomendasi:** Opsi A, UUID v4 client-side. BE tinggal verifikasi keunikan (`UNIQUE` constraint di DB).

2. **Lamports unit di BE.** BE saat ini terima `bigint` — pastikan dokumentasi API jelas bahwa unitnya **lamports** (bukan SOL).

3. **Rent-exempt SOL siapa yang bayar?** Provider, karena dia `payer`. Anggap negligible (~0.002 SOL untuk akun 114 byte). Tidak perlu di-refund.

4. **Apakah perlu `version: u8` di account?** Untuk forward-compat upgrade schema. **Rekomendasi: ya**, tambahkan field `version: u8 = 1`. Cheap, save headache nanti.

5. **Devnet vs localnet untuk demo hackathon?**  
   - Dev workflow: localnet (`anchor test`).  
   - Demo: deploy ke devnet, frontend point ke devnet RPC.

---

## 10b) Catatan toolchain (Anchor 0.31.1 + platform-tools 1.51)

Saat scaffold pertama kali, `anchor build` gagal karena `cargo-build-sbf` membundle cargo 1.84 (platform-tools 1.51) yang **belum stable** untuk `edition2024`. Beberapa transitive deps Solana terbaru sudah pakai edition2024.

Fix: setelah `cargo generate-lockfile`, downgrade beberapa crate ke versi yang masih compatible:

```bash
cargo update -p blake3 --precise 1.5.5
cargo update -p proc-macro-crate@3.5.0 --precise 3.3.0
cargo update -p indexmap@2.14.0 --precise 2.7.1
cargo update -p unicode-segmentation --precise 1.12.0
```

`Cargo.lock` di-commit supaya developer lain tidak kena lagi. Saat upgrade Anchor / platform-tools nanti, pin ini bisa dihapus.

## 11) Definition of Done (untuk fase ini)

- [x] Anchor workspace ter-init di `qupilot-anchor-program/`.
- [x] Instruction `create_quest` implemented, dengan event + error codes.
- [x] Semua test di §7 hijau.
- [x] Deploy ke devnet, program ID dicatat.
- [x] IDL di-export ke `qupilot-be` agar BE bisa decode event saat verifikasi.
- [x] Dokumen `02-be-integration.md` ditulis untuk panduan BE verify `tx_hash`.