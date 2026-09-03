# Integrate Prompt Profiling + Model Routing + Governance Rules

## Background

The current codebase is a FastAPI + React/TS/Vite platform where users connect their AWS account (IAM AssumeRole with ExternalId gating), we discover their enabled Bedrock models, and they can prompt against those models. Today the user manually picks a model from a dropdown and prompting is **entirely mocked** — there is no real `InvokeModel` call, no profiling, no routing, and no governance layer.

The old POC repo's `prompt_profiling&model_routing/` engine has already been copied into `backend/prompt_profiling&model_routing/` (all 5 runtime files + 3 training-only artifacts that should be excluded at deploy time).

### Key Findings from Research

| Area | Current State |
|---|---|
| **Deploy target** | No Dockerfile, no serverless config, no IaC for the backend itself — only a CloudFormation template for the *customer's* IAM role. Backend runs via `uv run uvicorn` locally. |
| **Persistence** | Supabase (Postgres via REST API + `httpx`). Single table: `connections`. No ORM — direct REST calls with `httpx`. |
| **Prompt dispatch** | **Does not exist.** [`sendPrompt`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/frontend/src/services/mock/mockService.ts#L127-L156) is a mock that returns fake text. No backend endpoint for prompting exists — only `/api/connection/*` routes. |
| **Existing schemas** | [`PromptRequest`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/app/schemas.py#L31-L33) and [`ModelResponse`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/app/schemas.py#L35-L43) are defined in backend schemas but **never used by any route**. |
| **Model ID format** | Bedrock returns IDs like `anthropic.claude-3-5-sonnet-20241022-v1:0`. The routing engine uses friendly IDs like `claude-sonnet-5`. **No mapping exists.** |
| **ML deps** | Not in `requirements.txt` or `pyproject.toml`. The engine needs `torch`, `sentence-transformers`, `xgboost`, `numpy`, `pandas`, `scikit-learn`. |
| **Engine import issue** | [`router.py`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/prompt_profiling%26model_routing/router.py#L24-L41) uses bare `from routing_models import ...` / `from features import ...` — relative to its own directory, not the backend package. This will break when imported from `app/`. |
| **Governance** | No governance concept exists anywhere in this repo. No `governance_rules` table, no rule checking, no throttling. |
| **Frontend model dropdown** | [`PlaygroundPage.tsx`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/frontend/src/components/playground/PlaygroundPage.tsx#L18-L234) has a multi-select model dropdown. User picks models, sends to `sendPrompt()` mock. |

---

## User Review Required

> [!IMPORTANT]
> **Dependency footprint / deploy-size warning (Step 1)**
> Adding `torch`, `sentence-transformers`, `xgboost` will add **~1–2 GB** of installed dependencies (torch alone is ~800MB–2GB depending on CPU/GPU variant). The 42MB `prompt_profiler.pkl` and the downloaded `BAAI/bge-base-en-v1.5` sentence-transformer model (~440MB) push the total runtime footprint to **~2–3 GB**.
>
> **There is currently no deploy config** (no Dockerfile, no Lambda config, no ECS task definition) — the backend runs locally via `uv run uvicorn`. This means:
> - A Lambda deploy is **not viable** with these dependencies (Lambda's 250MB unzipped limit, 10GB container image limit would be tight, and cold starts would be 30–60+ seconds)
> - A **container-based deploy** (ECS/Fargate, Cloud Run, EC2) with ≥4GB memory is the realistic target
> - For now this is local-only, which is fine — but this needs to be flagged for the eventual deploy conversation
>
> **Decision needed:** Should I install `torch` CPU-only (`--index-url https://download.pytorch.org/whl/cpu`) to save ~1GB, or full torch? CPU-only is recommended since we're only doing inference with sentence-transformers, not training on GPU.

> [!WARNING]
> **The `prompt_profiler.pkl` (42MB) is currently tracked in git.** This will bloat the repo significantly. Recommend adding it to `.gitignore` and storing it via Git LFS or an artifact store. For now I'll leave it as-is since it's already committed, but flagging this.

---

## Open Questions

> [!IMPORTANT]
> **Q1 — Model dropdown fate (Step 6):**
> The current `PlaygroundPage.tsx` has a multi-select model dropdown where users pick models manually. Three options:
> 1. **Remove it entirely** — full auto-routing, user just types a prompt and sends
> 2. **Keep as "preferred model hint"** — governance/routing can override it, but user's selection is a soft preference passed to the router
> 3. **Keep behind a toggle** — default is auto-route, user can flip to "manual/legacy mode" for comparison
>
> I recommend option **3** (toggle between auto-route and legacy/manual), which matches your "keep behind a `dry_run`/legacy flag" spec. Please confirm.

> [!IMPORTANT]
> **Q2 — Throttling definition (Step 3):**
> The spec says "max request-rate / token-volume threshold per some time window." Specific questions:
> - **What to track:** Request count per window, total input tokens per window, total output tokens per window, or all three?
> - **Window size:** Rolling 1-minute, 1-hour, or 24-hour? Or configurable?
> - **Enforcement target:** Per-org (user_id) for now?
>
> My recommendation: Start with **request count per minute** + **total tokens (input+output) per day** as the two throttle dimensions, both per-org (user_id). Window sizes stored in the governance rule config so they're adjustable without code changes.

> [!IMPORTANT]
> **Q3 — Bedrock InvokeModel endpoint:**
> There is currently **no backend prompt endpoint** — `sendPrompt()` in the frontend is fully mocked. The spec says "dispatch to the routed model via the existing Bedrock invoke path" but no such path exists. I will need to build:
> 1. A new `/api/prompt/send` (or `/api/prompt/route`) backend route
> 2. An `invoke_bedrock_model()` service function that does `AssumeRole` → `bedrock-runtime.invoke_model()` with per-model-family request translation (Anthropic Messages API shape vs Titan vs Llama vs Mistral body formats)
> 3. Response normalization back to the `ModelResponse` schema
>
> This is equivalent to **Task 4** from [`team_task_specs.md`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/team_task_specs.md#L143-L176). Should I build this as part of this work, or is it being handled separately? **I'll plan to include it** since the pipeline is: governance → profile → route → **invoke** → respond, and without invoke the whole chain is untestable end-to-end.

> [!IMPORTANT]
> **Q4 — Supabase table for governance rules:**
> Persistence is Supabase (REST API via httpx, no ORM). I'll create a new `governance_rules` table in Supabase and a corresponding service module following the same pattern as [`supabase_service.py`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/app/services/supabase_service.py). Should I provide the SQL DDL for you to run in the Supabase SQL Editor (same as the existing `connections` table setup in the README), or is there a migration system I'm not seeing?

---

## Proposed Changes

### Component 1 — Routing Engine Module (Step 1)

Relocate the 5 runtime files into the backend's `app/` package structure and make them importable.

#### [NEW] `app/services/routing/__init__.py`
Package init for the routing engine submodule.

#### [NEW] `app/services/routing/features.py`
Copy of [`features.py`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/prompt_profiling%26model_routing/features.py) — no changes needed, pure functions.

#### [NEW] `app/services/routing/routing_models.py`
Copy of [`routing_models.py`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/prompt_profiling%26model_routing/routing_models.py) — dataclasses for `PromptProfile`, `ModelCandidate`, `ModelRecommendation`, `RoutingResult`.

#### [NEW] `app/services/routing/router.py`
Copy of [`router.py`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/prompt_profiling%26model_routing/router.py) with **import path fixes**:
- `from routing_models import ...` → `from app.services.routing.routing_models import ...`
- `from features import ...` → `from app.services.routing.features import ...`
- Update default `pkl_path` and `registry_path` to resolve relative to this module's directory.

#### [NEW] `app/services/routing/model_registry_v3.json`
Copy of [`model_registry_v3.json`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/prompt_profiling%26model_routing/model_registry_v3.json).

#### Pickle file: `app/services/routing/prompt_profiler.pkl`
Copy of the 42MB pickle. Symlink or copy — either way it must be accessible at the module-relative path.

#### [NEW] `app/services/routing_service.py`
**The main integration facade.** This is the single entry point the rest of the app uses.

```python
class RoutingService:
    """Singleton facade wrapping PromptProfiler + ModelRouter."""

    _instance: Optional["RoutingService"] = None

    def __init__(self):
        # Load once at startup
        base = Path(__file__).parent / "routing"
        self.profiler = PromptProfiler(str(base / "prompt_profiler.pkl"))
        self.registry = ModelRegistry(str(base / "model_registry_v3.json"))
        self.router = ModelRouter(self.profiler, self.registry)

    @classmethod
    def get(cls) -> "RoutingService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def route(
        self,
        prompt: str,
        allowed_model_ids: list[str],  # friendly IDs from allow-list ∩ Bedrock-enabled
        max_tokens: int | None = None,
        enterprise_criticality: str = "standard",
    ) -> RoutingResult:
        # Filter registry models to only allowed ones before routing
        ...
```

Initialization will be triggered via FastAPI's `lifespan` context manager in [`main.py`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/main.py) so the ML models are loaded once at process startup.

#### [MODIFY] [`requirements.txt`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/requirements.txt)
Add (CPU-only torch, pending Q above):
```
torch>=2.3.0
sentence-transformers>=3.0.0
xgboost>=2.1.0
scikit-learn>=1.3.2
numpy>=1.26.0
pandas>=2.2.3
```

#### [MODIFY] [`pyproject.toml`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/pyproject.toml)
Mirror the same dependencies.

---

### Component 2 — Model ID Mapping Layer (Step 2)

#### [NEW] `app/services/routing/bedrock_model_mapping.json`
An explicit mapping table: friendly ID → Bedrock model ID. Starting set based on what's in the registry and what Bedrock actually returns:

```json
{
  "_doc": "Explicit mapping from model_registry_v3 friendly IDs to AWS Bedrock model IDs. Extend manually as new models are added.",
  "models": {
    "claude-haiku-4-5-20251001": "anthropic.claude-3-5-haiku-20251001-v1:0",
    "claude-sonnet-5": "anthropic.claude-sonnet-4-20250514-v1:0",
    "claude-opus-5": null,
    "claude-sonnet-4-6": "anthropic.claude-sonnet-4-20250514-v1:0",
    "claude-haiku-3-5": "anthropic.claude-3-5-haiku-20241022-v1:0",
    "claude-3-haiku": "anthropic.claude-3-haiku-20240307-v1:0",
    "amazon-nova-micro": "amazon.nova-micro-v1:0",
    "amazon-nova-lite": "amazon.nova-lite-v1:0",
    "amazon-nova-pro": "amazon.nova-pro-v1:0",
    "amazon-nova-premier": "amazon.nova-premier-v1:0",
    "llama-3.3-70b": "meta.llama3-3-70b-instruct-v1:0",
    "llama-4-scout": null,
    "llama-4-maverick": null,
    "mistral-large-3": "mistral.mistral-large-2407-v1:0",
    "mistral-small": "mistral.mistral-small-2402-v1:0"
  }
}
```

> [!NOTE]
> Many models in the registry (OpenAI, Google, DeepSeek, xAI) are **not available on Bedrock** — they'll have `null` mappings and will be filtered out when intersecting with Bedrock-enabled models. This is by design. The mapping only covers models that *can* be invoked via `bedrock-runtime:InvokeModel`.

#### [NEW] `app/services/model_mapping_service.py`
Loads the mapping JSON, provides:
- `friendly_to_bedrock(friendly_id) -> str | None`
- `bedrock_to_friendly(bedrock_id) -> str | None`
- `get_routable_models(bedrock_enabled: list[str], allow_listed: list[str]) -> list[str]` — triple intersection (Bedrock-enabled ∩ allow-listed ∩ registry-known), returns friendly IDs
- `get_mapping_warnings(allow_listed, bedrock_enabled) -> list[str]` — warns about unmapped models

---

### Component 3 — Governance Rules (Steps 3 & 4)

#### [NEW] Supabase table DDL: `governance_rules`

```sql
CREATE TABLE public.governance_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,  -- FK to user_id for now, maps to org later
  rule_type text NOT NULL,  -- 'allow_list' | 'throttle' | 'context_window' | 'moderation' | 'io_tokens'
  scope text NOT NULL DEFAULT 'org',  -- 'org' | 'application' | 'user' | 'tag'
  scope_target text,  -- nullable, for sub-org targeting later
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  mode text NOT NULL DEFAULT 'dry_run',  -- 'dry_run' | 'enforce'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT governance_rules_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX governance_rules_org_type_scope ON public.governance_rules(org_id, rule_type, scope, coalesce(scope_target, ''));

ALTER TABLE public.governance_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow backend all access governance_rules"
  ON public.governance_rules FOR ALL USING (true) WITH CHECK (true);
```

**Config shapes per rule_type:**

```jsonc
// allow_list
{ "allowed_models": ["claude-sonnet-5", "claude-haiku-4-5-20251001", "amazon-nova-pro"] }

// throttle
{ "max_requests_per_minute": 60, "max_tokens_per_day": 1000000 }

// context_window
{ "max_input_tokens": 200000, "max_output_tokens": 65536, "max_total_tokens": 265536 }

// moderation (stub)
{ "enabled": false, "categories": [] }

// io_tokens (stub)
{ "min_input_tokens": 1, "max_input_tokens": 200000, "min_output_tokens": 1, "max_output_tokens": 65536 }
```

#### [NEW] `app/services/governance_service.py`
Supabase CRUD + enforcement logic, following the same httpx REST pattern as [`supabase_service.py`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/app/services/supabase_service.py):

```python
class GovernanceEvaluation:
    rule_type: str
    passed: bool
    mode: str  # "enforce" | "dry_run"
    message: str  # human-readable reason

class GovernanceService:
    async def get_rules(org_id: str) -> list[GovernanceRule]
    async def upsert_rule(org_id: str, rule: GovernanceRule) -> GovernanceRule
    async def evaluate_request(org_id: str, prompt: str, est_tokens: int) -> GovernanceResult
        # Returns: passed (bool), evaluations (list), allowed_models (list[str])
```

**Enforcement pipeline (Step 4 request flow):**
1. Load org's governance rules from Supabase
2. **Context window check** — estimate prompt tokens, compare against `context_window` rule
3. **Throttle check** — count recent requests/tokens (needs a lightweight counter — see below)
4. **Allow-list filter** — compute `allowed_models ∩ bedrock_enabled ∩ registry_known`
5. If any `enforce`-mode rule fails → reject with structured error
6. If any `dry_run`-mode rule fails → log warning, continue, include in response evaluations

**Throttle state tracking:**
Since Supabase doesn't have built-in rate limiting, I'll track request counts in a new lightweight table:

```sql
CREATE TABLE public.request_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  tokens_used int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX request_log_org_created ON public.request_log(org_id, created_at);
```

The throttle check queries `SELECT count(*), sum(tokens_used) FROM request_log WHERE org_id = ? AND created_at > now() - interval '...'`.

#### [NEW] `app/services/governance_defaults.py`
Seeds default `dry_run` governance rules for new orgs on first prompt request (if no rules exist yet). Default allow-list includes all Bedrock-mappable models.

---

### Component 4 — Prompt Route & Bedrock Invoke Endpoint (Steps 4 & 5)

#### [NEW] `app/routes/prompt.py`
New FastAPI router at `/api/prompt`:

```
POST /api/prompt/route   — the main governed + profiled + routed + invoked endpoint
POST /api/prompt/legacy  — manual model selection (legacy/comparison mode)
POST /api/prompt/profile — profile-only (no invoke), returns PromptProfile + RoutingResult for dry-run/debugging
```

**`/api/prompt/route` flow:**
```
1. Authenticate user (X-User-ID header)
2. Load connection (get role_arn, bedrock-enabled models)
3. Run governance checks (GovernanceService.evaluate_request)
4. If governance fails (enforce mode) → return 403 with structured rejection
5. Call RoutingService.route(prompt, allowed_models_filtered)
6. Take top-ranked model from RoutingResult
7. Map friendly ID → Bedrock model ID (ModelMappingService)
8. AssumeRole with user's role_arn → temp creds
9. InvokeModel on bedrock-runtime with per-model-family request translation
10. If #1 fails → retry with #2 (fallback)
11. Normalize response → return enriched ModelResponse
```

#### [NEW] `app/services/bedrock_invoke_service.py`
Handles the actual Bedrock model invocation with per-model-family request/response translation:

```python
class BedrockInvokeService:
    def invoke(
        self, role_arn: str, external_id: str, bedrock_model_id: str,
        prompt: str, max_tokens: int, region: str
    ) -> InvokeResult:
        # 1. AssumeRole (reuse existing STS logic)
        # 2. Build model-family-specific request body
        # 3. bedrock-runtime.invoke_model()
        # 4. Parse model-family-specific response
        # 5. Return normalized InvokeResult(text, tokens_used, latency_ms)
```

**Model family request translators** (per [`team_task_specs.md`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/team_task_specs.md#L149-L152)):
- **Anthropic** (Claude models): Messages API body `{"anthropic_version": "bedrock-2023-05-31", "messages": [{"role": "user", "content": prompt}], "max_tokens": ...}`
- **Amazon** (Nova models): `{"inputText": prompt, "textGenerationConfig": {"maxTokenCount": ...}}`
- **Meta** (Llama models): `{"prompt": prompt, "max_gen_len": ...}`
- **Mistral**: `{"prompt": prompt, "max_tokens": ...}`

#### [MODIFY] [`app/schemas.py`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/app/schemas.py)
Extend with new request/response models:

```python
class RoutedPromptRequest(BaseModel):
    prompt: str
    max_tokens: Optional[int] = None
    mode: str = "auto"  # "auto" | "legacy"
    legacy_model_ids: Optional[List[str]] = None  # only used in legacy mode
    enterprise_criticality: str = "standard"

class GovernanceEvaluationSchema(BaseModel):
    rule_type: str
    passed: bool
    mode: str
    message: str

class RoutedModelResponse(BaseModel):
    text: str
    routed_model: str           # friendly ID of the model that answered
    routed_model_bedrock_id: str  # actual Bedrock model ID
    routing_reason: List[str]
    tier: str
    complexity_score: float
    cost_estimate: float
    model_used_name: str
    fallback_used: bool = False
    fallback_from: Optional[str] = None
    tokens_used: Optional[int] = None
    latency_ms: Optional[float] = None
    governance_evaluations: List[GovernanceEvaluationSchema] = []
    profile_summary: Optional[dict] = None  # d1-d5, domain, intent, etc.
```

#### [MODIFY] [`main.py`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/backend/main.py)
- Add `lifespan` context manager to initialize `RoutingService` singleton at startup
- Include new `prompt_router` in `app.include_router(...)`

---

### Component 5 — Frontend Updates (Step 6)

#### [MODIFY] [`frontend/src/types/index.ts`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/frontend/src/types/index.ts)
Add new types matching the extended response contract:

```typescript
export interface RoutedModelResponse extends ModelResponse {
  routed_model: string;
  routed_model_bedrock_id: string;
  routing_reason: string[];
  tier: string;
  complexity_score: number;
  cost_estimate: number;
  governance_evaluations: GovernanceEvaluation[];
  profile_summary?: Record<string, unknown>;
}

export interface GovernanceEvaluation {
  rule_type: string;
  passed: boolean;
  mode: string;
  message: string;
}
```

#### [MODIFY] [`frontend/src/services/apiService.ts`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/frontend/src/services/apiService.ts)
Add `sendRoutedPrompt()` function calling `POST /api/prompt/route`.

#### [MODIFY] [`frontend/src/services/mock/mockService.ts`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/frontend/src/services/mock/mockService.ts)
Update `sendPrompt()` to call the real backend endpoint when available, falling back to mock.

#### [MODIFY] [`frontend/src/components/playground/PlaygroundPage.tsx`](file:///c:/Users/Musharraf/Documents/Profiling_Routing/frontend/src/components/playground/PlaygroundPage.tsx)
- Add a toggle: **Auto-Route** (default) vs **Manual Model Select** (legacy)
- In auto-route mode: hide the model dropdown, show a "Powered by AI Routing" badge
- Display routing metadata in the response panel: routed model, tier, complexity score, cost estimate, routing reasons
- Display governance evaluation status (which rules checked, pass/fail/dry_run)
- Keep manual mode for comparison/testing with the existing dropdown

---

### Component 6 — Governance Admin Routes (lightweight)

#### [NEW] `app/routes/governance.py`
CRUD endpoints for managing governance rules per org:

```
GET    /api/governance/rules          — list all rules for the org
POST   /api/governance/rules          — create/upsert a rule
PUT    /api/governance/rules/{id}     — update a specific rule
DELETE /api/governance/rules/{id}     — delete a rule
GET    /api/governance/rules/defaults — get default rule templates
```

These are admin-facing endpoints for configuring governance. The frontend can wire these up later; for now they're callable via Postman/curl.

---

## Files Summary

| File | Action | Summary |
|---|---|---|
| `app/services/routing/__init__.py` | NEW | Package init |
| `app/services/routing/features.py` | NEW | Feature engineering (copy from POC) |
| `app/services/routing/routing_models.py` | NEW | Dataclasses (copy from POC) |
| `app/services/routing/router.py` | NEW | Core engine with import fixes |
| `app/services/routing/model_registry_v3.json` | NEW | Model registry config |
| `app/services/routing/prompt_profiler.pkl` | NEW | 42MB ML artifact |
| `app/services/routing/bedrock_model_mapping.json` | NEW | Friendly ID ↔ Bedrock ID mapping |
| `app/services/routing_service.py` | NEW | Singleton facade for routing |
| `app/services/model_mapping_service.py` | NEW | Model ID mapping service |
| `app/services/governance_service.py` | NEW | Governance rules CRUD + enforcement |
| `app/services/governance_defaults.py` | NEW | Default dry_run rule seeding |
| `app/services/bedrock_invoke_service.py` | NEW | Bedrock InvokeModel per-model-family |
| `app/routes/prompt.py` | NEW | `/api/prompt/*` routes |
| `app/routes/governance.py` | NEW | `/api/governance/*` CRUD routes |
| `app/schemas.py` | MODIFY | Add `RoutedPromptRequest`, `RoutedModelResponse`, governance schemas |
| `main.py` | MODIFY | Add lifespan, include new routers |
| `requirements.txt` | MODIFY | Add ML dependencies |
| `pyproject.toml` | MODIFY | Mirror ML dependencies |
| `frontend/src/types/index.ts` | MODIFY | Add routing/governance types |
| `frontend/src/services/apiService.ts` | MODIFY | Add `sendRoutedPrompt()` |
| `frontend/src/services/mock/mockService.ts` | MODIFY | Wire to real backend |
| `frontend/src/components/playground/PlaygroundPage.tsx` | MODIFY | Auto-route toggle, routing metadata display |

---

## Verification Plan

### Automated Tests

```bash
# Existing tests still pass
cd backend && uv run pytest -v

# New unit tests
uv run pytest tests/test_governance.py -v
uv run pytest tests/test_routing_service.py -v
uv run pytest tests/test_model_mapping.py -v
uv run pytest tests/test_prompt_route.py -v
```

New test files to create:
- `tests/test_model_mapping.py` — verify mapping table, triple intersection logic, unmapped model warnings
- `tests/test_governance.py` — verify rule CRUD, context window checks, throttle checks, dry_run vs enforce behavior
- `tests/test_routing_service.py` — verify RoutingService facade, profile-only mode, filtered candidate routing
- `tests/test_prompt_route.py` — integration test for the full `/api/prompt/route` endpoint with mocked Bedrock

### Manual Verification

1. Start backend (`uv run uvicorn main:app --reload`) — verify ML models load at startup without error
2. Call `POST /api/prompt/profile` with a test prompt — verify profiling + routing output (no invoke)
3. Call `POST /api/prompt/route` with a connected user — verify end-to-end: governance → profile → route → invoke → response
4. Verify governance rejections: set a context_window rule with low max, send a long prompt, confirm 403 with structured reason
5. Verify dry_run mode: set throttle rule to dry_run, exceed threshold, confirm request succeeds but evaluations show dry_run failure
6. Frontend: verify auto-route mode shows routing metadata, manual mode works as before
7. Check startup time — ML model loading should complete in < 30s on local machine
