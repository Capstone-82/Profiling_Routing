import pytest

from app.services.hallucination_guardrail import (
    HallucinationFinding,
    HallucinationGuardrail,
    HallucinationGuardrailError,
    HallucinationVerification,
    settings_from_config,
)


class FakeProvider:
    def __init__(self, result):
        self.result = result

    def verify(self, _response, _evidence):
        return self.result


def finding(status, confidence=0.9):
    return HallucinationFinding("The claim", status, confidence, "test explanation")


def test_supported_contradicted_and_insufficient_evidence_statuses():
    supported = HallucinationGuardrail(FakeProvider(HallucinationVerification(
        "SUPPORTED", 0.94, (finding("SUPPORTED", 0.94),), "supported"
    ))).scan("The claim.", ["evidence"], {"enabled": True})
    assert supported.status == "SUPPORTED"

    contradicted = HallucinationGuardrail(FakeProvider(HallucinationVerification(
        "CONTRADICTED", 0.91, (finding("CONTRADICTED", 0.91),), "contradicted"
    ))).scan("The claim.", ["evidence"], {"enabled": True})
    assert contradicted.requires_action

    limited = HallucinationGuardrail().scan("A claim without evidence.", [], {"enabled": True})
    assert limited.status == "INSUFFICIENT_EVIDENCE"
    assert limited.confidence == 0


def test_multiple_findings_and_malformed_provider_output():
    result = HallucinationVerification(
        "INSUFFICIENT_EVIDENCE", 0.2,
        (finding("SUPPORTED", 0.9), finding("INSUFFICIENT_EVIDENCE", 0.0)),
        "mixed",
    )
    assert len(HallucinationGuardrail(FakeProvider(result)).scan("text", ["evidence"], {"enabled": True}).findings) == 2
    with pytest.raises(HallucinationGuardrailError):
        HallucinationGuardrail(FakeProvider({"status": "SUPPORTED"})).scan("text", ["evidence"], {"enabled": True})


def test_failure_modes_and_configuration():
    with pytest.raises(HallucinationGuardrailError):
        HallucinationGuardrail(FakeProvider(None)).apply("text", ["evidence"], {"enabled": True})
    allowed = HallucinationGuardrail(FakeProvider(None)).apply(
        "text", ["evidence"], {"enabled": True, "failure_mode": "ALLOW"}
    )
    assert allowed.status == "REVIEW_REQUIRED"
    with pytest.raises(ValueError):
        settings_from_config({"action": "MASK"})

