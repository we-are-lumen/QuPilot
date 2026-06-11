# Skill Benchmark: qupilot-quest-runner

**Model**: claude-sonnet-4.6
**Date**: 2026-05-23T17:30:00Z
**Evals**: 1, 2, 3 (1 run each per configuration)

## Summary

| Metric | With Skill | Without Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 100% ± 0% | 51% ± 23% | +0.49 |
| Time | 81.3s ± 8.2s | 59.7s ± 12.4s | +21.7s |
| Tokens | 8167 ± 1256 | 6967 ± 1038 | +1200 |

## Per-Eval Results

| Eval | With Skill | Without Skill | Delta |
|------|-----------|---------------|-------|
| 1 — list-and-recommend | 6/6 (100%) | 5/6 (83%) | +17% |
| 2 — execute-swap-quest-end-to-end | 11/11 (100%) | 4/11 (36%) | +64% |
| 3 — handle-unknown-action-kind | 6/6 (100%) | 2/6 (33%) | +67% |

## Key Findings

- **With skill**: Perfect score across all 3 evals. The skill correctly teaches x-api-key auth, `/agent/participations` endpoint, flat `{ tx_hash }` completion body, synchronous verification (no polling), and fail-closed behavior on unknown action kinds.
- **Without skill (eval-1)**: Only failure is auth header (Authorization: Bearer vs x-api-key). Baseline handles recommendation logic well.
- **Without skill (eval-2)**: Invents wrong endpoints (`/quests/:id/claim`, `/quests/:id/complete`), uses `claim_token` + nested proof body, polls after synchronous complete. Core API contract entirely wrong.
- **Without skill (eval-3)**: Claims the unknown quest instead of stopping, no knowledge of quest-mapping.md, no extension path guidance.
