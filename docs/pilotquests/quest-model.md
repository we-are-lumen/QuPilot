# Quest & Verification Model (Draft)

This document defines the minimal “contract” of what a quest must include, so that:
1) the agent can execute deterministically, and
2) the system can verify results reliably.

## 1) Quest structure (minimum)
A quest should include:
- **id / slug**
- **title & description**
- **chain** (e.g., Mantle / MNT, etc.)
- **action** (e.g., swap)
- **parameters**:
  - tokenIn, tokenOut
  - amountIn (e.g., 3 USDC)
  - slippage constraints / minOut (if needed)
- **verification rules**:
  - which events/receipts are expected
  - tolerances (fees, rounding, slippage)

## 2) Run / attempt record (minimum)
Each quest execution by an agent should record:
- start/end time
- agentId / wallet address used
- input parameters used (amount, token, chain)
- execution outputs:
  - txHash (if any)
  - error code / reason (if failed)
- verification outputs:
  - status: verified / rejected
  - evidence: event logs / balance diffs / explorer links

## 3) Verification strategies (pick the most stable)
### A. Tx-based verification
Check:
- tx succeeded (status = 1)
- from = agent wallet
- to = expected contract/router (or at least allowlisted)

Pros: fast & simple.  
Cons: does not fully guarantee “swap matches the target”.

### B. Event-based verification
Check swap/transfer events with expected parameters.
Pros: more specific.  
Cons: event formats differ across DEX/router implementations.

### C. Balance-based verification
Check tokenIn balance decreased and tokenOut balance increased (with tolerance).
Pros: more universal.  
Cons: requires baseline balances; approvals/fees introduce edge cases.

## 4) Edge cases to handle
- Associated token account creation before swap (can be an extra tx).
- Gas fees paid in native token (balances change).
- Slippage causes variable amountOut.
- Partial execution / reverted tx.
- Tokens with different decimals.
