import time
import json
import logging
from typing import Optional, Dict, Any, Tuple
import boto3
from botocore.exceptions import ClientError, BotoCoreError

from app.config import settings

logger = logging.getLogger(__name__)

class BedrockInvokeService:
    """
    Dispatches prompts to the target Bedrock foundation model using customer's IAM Role.
    Translates model-family request bodies (Anthropic, Nova, Llama, Mistral)
    and normalizes output text and token usage.
    """

    def _get_bedrock_runtime_client(
        self,
        role_arn: str,
        external_id: str,
        region: Optional[str] = None
    ):
        target_region = region or settings.AWS_REGION
        sts = boto3.client("sts", region_name=target_region)
        session_name = f"AIRouteDispatch-{external_id[:8]}" if external_id else "AIRouteDispatch"

        assumed = sts.assume_role(
            RoleArn=role_arn,
            RoleSessionName=session_name,
            ExternalId=external_id
        )
        creds = assumed["Credentials"]

        return boto3.client(
            "bedrock-runtime",
            region_name=target_region,
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
        )

    def _format_request_body(
        self,
        bedrock_model_id: str,
        prompt: str,
        max_tokens: int = 1500,
        temperature: float = 0.7,
    ) -> str:
        """Format request payload according to the model family schema."""
        m_lower = bedrock_model_id.lower()

        # 1. Anthropic Claude (Messages API format)
        if "anthropic.claude" in m_lower:
            payload = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt}
                        ]
                    }
                ]
            }
            return json.dumps(payload)

        # 2. Amazon Nova (Nova Micro, Lite, Pro, Premier)
        elif "amazon.nova" in m_lower:
            payload = {
                "messages": [
                    {
                        "role": "user",
                        "content": [{"text": prompt}]
                    }
                ],
                "inferenceConfig": {
                    "max_new_tokens": max_tokens,
                    "temperature": temperature,
                    "top_p": 0.9
                }
            }
            return json.dumps(payload)

        # 3. Meta Llama 3 / 3.1 / 3.3
        elif "meta.llama" in m_lower:
            formatted_prompt = f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
            payload = {
                "prompt": formatted_prompt,
                "max_gen_len": max_tokens,
                "temperature": temperature,
                "top_p": 0.9
            }
            return json.dumps(payload)

        # 4. Mistral / Codestral
        elif "mistral." in m_lower:
            formatted_prompt = f"<s>[INST] {prompt} [/INST]"
            payload = {
                "prompt": formatted_prompt,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": 0.9
            }
            return json.dumps(payload)

        # 5. Generic fallback
        else:
            payload = {
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
            return json.dumps(payload)

    def _parse_response_body(
        self,
        bedrock_model_id: str,
        response_body_bytes: bytes
    ) -> Tuple[str, int]:
        """Extract output text and token count from model family response payload."""
        data = json.loads(response_body_bytes.decode("utf-8"))
        m_lower = bedrock_model_id.lower()

        # 1. Anthropic Claude
        if "anthropic.claude" in m_lower:
            content_list = data.get("content", [])
            text_parts = [c.get("text", "") for c in content_list if c.get("type") == "text"]
            text = "".join(text_parts)
            usage = data.get("usage", {})
            tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
            return text, tokens

        # 2. Amazon Nova
        elif "amazon.nova" in m_lower:
            output = data.get("output", {})
            message = output.get("message", {})
            content = message.get("content", [])
            text_parts = [c.get("text", "") for c in content if "text" in c]
            text = "".join(text_parts)
            usage = data.get("usage", {})
            tokens = usage.get("inputTokens", 0) + usage.get("outputTokens", 0)
            return text, tokens

        # 3. Meta Llama
        elif "meta.llama" in m_lower:
            text = data.get("generation", "")
            tokens = data.get("prompt_token_count", 0) + data.get("generation_token_count", 0)
            return text, tokens

        # 4. Mistral
        elif "mistral." in m_lower:
            outputs = data.get("outputs", [])
            text = outputs[0].get("text", "") if outputs else ""
            tokens = int(len(text.split()) * 1.3)
            return text, tokens

        # 5. Generic fallback
        else:
            text = data.get("generation", data.get("text", str(data)))
            tokens = int(len(text.split()) * 1.3)
            return text, tokens

    def _resolve_bedrock_model_id(self, bedrock_model_id: str, region: Optional[str] = None) -> str:
        """
        Resolves foundation model ID to cross-region inference profile ID when required.
        AWS Bedrock requires system inference profiles (e.g. 'us.meta.llama3-1-8b-instruct-v1:0')
        for on-demand invocation of Llama models and other cross-region supported models.
        """
        target_region = region or settings.AWS_REGION or "us-east-1"
        prefix = "us." if target_region.startswith("us-") else ("eu." if target_region.startswith("eu-") else "us.")

        # Already an inference profile (system or custom ARN)
        if bedrock_model_id.startswith(("us.", "eu.", "ap.", "global.", "arn:aws:")):
            return bedrock_model_id

        # Meta Llama models require inference profile on Bedrock for on-demand invoke
        if bedrock_model_id.startswith("meta.llama"):
            return f"{prefix}{bedrock_model_id}"

        return bedrock_model_id

    def invoke(
        self,
        role_arn: Optional[str],
        external_id: str,
        bedrock_model_id: str,
        prompt: str,
        max_tokens: int = 1500,
        region: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes InvokeModel on AWS Bedrock via customer credentials.
        Returns: { 'text': str, 'tokens_used': int, 'latency_ms': float, 'simulated': bool }
        """
        if not role_arn or not role_arn.startswith("arn:aws:iam::"):
            raise ValueError("Valid AWS IAM Role ARN is required for Bedrock invocation.")

        start_time = time.time()
        actual_model_id = self._resolve_bedrock_model_id(bedrock_model_id, region=region)
        client = None

        try:
            client = self._get_bedrock_runtime_client(
                role_arn=role_arn,
                external_id=external_id,
                region=region
            )

            body_str = self._format_request_body(
                bedrock_model_id=actual_model_id,
                prompt=prompt,
                max_tokens=max_tokens
            )

            res = client.invoke_model(
                modelId=actual_model_id,
                contentType="application/json",
                accept="application/json",
                body=body_str
            )

            raw_body = res["body"].read()
            text, tokens = self._parse_response_body(actual_model_id, raw_body)
            latency = round((time.time() - start_time) * 1000, 2)

            return {
                "text": text,
                "tokens_used": tokens,
                "latency_ms": latency,
                "simulated": False
            }

        except (ClientError, BotoCoreError) as e:
            err_msg = str(e)
            # If failed because model requires an inference profile, attempt auto-recovery
            if ("inference profile" in err_msg.lower() or "on-demand throughput" in err_msg.lower()) and client:
                target_region = region or settings.AWS_REGION or "us-east-1"
                prefix = "us." if target_region.startswith("us-") else ("eu." if target_region.startswith("eu-") else "us.")
                if not actual_model_id.startswith(("us.", "eu.", "ap.", "global.")):
                    retry_model_id = f"{prefix}{actual_model_id}"
                    logger.info(f"Retrying invocation with cross-region inference profile: {retry_model_id}")
                    try:
                        retry_body_str = self._format_request_body(
                            bedrock_model_id=retry_model_id,
                            prompt=prompt,
                            max_tokens=max_tokens
                        )
                        retry_res = client.invoke_model(
                            modelId=retry_model_id,
                            contentType="application/json",
                            accept="application/json",
                            body=retry_body_str
                        )
                        raw_body = retry_res["body"].read()
                        text, tokens = self._parse_response_body(retry_model_id, raw_body)
                        latency = round((time.time() - start_time) * 1000, 2)
                        return {
                            "text": text,
                            "tokens_used": tokens,
                            "latency_ms": latency,
                            "simulated": False
                        }
                    except Exception as retry_err:
                        logger.error(f"Retry with inference profile {retry_model_id} also failed: {retry_err}")

            logger.error(f"Error invoking Bedrock model {bedrock_model_id} (attempted {actual_model_id}): {e}")
            raise e


bedrock_invoke_service = BedrockInvokeService()
