from unittest.mock import patch

import pytest

from app.services.toxicity_guardrail import (
    ToxicityFinding,
    ToxicityGuardrail,
    ToxicityGuardrailError,
    settings_from_config,
)


class FakeProvider:
    def __init__(self, scores):
        self.scores = scores

    def predict(self, _text):
        return self.scores


def test_toxicity_detects_categories_and_profanity_without_raw_text():
    guardrail = ToxicityGuardrail(
        FakeProvider({"toxicity": 0.94, "threat": 0.2, "insult": 0.81})
    )
    result = guardrail.scan(
        "You are an idiot, you fucking fool.",
        {"enabled": True, "action": "FLAG", "score_threshold": 0.7},
    )
    assert result.findings == (
        ToxicityFinding("insult", 0.81, 1),
        ToxicityFinding("profanity", 1.0, 1),
        ToxicityFinding("toxicity", 0.94, 1),
    )
    assert "idiot" not in repr(result.findings)


def test_threshold_and_allow_non_toxic_content():
    guardrail = ToxicityGuardrail(FakeProvider({"toxicity": 0.49, "insult": 0.1}))
    result = guardrail.scan(
        "This is an educational discussion of harmful language.",
        {"enabled": True, "action": "FLAG", "score_threshold": 0.7},
    )
    assert result.detected is False


def test_settings_reject_unknown_action():
    with pytest.raises(ValueError):
        settings_from_config({"action": "MASK"})


def test_provider_failure_fails_closed_or_configured_open():
    guardrail = ToxicityGuardrail()
    with patch.object(guardrail._provider, "predict", side_effect=ToxicityGuardrailError("offline")):
        with pytest.raises(ToxicityGuardrailError):
            guardrail.apply("unsafe text", {"enabled": True, "action": "FLAG"})
        result = guardrail.apply(
            "unsafe text",
            {"enabled": True, "action": "FLAG", "failure_mode": "ALLOW"},
        )
    assert result.detected is False
