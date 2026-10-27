import pytest

from app.services.conciseness_guardrail import (
    ConcisenessGuardrail,
    ConcisenessGuardrailError,
    settings_from_config,
    requested_length_from_prompt,
)


def test_counts_within_limits_and_empty_response():
    result = ConcisenessGuardrail().evaluate(
        "A short answer. It is clear.",
        {"enabled": True, "max_words": 10, "max_characters": 100, "max_sentences": 3},
    )
    assert result.detected is False
    assert result.word_count == 6
    assert result.sentence_count == 2
    assert ConcisenessGuardrail().evaluate("", {"enabled": True}).word_count == 0


def test_each_limit_and_repetition_are_reported():
    result = ConcisenessGuardrail().evaluate(
        "Repeat this sentence. Repeat this sentence. Repeat this sentence. Extra words here.",
        {"enabled": True, "max_words": 5, "max_characters": 20, "max_sentences": 2, "repetition_threshold": 0.5},
    )
    codes = {finding.code for finding in result.findings}
    assert {"MAX_WORDS", "MAX_CHARACTERS", "MAX_SENTENCES", "REPETITION"} <= codes


def test_default_length_and_explicit_prompt_preference():
    guardrail = ConcisenessGuardrail()
    short = guardrail.evaluate(
        "one two three four five six seven eight nine ten",
        {"enabled": True, "response_length": "SHORT"},
    )
    long = guardrail.evaluate(
        "one two three four five six seven eight nine ten",
        {"enabled": True, "response_length": "LONG"},
        "LONG",
    )
    assert short.detected is False
    assert long.requested_length == "LONG"
    assert requested_length_from_prompt("Give me a brief answer.") == "SHORT"
    assert requested_length_from_prompt("Give me a detailed explanation.") == "LONG"


def test_disabled_and_invalid_configuration():
    result = ConcisenessGuardrail().evaluate("long text", {"enabled": False})
    assert result.detected is False
    with pytest.raises(ValueError):
        settings_from_config({"response_length": "UNLIMITED"})
    with pytest.raises(ValueError):
        settings_from_config({"max_words": 0})


def test_provider_failure_policy_is_safe():
    guardrail = ConcisenessGuardrail()
    failing = ConcisenessGuardrail()
    failing.evaluate = lambda *_args, **_kwargs: (_ for _ in ()).throw(ConcisenessGuardrailError("offline"))
    with pytest.raises(ConcisenessGuardrailError):
        failing.apply("text", {"enabled": True, "failure_mode": "BLOCK"})
    result = failing.apply("text", {"enabled": True, "failure_mode": "ALLOW"})
    assert result.detected is False

