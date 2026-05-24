# Quest API — Backend Design & Requirements

## Overview

Platform web3 quest yang menghubungkan tiga jenis aktor: **User Provider** (pembuat quest), **User** (pemilik wallet), dan **AI Agent** (satu-satunya yang menjalankan quest secara on-chain). Backend dibangun dengan Express + TypeScript, database Supabase PostgreSQL yang hanya bisa diakses melalui Express menggunakan service role key — tidak ada akses publik via PostgREST.

---

## Tech Stack

| Layer | Pilihan |
|---|---|
| Framework | Express v5 + TypeScript |
| Database | Supabase PostgreSQL |
| DB Access | Supabase JS SDK dengan `service_role` key |
| Auth — User Provider / User | JWT (connect wallet), role: `user_provider` atau `user` |
| Auth — AI Agent | API key via header `x-api-key` — di-generate oleh user (wallet) dari dashboard, satu key aktif per user, tersimpan sebagai SHA-256 hash + prefix |
| Validation | Zod (request body & query params) |
| Deploy | Railway / Fly.io / VPS |

---

## Database Schema

### Konvensi ID di Semua Tabel

Setiap tabel memiliki dua jenis identifier:

| Column | Type | Fungsi |
|---|---|---|
| `id` | bigint, auto increment PK | Digunakan sebagai foreign key antar tabel — tidak pernah diekspos ke UI |
| `uuid` | uuid, default uuidv4 | Digunakan sebagai identifier publik yang dimunculkan ke UI dan API response |

---

### Tabel: `users`

Menyimpan akun berbasis wallet address. Tidak ada password — autentikasi via Solana signature (ed25519 verify). Satu table ini menyimpan dua role: `user` dan `user_provider`.

| Column | Type | Keterangan |
|---|---|---|
| id | bigint PK auto increment | Internal FK |
| uuid | uuid UNIQUE default uuidv4 | ID publik untuk UI |
| wallet_address | text UNIQUE | Solana wallet address (base58) |
| role | text | Enum: `user` / `user_provider` |
| display_name | text | Nama tampil (khusus provider, nullable) |
| logo_url | text | URL logo provider (nullable) |
| created_at | timestamptz | |

---

### Tabel: `agent_api_keys`

Menyimpan API key yang di-generate oleh user untuk dipakai AI Agent. Satu user hanya boleh memiliki satu key aktif pada satu waktu — regenerate akan me-revoke key lama.

| Column | Type | Keterangan |
|---|---|---|
| id | bigint PK auto increment | Internal FK |
| uuid | uuid UNIQUE default uuidv4 | ID publik untuk UI |
| user_id | bigint FK | → users.id (one user → many keys total, tapi hanya satu `revoked_at IS NULL`) |
| key_prefix | text | 8 karakter pertama dari plaintext key — dipakai untuk lookup cepat. Index biasa. |
| key_hash | text | SHA-256 hash hex dari plaintext key — dipakai untuk verifikasi (constant-time compare). |
| label | text | Label opsional yang diberikan user saat generate (mis. "trading-bot"). |
| created_at | timestamptz | |
| last_used_at | timestamptz | Update setiap kali key dipakai untuk authenticate. |
| revoked_at | timestamptz | NULL jika masih aktif. Diisi saat user regenerate atau revoke manual. |

**Partial unique index:** `(user_id) WHERE revoked_at IS NULL` — enforce "satu key aktif per user" di level database.

**Plaintext key:** Format `qpk_<random-32-chars>`. Plaintext hanya muncul satu kali di response saat generate — setelah itu tidak bisa dilihat ulang (best practice industri). 8 karakter pertama plaintext (`qpk_xxxx`) disimpan di `key_prefix` agar verify flow tidak perlu full table scan.

---

### Tabel: `quests`

Menyimpan quest yang dibuat oleh user provider. Quest langsung aktif dan publik setelah dibuat — tidak ada status draft, tidak ada fitur publish, dan tidak bisa diedit.

