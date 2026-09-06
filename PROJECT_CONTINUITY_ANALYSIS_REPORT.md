# PROJECT CONTINUITY ANALYSIS REPORT

Analysis performed read-only. No source files, configuration, or dependencies were modified in the course of this review. Test suite execution (`pytest`) was attempted for verification purposes only — non-destructive.

---

## 1. Executive Summary

This is an **AI Profiling & Routing Platform**: an enterprise "AI governance" control plane that lets an organization connect its own AWS account, discover which Bedrock foundation models it has enabled, define policy guardrails (allowed models, context-window limits, rate/token throttles), and then send prompts through a pipeline that: (1) checks governance policy, (2) profiles the prompt's complexity/domain/intent using a trained ML model, (3) picks the cheapest model that satisfies quality/capability requirements from the organization's allowed pool, (4) dispatches the request to AWS Bedrock using the organization's own IAM role, and (5) falls back automatically to the next-best model if the first choice fails.

**Current state:** far more complete than a typical "in-progress" continuity handoff. Two commits (`baa9263`, `25f210d`, both authored by **Mohammed Musharraf**) already implemented essentially the entire `implementation_plan.md` proposal — the routing engine, governance service, Bedrock dispatch, and frontend wiring all exist and are integrated end-to-end, not just stubbed. The one significant piece of the original spec that is **not** implemented is Task 3 from `team_task_specs.md` — a live, Supabase-backed Model Registry with AWS Price List API pricing sync; a static local JSON file is used instead. Governance also has two rule types (`moderation`, `io_tokens`) defined in schema but never evaluated, and admin CRUD lacks update/delete endpoints.

## 2. Project Objective

**Business objective:** Give enterprises a single governed entry point for using AI foundation models on AWS Bedrock — so an admin can restrict which models are usable, cap spend/rate, and get automatic cost-optimal routing — without every team re-implementing model selection, IAM plumbing, or per-vendor request formatting themselves.

**Technical objective:** Provide (a) a secure, credential-free connection mechanism to a customer's AWS account (STS `AssumeRole` + `ExternalId`, no static keys stored), (b) a policy engine that evaluates requests against configurable rules in `dry_run` or `enforce` mode, (c) an ML-based prompt profiler that scores semantic complexity/domain/intent and a rules-based router that picks the best model under cost/quality/context constraints, and (d) a dispatch layer that translates the routed model into the correct Bedrock request format per model family, invokes it, and cascades to a fallback model on failure.

**Expected final system:** A user signs up (Supabase Auth) → connects an AWS account via a one-click CloudFormation stack → configures governance guardrails → submits prompts through a Playground UI that shows which model answered, why, at what cost, and whether governance/fallback was involved — with the routing decision and dispatch fully automatic. Vertex AI and Azure Foundry are shown as "coming soon" tiles; only AWS Bedrock is wired for V1, per `team_task_specs.md`.

## 3. Technology Stack

| Layer | Technology | Purpose | Evidence |
|---|---|---|---|
| Frontend | React 18 + TypeScript + Vite | SPA UI, routing, state | [frontend/src/App.tsx](frontend/src/App.tsx), [frontend/package.json](frontend/package.json) |
| Frontend Auth | `@supabase/supabase-js` | Email/password auth, session mgmt, demo-mode fallback | [frontend/src/lib/supabase.ts](frontend/src/lib/supabase.ts), [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx) |
| Frontend Routing | `react-router-dom` | Protected routes, auth/connection guards | [frontend/src/App.tsx](frontend/src/App.tsx) |
| Backend | Python 3.12/3.13 + FastAPI | REST API, request validation, lifespan startup | [backend/main.py](backend/main.py), [backend/pyproject.toml](backend/pyproject.toml) |
| Backend Cloud SDK | boto3 / botocore | STS `AssumeRole`, Bedrock `ListFoundationModels` / `InvokeModel` | [backend/app/services/aws_service.py](backend/app/services/aws_service.py), [backend/app/services/bedrock_invoke_service.py](backend/app/services/bedrock_invoke_service.py) |
| Database | Supabase (Postgres via REST + `httpx`, no ORM) | Per-user `connections` row; governance rules (fallback: in-memory + default templates if table absent) | [backend/app/services/supabase_service.py](backend/app/services/supabase_service.py), [backend/app/services/governance_service.py](backend/app/services/governance_service.py) |
| ML / Routing | sentence-transformers (`BAAI/bge-base-en-v1.5`), XGBoost, scikit-learn, PCA/KNN, numpy/pandas, tiktoken | Prompt embedding → dimension scoring (`d1`-`d5`) → tier/domain/intent classification → weighted model ranking | [backend/app/services/routing/router.py](backend/app/services/routing/router.py), 42MB `prompt_profiler.pkl` |
| Testing | pytest + pytest-asyncio + FastAPI `TestClient` | Backend route/service tests | [backend/tests/](backend/tests/) (5 files) |
| API | REST, FastAPI routers under `/api/connection`, `/api/prompt`, `/api/governance` | Public contract | [backend/main.py](backend/main.py) |
| Build | Vite (frontend), `uv`/`pip` + `pyproject.toml` (backend) | Dev servers, dependency resolution | [frontend/vite.config.ts](frontend/vite.config.ts), [backend/uv.lock](backend/uv.lock) |
| CI/CD | **None found** | — | No `.github/workflows`, no other CI config in repo |
| Deployment | **None found** for the backend itself | — | No Dockerfile, no Lambda/ECS config; only a CloudFormation template for the *customer's* IAM role |
| Cloud (customer-side) | AWS IAM, STS, Bedrock, CloudFormation | Cross-account access the platform assumes into | [backend/cloudformation/bedrock-role-template.yaml](backend/cloudformation/bedrock-role-template.yaml) |

