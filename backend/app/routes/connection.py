from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Header
from app.schemas import ConnectionRequest, ConnectionResponse, ModelSchema
from app.services.aws_service import verify_aws_bedrock_connection
from app.services.supabase_service import fetch_connection_from_supabase, save_connection_to_supabase

router = APIRouter(prefix="/api/connection", tags=["Connection"])

# In-memory dictionary per user ID (for local testing/fallback)
USER_CONNECTIONS: dict[str, ConnectionResponse] = {}

@router.get("", response_model=ConnectionResponse)
async def get_connection(x_user_id: Optional[str] = Header(None, alias="X-User-ID")):
    """Get connection status for the specified user."""
    user_id = x_user_id or "demo-user-uuid"

    # Try fetching from Supabase first
    supabase_conn = await fetch_connection_from_supabase(user_id)
    if supabase_conn:
        USER_CONNECTIONS[user_id] = supabase_conn
        return supabase_conn

    # Fallback to local memory dictionary per user
    return USER_CONNECTIONS.get(user_id, ConnectionResponse(
        provider="aws-bedrock",
        status="not_connected",
        availableModels=[]
    ))

@router.post("/test", response_model=ConnectionResponse)
async def test_connection(
    req: ConnectionRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    Test AWS Bedrock connection for a user by assuming the provided IAM Role ARN 
    and calling Bedrock ListFoundationModels.
    """
    user_id = req.external_id or x_user_id or "demo-user-uuid"

    # Run AWS STS AssumeRole + Bedrock ListFoundationModels verification
    res = verify_aws_bedrock_connection(role_arn=req.role_arn, external_id=user_id)

    # Save to Supabase DB per user
    await save_connection_to_supabase(
        user_id=user_id,
        role_arn=req.role_arn,
        status=res.status,
        available_models=res.availableModels,
        error=res.error
    )

    # Store in memory cache per user
    USER_CONNECTIONS[user_id] = res
    return res

@router.post("/reset", response_model=ConnectionResponse)
@router.delete("", response_model=ConnectionResponse)
async def reset_connection(x_user_id: Optional[str] = Header(None, alias="X-User-ID")):
    """Reset connection back to not_connected state for the specified user."""
    user_id = x_user_id or "demo-user-uuid"

    reset_res = ConnectionResponse(
        provider="aws-bedrock",
        status="not_connected",
        availableModels=[]
    )

    USER_CONNECTIONS[user_id] = reset_res

    await save_connection_to_supabase(
        user_id=user_id,
        role_arn="",
        status="not_connected",
        available_models=[],
        error=None
    )

    return reset_res

@router.get("/models", response_model=list[ModelSchema])
async def get_models(x_user_id: Optional[str] = Header(None, alias="X-User-ID")):
    """Get available models for verified user connection."""
    conn = await get_connection(x_user_id=x_user_id)
    if conn.status != "verified":
        return []
    return conn.availableModels
