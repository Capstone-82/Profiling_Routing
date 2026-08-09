import uuid
import datetime
from typing import Optional, Dict, Any, List
import httpx
from app.config import settings
from app.schemas import ConnectionResponse, ModelSchema

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