## 4. Repository Structure

```
Profiling_Routing/
├── README.md                       Setup instructions, feature list, API table
├── team_task_specs.md              Original 4-task spec (Bedrock V1 scope)
├── implementation_plan.md          A teammate's own prior analysis + proposal — now (mostly) implemented
├── frontend/
│   └── src/
│       ├── components/auth/        Sign in/up/forgot/reset forms + brand panel
│       ├── components/connections/ AWS Bedrock connect + Role ARN + test flow
│       ├── components/playground/  Prompt entry, auto/legacy toggle, response panel
│       ├── components/governance/  Guardrails config modal, profile+route testing UI
│       ├── components/models/      Read-only model catalog browser
│       ├── context/AuthContext.tsx Supabase session state, demo-mode adapter
│       ├── services/apiService.ts  Typed fetch wrappers to FastAPI backend
│       ├── services/mock/mockService.ts  Backend-first, mock-fallback service layer
│       └── types/index.ts          Shared request/response TypeScript contracts
└── backend/
    ├── main.py                     FastAPI app, CORS, lifespan (loads ML model), routers
    ├── app/
    │   ├── config.py                Settings (env-driven, with defaults — see Risk #1)
    │   ├── schemas.py                Pydantic request/response models
    │   ├── routes/{connection,prompt,governance}.py
    │   └── services/
    │       ├── aws_service.py            ARN validation, AssumeRole+ListFoundationModels
    │       ├── supabase_service.py        REST persistence for `connections`
    │       ├── governance_service.py      Rule evaluation, in-memory throttle tracker
    │       ├── model_mapping_service.py   Friendly-ID ⇄ Bedrock-ID mapping, catalog
    │       ├── bedrock_invoke_service.py  Per-model-family request/response translation
    │       ├── routing_service.py         Singleton facade over the ML router (+ heuristic fallback)
    │       └── routing/                   Copied-in ML engine (features.py, router.py, routing_models.py,
    │                                       model_registry_v3.json, prompt_profiler.pkl [42MB])
    ├── prompt_profiling&model_routing/    Original POC copy of the same engine (duplicate, still tracked)
    ├── cloudformation/bedrock-role-template.yaml
    └── tests/  test_connection.py, test_governance.py, test_model_mapping.py,
                test_prompt_route.py, test_routing_service.py
```

## 5. Requirements

Requirements are drawn from `team_task_specs.md` (original 4-task spec) plus the governance/routing/invoke work documented in `implementation_plan.md`.

| ID | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| R001 | Supabase email/password auth + demo-mode fallback | High | **COMPLETE** | [AuthContext.tsx](frontend/src/context/AuthContext.tsx), [AuthForms.tsx](frontend/src/components/auth/AuthForms.tsx) |
| R002 | Connections page, 3 provider tiles (Bedrock live, Vertex/Azure "coming soon") | High | **LIKELY COMPLETE** — Bedrock tile flow fully read; Vertex/Azure disabled-tile presence not visually confirmed (file only partially read) | [ConnectionsPage.tsx](frontend/src/components/connections/ConnectionsPage.tsx) |
| R003 | AWS Bedrock connection: AssumeRole+ExternalId, ListFoundationModels, Supabase persistence | High | **MOSTLY COMPLETE** — one spec detail missing (see Gap Analysis) | [aws_service.py](backend/app/services/aws_service.py), [connection.py](backend/app/routes/connection.py) |
| R004 | Model Registry & Pricing Cache: Supabase `model_registry` table, AWS Price List API sync (monthly + lazy on-demand) | High | **NOT STARTED** — static local JSON substituted, no live pricing pipeline | No `model_registry` Supabase table or Price List API call found anywhere in repo |
| R005 | Request Translation, Dispatch, Throttling, Fallback (Task 4) | High | **COMPLETE** | [bedrock_invoke_service.py](backend/app/services/bedrock_invoke_service.py), [prompt.py](backend/app/routes/prompt.py) |
| R006 | Governance: allow-list, context-window, throttle rules, `dry_run`/`enforce` modes | High | **PARTIALLY COMPLETE** — 3 of 5 spec'd rule types evaluated; throttle state is in-memory, not the `request_log` table the plan specified | [governance_service.py](backend/app/services/governance_service.py) |
| R007 | Governance: moderation, io\_tokens rule types | Medium | **NOT STARTED** — schema fields exist, no evaluation logic | [schemas.py](backend/app/schemas.py) vs [governance_service.py](backend/app/services/governance_service.py) |
| R008 | Governance admin CRUD (GET/POST/PUT/DELETE rules) | Medium | **PARTIAL** — GET + POST (upsert) + defaults implemented; PUT/DELETE missing | [governance.py](backend/app/routes/governance.py) |
| R009 | ML Prompt Profiling (embeddings → dimension scores → domain/intent/tier) | High | **COMPLETE**, with heuristic fallback if ML artifacts fail to load | [router.py](backend/app/services/routing/router.py) |
| R010 | Friendly-ID ⇄ Bedrock-model-ID mapping + triple intersection (connected ∩ allow-list ∩ user selection) | High | **COMPLETE** | [model_mapping_service.py](backend/app/services/model_mapping_service.py), tested |
| R011 | Frontend Auto-Route vs Manual/Legacy toggle | Medium | **UI COMPLETE, BACKEND NOT WIRED** — see Gap Analysis | [PlaygroundPage.tsx](frontend/src/components/playground/PlaygroundPage.tsx) vs [prompt.py](backend/app/routes/prompt.py) |
| R012 | Backend deploy config (Dockerfile/IaC) | Medium | **NOT STARTED** — explicitly flagged as unresolved in `implementation_plan.md` itself | No Dockerfile/IaC found |

