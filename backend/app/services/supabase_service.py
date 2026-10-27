import uuid
import datetime
from typing import Optional, Dict, Any, List
import httpx
from app.config import settings
from app.schemas import ConnectionResponse, GCPConnectionResponse, ModelSchema

def ensure_uuid(user_id_str: str) -> str:
    """Ensure the user ID is a valid 36-character UUID format for PostgreSQL."""
    try:
        val = uuid.UUID(user_id_str)
        return str(val)
    except ValueError:
        # Convert string (e.g. demo ID) to a deterministic valid UUID
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, user_id_str))

def get_supabase_headers() -> Dict[str, str]:
    # Use Service Role key if available to bypass RLS for server-side persistence, otherwise use Anon key
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY or ""
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

async def fetch_connection_from_supabase(user_id: str) -> Optional[ConnectionResponse]:
    if not settings.SUPABASE_URL or not (settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY):
        return None

    clean_user_id = ensure_uuid(user_id)
    url = f"{settings.SUPABASE_URL}/rest/v1/connections?user_id=eq.{clean_user_id}&select=*"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=get_supabase_headers(), timeout=5.0)
            if res.status_code == 200:
                rows = res.json()
                if rows and len(rows) > 0:
                    row = rows[0]
                    raw_models = row.get("available_models") or []
                    models = [ModelSchema(**m) for m in raw_models]
                    
                    return ConnectionResponse(
                        provider="aws-bedrock",
                        status=row.get("status", "pending"),
                        roleArn=row.get("role_arn"),
                        error=row.get("error"),
                        availableModels=models,
                        verifiedAt=row.get("verified_at"),
                        lastSyncedAt=row.get("last_synced_at")
                    )
            else:
                print(f"Supabase GET connection status {res.status_code}: {res.text}")
    except Exception as e:
        print(f"Error fetching connection from Supabase for user {user_id}: {e}")
    return None

async def save_connection_to_supabase(
    user_id: str, 
    role_arn: str, 
    status: str, 
    available_models: List[ModelSchema], 
    error: Optional[str] = None
) -> Optional[ConnectionResponse]:
    if not settings.SUPABASE_URL or not (settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY):
        return None

    clean_user_id = ensure_uuid(user_id)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    models_json = [m.model_dump() for m in available_models]

    payload = {
        "user_id": clean_user_id,
        "external_id": clean_user_id,
        "role_arn": role_arn,
        "status": status,
        "available_models": models_json,
        "error": error,
        "last_synced_at": now_iso
    }
    
    if status == "verified":
        payload["verified_at"] = now_iso

    url = f"{settings.SUPABASE_URL}/rest/v1/connections?on_conflict=user_id"
    headers = get_supabase_headers()
    headers["Prefer"] = "resolution=merge-duplicates,return=representation"

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, headers=headers, json=payload, timeout=5.0)
            if res.status_code in (200, 201):
                rows = res.json()
                if rows:
                    row = rows[0]
                    return ConnectionResponse(
                        provider="aws-bedrock",
                        status=row.get("status", "pending"),
                        roleArn=row.get("role_arn"),
                        error=row.get("error"),
                        availableModels=available_models,
                        verifiedAt=row.get("verified_at"),
                        lastSyncedAt=row.get("last_synced_at")
                    )
            else:
                print(f"Supabase POST connection status {res.status_code}: {res.text}")
    except Exception as e:
        print(f"Error saving connection to Supabase for user {user_id}: {e}")
    return None


async def fetch_gcp_connection_from_supabase(user_id: str) -> Optional[GCPConnectionResponse]:
    """Fetch the user's Vertex AI connection without storing credentials."""
    if not settings.SUPABASE_URL or not (settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY):
        return None

    clean_user_id = ensure_uuid(user_id)
    url = f"{settings.SUPABASE_URL}/rest/v1/gcp_connections?user_id=eq.{clean_user_id}&select=*"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=get_supabase_headers(), timeout=5.0)
            if res.status_code == 200:
                rows = res.json()
                if rows:
                    row = rows[0]
                    models = [ModelSchema(**m) for m in (row.get("available_models") or [])]
                    return GCPConnectionResponse(
                        provider="vertex-ai",
                        status=row.get("status", "pending"),
                        projectId=row.get("project_id"),
                        organizationId=row.get("organization_id"),
                        projectNumber=row.get("project_number"),
                        region=row.get("region"),
                        error=row.get("error"),
                        availableModels=models,
                        verifiedAt=row.get("verified_at"),
                        lastSyncedAt=row.get("last_synced_at"),
                    )
    except Exception as error:
        print(f"Error fetching GCP connection from Supabase for user {user_id}: {error}")
    return None


