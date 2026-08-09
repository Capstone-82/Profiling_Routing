# AI Profiling & Routing Platform

A multi-provider AI governance platform that enables secure cloud provider connections, intelligent model routing, and workload profiling across foundation models.

## Project Structure

```
Profiling_Routing/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Python FastAPI
│   ├── app/
│   │   ├── config.py          # Settings & environment variables
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── routes/
│   │   │   └── connection.py  # /api/connection endpoints
│   │   └── services/
│   │       ├── aws_service.py      # STS AssumeRole + Bedrock integration
│   │       └── supabase_service.py # Per-user connection persistence
│   ├── cloudformation/
│   │   └── bedrock-role-template.yaml  # IAM Role CloudFormation template
│   ├── tests/
│   │   └── test_connection.py
│   └── main.py                # FastAPI app entrypoint
└── team_task_specs.md         # Capstone project specifications
```

## Features

- **Supabase Authentication** — Email/password sign-up and sign-in with demo mode fallback
- **AWS Bedrock Connection** — Secure cross-account IAM role assumption via STS with ExternalId verification
- **CloudFormation Template** — One-click IAM role deployment for customers connecting their AWS accounts
- **Per-User Persistence** — Connection state and available models stored in Supabase per authenticated user
- **Model Discovery** — Automatic listing of available Bedrock foundation models after connection verification

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.13
- **uv** (Python package manager)
- **AWS Account** with Bedrock access
- **Supabase Project**

### Backend Setup

```bash
cd backend
uv venv
uv add fastapi "uvicorn[standard]" boto3 botocore pydantic python-dotenv httpx pytest pytest-asyncio

# Copy .env.example to .env and fill in your credentials
cp .env.example .env

# Run the server
uv run uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install

# Copy .env.example to .env and fill in your Supabase credentials
cp .env.example .env

# Run the dev server
npm run dev
```

### Supabase Database Setup

Run the following SQL in the Supabase SQL Editor to create the `connections` table:

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
```

### AWS CloudFormation Setup

1. Deploy `backend/cloudformation/bedrock-role-template.yaml` in your target AWS account
2. Set `TrustedAccountId` to your platform's AWS Account ID
3. Set `ExternalId` to the user's Supabase Auth UUID
4. Copy the output `RoleArn` and paste it into the Connections page

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/connection` | Get connection status for user |
| `POST` | `/api/connection/test` | Test AWS Bedrock connection |
| `POST` | `/api/connection/reset` | Reset connection to disconnected |
| `GET` | `/api/connection/models` | Get available Bedrock models |
| `GET` | `/health` | Health check |

## Running Tests

```bash
cd backend
uv run pytest -v
```

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Supabase Auth
- **Backend**: Python, FastAPI, Boto3, Pydantic
- **Database**: Supabase (PostgreSQL)
- **Cloud**: AWS Bedrock, IAM, STS, CloudFormation