| Column | Type | Keterangan |
|---|---|---|
| id | bigint PK auto increment | Internal FK |
| uuid | uuid UNIQUE default uuidv4 | ID publik untuk UI dan AI agent |
| provider_id | bigint FK | → users.id (row dengan `role='user_provider'`) |
| title | text | Judul quest |
| description | text | Deskripsi detail quest |
| protocol | text | Free text (nama protocol, non-empty) |
| total_reward_pool | bigint NOT NULL | Total reward (base units, bigint) yang tersedia untuk quest ini. Batas atas akumulasi distribusi. Immutable setelah quest dibuat. |
| reward_per_user | bigint NOT NULL | Reward (base units) yang diterima setiap user yang berhasil men-complete quest. Immutable setelah quest dibuat. Constraint DB: `total_reward_pool >= reward_per_user`. |
| total_reward_distributed | bigint NOT NULL DEFAULT 0 | Akumulasi reward yang sudah diberikan ke semua participation `status=success` quest ini. Di-increment server saat agent berhasil complete participation. Hanya kolom inilah di `quests` yang mutable. Constraint DB: `total_reward_distributed <= total_reward_pool`. |
| reward_token | text | `"SOL"` |
| tx_hash | text | Tx signature Solana (base58) yang dikirim provider saat create quest (required) |
| expires_at | timestamptz | Quest tidak muncul di listing publik setelah tanggal ini |
| created_at | timestamptz | |

Quest sudah tidak menyimpan `quest_type` ataupun `action_params`. Langkah-langkah eksekusi disimpan di tabel `quest_steps`.

**Tidak ada kolom `status`:** Quest selalu publik sejak dibuat. Visibilitas di listing publik dikontrol murni oleh `expires_at`.

---

### Tabel: `quest_participations`

Menyimpan record eksekusi quest oleh AI agent atas nama user tertentu.

| Column | Type | Keterangan |
|---|---|---|
| id | bigint PK auto increment | Internal FK |
| uuid | uuid UNIQUE default uuidv4 | ID publik |
| user_id | bigint FK | → users.id |
| quest_id | bigint FK | → quests.id |
| status | text | Enum: `inprogress` → `success` / `failed` |
| tx_hash | text | Hash transaksi on-chain yang disubmit AI agent |
| reward_claimed | bool | Default false, true setelah claim berhasil |
| started_at | timestamptz | Waktu AI agent mulai mengeksekusi quest |
| completed_at | timestamptz | Waktu status berubah ke success/failed |

**Tidak ada kolom reward** di `quest_participations`. Nominal reward untuk claim direfer ke `quests.reward_per_user` — aman karena kolom itu immutable.

---

### Tabel: `quest_steps`

Menyimpan langkah-langkah penyelesaian quest. Step bersifat immutable (tidak bisa diedit setelah quest dibuat).

| Column | Type | Keterangan |
|---|---|---|
| id | bigint PK auto increment | Internal FK |
| uuid | uuid UNIQUE default uuidv4 | ID publik step |
| quest_id | bigint FK | → quests.id |
| order_index | int | Urutan step (mulai dari 0) |
| step_type | text | Enum: `swap`, `clmm_open`, `clmm_close` |
| action_params | jsonb | Parameter per step untuk AI agent (shape tergantung `step_type`) |
| created_at | timestamptz | |

---

### Tabel: `quest_step_participations`

Menyimpan progress eksekusi per step untuk satu `quest_participations` + `quest_steps`.

| Column | Type | Keterangan |
|---|---|---|
| id | bigint PK auto increment | Internal FK |
| uuid | uuid UNIQUE default uuidv4 | ID publik |
| participation_id | bigint FK | → quest_participations.id |
| step_id | bigint FK | → quest_steps.id |
| status | text | Enum: `inprogress` → `success` / `failed` |
| tx_hash | text | Tx signature Solana (base58) untuk step ini |
| started_at | timestamptz | |
| completed_at | timestamptz | |

## JWT Payload

Semua JWT mengandung field `role` untuk membedakan aktor di middleware.

**User Provider:**
| Field | Value |
|---|---|
| `sub` | uuid provider |
| `role` | `user_provider` |
| `wallet_address` | Solana wallet address (base58) |
| `exp` | 7 hari |

**User:**
| Field | Value |
|---|---|
| `sub` | uuid user |
| `role` | `user` |
| `wallet_address` | Solana wallet address (base58) |
| `exp` | 7 hari |

Middleware auth membaca field `role` untuk menentukan hak akses endpoint — satu middleware dapat mendukung multiple role jika diperlukan.

---

## Fitur & Requirements per Aktor

---

### 1. Auth — Wallet (User / Provider)

**Login**
- Input: `wallet_address`, `signature`, `message`
- Flow: FE minta user sign pesan arbitrary, BE verify signature (ed25519) dan harus match dengan `wallet_address`.