No requirement here is marked COMPLETE purely because a same-named file exists — each was checked by reading the actual logic and, where practical, correlating with a passing/failing test.

## 6. Current Implementation

The platform is functionally a real, working pipeline, not a scaffold:

- **Auth** — real Supabase session handling with a parallel local "demo mode" (works without any Supabase project configured), in [AuthContext.tsx](frontend/src/context/AuthContext.tsx).
- **Connection** — `POST /api/connection/test` does a genuine `sts:AssumeRole` → `bedrock:ListFoundationModels` call, classifies models by context window/category heuristically, and persists to Supabase (or an in-memory dict per-process if Supabase is unreachable). Verified by `backend/tests/test_connection.py`, which mocks the boto3 clients rather than hitting real AWS.
- **Governance** — `GovernanceService.evaluate_prompt()` runs context-window, throttle, and allow-list checks against rules loaded from Supabase (or seeded defaults), with a genuine in-process sliding-window throttle tracker (`ThrottleTracker`).
- **Routing** — `RoutingService` is a singleton warmed at FastAPI `lifespan` startup: it loads a 42MB pickle bundle (PCA + scaler + KNN + per-dimension XGBoost heads + label encoders) and a `BAAI/bge-base-en-v1.5` sentence-transformer, then scores prompts across 5 dimensions, resolves a tier (T1/T2/T3) with confidence-based escalation, filters the model registry by governance allow-list/context/capability, and ranks survivors with an explainable weighted score (quality/capability/context/reliability/latency/cost). If ML artifacts fail to load, it falls back to a keyword-heuristic profiler rather than crashing.
- **Dispatch** — `BedrockInvokeService` builds the correct request body per model family (Anthropic Messages API, Amazon Nova, Meta Llama chat-template, Mistral instruct-template), calls `bedrock-runtime.invoke_model`, and even auto-retries with a cross-region inference-profile ID (`us.`/`eu.` prefix) if AWS rejects a Llama call needing one. `/api/prompt/route` cascades Rank 1 → Rank 2 → Rank 3 on invocation failure.
- **Frontend** — Playground and Governance pages both call the real `/api/prompt/route` and `/api/prompt/profile` endpoints, render governance evaluation badges, the 5-dimension complexity breakdown, routing reasons, fallback banners, and cost/latency/token footers. When the backend is unreachable, `mockService.ts` degrades gracefully to a client-side simulated response rather than erroring.
- **No real Bedrock invocation is required to demo the system**: if `role_arn` is missing/unverified, `BedrockInvokeService.invoke()` returns a labeled simulated response instead of raising, so the whole governance→profile→route pipeline is testable without any AWS account connected.

## 7. Team Implementation / Existing Contributions

Git history shows exactly two committing identities. Ownership below is stated only where the commit log directly supports it.

| Existing Work | Likely Owner/Source | Files (representative) | Purpose | Status | Dependency on My Work |
|---|---|---|---|---|---|
| Initial React scaffold, UI component kit, auth forms | `bilalinbytes` (`514990a`, `first commit`) | `src/components/**`, `src/context/AuthContext.tsx` | Bootstrapped the SPA | Complete (superseded by later restyle) | Low — mostly restyled since |
| Monorepo restructure (`frontend/`+`backend/`), FastAPI backend skeleton, `connections` table design | Mohammed Musharraf (`2d4bf6d`) | `backend/**` (new), `README.md` | Introduced Python backend, AWS connection flow v1 | Complete | Foundation for everything else |
| CoreStack enterprise design system, Bedrock UI flow, model dropdown | `bilalinbytes` (`a763d86`) | `AuthForms.tsx`, `BrandPanel.tsx`, `PlaygroundPage.tsx`, `index.css` | Visual redesign, brand system | Complete | Low |
| Full profiling/routing/governance/invoke integration (matches `implementation_plan.md` almost file-for-file) | Mohammed Musharraf (`baa9263`) | `app/services/routing/**`, `governance_service.py`, `bedrock_invoke_service.py`, `model_mapping_service.py`, `routes/prompt.py`, `routes/governance.py`, all 5 test files, `implementation_plan.md` itself | Delivered Tasks 3(partial)/4 + new governance layer | Mostly complete (gaps noted in §12) | **High** — this is almost certainly the baseline any further task builds on |
| Refinements to routing/invoke/mapping, large GovernancePage rewrite, frontend type updates | Mohammed Musharraf (`25f210d`, latest, same day as this analysis: 2026-09-06) | `routes/prompt.py`, `bedrock_invoke_service.py`, `model_mapping_service.py`, `GovernancePage.tsx`, `PlaygroundPage.tsx` | Polish pass on the above | Complete | Same as above |