async def save_gcp_connection_to_supabase(
    user_id: str,
    project_id: str,
    project_number: Optional[str],
    region: str,
    status: str,
    available_models: List[ModelSchema],
    error: Optional[str] = None,
    organization_id: Optional[str] = None,
) -> Optional[GCPConnectionResponse]:
    """Persist only non-secret Vertex connection metadata."""
    if not settings.SUPABASE_URL or not (settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY):
        return None

    clean_user_id = ensure_uuid(user_id)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    payload = {
        "user_id": clean_user_id,
        "organization_id": ensure_uuid(organization_id or user_id),
        "provider": "vertex-ai",
        "project_id": project_id,
        "project_number": project_number,
        "region": region,
        "status": status,
        "available_models": [m.model_dump() for m in available_models],
        "error": error,
        "last_synced_at": now_iso,
    }
    if status == "verified":
        payload["verified_at"] = now_iso

    url = f"{settings.SUPABASE_URL}/rest/v1/gcp_connections?on_conflict=user_id"
    headers = get_supabase_headers()
    headers["Prefer"] = "resolution=merge-duplicates,return=representation"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, headers=headers, json=payload, timeout=5.0)
            if res.status_code in (200, 201):
                rows = res.json()
                if rows:
                    row = rows[0]
                    return GCPConnectionResponse(
                        provider="vertex-ai",
                        status=row.get("status", status),
                        projectId=row.get("project_id", project_id),
                        organizationId=row.get("organization_id", None),
                        projectNumber=row.get("project_number", project_number),
                        region=row.get("region", region),
                        error=row.get("error", error),
                        availableModels=available_models,
                        verifiedAt=row.get("verified_at"),
                        lastSyncedAt=row.get("last_synced_at"),
                    )
            else:
                print(f"Supabase POST GCP connection status {res.status_code}: {res.text}")
    except Exception as error:
        print(f"Error saving GCP connection for user {user_id}: {error}")
    return None


async def fetch_gcp_oauth_secret_from_supabase(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch encrypted OAuth material; never return raw credentials."""
    # OAuth ciphertext is server-only data. Do not fall back to the anon key,
    # even if a permissive RLS policy exists by mistake.
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    clean_user_id = ensure_uuid(user_id)
    url = f"{settings.SUPABASE_URL}/rest/v1/gcp_connection_secrets?user_id=eq.{clean_user_id}&select=*"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=get_supabase_headers(), timeout=5.0)
            if response.status_code == 200:
                rows = response.json()
                return rows[0] if rows else None
            print(f"Supabase GET GCP OAuth secret status {response.status_code}")
    except Exception as error:
        print(f"Error fetching GCP OAuth secret for user {user_id}: {type(error).__name__}")
    return None


async def save_gcp_oauth_secret_to_supabase(
    *, user_id: str, organization_id: str, refresh_token_ciphertext: str
) -> bool:
    """Persist only encrypted refresh-token ciphertext."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("A Supabase service-role backend connection is required for GCP authorization storage.")
    clean_user_id = ensure_uuid(user_id)
    payload = {
        "user_id": clean_user_id,
        "organization_id": ensure_uuid(organization_id),
        "refresh_token_ciphertext": refresh_token_ciphertext,
    }
    url = f"{settings.SUPABASE_URL}/rest/v1/gcp_connection_secrets?on_conflict=user_id"
    headers = get_supabase_headers()
    headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=5.0)
            if response.status_code in (200, 201, 204):
                return True
            print(f"Supabase POST GCP OAuth secret status {response.status_code}")
    except Exception as error:
        print(f"Error saving GCP OAuth secret for user {user_id}: {type(error).__name__}")
    raise RuntimeError("Google authorization could not be securely stored.")


async def delete_gcp_oauth_secret_from_supabase(user_id: str) -> None:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return
    clean_user_id = ensure_uuid(user_id)
    url = f"{settings.SUPABASE_URL}/rest/v1/gcp_connection_secrets?user_id=eq.{clean_user_id}"
    try:
        async with httpx.AsyncClient() as client:
            await client.delete(url, headers=get_supabase_headers(), timeout=5.0)
    except Exception as error:
        print(f"Error deleting GCP OAuth secret for user {user_id}: {type(error).__name__}")
