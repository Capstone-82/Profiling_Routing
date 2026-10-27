from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.auth.supabase_auth import CurrentUser, get_current_user
from app.config import settings
from app.schemas import (
    GCPAuthorizationResponse,
    GCPConnectionRequest,
    GCPConnectionResponse,
    GCPProjectSchema,
    ModelSchema,
)
from app.services.gcp.gcp_service import gcp_service
from app.services.gcp.oauth_service import (
    GCPOAuthConfigurationError,
    GCPOAuthStateError,
    gcp_oauth_service,
)
from app.services.gcp.project_discovery import discover_accessible_projects
from app.services.gcp.token_store import (
    GCPTokenStoreError,
    delete_gcp_refresh_token,
    load_gcp_oauth_credentials,
    store_gcp_refresh_token,
)
from app.services.supabase_service import (
    fetch_gcp_connection_from_supabase,
    save_gcp_connection_to_supabase,
)

router = APIRouter(prefix="/api/gcp", tags=["Google Cloud / Vertex AI"])
GCP_CONNECTIONS: dict[str, GCPConnectionResponse] = {}


async def get_gcp_connection_for_user(user_id: str) -> GCPConnectionResponse:
    stored = await fetch_gcp_connection_from_supabase(user_id)
    if stored:
        GCP_CONNECTIONS[user_id] = stored
        return stored
    return GCP_CONNECTIONS.get(
        user_id,
        GCPConnectionResponse(provider="vertex-ai", status="not_connected", availableModels=[]),
    )


async def get_gcp_connection(x_user_id: Optional[str] = None) -> GCPConnectionResponse:
    """Internal compatibility helper; callers must derive x_user_id securely."""
    return await get_gcp_connection_for_user(x_user_id or "demo-user-uuid")


def _frontend_redirect(status: str, error: Optional[str] = None) -> RedirectResponse:
    params = {"gcp": status}
    if error:
        params["gcp_error"] = error[:500]
    target = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/connections?{urlencode(params)}"
    return RedirectResponse(url=target, status_code=303)


