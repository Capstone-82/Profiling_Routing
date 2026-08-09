import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from botocore.exceptions import ClientError

from main import app
from app.services.aws_service import validate_role_arn, verify_aws_bedrock_connection

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_get_connection_default():
    response = client.get("/api/connection")
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "aws-bedrock"
    assert data["status"] in ("not_connected", "verified", "failed")

def test_validate_role_arn():
    # Empty
    valid, msg = validate_role_arn("")
    assert not valid
    assert "empty" in msg.lower()

    # Not starting with arn:aws:iam::
    valid, msg = validate_role_arn("https://aws.amazon.com")
    assert not valid
    assert "Invalid Role ARN format" in msg

    # Bad account ID length or format
    valid, msg = validate_role_arn("arn:aws:iam::12345:role/MyRole")
    assert not valid

    # Valid
    valid, msg = validate_role_arn("arn:aws:iam::123456789012:role/MyBedrockRole")
    assert valid
    assert msg == ""

def test_test_connection_invalid_arn():
    response = client.post(
        "/api/connection/test",
        json={"roleArn": "invalid-arn", "externalId": "test-uuid-123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert "Invalid Role ARN format" in data["error"]

def test_test_connection_sts_assume_role_failure():
    # Mock STS client throwing AccessDenied ClientError
    mock_sts = MagicMock()
    error_response = {
        "Error": {
            "Code": "AccessDenied",
            "Message": "User is not authorized to perform sts:AssumeRole"
        }
    }
    mock_sts.assume_role.side_effect = ClientError(error_response, "AssumeRole")

    valid_arn = "arn:aws:iam::123456789012:role/MyBedrockRole"
    res = verify_aws_bedrock_connection(
        role_arn=valid_arn,
        external_id="test-user-id",
        sts_client=mock_sts
    )

    assert res.status == "failed"
    assert "AccessDeniedException" in res.error
    assert res.availableModels == []

def test_test_connection_success():
    # Mock STS client returning temporary credentials
    mock_sts = MagicMock()
    mock_sts.assume_role.return_value = {
        "Credentials": {
            "AccessKeyId": "AKIAIOSFODNN7EXAMPLE",
            "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "SessionToken": "AQoDYXdzEJr1K5..."
        }
    }

    # Mock Bedrock client returning foundation model summaries
    mock_bedrock = MagicMock()
    mock_bedrock.list_foundation_models.return_value = {
        "modelSummaries": [
            {
                "modelId": "anthropic.claude-3-5-sonnet-20241022-v1:0",
                "modelName": "Claude 3.5 Sonnet",
                "providerName": "Anthropic",
                "inputModalities": ["TEXT"],
                "outputModalities": ["TEXT"],
                "responseStreamingSupported": True
            },
            {
                "modelId": "amazon.nova-pro-v1:0",
                "modelName": "Nova Pro",
                "providerName": "Amazon",
                "inputModalities": ["TEXT"],
                "outputModalities": ["TEXT"],
                "responseStreamingSupported": True
            }
        ]
    }

    valid_arn = "arn:aws:iam::123456789012:role/MyBedrockRole"
    
    res = verify_aws_bedrock_connection(
        role_arn=valid_arn,
        external_id="test-user-id",
        sts_client=mock_sts,
        bedrock_client=mock_bedrock
    )

    assert res.status == "verified"
    assert len(res.availableModels) == 2
    assert res.availableModels[0].providerModelId == "anthropic.claude-3-5-sonnet-20241022-v1:0"
    assert res.availableModels[0].category == "Quality-First"
    assert res.availableModels[1].providerModelId == "amazon.nova-pro-v1:0"
    assert res.verifiedAt is not None

def test_api_connection_flow():
    with patch("app.routes.connection.verify_aws_bedrock_connection") as mock_test:
        from app.schemas import ConnectionResponse, ModelSchema
        mock_test.return_value = ConnectionResponse(
            provider="aws-bedrock",
            status="verified",
            roleArn="arn:aws:iam::123456789012:role/TestRole",
            availableModels=[
                ModelSchema(
                    id="model-1",
                    name="Claude 3.5 Sonnet",
                    provider="Anthropic",
                    providerModelId="anthropic.claude-3-5-sonnet-20241022-v1:0"
                )
            ],
            verifiedAt="2026-08-09T12:00:00Z"
        )

        # POST test connection
        res = client.post("/api/connection/test", json={"roleArn": "arn:aws:iam::123456789012:role/TestRole"})
        assert res.status_code == 200
        assert res.json()["status"] == "verified"

        # GET models
        res_models = client.get("/api/connection/models")
        assert res_models.status_code == 200
        assert len(res_models.json()) == 1

        # POST reset
        res_reset = client.post("/api/connection/reset")
        assert res_reset.status_code == 200
        assert res_reset.json()["status"] == "not_connected"
