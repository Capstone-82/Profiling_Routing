# Extended Plan — Path to Real Production

Everything below is scoped from what's actually been found in this codebase (the continuity audit, the independent production-reliability audit, and gaps flagged but never built by earlier work) — not generic best-practice padding. Grouped by what breaks first if ignored.

## P0 — Blocks real deployment (do before anyone but the team touches it)

### 1. Real authentication
**What:** `X-User-ID` is a client-supplied header today — no verification against a session/JWT. Anyone who can reach the API can act as any org: read/change their governance rules, invoke Bedrock through *their* connected AWS role.
**Fix:** Verify the real Supabase JWT server-side (FastAPI dependency that validates the token and extracts `user.id` from it) instead of trusting the header. Every route in `prompt.py`, `governance.py`, `connection.py` needs this dependency.
**Why now:** This is the one finding from the audit that's an actual security hole, not a scaling limitation.

### 2. Deployment artifacts
**What:** No Dockerfile, no CI, no production entrypoint — only `uvicorn --reload` locally.
**Fix:** Minimum: a `Dockerfile` for the backend (flag the ~2-3GB ML dependency footprint, use a CPU-only torch wheel), a `Dockerfile` for the frontend build, and a basic GitHub Actions workflow running `pytest` + `tsc` + `vite build` on every PR. Pick a real deploy target next (ECS/Fargate/Cloud Run — Lambda is not viable given the dependency size and cold-start cost).
**Why now:** Nothing here can go anywhere but a laptop until this exists.

### 3. Multi-instance state
**What:** `ORG_RULES_CACHE` and `ThrottleTracker` in `governance_service.py` are plain in-process Python dicts. With more than one backend replica, governance rule changes and rate/quota limits silently diverge per-replica instead of converging — this isn't "resets on restart," it's "never agrees across instances."
**Fix:** Move both to Supabase (a `request_log` table for throttle counters was already speced in `implementation_plan.md` and never built) or Redis if request volume needs it. `USER_CONNECTIONS` in `connection.py` already does this correctly (Supabase-first, in-memory as a mirror only) — copy that pattern.
**Why now:** This defeats the entire point of governance the moment there's more than one process.

## P1 — Needed before this is a real multi-org product

### 4. Live model registry & pricing (original Task 3, never built)
**What:** `model_registry_v3.json` is a hand-maintained static file. It was fixed once this session against real AWS data, but there's no pipeline keeping it current — the next Bedrock model launch or price change goes stale silently.
**Fix:** Supabase `model_registry` table + a scheduled job pulling AWS Price List API + `ListFoundationModels`, with the same "marketplace models aren't in Price List API" caveat already discovered — those need a documented manual-entry fallback, not a silent gap.
**Why now:** This was flagged as an unbuilt task from day one; the registry rebuild this session proved the process works, it just needs to run on a schedule instead of by hand.

### 5. Governance rule completeness
**What:** `moderation` and `io_tokens` rule types exist in the schema but have no evaluation logic. Admin CRUD is missing `PUT`/`DELETE /api/governance/rules/{id}`.
**Fix:** Implement the two missing evaluation branches in `governance_service.evaluate_prompt()`, or formally drop them from the schema if out of scope. Add the missing CRUD endpoints.
**Why now:** Half-implemented governance rule types are worse than absent ones — they look configurable in the UI but silently do nothing.

### 6. Test gaps the audit named specifically
**What:**
- No test exercises `bedrock_invoke_service.py`'s per-model-family request/response translators directly (a bug in the Mistral token-count heuristic, for example, wouldn't be caught)
- No test simulates a real Bedrock `ClientError` (throttling, access-denied) reaching `invoke()` — only a generic `RuntimeError`
- Zero concurrency tests — the multi-instance state bugs (#3) are unverified by the suite
- `model_mapping_service.intersect_candidates()` has a test but is dead code (nothing calls it — `prompt.py` reimplements the same logic inline)
**Fix:** Add the three missing test categories; either wire `intersect_candidates()` into `prompt.py` for real or delete both it and its test.

### 7. Observability
**What:** The routing engine has a real, dangerous silent failure mode: any malformed row in `model_registry_v3.json` (missing `model_id`/`tier`) throws inside `ModelRegistry.__init__`, which `RoutingService.initialize()` catches broadly and falls back to a crude 4-keyword heuristic profiler — for every request, platform-wide, with only a log line marking it.
**Fix:** Add alerting on `routing_ready: false` from `/health`, and validate `model_registry_v3.json` against a schema at startup (fail loud, not silent-degrade) rather than letting one bad row take down real ML routing for everyone.

## P2 — Worth doing, not urgent

### 8. Repo hygiene
- `prompt_profiler.pkl` (42MB) is tracked twice — `backend/app/services/routing/` and the original `backend/prompt_profiling&model_routing/` POC copy. Git LFS or prune the duplicate.
- XGBoost pickle version-mismatch warning fires on every test run — the model was pickled with an older XGBoost than what's installed. Migrate to `Booster.save_model()` format and pin the exact XGBoost version in `requirements.txt` (currently an unbounded `>=`).

### 9. Frontend
- Zero automated tests exist under `frontend/src` — at minimum, cover the null-vs-undefined class of bug found this session (it's exactly the kind of thing a snapshot/unit test catches before it reaches a real user).
- No error boundary — a future uncaught render error will blank the page the same way the `tokens_used` bug did, just from a different cause next time.

### 10. AWS account setup (not code, but blocking real invokes)
Account `108839616732` has never had Bedrock model access enabled in the console — confirmed account-wide across Claude/Llama/Mistral. Nothing here ships a real response until someone with console access flips that on. Track it as a checklist item, not a code task.

---

## Suggested order

1. Auth (P0-1) and deployment artifacts (P0-2) — do these in parallel, they don't touch the same files
2. Multi-instance state (P0-3) — needs auth done first so "which org" is trustworthy before you persist per-org state properly
3. Live registry pipeline (P1-4) and governance completeness (P1-5) — independent of each other, can run in parallel
4. Test gaps (P1-6) — write these alongside whichever of #3/#4/#5 you're touching, not as a separate pass
5. Observability (P1-7), then P2 cleanup whenever there's slack

Branch: `sh/governance-rewrite` · Repo: `Capstone-82/Profiling_Routing`
