"""Vertex AI generative-model invocation and response normalization."""

import logging
import time
from typing import Any, Dict, Optional

from app.services.gcp.auth import load_gcp_credentials
from app.services.gcp.model_discovery import describe_vertex_exception, validate_project_and_region

logger = logging.getLogger(__name__)


class VertexAIInvokeService:
    def _client(self, project_id: str, region: str, credentials=None, client_factory=None):
        if client_factory:
            return client_factory(project_id=project_id, region=region)
        from google import genai
        from google.genai.types import HttpOptions

        if credentials is None:
            credentials, _, _ = load_gcp_credentials(project_id)
        return genai.Client(
            vertexai=True,
            credentials=credentials,
            project=project_id,
            location=region,
            http_options=HttpOptions(api_version="v1"),
        )

    @staticmethod
    def _token_count(response: Any) -> Optional[int]:
        usage = getattr(response, "usage_metadata", None)
        if usage is None and isinstance(response, dict):
            usage = response.get("usage_metadata") or response.get("usageMetadata")
        if usage is None:
            return None
        values = []
        for name in ("total_token_count", "totalTokenCount"):
            value = getattr(usage, name, None) if not isinstance(usage, dict) else usage.get(name)
            if value is not None:
                return int(value)
        for name in ("prompt_token_count", "promptTokenCount", "candidates_token_count", "candidatesTokenCount"):
            value = getattr(usage, name, None) if not isinstance(usage, dict) else usage.get(name)
            if value is not None:
                values.append(int(value))
        return sum(values) if values else None

    @staticmethod
    def _text(response: Any) -> str:
        text = getattr(response, "text", None)
        if text:
            return str(text)
        if isinstance(response, dict):
            return str(response.get("text", ""))
        return ""

    def invoke(
        self,
        project_id: str,
        region: str,
        model_id: str,
        prompt: str,
        max_tokens: int = 1500,
        *,
        credentials=None,
        client_factory=None,
        generation_config_factory=None,
    ) -> Dict[str, Any]:
        project_id, region = validate_project_and_region(project_id, region)
        if not model_id.strip():
            raise ValueError("A Vertex AI model ID is required.")
        start = time.time()
        client = None
        try:
            client = self._client(
                project_id,
                region,
                credentials=credentials,
                client_factory=client_factory,
            )
            if generation_config_factory is None:
                from google.genai import types
                generation_config_factory = types.GenerateContentConfig

            response = client.models.generate_content(
                model=model_id,
                contents=prompt,
                config=generation_config_factory(
                    max_output_tokens=max_tokens,
                    temperature=0.7,
                ),
            )
            return {
                "text": self._text(response),
                "tokens_used": self._token_count(response),
                "latency_ms": round((time.time() - start) * 1000, 2),
            }
        except Exception as error:
            safe_error = describe_vertex_exception(error)
            logger.error(
                "Vertex AI invocation failed for %s/%s: %s",
                project_id,
                model_id,
                safe_error,
            )
            raise RuntimeError(safe_error) from error
        finally:
            close = getattr(client, "close", None)
            if callable(close):
                close()


vertex_ai_service = VertexAIInvokeService()
