# PilotQuests — Quest Ideas (Generated from Byreal Capabilities)

This document proposes quest templates that are feasible given the current Byreal tooling we reviewed:
- `byreal-cli` (Solana Byreal DEX): pools/tokens/TVL queries, swap, wallet/balance management, and CLMM position open/close/claim.
- `byreal-perps-cli` (Hyperliquid perps): market signals, account/positions/orders, open/close positions, leverage, margin modes, TP/SL.

The goal is “open innovation”: generate a menu of quests a provider could publish, then we can pick the first 3–5 for MVP.

## MVP safety principles (important)
- Quests should be **non-speculative** by default (capability proof and safe automation).
- Any value-moving quest (swap/LP) must be bounded by **user-defined caps**.
- Verification should rely on **tx receipt + raw logs**, restricted to **allowlisted program IDs**.

> Perps-related ideas below are included as an optional future category. They must never “decide trades” for users without explicit opt-in and strict limits.

---

## 0) Common quest structure (template)
Each quest should define:
- **Action**: what the agent must do (swap / CLMM / perps order / etc.)
- **Constraints**: max slippage, min notional, allowed programs/routers/markets, max leverage, etc.
- **Verification** (default): tx receipt baseline + store raw logs
- **Success criteria**: explicit, machine-checkable outcome

---

## 1) Solana / Byreal DEX quests (via `byreal-cli`)

### 1.1 Swap quests
1) **Swap exact input (basic)**
   - Example: Swap 3 USDC → SOL
   - Constraints: slippage bps, minOut, allowed route/program allowlist
   - Verify: tx succeeded + swap-related logs present

2) **Swap exact output (target amount)**
   - Example: Get exactly 0.1 SOL using USDC (agent computes input)
   - Constraints: max input, slippage cap
   - Verify: tx + logs + final tokenOut ≥ target

3) **Stable-to-stable rotation**
   - Example: USDC → USDT (or equivalent)
   - Constraints: low slippage cap, route allowlist
   - Verify: tx logs + minimal price impact requirement (optional)

4) **Daily “portfolio rebalance” swap**
   - Example: Keep SOL exposure at 20% by swapping USDC↔SOL
   - Constraints: max notional per run; requires read balances first
   - Verify: tx logs + post-run balance ratio within tolerance

### 1.2 Wallet & balance quests (pre-flight / maintenance)
5) **Wallet health check**
   - Action: fetch wallet address, SOL balance, token balances
   - Verify: off-chain evidence record (no tx)

6) **Dust cleanup**
   - Action: swap small leftover tokens to a base asset (USDC/SOL)
   - Constraints: minimum notional; avoid spam swaps
   - Verify: tx logs + reduced token count / dust threshold met

### 1.3 Pool discovery / analytics quests (read-only)
7) **Find top pools by TVL**
   - Action: query pools and rank by TVL
   - Output: list top N pools + addresses (full strings, no truncation)

8) **APR + risk screening**
   - Action: analyze pool APR & risk; pick “eligible” pools
   - Verify: deterministic scoring output stored as evidence

### 1.4 CLMM / LP position quests
9) **Open a CLMM position (basic)**
   - Action: open a position for a given pool with a defined range
   - Constraints: max deposit, tick range strategy, slippage cap
   - Verify: tx logs + position/NFT address captured

10) **Open a CLMM position (strategy-based)**
   - Examples:
     - “Open a narrow range around current price”
     - “Open a wide range for passive exposure”
   - Constraints: range width rules, max capital, risk score threshold
   - Verify: tx logs + resulting range parameters stored

11) **Close a CLMM position**
   - Action: close position and withdraw liquidity
   - Verify: tx logs + position closed state

12) **Claim fees/rewards**
   - Action: claim accrued fees/rewards for an existing position
   - Verify: tx logs + fee/reward token transfers

13) **LP maintenance: rebalance range**
   - Action: close old range position and open a new one around price
   - Constraints: maximum churn frequency, min fees threshold before rebalance
   - Verify: multiple tx receipts/logs, old position closed + new position created

---

## 2) Hyperliquid Perps quests (via `byreal-perps-cli`)

> Note: this is optional for the Solana-first MVP, but we can offer it as a second “quest category” once the platform plumbing is stable.

### 2.1 Signals → action quests
14) **Signal-based watchlist report**
   - Action: run `signal scan` and store results
   - Verify: deterministic report artifact stored (no tx)

15) **Open a position when a signal triggers**
   - Action: if signal meets threshold, open a small notional position
   - Constraints:
     - max notional, max leverage
     - force explicit market prefix (`main:` vs `xyz:`)
     - minimum notional (Hyperliquid min ~ $10)
   - Verify: order confirmation + position list shows it open

### 2.2 Position management quests
16) **Open position (fixed notional)**
   - Example: Open $20 SOL long at 3x
   - Verify: order result + position shows leverage and liquidationPx

17) **Set/update leverage**
   - Action: set leverage for a coin to X
   - Verify: leverage reflected in position list (or stored as config for next trade)

18) **Set TP/SL on existing position**
   - Action: attach TP/SL orders
   - Verify: `position tpsl` reflects the new orders

19) **Close position (market)**
   - Action: close coin position at market
   - Verify: position list shows size = 0 / not present

20) **Close all positions**
   - Action: emergency flatten
   - Constraints: requires explicit provider/user intent flag
   - Verify: positions list empty after execution

---

## 3) Verification notes (how these quests can be proven)
For MVP we can standardize on:
- **Tx succeeded** (receipt/status) and capture **full tx id/signature** (no truncation)
- **Store raw logs** (Solana logs / CLI JSON output where available)
- When needed: add a second layer:
  - balance diffs for swaps
  - position state for perps (position list / tpsl)
  - CLMM position/NFT existence checks

---

## 4) Picking the first 3–5 MVP quests
Given Solana-first scope, a strong initial set is usually:
1) Swap exact input (USDC → SOL)
2) Swap reverse (SOL → USDC)
3) Open CLMM position (basic)
4) Claim fees/rewards
5) Close CLMM position

We can refine these into concrete quest specs once you confirm the desired tokens, pools, and constraints.
