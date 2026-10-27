from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.services.pii_guardrail import (
    PIIFinding,
    PIIGuardrail,
    PIIGuardrailError,
    PIIScanResult,
    settings_from_config,
)


def test_pii_policy_defaults_disabled_and_validates_actions():
    assert settings_from_config({}).enabled is False
    assert settings_from_config({"enabled": True, "action": "MASK"}).action == "MASK"
    with pytest.raises(ValueError):
        settings_from_config({"action": "REDACT"})


def test_presidio_findings_do_not_expose_values_and_mask():
    service = PIIGuardrail()

    class FakeAnalyzer:
        def analyze(self, **_kwargs):
            return [SimpleNamespace(entity_type="EMAIL_ADDRESS", score=0.91, start=6, end=23)]

    class FakeAnonymizer:
        def anonymize(self, **_kwargs):
            return SimpleNamespace(text="Email: <EMAIL_ADDRESS>")

    service._initialized = True
    service._analyzer = FakeAnalyzer()
    service._anonymizer = FakeAnonymizer()
    service._operator_config_factory = lambda *args: object()

    result = service.apply(
        "Email: alice@example.com",
        {"enabled": True, "action": "MASK", "entities": ["EMAIL_ADDRESS"]},
    )

    assert result.text == "Email: <EMAIL_ADDRESS>"
    assert result.changed is True
    assert result.findings == (PIIFinding("EMAIL_ADDRESS", 1, 0.91),)
    assert "alice@example.com" not in repr(result.findings)


def test_block_action_keeps_text_unchanged_and_reports_detection():
    service = PIIGuardrail()

    class FakeAnalyzer:
        def analyze(self, **_kwargs):
            return [SimpleNamespace(entity_type="PHONE_NUMBER", score=0.8)]

    service._initialized = True
    service._analyzer = FakeAnalyzer()
    service._anonymizer = object()

    result = service.apply("Call +91 9999999999", {"enabled": True, "action": "BLOCK"})
    assert result.detected is True
    assert result.changed is False
    assert result.text == "Call +91 9999999999"


def test_failure_mode_allow_does_not_bypass_by_default():
    service = PIIGuardrail()
    with patch.object(service, "_initialize", side_effect=PIIGuardrailError("unavailable")):
        with pytest.raises(PIIGuardrailError):
            service.apply("alice@example.com", {"enabled": True, "action": "ALLOW"})
        result = service.apply(
            "alice@example.com",
            {"enabled": True, "action": "ALLOW", "failure_mode": "ALLOW"},
        )
    assert result.text == "alice@example.com"
    assert result.findings == ()