Author/owner of any *unassigned remaining scope* (i.e., what belongs to the user of this report, `preethu@gsstech.in`) **cannot be determined from repository evidence** — no commits under that identity exist yet, and neither `team_task_specs.md` nor `implementation_plan.md` names individual owners. See §20.

## 8. Architecture

```
User (browser)
   │
   ▼
React SPA (Vite)
   ├─ AuthContext ── Supabase Auth (or local demo-mode fallback)
   ├─ ConnectionsPage ── apiService → /api/connection, /api/connection/test
   ├─ PlaygroundPage ── mockService.sendPrompt() → apiService → /api/prompt/route (fallback: client-side mock)
   ├─ GovernancePage ── /api/governance/rules (CRUD), /api/prompt/profile, /api/prompt/route
   └─ ModelsPage ── /api/prompt/catalog (read-only)
   │  (all requests carry an `X-User-ID` header = Supabase user.id)
   ▼
FastAPI backend (CORS: allows "*", see Risk)
   ├─ /api/connection  → aws_service (STS AssumeRole → Bedrock ListFoundationModels)
   │                    → supabase_service (persist per-user `connections` row)
   ├─ /api/prompt
   │     ├─ governance_service.evaluate_prompt()   [context_window, throttle, allow_list]
   │     ├─ connection lookup (verified Bedrock-enabled models)
   │     ├─ model_mapping_service.intersect_candidates()  [connected ∩ governance allow-list]
   │     ├─ routing_service.route()  → ML profiler (sentence-transformer + XGBoost heads)
   │     │                            → weighted ranking over local model_registry_v3.json
   │     └─ bedrock_invoke_service.invoke()  [Rank1 → Rank2 → Rank3 cascade on failure]
   └─ /api/governance  → governance_service (rule CRUD; Supabase-backed, in-memory cache/fallback)
   │
   ▼
Supabase (Postgres via REST/httpx) ── `connections` table (confirmed via README DDL)
                                     ── `governance_rules` table (DDL only in implementation_plan.md;
                                        app degrades to in-memory defaults if table/env absent)
   │
   ▼
AWS (customer account, assumed via STS) ── Bedrock ListFoundationModels / InvokeModel
```

Entry points: `backend/main.py` (FastAPI `lifespan` warms the ML singleton at process start); `frontend/src/main.tsx` → `App.tsx` (route guards: `RequireAuth`, `RequireConnection`). Business logic lives entirely in `app/services/*`; routes are thin. No ORM, no migration tool — Supabase is accessed purely via REST calls with hand-built payloads, so schema drift between code and the actual Supabase project would fail silently into the various "table not found → fall back to defaults" branches rather than raising.

## 9. Major Workflows

| Workflow | Input | Processing | External Dependency | Output | Error Handling |
|---|---|---|---|---|---|
| Sign up / Sign in | email, password | Supabase Auth call, or local demo-mode user object | Supabase Auth API (optional) | `AuthUser{id, email}` in context | Mapped human-readable errors (`mapAuthError`); network failure suggests demo mode |
| Connect AWS Bedrock | Role ARN pasted by user | Regex-validate ARN → STS AssumeRole → Bedrock ListFoundationModels → classify models → persist | AWS STS/Bedrock, Supabase | `ConnectionResponse{status, availableModels}` | Distinguishes AccessDenied/InvalidParameterValue/BotoCoreError/malformed-ARN, each with a specific message |
| Configure Guardrails | allow-list, token/rate limits (Governance modal) | 3 parallel `POST /api/governance/rules` upserts | Supabase (or in-memory cache) | Save confirmation | Generic catch-all error banner on any fetch failure |
| Send Prompt (auto-route) | prompt text, optional preferred model | governance check → candidate intersection → ML routing → rank1→2→3 dispatch → normalize | Supabase, AWS Bedrock (or simulated) | `ModelResponse` with text + full routing/governance metadata | 403 (governance enforce-block), 400 (no candidates), 422 (no recommendations pass filters), 502 (all ranked models failed invoke) |
| Profile Only | prompt text | governance check → candidate intersection → ML routing (no invoke) | none (AWS not called) | `ProfileOnlyResponse` (profile + recommendations + rejections) | Same governance error surface as above, no invoke-layer errors possible |

