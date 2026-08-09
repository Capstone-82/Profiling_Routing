import re
import datetime
from typing import Tuple, List, Dict, Any
import boto3
from botocore.exceptions import ClientError, BotoCoreError

from app.schemas import ModelSchema, ConnectionResponse
from app.config import settings

ROLE_ARN_REGEX = r"^arn:aws:iam::\d{12}:role/[\w+=,.@-]+$"

def validate_role_arn(role_arn: str) -> Tuple[bool, str]:
    if not role_arn or not role_arn.strip():
        return False, "Role ARN cannot be empty."
    
    cleaned = role_arn.strip()
    if not cleaned.startswith("arn:aws:iam::"):
        return False, "Invalid Role ARN format. Expected: arn:aws:iam::<ACCOUNT_ID>:role/<ROLE_NAME>"
    
    if not re.match(ROLE_ARN_REGEX, cleaned):
        return False, "Malformed Role ARN. Must match format: arn:aws:iam::<12-digit-account-id>:role/<role-name>"
    
    return True, ""

def infer_category_and_context(model_id: str, provider_name: str) -> Tuple[str, str]:
    model_id_lower = model_id.lower()
    
    # Context window estimation
    if "claude-3-5" in model_id_lower or "claude-3" in model_id_lower:
        context = "200K tokens"
    elif "nova" in model_id_lower:
        context = "300K tokens"
    elif "llama3-1" in model_id_lower or "llama-3.1" in model_id_lower:
        context = "128K tokens"
    elif "command-r" in model_id_lower:
        context = "128K tokens"
    elif "mistral" in model_id_lower:
        context = "32K tokens"
    else:
        context = "128K tokens"
        
    # Category estimation
    if "sonnet" in model_id_lower or "opus" in model_id_lower or "70b" in model_id_lower or "large" in model_id_lower:
        category = "Quality-First"
    elif "haiku" in model_id_lower or "lite" in model_id_lower or "8b" in model_id_lower or "micro" in model_id_lower:
        category = "Speed & Economy"
    elif "pro" in model_id_lower or "instruct" in model_id_lower:
        category = "Balanced"
    else:
        category = "General"
        
    return category, context

def format_bedrock_model(raw_summary: Dict[str, Any], index: int) -> ModelSchema:
    model_id = raw_summary.get("modelId", f"unknown-model-{index}")
    model_name = raw_summary.get("modelName", model_id)
    provider_name = raw_summary.get("providerName", "AWS Bedrock")
    
    input_modalities = raw_summary.get("inputModalities", [])
    output_modalities = raw_summary.get("outputModalities", [])
    streaming = raw_summary.get("responseStreamingSupported", False)
    
    category, context_window = infer_category_and_context(model_id, provider_name)
    
    return ModelSchema(
        id=f"model-{index + 1}",
        name=model_name,
        provider=provider_name,
        providerModelId=model_id,
        contextWindow=context_window,
        category=category,
        inputModalities=input_modalities,
        outputModalities=output_modalities,
        responseStreamingSupported=streaming
    )

def verify_aws_bedrock_connection(
    role_arn: str, 
    external_id: str = "demo-user-id", 
    region: str = None,
    sts_client=None,
    bedrock_client=None
) -> ConnectionResponse:
    if region is None:
        region = settings.AWS_REGION
        
    role_arn = role_arn.strip()
    is_valid, err_msg = validate_role_arn(role_arn)
    if not is_valid:
        return ConnectionResponse(
            provider="aws-bedrock",
            status="failed",
            roleArn=role_arn,
            error=err_msg,
            availableModels=[]
        )

    try:
        # Step 1: Assume Role via STS (unless stubbed/passed in for testing)
        if sts_client is None:
            sts_client = boto3.client("sts", region_name=region)
            
        session_name = f"BedrockConnTest-{external_id[:8]}" if external_id else "BedrockConnTest"
        
        assumed = sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName=session_name,
            ExternalId=external_id
        )
        
        creds = assumed.get("Credentials", {})
        access_key = creds.get("AccessKeyId")
        secret_key = creds.get("SecretAccessKey")
        session_token = creds.get("SessionToken")

        # Step 2: Call Bedrock ListFoundationModels with assumed credentials
        if bedrock_client is None:
            bedrock_client = boto3.client(
                "bedrock",
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                aws_session_token=session_token
            )
            
        models_response = bedrock_client.list_foundation_models()
        summaries = models_response.get("modelSummaries", [])
        
        # Filter TEXT models (or active models)
        formatted_models: List[ModelSchema] = []
        for idx, raw in enumerate(summaries):
            # Only include models supporting TEXT input/output or TEXT output
            input_mods = raw.get("inputModalities", [])
            output_mods = raw.get("outputModalities", [])
            if "TEXT" in input_mods or "TEXT" in output_mods:
                formatted_models.append(format_bedrock_model(raw, len(formatted_models)))

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        return ConnectionResponse(
            provider="aws-bedrock",
            status="verified",
            roleArn=role_arn,
            availableModels=formatted_models,
            verifiedAt=now_iso,
            lastSyncedAt=now_iso
        )

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "ClientError")
        error_msg = e.response.get("Error", {}).get("Message", str(e))

        if error_code in ("AccessDenied", "AccessDeniedException"):
            trusted_account = settings.AWS_TRUSTED_ACCOUNT_ID
            detailed_msg = (
                f"AccessDeniedException: Unable to verify role via STS AssumeRole. "
                f"Verify that the CloudFormation stack TrustedAccountId is set to '{trusted_account}' "
                f"and ExternalId is set to '{external_id}'. "
                f"Original AWS error: {error_msg}"
            )
        elif error_code == "InvalidParameterValue":
            detailed_msg = f"Invalid parameter provided to AWS STS: {error_msg}"
        else:
            detailed_msg = f"AWS ClientError [{error_code}]: {error_msg}"

        return ConnectionResponse(
            provider="aws-bedrock",
            status="failed",
            roleArn=role_arn,
            error=detailed_msg,
            availableModels=[]
        )

    except BotoCoreError as e:
        return ConnectionResponse(
            provider="aws-bedrock",
            status="failed",
            roleArn=role_arn,
            error=f"AWS BotoCore Error: {str(e)}",
            availableModels=[]
        )

    except Exception as e:
        return ConnectionResponse(
            provider="aws-bedrock",
            status="failed",
            roleArn=role_arn,
            error=f"Unexpected error testing AWS connection: {str(e)}",
            availableModels=[]
        )