**Register gate**
- Jika wallet address belum ada di tabel `users` dan request tidak menyertakan `role` → response `{ registered: false }` (client harus minta user memilih role).
- Setelah user memilih role, client hit endpoint yang sama dengan tambahan:
  - `role`: `user` atau `user_provider`
  - Jika `role=user_provider`: terima juga `display_name` (required) dan `logo_url` (optional)
- Jika wallet sudah terdaftar, return JWT sesuai role yang tersimpan.
- Jika client mengirim `role` tapi beda dari role yang sudah tersimpan untuk wallet itu, return 409 `ROLE_MISMATCH`.

**Return**
- JWT dengan payload sesuai role (`user` atau `user_provider`)
- JWT expire: 7 hari

---

### 2. Fitur User Provider

Semua endpoint memerlukan JWT dengan role `user_provider`.

**Create Quest**
- Quest langsung aktif dan publik setelah dibuat — tidak ada tahap draft atau publish
- Quest tidak bisa diedit dalam kondisi apapun setelah dibuat — enforce di level backend, return 403 jika ada request PUT/PATCH
- Input wajib: `title`, `description`, `protocol`, `steps`, `total_reward_pool`, `reward_per_user`, `reward_token`, `tx_hash`, `expires_at`
- Validasi: `expires_at` harus di masa depan; `total_reward_pool >= reward_per_user` (zod + DB check); kedua nilai reward >= 0
- `total_reward_distributed` di-set 0 oleh server (tidak di body)
- Response mengembalikan `uuid` quest sebagai identifier publik

**Lihat Daftar Quest Milik Provider**
- Menampilkan semua quest yang dibuat oleh provider tersebut
- Setiap quest menampilkan jumlah AI agent yang sudah mengeksekusi quest (`quest_participations count`)

**Lihat Detail Quest**
- Menampilkan detail lengkap satu quest berdasarkan `uuid`
- Termasuk analytics: jumlah eksekusi, jumlah success, jumlah failed, success rate

---

### 3. Fitur User

Semua endpoint memerlukan JWT dengan role `user`. User hanya bisa **melihat data** — tidak bisa join atau execute quest. Seluruh eksekusi dilakukan oleh AI Agent.

**Lihat Achievement & Daftar Quest**
- Menampilkan semua quest yang pernah dieksekusi AI agent atas nama user ini, beserta statusnya (`inprogress`, `success`, `failed`)
- Dibagi dua section: achievement (quest yang berhasil) dan quest list (semua)

**Lihat Detail Quest yang Diikuti**
- Menampilkan detail quest + status partisipasi user saat ini
- Menampilkan apakah reward sudah bisa di-claim (`status = success` dan `reward_claimed = false`)

**Claim Reward**
- Endpoint bulk: claim semua reward dari quest yang sudah `success` dan belum di-claim
- Trigger transaksi on-chain untuk mengirim reward ke wallet user
- Setelah berhasil, update `reward_claimed = true` pada semua participation yang di-claim
- Reward bisa di-claim lewat dua jalur (sama-sama mengirim ke wallet user yang sama):
  - **Manual** oleh user via dashboard (JWT user) → `POST /me/claim`
  - **Otomatis** oleh AI Agent atas nama user (API key) → `POST /agent/claim`. Agent tidak menerima reward — destination tetap `users.wallet_address` milik owner API key.
- Bersifat idempotent: row yang sudah `reward_claimed = true` otomatis di-skip, jadi dual-trigger (user + agent) tidak menyebabkan double-spend.

**Generate API Key untuk AI Agent**
- Hanya bisa diakses setelah user login pakai wallet (JWT role `user`)
- Saat dipanggil: revoke key lama (set `revoked_at = now()`), generate plaintext baru `qpk_<32-random-chars>`, hash SHA-256, simpan row baru di `agent_api_keys` dengan `key_prefix` (8 char pertama plaintext) dan `key_hash`
- Response berisi **plaintext key** dan `key_prefix` — plaintext **hanya muncul satu kali** di response ini, tidak bisa dilihat lagi setelah itu
- Optional input: `label` untuk menandai key (mis. nama agent / device)

**Lihat Status API Key Aktif**
- Mengembalikan metadata key aktif user saat ini: `key_prefix`, `label`, `created_at`, `last_used_at` — tanpa plaintext, tanpa hash
- Return `null` / 404 jika user belum pernah generate key