Unclear/partially-broken flow: **Manual/Legacy routing mode.** The frontend sends `mode` and `selectedModelIds`/`preferredModelId`, but `route_and_invoke_prompt()` in `prompt.py` explicitly ignores them for candidate restriction (comment: *"We do NOT restrict routing to the user's manual selection — router always picks optimal model from allowed pool"*) — it only uses the preferred model to build a `comparison_insight` display string. So selecting "Manual/Legacy Mode" in the Playground UI does not force that model to be invoked; the router still auto-selects. This may be an intentional design choice (comparison/benchmark mode) or an unfinished piece of R011 — worth confirming with the plan's author before treating it as a bug.

## 10. Testing Status

| Area | Existing Tests | Coverage/Confidence | Missing Tests |
|---|---|---|---|
| Connection (`/api/connection/*`) | `test_connection.py` — ARN validation, mocked STS/Bedrock success & failure, full API flow | Good — mocks boto3 directly, doesn't hit real AWS | "already-verified row refresh, not duplicate" edge case not directly tested |
| Governance | `test_governance.py` — context_window enforce-block, throttle dry_run | Moderate — only 2 of 3 implemented rule types tested | allow_list rule evaluation untested; moderation/io_tokens N/A (unimplemented) |
| Model mapping | `test_model_mapping.py` — friendly↔Bedrock lookups, catalog size, triple-intersection logic | Good | Fuzzy-match fallback paths (version-suffix variants) only partially exercised |
| Prompt routing (integration) | `test_prompt_route.py` — catalog, profile-only, route+invoke (simulated), governance defaults | Shallow — asserts response shape/keys exist, not specific routing correctness | Fallback cascade (rank1 failure → rank2) never tested; per-model-family request/response translators in `bedrock_invoke_service.py` have **zero direct unit tests** |
| Routing service | `test_routing_service.py` — one end-to-end profile+rank call | Minimal — single prompt, no edge cases (empty prompt, all-models-rejected, low-confidence escalation) | Tier escalation logic, quality-floor rejection, near-tie warning path |
| Frontend | **None found** | None | No test files anywhere under `frontend/src` |

**Testing-environment finding (Phase 8):** dependencies from `requirements.txt` (`fastapi`, `boto3`, `torch`, `xgboost`, `sentence-transformers`, etc.) are importable in the currently active Python 3.12 environment on this machine, but **`pytest` itself is not installed** in that same environment. This means `uv run pytest -v` (per the README) has not been verifiably run/passed here recently — current pass/fail status of the suite is **UNKNOWN**, not confirmed-green.

## 11. Incomplete / Missing Work

Distinguishing genuine gaps from acceptable placeholders:

- **Actual project blocker candidate:** Task 3 (live Model Registry & Pricing Cache via AWS Price List API, Supabase `model_registry` table, monthly + lazy refresh) — not started at all. Routing currently works off a static, manually-maintained `model_registry_v3.json`, which is fine for a demo but means pricing/model-availability data goes stale with no update mechanism.
- **Technical debt / architecture divergence:** Throttle counters live in an in-process Python dict (`ThrottleTracker`), not the `request_log` Supabase table the plan specified — resets on every server restart and won't work correctly across multiple backend instances/replicas.
- **Incomplete feature, not blocking demo:** `moderation` and `io_tokens` governance rule types are defined in Pydantic schemas and the DB DDL comment block but have no evaluation branch in `GovernanceService.evaluate_prompt()`.
- **Incomplete admin surface:** `governance.py` has `GET /rules`, `POST /rules` (upsert), `GET /defaults` — no `PUT /rules/{id}` or `DELETE /rules/{id}`, both specified in `implementation_plan.md`.
- **Possible intentional deferral, needs confirmation:** Manual/Legacy routing mode toggle exists in the UI but isn't enforced server-side (see §9).
- **Known, previously-flagged, still unresolved:** No Dockerfile/IaC/CI for the backend — `implementation_plan.md` itself raised this as an open question and it was never answered or acted on.
- **Repo hygiene, previously flagged, still unresolved:** `prompt_profiler.pkl` (42MB) is tracked **twice** — once under `backend/prompt_profiling&model_routing/` (original POC copy) and again under `backend/app/services/routing/` (the "production" copy) — 84MB total, plus a 10,640-row `dataset_final.csv` and a 7,051-line `notebook.ipynb`, all committed to git. `implementation_plan.md` recommended `.gitignore` + Git LFS; neither was done.
- **Not a blocker, intentional per code comments:** Legacy `prompt_profiling&model_routing/` directory is explicitly described as "training-only artifacts that should be excluded at deploy time" — currently has no deploy-exclusion mechanism since there's no deploy pipeline at all yet.
- **Security-relevant, not merely a TODO:** see Risk table, item 1 (hardcoded Supabase URL/key defaults).

No `TODO`/`FIXME`/`NotImplemented` markers were found in any `.py` or `.tsx` source file (only one hit, inside a Jupyter notebook, irrelevant to runtime code) — this codebase does not signal its gaps inline; they only surface by comparing implementation against the two spec documents.

## 12. Gap Analysis

