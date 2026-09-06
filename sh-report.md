# Governance & Routing Rewrite — `sh/governance-rewrite`

Consolidated the playground/governance split into one production Bedrock flow: connect AWS → set allow-list/guardrails → prompt gets profiled + governed + routed to top 3 models → rank #1 auto-invoked, rank #2/#3 manual retry only. No fake/simulated responses anywhere anymore.

## Backend
- New strict `/api/prompt/route` contract (prompt, guessed/retry Bedrock model ID in; text, top-3 recommendations, `invocation_error` out)
- Model registry + mapping rebuilt from live AWS data (`ListFoundationModels` + Price List API), not assumptions
- Governance allow-list now uses real Bedrock model IDs instead of internal friendly IDs
- Governance evaluate/record split so profile-only previews don't consume throttle quota
- Removed the simulated-invoke fallback entirely — fails honestly instead of faking a response

## Frontend
- `GovernancePage` rewritten around one action — Route & Invoke — with guessed-model comparison and manual retry buttons on rank #2/#3
- Markdown-rendered responses (`react-markdown` + `remark-gfm`)
- Model Registry page grouped by provider with brand-style icon marks, clickable as filters
- `PlaygroundPage` removed; `/playground` now redirects to `/governance`

## 7 real bugs found & fixed
(not hypothetical — each reproduced before the fix and re-verified after)

1. **Retired Bedrock model IDs still wired in** — three Anthropic model IDs the app depended on no longer exist in Bedrock's real catalog; any invoke would've failed outright
2. **Anthropic invokes missing inference-profile prefix** — cross-region prefixing only covered Meta Llama; every current-gen Claude model needs it too
3. **Guardrails "Save" was a silent no-op** — allow-list saved under a key/value type the backend no longer read
4. **Empty allow-list returned 403 instead of 400** — allow-list check was tangled into the generic enforce-block path
5. **Mistral pricing 10x wrong, wrong model IDs** on Mistral Large and both Llama 4 variants — corrected against real Price List API data
6. **`backend/.env` silently ignored** — `python-dotenv` was a declared dependency, never actually called; real AWS creds were invisible to the running server
7. **Invocation failure crashed the whole page** — `tokens_used !== undefined` doesn't catch `null`, which is exactly what the backend sends on a failed invoke

## Independent audit + follow-up fixes
Had a fresh Claude instance (no memory of this branch's work) audit it cold for production reliability. Verdict: **reliable for a single-instance/internal deployment, not for scaled multi-user production as-is.** Full findings in `extended-plan.md`. It also caught something real:

8. **Bug #3's fix was incomplete** — `GovernancePage.tsx` still had 4 hardcoded `fetch('http://localhost:8000/...')` calls bypassing the app's configurable API URL, so guardrails would silently fail to load/save anywhere frontend and backend aren't on the same machine. Fixed properly this time (routed through `apiService.ts`), re-verified live with network logging (3/3 saves return 200).

Also fixed from the same audit pass: CORS was misconfigured (`"*"` mixed with explicit origins + credentials), and `uvicorn`'s `reload=True` was hardcoded instead of env-gated.

## Verification
- 27/27 backend tests passing, clean `tsc`, clean production build — re-checked at every step, not just at the end
- Real IAM role created and verified in AWS account `108839616732` (assume-role + list-models confirmed before handoff)
- Full pipeline run live end-to-end against that real connection: governance → profiling → routing → invoke attempt
- The page-crash bug (#7) and the guardrails-save bug (#8) were both reproduced live in a browser against the real connection before being fixed, then re-verified after

## Open item — not code
AWS account `108839616732` needs Bedrock **model access** enabled in the console (Bedrock → Model access). This is separate from IAM permissions and can't be toggled via API for most providers. Confirmed account-wide by testing Claude, Llama, and Mistral separately — all three hit the identical `Operation not allowed` error.

## Further reading
- `gap.md` — review of the routing/ranking algorithm itself: one real scoring bug (over-provisioned models score higher than exact tier matches), one edge-case gap in tier-relax logic, and a design gap around fallback-provider diversity
- `extended-plan.md` — prioritized roadmap to real multi-user production (real auth, deployment artifacts, multi-instance state, live pricing pipeline, remaining test gaps)

---
Branch: `sh/governance-rewrite` · Repo: `Capstone-82/Profiling_Routing`
