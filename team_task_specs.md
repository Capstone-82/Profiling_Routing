# Task Specs — Detailed Workflow Breakdown

Companion to `multi_provider_routing_architecture.md`. This doc breaks the 4 assigned tasks
down to workflow-level detail (not code) so each owner knows exactly what to build and how the
pieces hand off to each other. Scope: **Bedrock only, V1.**

**Decisions locked in this round:**
- Dispatch fallback: if the #1-ranked model's Bedrock call fails after retries, **auto-retry
  the #2-ranked model** from the same RoutingResult before failing the request.
- Pricing cache validity: **1 month**, with a lazy on-demand refresh if a model's cached row is
  older than that when requested (so no user waits on the monthly batch job specifically).
- Live pricing source: **AWS Price List API** (official, structured — not a scrape).

---

## Task 1 — Frontend (UI Flow Only, No Logic)

**Scope reminder:** wire up the pages and their states; every backend call is a stub/mock until
Tasks 2–4 are ready. No auth logic, no AWS logic, no routing logic lives here.

### Pages, in order

1. **Sign in / Sign up** — email-based, via Supabase Auth. Standard email+password or
   magic-link (pick one — magic-link is less UI to build if that's acceptable). On success,
   Supabase gives you the `user.id` (UUID) — this is the same UUID used as the `external_id`
   in Task 2's IAM trust policy, so it must be available to whatever calls that logic next.
2. **Connections page** — shown right after first sign-up (and reachable later from a settings
   menu). Layout should have space for 3 provider tiles (**AWS Bedrock, Vertex AI, Azure
   Foundry**) even though only Bedrock is wired up — the other two show as "Coming soon" /
   disabled tiles. The Bedrock tile has:
   - A "Connect AWS Bedrock" button (opens the CloudFormation link — Task 2 provides the URL)
   - An input field for pasting the Role ARN back
   - A "Test Connection" button
   - A status indicator: `not connected` / `pending` / `verified` / `failed` (with an error
     message slot for the failed case)
3. **Main page** — only reachable once at least one connection is `verified`:
   - A text area for the prompt
   - Below it, a model multi-select populated from `available_models` for the connected
     account (Task 2 supplies this list) — this is the **Allow-List** the user is choosing
     from, not literally every Bedrock model in existence
   - A "Send" button
   - A response display area, with a loading state while waiting, and a way to show which
     model actually answered (useful once fallback, Task 4, is wired in — the UI should have a
     small "Answered by: <model_id>" tag ready even if Task 4 isn't done yet)

### Color palette note

I couldn't extract verified hex codes from corestack.io programmatically — the fetch only
returned markup, not computed CSS. Have whoever builds this open corestack.io in a browser,
inspect a few key elements (nav bar, primary CTA button, links), and pull the real hex values
directly — that's more reliable than anyone guessing. Directionally, expect a dark navy/charcoal
base with a teal or cyan accent, typical of enterprise cloud-governance SaaS sites, but treat
that as a starting guess only, not a spec.

---

## Task 2 — AWS Connection Logic

### Data model (Supabase table: `connections`)

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | FK to Supabase `auth.users` |
| `external_id` | uuid | Same as `user_id` — no need for a second UUID, reuse it |
| `role_arn` | text | Pasted by the user after running the CloudFormation stack |
| `status` | text | `pending` / `verified` / `failed` |
| `available_models` | jsonb | Populated by `ListFoundationModels` at verification time |
| `verified_at` | timestamptz | Null until first successful test |
| `last_synced_at` | timestamptz | For re-checking model-enablement drift later |

### Flow

1. On first login, if no `connections` row exists for this `user_id`, create one with
   `status = pending`.
2. "Connect AWS Bedrock" button opens a CloudFormation quick-create URL with `ExternalId =
   user_id` and `TrustedAccountId = 108839616732` pre-filled as stack parameters.
3. The CloudFormation template (you write and host this `.yaml` once) creates:
   - An IAM role with a trust policy allowing account `108839616732` to assume it, gated on
     `sts:ExternalId = <user_id>`
   - A permissions policy scoped to `bedrock:InvokeModel` and
     `bedrock:InvokeModelWithResponseStream` only
4. User pastes the resulting Role ARN into the Connections page, clicks **Test Connection**.
5. Backend: `sts:AssumeRole(role_arn, external_id=user_id)` → temporary credentials →
   `bedrock:ListFoundationModels` with those credentials.
   - Success → update the row: `status = verified`, `available_models = [...]`,
     `verified_at = now()`.
   - Failure → `status = failed`, surface a specific reason (bad ARN, trust policy mismatch,
     external ID mismatch, no models enabled) back to the frontend's status slot.
6. Nothing beyond `role_arn` and `external_id` (=`user_id`) is ever stored — no static AWS
   credentials touch this system at rest.

### Edge cases to handle explicitly

- User pastes a malformed ARN → validate format before attempting `AssumeRole`.
- `AssumeRole` succeeds but `ListFoundationModels` returns zero models (account has Bedrock
  access but hasn't enabled any specific model) → `status = verified` but
  `available_models = []`, with a UI message telling the user to enable at least one model in
  their AWS Bedrock console.
- Re-running Test Connection on an already-verified row should just refresh `available_models`
  and `verified_at`, not create a duplicate row.

---

## Task 3 — Model Registry & Pricing Cache

### Data model (Supabase table: `model_registry`)

| Column | Type | Notes |
|---|---|---|
| `model_id` | text (PK) | Bedrock model identifier |
| `provider` | text | `anthropic` / `meta` / `amazon` / `mistral` / etc. |
| `cost_in_per_1m` | numeric | USD per 1M input tokens |
| `cost_out_per_1m` | numeric | USD per 1M output tokens |
| `max_input_tokens` | int | |
| `max_output_tokens` | int | |
| `reasoning_mode` | boolean | Feeds the routing engine's Filter Gate 11 |
| `source` | text | `aws_price_list_api` |
| `last_checked_at` | timestamptz | Drives the 1-month staleness check |

### Pipeline

1. **Scheduled refresh (monthly):** a Supabase Edge Function (cron-triggered) calls the AWS
   Price List API for Bedrock, walks the pricing dimensions per model, and upserts rows into
   `model_registry`, updating `last_checked_at`.
2. **Lazy on-demand refresh:** whenever the Routing Engine needs pricing for a `model_id` and
   its row is either missing or `last_checked_at` is more than 1 month old, trigger a
   synchronous refresh for **just that model** before continuing — so a single stale/missing
   row doesn't block on the next scheduled batch, and the fix benefits every subsequent user
   who requests that same model (shared cache, not per-user).
3. This table is what Section 6 of the architecture doc's "Scoring" stage reads for the cost
   formula (`cost_in`, `cost_out`) — no other component should call the AWS Price List API
   directly.

### Note on AWS Price List API specifics

It returns a large nested JSON structure per service; Bedrock pricing will need to be filtered
by model/unit (input tokens vs output tokens are usually separate SKUs). Worth a short spike to
map the exact response shape before committing to the upsert logic — flag this as a known
unknown rather than assuming the mapping is trivial.

---

## Task 4 — Request Translation, Dispatch, Response, Throttling & Fallback

### Flow

1. Take the top-ranked `model_id` from the Routing Engine's `RoutingResult`.
2. **Request Translator:** map the normalized prompt into that model's native Bedrock
   `invoke_model` body. **Important:** Bedrock does not have one universal request schema —
   Anthropic models on Bedrock use a Messages-style body, while Titan, Llama, and Mistral models
   each have their own different JSON shape. This needs a per-model-family mapping, not a
   single Bedrock-wide adapter.
3. **Dispatch:** use the `role_arn` from Task 2's `connections` table to `AssumeRole`, sign the
   request, call `InvokeModel`.
4. **Throttling (Layer 2, from the architecture doc):** wrap the call in the AWS SDK's built-in
   retry config with exponential backoff + jitter on `ThrottlingException` (2–3 attempts).
5. **Fallback:** if the #1-ranked model still fails after retries are exhausted, automatically
   retry the same request against the **#2-ranked model** from the same `RoutingResult`
   (translated into #2's own request schema). If #2 also fails, fail the request back to the
   user with a clear error — do not cascade further than #2 without a separate decision to do
   so.
6. **Response Normalizer:** map whichever model actually answered back into one common shape:
   `{ text, model_used, fallback_used: bool, tokens_used, estimated_cost, latency_ms }`.
7. Log the full outcome (RoutingResult, model actually used, whether fallback fired, cost,
   latency) for audit — this is the same logging point called out in the architecture doc's
   Section 7 output.

### Edge cases to handle explicitly

- Both #1 and #2 fail → surface a specific error, not a generic "something went wrong."
- A model in the `RoutingResult` no longer appears in the user's `available_models` (enablement
  drift since the last sync) → skip it and move to the next ranked candidate rather than
  attempting a doomed call.
- Response schema differences between model families must be normalized before this reaches the
  frontend — Task 1's UI should never need to know which model family answered.

---

## Cross-Task Dependencies (so nobody blocks on nobody)

| This task... | ...needs this from another task before it can fully work |
|---|---|
| Task 1 (Frontend) | Can build against mocked responses independently; needs Task 2's `available_models` shape and Task 4's response shape finalized before final wiring |
| Task 2 (Connection) | Fully independent — can start immediately |
| Task 3 (Registry) | Independent of Task 2, but the Routing Engine needs both Task 2's `available_models` (candidate pool) and Task 3's `model_registry` (pricing/capability) to actually score anything |
| Task 4 (Dispatch) | Needs Task 2's `role_arn`/`connections` table and a `RoutingResult` (which itself needs Task 3's registry) before it can run end-to-end |

**Recommended build order for a working pilot:** Task 2 first (nothing else can be tested
without a real connection), Task 3 in parallel, Task 1's static pages in parallel, then Task 4
last since it's the only one that depends on both 2 and 3 being real.