| Area | Expected (per specs) | Current State | Gap | Required Action |
|---|---|---|---|---|
| Model Registry & Pricing | Supabase `model_registry` table, AWS Price List API, monthly cron + lazy per-model refresh | Static `model_registry_v3.json`, no DB table, no Price List API call | Full Task 3 not implemented | Design + build the Supabase table, Price List API ingestion, and refresh triggers |
| Throttle persistence | Supabase `request_log` table, queryable across instances | In-process Python dict, per-server-instance | Not horizontally scalable, resets on restart | Move counters to Supabase or a shared store if multi-instance deploy is planned |
| Governance rule types | 5 types: allow_list, throttle, context_window, moderation, io_tokens | 3 of 5 evaluated | moderation/io_tokens are inert | Implement evaluation branches or explicitly descope them |
| Governance admin API | Full CRUD (GET/POST/PUT/DELETE) | GET + POST (upsert) + GET defaults only | No update-by-id or delete | Add `PUT`/`DELETE /rules/{id}` |
| Connection first-login behavior | Auto-create `connections` row with `status=pending` on first login | Row only created on first `Test Connection` call | Minor behavioral gap | Confirm whether this matters for the UI's "not connected" vs "pending" distinction, or is acceptable as-is |
| Manual/Legacy routing mode | Spec (Q1 in `implementation_plan.md`) recommended a toggle where legacy mode uses the manually chosen model | UI toggle exists; backend always auto-routes regardless of mode | Functional mismatch between UI intent and backend behavior | Needs a product decision + code fix if legacy mode is meant to bypass auto-routing |
| Deploy/CI | None specified yet, but flagged as needed before production use | No Dockerfile, IaC, or CI config | Full gap, previously flagged, unresolved | Scope as a separate task once functional work stabilizes |
| Secrets hygiene | `.env`-only credentials (per `.gitignore` intent) | Real-looking Supabase URL + anon key hardcoded as Python default values in `config.py` | Committed secret-like value | Flag to project owner; rotate/remove default if it is a live key |

## 13. My Expected Responsibility

**Confirmed directly by the user (2026-09-06):** all three candidate gap areas identified in this analysis are assigned. Git history still shows no commits under `preethu@gsstech.in`, and neither spec document names individual owners in writing — this scope confirmation comes from the user, not from repository evidence.

