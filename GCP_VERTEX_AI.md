# Google Cloud / Vertex AI customer connection

> **Status: ON HOLD.** Vertex AI is intentionally disabled in the active
> application phase because no GCP account is currently available. The backend
> routes/services, frontend service wrappers, and tests are retained here for
> later re-enablement. Do not expose the GCP router or restore the paused UI
> until credentials, project access, and a live verification plan are ready.

This integration adds Google Vertex AI to the existing unified model catalog and
router. AWS Bedrock remains on its existing IAM role, External ID, STS, and
CloudFormation flow.

## Customer end-to-end flow

1. The customer signs in to the platform with Supabase.
2. The frontend calls `GET /api/gcp/connect`, sending the Supabase bearer
   session. The backend derives the user and organization from the verified
   Supabase session; it does not trust a browser-supplied user ID.
3. The backend creates a short-lived, single-use, HMAC-protected OAuth `state`
   bound to that user, organization, optional project, and region. It redirects
   the browser to Google's OAuth consent screen with the `cloud-platform` scope
   and offline access.
4. Google redirects to `GET /api/gcp/callback` on the backend. The backend
   validates and consumes `state`, exchanges the authorization code, and never
   sends Google tokens to the browser.
5. If a project was supplied, or exactly one accessible project is found, the
   backend performs a real Vertex AI API check and discovers maintained models.
   If several projects are accessible, the backend stores the encrypted refresh
   token and asks the frontend to choose a project.
6. A successful connection is persisted as non-secret metadata. Only an
   encrypted refresh-token ciphertext is stored in the server-only secrets
   table. Access tokens are refreshed in memory and are not persisted.
7. The existing governance and routing pipeline receives the verified Vertex
   models. The provider dispatch invokes Vertex AI for a selected Vertex model;
   AWS dispatch is unchanged.

Google's web-server OAuth documentation describes this authorization-code flow,
`state`, and offline access: [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server).

## Frontend behavior

The Connections page shows an optional Project ID, a region, and **Connect
Google Cloud**. It opens the backend authorization URL; it does not ask the
customer to install `gcloud`, create a service-account key, paste JSON, or enter
an access token. After Google redirects back, the page displays the verified
project, region, discovered model count, and OAuth authentication method.

## Backend endpoints

```text
GET    /api/gcp/connect?projectId=&region=
GET    /api/gcp/callback?code=&state=
GET    /api/gcp/connection
GET    /api/gcp/projects
POST   /api/gcp/connection/test
POST   /api/gcp/models/discover
GET    /api/gcp/models
POST   /api/gcp/connection/reset
DELETE /api/gcp/connection
```

All customer-facing GCP endpoints require `Authorization: Bearer <Supabase
access token>`, except the OAuth callback. The callback is protected by the
single-use signed state created for the authenticated platform session.

`POST /api/gcp/connection/test` only returns `verified` after the backend uses
the stored Google authorization to call Vertex AI in the requested project and
region and successfully completes model discovery. Authentication, IAM, API
enablement, project, region, or quota failures remain `failed`.

## Platform environment

Set these in `backend/.env`; they are backend-only values:

```text
GCP_PROJECT_ID=sharath01-464613
GCP_REGION=us-central1
GCP_OAUTH_CLIENT_ID=
GCP_OAUTH_CLIENT_SECRET=
GCP_OAUTH_REDIRECT_URI=http://localhost:8000/api/gcp/callback
GCP_OAUTH_STATE_SECRET=
GCP_TOKEN_ENCRYPTION_KEY=
FRONTEND_BASE_URL=http://localhost:5173
SUPABASE_SERVICE_ROLE_KEY=
```

`GCP_PROJECT_ID` is an optional platform fallback; the customer-authorized
project is selected in the OAuth flow. `GCP_PROJECT_NUMBER` is not required.
Generate `GCP_TOKEN_ENCRYPTION_KEY` with a Fernet key generator and keep it in
the backend secret manager. Do not put any of these secrets in frontend
environment variables.

`GOOGLE_APPLICATION_CREDENTIALS` remains an optional local-only compatibility
fallback for existing non-customer development code. It is not part of the
customer OAuth flow and no customer service-account private key is required.

The backend startup log and `/health` response report missing project, OAuth,
encryption, or service-role configuration explicitly without exposing secret
values.

## Google Cloud setup

1. Create a Google OAuth client of type **Web application**.
2. Add the exact backend callback URL as an authorized redirect URI.
3. Configure the OAuth consent screen and request the `cloud-platform` scope.
4. Enable the Vertex AI API in each customer project.
5. Grant the authorizing Google user the minimum Vertex permissions required by
   the product, normally `roles/aiplatform.user`, plus service-usage permission
   if required by the project. Project discovery additionally requires the user
   to be able to search/list the projects they want to select.

Vertex IAM guidance is in [Vertex AI access control](https://cloud.google.com/vertex-ai/docs/general/access-control).
The backend uses Google OAuth user credentials and refreshes them through
Google's supported credential flow; ADC is not used for customer authorization.

## Supabase database migration

The existing metadata table must include the tenant/provider fields:

```sql
alter table public.gcp_connections
  add column if not exists organization_id uuid,
  add column if not exists provider text not null default 'vertex-ai';
```

Create a separate server-only secret table:

```sql
create table if not exists public.gcp_connection_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_id uuid not null,
  refresh_token_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gcp_connection_secrets enable row level security;
```

Do not add an anon/authenticated policy that exposes this table. The backend
uses the Supabase service-role key for this table and stores ciphertext only.
The service-role key and encryption key must be rotated through the deployment
secret manager, never committed to Git, logged, or sent to the frontend.

## Security properties

- Supabase bearer sessions establish platform identity; client `user_id` and
  `organization_id` fields are not trusted.
- OAuth state is signed, time-limited, bound to the platform user, and consumed
  once to prevent CSRF and replay.
- Google client secret and refresh tokens stay on the backend.
- Raw JSON keys, private keys, access tokens, and refresh tokens are not stored
  in Supabase or returned by an API.
- Model discovery is filtered through the maintained Vertex catalog before
  models enter the unified router.
- AWS Bedrock files and its existing connection flow remain unchanged.

## Verification checklist

```text
python -m pytest -q
python -m compileall -q app main.py
```

A local test run without OAuth client settings, Supabase service-role storage,
and a real customer Google session must not claim a connected GCP account. The
real success criterion is a live callback followed by a successful Vertex API
call and model discovery.
