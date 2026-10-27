import pytest

from app.services.racial_bias_guardrail import (
    ConservativeBaselineProvider,
    RacialBiasFinding,
    RacialBiasGuardrail,
    RacialBiasGuardrailError,
    RacialBiasResult,
    settings_from_config,
)


def test_detects_stereotype_and_differential_treatment():
    result = RacialBiasGuardrail().scan(
        "Black people are inherently violent and employers should reject them.",
        {"enabled": True, "confidence_threshold": 0.75},
    )
    categories = {finding.category for finding in result.findings}
    assert result.status == "POTENTIAL_BIAS"
    assert {"UNSUPPORTED_GENERALIZATION", "DIFFERENTIAL_TREATMENT"} <= categories


@pytest.mark.parametrize("text", [
    "This history lesson analyzes racism and discriminatory laws.",
    "The report quotes a stereotype in order to critique it.",
    "Anti-discrimination policy requires equal treatment for racial groups.",
])
def test_neutral_or_anti_discrimination_context_is_not_automatically_flagged(text):
    result = RacialBiasGuardrail().scan(text, {"enabled": True})
    assert result.status == "CLEAR"


def test_ambiguous_group_reference_is_clear_and_empty_text_safe():
    provider = ConservativeBaselineProvider()
    assert provider.detect("Asian food is discussed in this recipe.").status == "CLEAR"
    assert provider.detect("").status == "CLEAR"


def test_malformed_provider_and_failure_modes():
    class BadProvider:
        def detect(self, _text):
            return {"status": "POTENTIAL_BIAS"}

    guardrail = RacialBiasGuardrail(BadProvider())
    with pytest.raises(RacialBiasGuardrailError):
        guardrail.apply("text", {"enabled": True})

    class FailingProvider:
        def detect(self, _text):
            raise TimeoutError("offline")

    failing = RacialBiasGuardrail(FailingProvider())
    allowed = failing.apply("text", {"enabled": True, "failure_mode": "ALLOW"})
    assert allowed.status == "REVIEW_REQUIRED"
    with pytest.raises(ValueError):
        settings_from_config({"action": "MASK"})