### MUST DO (confirmed scope)
1. **Task 3 — Model Registry & Pricing Cache.** Build the Supabase `model_registry` table + AWS Price List API ingestion (monthly scheduled + lazy on-demand refresh when a requested model's row is missing or >1 month stale), replacing the static `model_registry_v3.json` as the source of truth for `cost_in`/`cost_out`/capability fields that `ModelRegistry`/`ModelRouter` consume.
2. **Governance completeness.**
   - Implement `moderation` and `io_tokens` rule-type evaluation branches in `GovernanceService.evaluate_prompt()` (currently only `context_window`, `throttle`, `allow_list` are evaluated).
   - Add `PUT /api/governance/rules/{id}` and `DELETE /api/governance/rules/{id}` to `governance.py` (currently only GET/POST-upsert/GET-defaults exist).
   - Migrate throttle counters off the in-process `ThrottleTracker` dict onto a persisted Supabase `request_log` table (per `implementation_plan.md`'s original design), so limits survive restarts and work across multiple backend instances.
3. **Manual/Legacy routing mode fix + tests.**
   - Resolve the mismatch in §9/§12: the Playground UI's "Manual/Legacy Mode" toggle sends `mode`/`selectedModelIds`, but `route_and_invoke_prompt()` in `prompt.py` ignores them for candidate restriction and always auto-routes. Needs a decision (confirm intended behavior, likely: legacy mode should force-invoke the chosen model, bypassing the router) then a fix in `prompt.py`.
   - Add the missing tests flagged in §10: unit tests for `bedrock_invoke_service.py`'s per-model-family request/response translators (Anthropic/Nova/Llama/Mistral), an integration test for the rank1→rank2 fallback cascade, and a test for the fixed legacy-mode behavior.

### SHOULD DO
- Resolve the pkl/CSV/notebook repo bloat (Git LFS or exclude from tracking) — already flagged once in `implementation_plan.md` and never fixed. Touches repo hygiene, not application behavior — sequence this after the MUST-DO items, or whenever convenient.

### NICE TO HAVE (out of confirmed scope, flag if blocking)
- Backend Dockerfile / IaC / CI pipeline.
- Frontend test coverage (currently zero).
- Hardcoded Supabase default values in `config.py` — flag to project owner; not yours to silently change since it may point to a shared live project.

This is a genuinely large scope — three largely independent subsystems (pricing pipeline, governance rule engine, routing/dispatch behavior). §16 below sequences them; §14 maps what each depends on so work on one doesn't silently break another.

## 14. Dependencies

| My Task (candidate) | Depends On | Why | Risk |
|---|---|---|---|
| Model Registry & Pricing (Task 3) | `routing_service.py`'s `ModelRegistry` class, `model_registry_v3.json` schema | Whatever table/API you build must produce data in a shape `ModelRouter` already consumes (`cost_in`, `cost_out`, `reasoning_mode`, etc.) | Changing the registry's shape could silently break routing if `ModelRegistry.__init__` isn't updated in lockstep |
| Manual/Legacy mode fix | `prompt.py`'s `route_and_invoke_prompt()`, `model_mapping_service.intersect_candidates()` | Candidate restriction logic lives here; frontend already sends the right fields | Changing candidate-pool logic could affect the auto-route path too if not carefully isolated by `mode` |
| moderation/io_tokens rules | `GovernanceService.evaluate_prompt()`'s per-rule-type loop, `GovernanceRuleConfig` schema | New rule types must slot into the existing evaluation loop and `GovernanceResult` shape the frontend already renders | Frontend governance badges render generically by `rule_type`, so this should be additive/low-risk |
| Governance CRUD completion | `governance_service.save_rule()`, in-memory `ORG_RULES_CACHE`, Supabase upsert pattern | Delete/update must invalidate the cache correctly or stale rules will keep being enforced | Cache invalidation bugs are easy to introduce silently — needs explicit test |
| Throttle persistence migration | `ThrottleTracker` class, `governance_service.throttle_tracker` singleton | Anything reading throttle stats today expects the current in-memory shape | Migrating this while the in-memory version is used by other running tests could break `test_governance.py` |

## 15. Risks

| Risk | Probability | Impact | Severity | Mitigation |
|---|---|---|---|---|
| A real Supabase URL + anon key are hardcoded as default values in `config.py` and committed to git | Confirmed present | Medium (anon key alone is limited by RLS, but still shouldn't be committed) | Medium | Confirm with project owner whether this is a live project; rotate/remove if so; enforce env-only in production |
| CORS is configured to allow `"*"` alongside specific origins in `config.py` | Confirmed present | Medium | Medium | Tighten before any non-local deployment |
| No deploy pipeline exists for a backend that requires ~2-3GB of ML dependencies (torch, sentence-transformers) | Confirmed | High (blocks any real deployment) | High | Was already flagged in `implementation_plan.md`; needs a container-based target (ECS/Fargate/Cloud Run), not Lambda |
| Test suite's actual pass/fail state is currently unverified (pytest not installed in the active environment) | Confirmed | Medium | Medium | Set up the environment per README (`uv run pytest -v`) before relying on "tests pass" as a completion signal |
| Throttle state is per-process and in-memory | Confirmed | Medium (only matters at scale / multi-instance) | Low–Medium | Fine for single-instance/demo; revisit before horizontal scaling |
| Duplicate 42MB ML artifacts + large CSV/notebook committed to git | Confirmed | Low functionally, but repo bloat/slow clones | Low | Git LFS or removal from tracking, as already recommended once |
| Manual/Legacy mode doesn't behave as the UI implies | Confirmed | Medium (user-facing correctness/trust issue) | Medium | Needs explicit product decision, then code fix or UI copy change |
| No CI — regressions in `governance_service.py`/`router.py` could ship unnoticed | Confirmed (absence) | Medium | Medium | Add CI once test environment is confirmed reproducible |

## 16. Proposed Implementation Plan

Scope is confirmed (§13): all three areas — Model Registry & Pricing, Governance completeness, Manual/Legacy mode fix + tests. Recommended sequencing below follows the dependency ordering in §14 (registry work doesn't touch governance/routing internals, so it can run in parallel with the other two; the legacy-mode fix should land after governance CRUD stabilizes since both touch `prompt.py`/`governance_service.py`).

### Step 1 — Reproduce the current environment
Objective: Get `uv run pytest -v` (or `pip install -r requirements.txt` + `pytest`) actually passing locally, so you have a real regression baseline.
Files affected: none (environment only).
Dependencies: `backend/requirements.txt` / `pyproject.toml`.
Expected result: Known-good baseline test run, with actual pass/fail counts.
Tests required: the existing 5 test files.
Risks: torch/sentence-transformers install size (~2-3GB) and long first-run model download.

### Step 2 — Implement each confirmed task in its own isolated pass (Registry → Governance → Legacy-mode)
Objective: Build one task at a time, touching the smallest file set possible (see §14 for what each depends on). Suggested order: Model Registry & Pricing first (fully independent of the other two), then Governance completeness, then the Manual/Legacy mode fix last (touches the same `prompt.py`/`governance_service.py` files governance work does, so land it after governance stabilizes).
Files affected: per §13/§14 table for each specific task.
Dependencies: as listed in §14.
Expected result: New/changed service passes its own new tests without altering existing endpoint contracts.
Tests required: new unit tests specific to each change (e.g., `test_model_registry.py` for Task 3, `test_governance.py` additions for moderation/io_tokens + CRUD, a fallback-cascade + legacy-mode test for the routing fix).
Risks: breaking the `ModelRegistry`/`ModelRouter` contract if touching registry data shape; governance cache-invalidation bugs on CRUD; legacy-mode fix accidentally changing auto-route behavior too.

### Step 3 — Add validation/error handling for each new surface
Objective: Cover edge cases explicitly (e.g., Price List API rate limits/empty responses for Task 3; PUT/DELETE on a nonexistent rule ID for governance CRUD).
Files affected: the service/route touched in Step 2.
Expected result: Explicit, structured errors, not silent failures.
Tests required: negative-path tests.

### Step 4 — Run the full existing suite
Objective: Confirm no regression in connection/governance/routing/prompt tests.
Command: `cd backend && uv run pytest -v`.
Expected result: All prior-passing tests still pass.

### Step 5 — Manual verification against the real UI
Objective: Exercise each change through the Playground/Governance pages, not just curl/pytest.
Expected result: Visual confirmation the change surfaces correctly (per the project's own "Manual Verification" checklist in `implementation_plan.md`, which is a good template to reuse).

### Step 6 — Review your own diff
Objective: Confirm only the intended files changed; no accidental edits to `prompt_profiler.pkl`, `model_registry_v3.json`, or other teammates' files.

### Step 7 — Update documentation
Objective: If you touch `README.md`-documented behavior (endpoints, DDL, setup steps), update it in the same change.

## 17. Files Likely To Be Modified

Dependent entirely on which task from §13 is confirmed as yours. No files should be touched yet.

| File | Why it would change |
|---|---|
| `backend/app/services/routing/router.py` (`ModelRegistry` class) | If Task 3 replaces the static JSON with a live Supabase-backed registry |
| New: `backend/app/services/model_registry_service.py` (or similar) | Home for AWS Price List API ingestion logic, if built |
| `backend/app/services/governance_service.py` | If adding `moderation`/`io_tokens` evaluation, or migrating throttle state |
| `backend/app/routes/governance.py` | If adding `PUT`/`DELETE /rules/{id}` |
| `backend/app/routes/prompt.py` | If fixing Manual/Legacy mode enforcement |
| `backend/tests/*.py` | New tests for whichever of the above is built |
| `README.md` | If new Supabase tables/endpoints are added, to keep setup instructions accurate |
| `backend/.gitignore` / repo tracking | If addressing the pkl/CSV/notebook bloat |

## 18. Testing Plan

1. Before any change: run `cd backend && uv run pytest -v` (after resolving the environment gap in §15) to capture a known-good baseline.
2. For each new capability, add tests **in the same style as the existing suite** — `TestClient` for route-level behavior (see `test_prompt_route.py`), direct service instantiation with mocked externals for unit-level behavior (see `test_connection.py`'s `sts_client=mock_sts` pattern).
3. Explicitly test the negative/edge paths this report identified as untested: allow-list rule evaluation, fallback cascade (rank1 failure → rank2 success), low-confidence tier escalation, empty-candidate-pool routing.
4. Manually verify through the actual running UI (`npm run dev` + `uv run uvicorn main:app --reload`) — not just automated tests — per the project's own precedent in `implementation_plan.md`'s "Manual Verification" section.
5. Re-run the full suite after your change to confirm zero regressions in the 5 existing test files.
6. If you touch anything CORS/secrets-adjacent, do **not** commit any real credentials — confirm `.env` stays gitignored (it already is) and don't put real values as Python defaults (per the risk already present in `config.py`).

## 19. Definition of Done

- Confirmed scope item is fully implemented — no partial branches, no silently-swallowed exceptions on the new code path.
- All 5 existing backend test files still pass (`uv run pytest -v`), plus new tests for the change.
- The change is exercised manually through the actual frontend UI, not just via automated tests.
- No unintended files were modified (verify with `git status`/`git diff` before committing) — in particular, the 42MB `prompt_profiler.pkl` and `model_registry_v3.json` should not show as modified unless that was explicitly the task.
- Any new Supabase table has its DDL documented in `README.md` the same way `connections` already is.
- No new secrets or credentials committed to git.
- `README.md` and/or `implementation_plan.md` updated if your change alters a documented endpoint, table, or setup step.

## 20. Questions / Unknowns

- **UNKNOWN / REQUIRES CLARIFICATION:** Which specific task or scope slice is assigned to you (`preethu@gsstech.in`)? No repository artifact names an owner for remaining work.
- **UNKNOWN:** Whether the `governance_rules` table has actually been created in the real Supabase project — its DDL exists only in `implementation_plan.md`, not in `README.md` alongside the `connections` table DDL. The app "working" without it (due to in-memory fallback) doesn't confirm the table exists.
- **UNKNOWN:** Whether the hardcoded Supabase URL/key in `config.py` point to a live, still-active project, or a decommissioned/test one — matters for how urgently it should be treated as a leaked secret.
- **UNKNOWN:** Whether the Manual/Legacy routing mode's current behavior (auto-route always wins) is intentional (a deliberate "benchmark mode") or an oversight — the original `implementation_plan.md` Q1 recommended the opposite (legacy mode should use the manual selection).
- **UNKNOWN:** Current pass/fail state of the backend test suite in a properly provisioned environment — not verified in this session (pytest missing from the active Python environment; installing it was avoided per this analysis's read-only mandate).
- **UNKNOWN:** Whether `ConnectionsPage.tsx`'s Vertex AI / Azure Foundry tiles are actually rendered as disabled "coming soon" placeholders as `team_task_specs.md` requires — only the first 120 of the file's ~660 lines were reviewed.

## 21. Recommended Next Action

Scope is now confirmed (§13: Model Registry & Pricing, Governance completeness, Manual/Legacy mode fix + tests). The single safest next action is **Step 1 of §16** — get the local environment reproducible (`pytest` installed, full suite actually run) so you have a real, verified baseline before any of the three implementation tasks begin. Everything after that follows the sequencing in §16.
