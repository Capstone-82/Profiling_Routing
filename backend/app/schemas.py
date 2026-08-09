from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class ModelSchema(BaseModel):
    id: str
    name: str
    provider: str
    providerModelId: str
    contextWindow: Optional[str] = "200K tokens"
    category: Optional[str] = "General"
    inputModalities: Optional[List[str]] = []
    outputModalities: Optional[List[str]] = []
    responseStreamingSupported: Optional[bool] = False

class ConnectionRequest(BaseModel):
    role_arn: str = Field(..., alias="roleArn", description="AWS IAM Role ARN pasted by user")
    external_id: Optional[str] = Field(None, alias="externalId", description="User Supabase UUID external ID")

    model_config = ConfigDict(populate_by_name=True)


class ConnectionResponse(BaseModel):
    provider: str = "aws-bedrock"
    status: str  # 'not_connected' | 'pending' | 'verified' | 'failed'
    roleArn: Optional[str] = None
    error: Optional[str] = None
    availableModels: List[ModelSchema] = []
    verifiedAt: Optional[str] = None
    lastSyncedAt: Optional[str] = None

class PromptRequest(BaseModel):
    prompt: str
    selectedModelIds: List[str]

class ModelResponse(BaseModel):
    text: str
    model_used: str
    model_used_name: str
    fallback_used: bool = False
    fallback_from: Optional[str] = None
    tokens_used: Optional[int] = None
    estimated_cost: Optional[float] = None
    latency_ms: Optional[float] = None