**Revoke API Key**
- Set `revoked_at = now()` pada key aktif user; tidak ada key aktif setelah operasi ini sampai user generate ulang

---

### 5. Fitur Publik

Tidak memerlukan autentikasi apapun.

**Daftar User Provider**
- Menampilkan semua user provider yang terdaftar (`users.role='user_provider'`)
- Termasuk field "spotlight" untuk menandai provider yang difeatured di landing page

**Daftar Quest per Provider**
- Menampilkan quest yang belum expired dari satu provider tertentu
- Menampilkan jumlah AI agent yang sudah mengeksekusi quest per quest

**Daftar Quest (Agregat)**
- Menampilkan semua quest yang belum expired dari semua provider
- Filter yang tersedia: `protocol` (byreal/bybit/sui), `type` (swap/lp/stake)
- Setiap quest menampilkan nama dan logo provider asalnya

**Detail Quest**
- Menampilkan detail lengkap satu quest berdasarkan `uuid` termasuk `steps[]` (ordered)
- Field `steps[].action_params` digunakan AI agent untuk mengeksekusi quest secara otomatis

**Leaderboard**
- Menampilkan ranking user berdasarkan dua metrik:
  - `total_reward`: jumlah akumulasi reward dari semua quest yang berhasil diklaim
  - `success_rate`: persentase quest yang berhasil dari total yang dieksekusi
- Urutan: `total_reward DESC`, lalu `success_rate DESC` sebagai tiebreaker
- Limit default: 100 entri teratas
- Implementasi pakai SQL view `public.leaderboard` supaya sorting agregat dilakukan di DB

---

### 6. Fitur AI Agent

AI agent mengakses API menggunakan API key via header `x-api-key`. Key di-generate oleh user dari dashboard (lihat section 4), jadi setiap key terikat ke satu user. Agent adalah satu-satunya aktor yang bisa join dan complete quest.

**Auth Flow di Backend**
- Ambil `x-api-key` dari header. Plaintext key format: `qpk_<32-random-chars>` (total 36 char).
- Lookup row `agent_api_keys` `WHERE key_prefix = <first-8-chars-of-plaintext> AND revoked_at IS NULL`. Jika tidak ada → 401.
- Bandingkan SHA-256 hash dari plaintext yang diterima dengan `key_hash` di row menggunakan `crypto.timingSafeEqual`. Mismatch → 401.
- Resolve `user_id` dari row, set `req.auth = { role: 'agent', user_id, key_id }`. Update `last_used_at = now()` (best-effort, non-blocking).

**Discovery Quest**
- Menggunakan endpoint publik `GET /quests` dengan filter `protocol` dan `type`
- Membaca `steps[]` dari `GET /quests/:uuid` untuk mendapatkan parameter eksekusi

**Join Quest**
- Membuat record baru di `quest_participations` dengan status `inprogress`
- Input: `quest_uuid` saja — `user_id` di-resolve otomatis dari API key (tidak perlu dikirim di body)
- Validasi: belum ada record `inprogress` untuk kombinasi user + quest yang sama
- Validasi: quest belum expired

**Complete Quest**
- Mengirimkan `steps: [{ step_uuid, tx_hash }]` dari transaksi on-chain yang sudah dieksekusi per step
- Validasi ownership: participation yang dirujuk harus milik user yang sama dengan owner API key — agent tidak bisa complete participation milik user lain (return 403)
- Backend **wajib memverifikasi `tx_hash` ke Solana RPC** sebelum mengubah status — tidak bisa langsung percaya input dari agent
- Jika transaksi valid: update `quest_step_participations.status=success` untuk step tsb.
- Jika transaksi tidak valid: update `quest_step_participations.status=failed` untuk step tsb.
- Participation quest dianggap `success` kalau semua step `success`, dan dianggap `failed` kalau ada minimal satu step `failed`.
- **Saat dan hanya saat status berubah ke `success`:**
  - Load `quests.{reward_per_user, total_reward_pool, total_reward_distributed}` untuk quest yang bersangkutan.
  - Hitung `new = total_reward_distributed + reward_per_user`. Kalau `new > total_reward_pool` → return 409 `REWARD_POOL_EXHAUSTED` (status participation tetap inprogress, agent boleh retry / inform user).
  - Else update `quests.total_reward_distributed = new`.
- Kalau `failed`: `total_reward_distributed` tidak berubah, pool tidak terpakai.

