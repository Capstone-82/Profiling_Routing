"""Provider-neutral invocation dispatch.

The routing engine selects a cloud provider along with a model. This module is
the only place that translates that selection into a provider-specific call.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict

from app.services.bedrock_invoke_service import bedrock_invoke_service
from app.services.gcp.vertex_ai_service import vertex_ai_service
from app.services.gcp.token_store import load_gcp_oauth_credentials


class ModelProvider(ABC):
    key: str

    @abstractmethod
    async def invoke(
        self,
        connection: Any,
        provider_model_id: str,
        prompt: str,
        max_tokens: int,
        user_id: str,
    ) -> Dict[str, Any]:
        raise NotImplementedError


class AWSBedrockProvider(ModelProvider):
    key = "aws-bedrock"

    async def invoke(self, connection, provider_model_id, prompt, max_tokens, user_id):
        return bedrock_invoke_service.invoke(
            role_arn=connection.roleArn,
            external_id=user_id,
            bedrock_model_id=provider_model_id,
            prompt=prompt,
            max_tokens=max_tokens,
        )


class GCPVertexAIProvider(ModelProvider):
    key = "vertex-ai"

    async def invoke(self, connection, provider_model_id, prompt, max_tokens, user_id):
        if not connection.projectId or not connection.region:
            raise ValueError("No verified Vertex AI connection is available for invocation.")
        credentials = await load_gcp_oauth_credentials(user_id, connection.projectId)
        return vertex_ai_service.invoke(
            project_id=connection.projectId,
            region=connection.region,
            model_id=provider_model_id,
            prompt=prompt,
            max_tokens=max_tokens,
            credentials=credentials,
        )


class ProviderDispatchService:
    def __init__(self):
        self.providers = {
            AWSBedrockProvider.key: AWSBedrockProvider(),
            GCPVertexAIProvider.key: GCPVertexAIProvider(),
        }

    async def invoke(self, cloud_provider: str, connection, provider_model_id: str, prompt: str, max_tokens: int, user_id: str):
        provider = self.providers.get(cloud_provider)
        if provider is None:
            raise ValueError(f"Unsupported model cloud provider: {cloud_provider}")
        return await provider.invoke(connection, provider_model_id, prompt, max_tokens, user_id)


provider_dispatch_service = ProviderDispatchService()
