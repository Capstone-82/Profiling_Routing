"""Verify the Supabase session that represents the platform user.

The browser sends its Supabase access token. The backend validates that token
against Supabase Auth and derives the user and organization identifiers from
the verified response; client-supplied user headers are not trusted here.
"""

from dataclasses import dataclass
from typing import Any, Optional

import httpx
from fastapi import Header, HTTPException

from app.config import settings


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    organization_id: str
    email: Optional[str] = None


def _organization_id(user: dict[str, Any]) -> str:
    app_metadata = user.get("app_metadata") or {}
    user_metadata = user.get("user_metadata") or {}
    return str(
        app_metadata.get("organization_id")
        or user_metadata.get("organization_id")
        or user.get("id")
        or ""
    )


async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="A valid Supabase session is required.")
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured.")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="A valid Supabase session is required.")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": settings.SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {token}",
                },
                timeout=5.0,
            )
    except httpx.HTTPError as error:
        raise HTTPException(status_code=503, detail="Unable to validate the Supabase session.") from error

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="The Supabase session is invalid or expired.")

    try:
        user = response.json()
        user_id = str(user["id"])
    except (ValueError, KeyError, TypeError) as error:
        raise HTTPException(status_code=401, detail="The Supabase session response was invalid.") from error

    return CurrentUser(
        user_id=user_id,
        organization_id=_organization_id(user),
        email=user.get("email"),
    )