**Claim Reward (Agent-triggered)**
- Endpoint: `POST /agent/claim` (auth via `x-api-key`)
- Agent boleh men-trigger claim semua reward milik user pemilik API key — `user_id` di-resolve dari API key, tidak perlu di body
- Sama persis dengan logika `POST /me/claim`: loop semua participation `status=success` & `reward_claimed=false` milik user tersebut, transfer SOL on-chain ke `users.wallet_address`, set `reward_claimed=true`
- Reward selalu masuk ke wallet user — agent tidak pernah jadi destination address
- Idempotent: aman dipanggil berulang, dan aman kalau user juga manual claim dari dashboard (DB constraint `reward_claimed=true` mencegah double-spend)

---

## Business Rules Lintas Fitur

| Rule | Detail |
|---|---|
| Quest immutable | Quest tidak bisa diedit setelah dibuat — tidak ada status draft, tidak ada publish step, return 403 untuk semua request edit |
| Tidak ada status quest | Visibilitas quest dikontrol murni oleh `expires_at` — quest expired tidak muncul di listing publik |
| Eksekusi hanya oleh AI Agent | Hanya AI Agent yang bisa join dan complete quest — endpoint ini tidak bisa diakses dengan JWT user maupun user_provider |
| User hanya view | User dengan role `user` hanya bisa membaca data partisipasi mereka dan claim reward |
| Verifikasi tx wajib | Status tidak boleh diubah ke `success` tanpa verifikasi `tx_hash` ke Solana RPC |
| Register gate wallet | Wallet baru tidak otomatis dibuat tanpa `role`; request pertama tanpa `role` return `{ registered:false }`, lalu client pilih role dan hit ulang |
| Partisipasi unik | AI Agent tidak bisa membuat dua record `inprogress` untuk kombinasi user + quest yang sama |
| UUID untuk publik | Semua identifier yang diekspos ke UI dan API response menggunakan `uuid` — bigint `id` tidak pernah diekspos |
| Foreign key pakai bigint | Semua relasi antar tabel menggunakan kolom `id` bigint, bukan `uuid` |
| Reward hanya untuk success | Endpoint claim hanya memproses participation dengan status `success` |
| Claim destination | Apapun trigger-nya (user manual atau agent otomatis), reward selalu ditransfer ke `users.wallet_address` milik owner participation. Agent bukan destination. |
| Claim idempotent | Semua endpoint claim aman dipanggil berulang — row dengan `reward_claimed=true` di-skip, sehingga dual-trigger user + agent tidak menyebabkan double-transfer. |
| Reward source-of-truth | Nilai reward yang ditransfer ke user diambil langsung dari `quests.reward_per_user`. Aman karena kolom ini immutable setelah quest dibuat. `quest_participations` sengaja tidak punya kolom reward sendiri. |
| Reward bigint | Semua angka reward (`quests.total_reward_pool`, `quests.reward_per_user`, `quests.total_reward_distributed`, response `claimed[].amount`, `leaderboard.total_reward`) bertipe `bigint` di DB dan dikirim sebagai **string** di JSON response untuk menghindari precision loss JavaScript. |
| Pool cap | `total_reward_distributed` tidak boleh melebihi `total_reward_pool`. Dijaga di dua tempat: (1) check constraint DB, (2) pre-check di `agent.service.complete` sebelum bump — kalau bakal exceed, return 409 `REWARD_POOL_EXHAUSTED`. |
| Quest mutability scope | Quest masih "immutable" untuk semua field yang dibuat user (title/description/protocol/total_reward_pool/reward_per_user/dst.) — return 403 untuk PATCH/PUT. Satu-satunya kolom yang berubah pasca create adalah `total_reward_distributed`, yang diubah eksklusif oleh server saat agent berhasil complete (bukan oleh provider). |
| DB access tertutup | Semua akses ke database wajib melalui Express — tidak ada endpoint Supabase publik yang dibuka |
| API Key per user | Setiap API key terikat ke satu user (wallet). Generate hanya bisa lewat JWT user. Satu user maksimal satu key aktif — regenerate me-revoke key lama otomatis. |
| API Key storage | Plaintext key tidak pernah disimpan — hanya SHA-256 hash + 8-char prefix. Plaintext cuma muncul di response saat generate, lookup pakai prefix + constant-time compare. |
| Agent bertindak atas nama user | Pada endpoint agent, `user_id` di-resolve dari API key — tidak boleh dikirim di body. Agent tidak bisa join/complete atas nama user lain. |
