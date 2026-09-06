# AI Profiling & Routing Platform

A multi-provider AI governance platform that enables secure cloud provider connections, intelligent prompt profiling, governed model routing, and cost-aware dispatch across AWS Bedrock foundation models.

## Project Structure

```
Profiling_Routing/
├── frontend/                       # React + TypeScript + Vite
│   └── src/
│       ├── components/
│       │   ├── connections/        # AWS Bedrock connect + IAM role test flow
│       │   ├── governance/         # Single production page: guardrails, prompt, routing, retry
│       │   └── models/             # Read-only Bedrock model registry browser (grouped by provider)
│       └── services/               # apiService.ts (real backend calls), mockService.ts (thin wrapper)
├── backend/                         # Python FastAPI
│   ├── app/
│   │   ├── config.py                # Settings & environment variables (loads .env)
│   │   ├── schemas.py                # Pydantic request/response models
│   │   ├── routes/
│   │   │   ├── connection.py         # /api/connection endpoints
│   │   │   ├── prompt.py             # /api/prompt endpoints (profile, route+invoke, catalog)
│   │   │   └── governance.py         # /api/governance endpoints (rule CRUD)
│   │   └── services/
│   │       ├── aws_service.py        # STS AssumeRole + Bedrock ListFoundationModels
│   │       ├── supabase_service.py   # Per-user connection persistence
│   │       ├── governance_service.py # Governance rule evaluation + throttle tracking
│   │       ├── model_mapping_service.py  # Friendly-ID <-> Bedrock-model-ID mapping
│   │       ├── bedrock_invoke_service.py # Per-model-family InvokeModel request/response translation
│   │       ├── routing_service.py    # Singleton facade over the ML routing engine
│   │       └── routing/              # Prompt profiler (sentence-transformer + XGBoost) + model registry
│   ├── cloudformation/
│   │   └── bedrock-role-template.yaml  # IAM Role CloudFormation template
│   ├── tests/
│   └── main.py                      # FastAPI app entrypoint
└── team_task_specs.md                # Capstone project specifications
```

## Features

- **Supabase Authentication** — Email/password sign-up and sign-in, with a local dev-mode fallback
- **AWS Bedrock Connection** — Secure cross-account IAM role assumption via STS with ExternalId verification
- **CloudFormation Template** — One-click IAM role deployment for customers connecting their AWS accounts
- **Prompt Profiling & Intelligent Routing** — ML-scored complexity/domain/intent, ranks the top 3 allowed models by cost/quality/context fit
- **Governance Guardrails** — Per-org allow-list (real Bedrock model IDs), context-window limits, throttling/daily quotas, `dry_run`/`enforce` modes
- **Governed Dispatch, No Auto-Fallback** — Rank #1 is invoked automatically; rank #2/#3 are only invoked if you manually retry
- **Model Registry Browser** — Maintained catalog of Bedrock models, grouped by provider with brand icons

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.12
- **AWS Account** with Bedrock access
- **Supabase Project**

### Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Copy .env.example to .env and fill in your credentials
cp .env.example .env

# Run the server
python -m uvicorn main:app --reload --port 8000
```

> **Note:** `requirements.txt` includes ML dependencies (`torch`, `sentence-transformers`, `xgboost`) needed for prompt profiling — installed footprint is ~2-3GB. First startup downloads the `BAAI/bge-base-en-v1.5` embedding model from Hugging Face and can take 10-30s.

### Frontend Setup

```bash
cd frontend
npm install

# Copy .env.example to .env and fill in your Supabase + backend URL
cp .env.example .env

# Run the dev server
npm run dev
```

### Supabase Database Setup

Run the following SQL in the Supabase SQL Editor:

```sql
CREATE TABLE public.connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_id uuid NOT NULL,
  role_arn text,
  status text NOT NULL DEFAULT 'pending'::text,
  available_models jsonb DEFAULT '[]'::jsonb,
  error text,
  verified_at timestamp with time zone,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT connections_pkey PRIMARY KEY (id),
  CONSTRAINT connections_user_id_unique UNIQUE (user_id),
  CONSTRAINT connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow backend all access connections"
  ON public.connections FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.governance_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  rule_type text NOT NULL,   -- 'allow_list' | 'throttle' | 'context_window'
  scope text NOT NULL DEFAULT 'org',
  scope_target text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  mode text NOT NULL DEFAULT 'dry_run',   -- 'dry_run' | 'enforce'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT governance_rules_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX governance_rules_org_type_scope
  ON public.governance_rules(org_id, rule_type, scope, coalesce(scope_target, ''));

ALTER TABLE public.governance_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow backend all access governance_rules"
  ON public.governance_rules FOR ALL USING (true) WITH CHECK (true);
```

> If this table is missing or unreachable, the backend transparently falls back to sensible in-memory default rules (allow-list = full maintained catalog, context window 200K/8192/250K, throttle 60rpm/5M tokens-per-day) so the app still works without it — but rule changes won't persist across restarts until the table exists.

### AWS CloudFormation Setup

1. Deploy `backend/cloudformation/bedrock-role-template.yaml` in your target AWS account
2. Set `TrustedAccountId` to your platform's AWS Account ID
3. Set `ExternalId` to the user's Supabase Auth UUID (shown on the Connections page)
4. Copy the output `RoleArn` and paste it into the Connections page
5. **Enable model access** for the Bedrock models you want invokable, in the AWS Bedrock console (Model access) — this is a separate, per-account gate from IAM permissions and isn't something the app can toggle for you

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/connection` | Get connection status for user |
| `POST` | `/api/connection/test` | Test AWS Bedrock connection |
| `POST` | `/api/connection/reset` | Reset connection to disconnected |
| `GET` | `/api/connection/models` | Get available Bedrock models |
| `GET` | `/api/prompt/catalog` | Get the maintained Bedrock model catalog |
| `POST` | `/api/prompt/profile` | Profile + route a prompt without invoking (requires verified connection) |
| `POST` | `/api/prompt/route` | Full pipeline: governance → profile → route → invoke rank #1 (or a validated `retry_bedrock_model_id`) |
| `GET` | `/api/governance/rules` | Get configured governance rules for the org |
| `POST` | `/api/governance/rules` | Upsert a governance rule (`allow_list` \| `context_window` \| `throttle`) |
| `GET` | `/api/governance/defaults` | Get default rule templates |
| `GET` | `/health` | Health check |

## Running Tests

```bash
cd backend
python -m pytest -v
```

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Supabase Auth, react-markdown
- **Backend**: Python, FastAPI, Boto3, Pydantic
- **Prompt Profiling**: sentence-transformers (`BAAI/bge-base-en-v1.5`), XGBoost, scikit-learn (PCA/KNN)
- **Database**: Supabase (PostgreSQL)
- **Cloud**: AWS Bedrock, IAM, STS, CloudFormation