@router.get("/connect", response_model=GCPAuthorizationResponse)
async def connect_google_cloud(
    project_id: Optional[str] = Query(None, alias="projectId"),
    region: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        authorization_url = gcp_oauth_service.authorization_url(
            user_id=current_user.user_id,
            organization_id=current_user.organization_id,
            project_id=project_id,
            region=region or settings.GCP_REGION,
        )
    except GCPOAuthConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return GCPAuthorizationResponse(
        provider="vertex-ai",
        status="pending",
        authorizationUrl=authorization_url,
    )


@router.get("/callback", include_in_schema=False)
async def google_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    if error:
        return _frontend_redirect("failed", "Google authorization was cancelled or denied.")
    if not code or not state:
        return _frontend_redirect("failed", "Google authorization returned an incomplete response.")

    try:
        state_data, credentials = gcp_oauth_service.exchange_code(code=code, state=state)
        # A blank project in the UI means "let the customer choose". Do not
        # silently substitute the platform operator's optional fallback project.
        project_id = state_data.project_id or None
        if not project_id:
            projects = discover_accessible_projects(credentials)
            if len(projects) != 1:
                await store_gcp_refresh_token(
                    user_id=state_data.user_id,
                    organization_id=state_data.organization_id,
                    refresh_token=credentials.refresh_token or "",
                )
                return _frontend_redirect(
                    "project_required",
                    "Select the GCP project to authorize for Vertex AI.",
                )
            project_id = projects[0]["projectId"]

        result = gcp_service.verify_connection(
            project_id=project_id,
            region=state_data.region,
            credentials=credentials,
        )
        if result.status != "verified":
            return _frontend_redirect("failed", result.error or "Vertex AI access could not be verified.")

        await store_gcp_refresh_token(
            user_id=state_data.user_id,
            organization_id=state_data.organization_id,
            refresh_token=credentials.refresh_token or "",
        )
        await save_gcp_connection_to_supabase(
            user_id=state_data.user_id,
            organization_id=state_data.organization_id,
            project_id=result.projectId or project_id,
            project_number=result.projectNumber,
            region=result.region or state_data.region,
            status="verified",
            available_models=result.availableModels,
            error=None,
        )
        GCP_CONNECTIONS[state_data.user_id] = result
        return _frontend_redirect("connected")
    except (GCPOAuthConfigurationError, GCPOAuthStateError, GCPTokenStoreError, ValueError) as error:
        return _frontend_redirect("failed", str(error))
    except Exception:
        return _frontend_redirect("failed", "Google authorization could not be completed securely.")


@router.get("/connection", response_model=GCPConnectionResponse)
async def get_connection(current_user: CurrentUser = Depends(get_current_user)):
    return await get_gcp_connection_for_user(current_user.user_id)


@router.get("/projects", response_model=list[GCPProjectSchema])
async def get_projects(current_user: CurrentUser = Depends(get_current_user)):
    try:
        credentials = await load_gcp_oauth_credentials(current_user.user_id)
        return discover_accessible_projects(credentials)
    except GCPTokenStoreError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except Exception:
        raise HTTPException(status_code=502, detail="Authorized GCP projects could not be discovered.")


@router.post("/connection/test", response_model=GCPConnectionResponse)
async def test_connection(
    req: GCPConnectionRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    current = await get_gcp_connection_for_user(current_user.user_id)
    project_id = (req.project_id or current.projectId or settings.GCP_PROJECT_ID).strip()
    region = (req.region or current.region or settings.GCP_REGION).strip()
    if not project_id:
        raise HTTPException(status_code=400, detail="Select a GCP project before testing Vertex AI access.")
    try:
        credentials = await load_gcp_oauth_credentials(current_user.user_id, project_id)
    except GCPTokenStoreError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error

    result = gcp_service.verify_connection(
        project_id=project_id,
        region=region,
        credentials=credentials,
    )
    await save_gcp_connection_to_supabase(
        user_id=current_user.user_id,
        organization_id=current_user.organization_id,
        project_id=result.projectId or project_id,
        project_number=result.projectNumber,
        region=result.region or region,
        status=result.status,
        available_models=result.availableModels,
        error=result.error,
    )
    GCP_CONNECTIONS[current_user.user_id] = result
    return result


@router.post("/models/discover", response_model=list[ModelSchema])
async def discover_models(current_user: CurrentUser = Depends(get_current_user)):
    connection = await get_gcp_connection_for_user(current_user.user_id)
    if connection.status != "verified" or not connection.projectId or not connection.region:
        raise HTTPException(status_code=403, detail="Vertex AI connection is not verified.")
    try:
        credentials = await load_gcp_oauth_credentials(current_user.user_id, connection.projectId)
        models = gcp_service.discover_models(
            connection.projectId,
            connection.region,
            credentials=credentials,
        )
    except GCPTokenStoreError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    refreshed = connection.model_copy(update={"availableModels": models})
    GCP_CONNECTIONS[current_user.user_id] = refreshed
    await save_gcp_connection_to_supabase(
        user_id=current_user.user_id,
        organization_id=current_user.organization_id,
        project_id=connection.projectId,
        project_number=connection.projectNumber,
        region=connection.region,
        status="verified",
        available_models=models,
        error=None,
    )
    return models


@router.get("/models", response_model=list[ModelSchema])
async def get_models(current_user: CurrentUser = Depends(get_current_user)):
    connection = await get_gcp_connection_for_user(current_user.user_id)
    return connection.availableModels if connection.status == "verified" else []


@router.post("/connection/reset", response_model=GCPConnectionResponse)
@router.delete("/connection", response_model=GCPConnectionResponse)
async def reset_connection(current_user: CurrentUser = Depends(get_current_user)):
    current = await get_gcp_connection_for_user(current_user.user_id)
    await delete_gcp_refresh_token(current_user.user_id)
    reset = GCPConnectionResponse(
        provider="vertex-ai",
        status="not_connected",
        projectId=current.projectId,
        organizationId=current_user.organization_id,
        projectNumber=current.projectNumber,
        region=current.region,
        availableModels=[],
    )
    GCP_CONNECTIONS[current_user.user_id] = reset
    if current.projectId and current.region:
        await save_gcp_connection_to_supabase(
            user_id=current_user.user_id,
            organization_id=current_user.organization_id,
            project_id=current.projectId,
            project_number=current.projectNumber,
            region=current.region,
            status="not_connected",
            available_models=[],
            error=None,
        )
    return reset
