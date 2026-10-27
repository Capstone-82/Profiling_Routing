"""Deterministic response-length and repetition guardrail."""

from dataclasses import dataclass
import re
from typing import Any, Optional

SUPPORTED_ACTIONS = {"ALLOW", "FLAG", "BLOCK", "REVIEW", "REGENERATE"}
SUPPORTED_FAILURE_MODES = {"BLOCK", "ALLOW", "REVIEW"}
RESPONSE_LENGTHS = {"SHORT", "MEDIUM", "LONG"}
DEFAULT_LIMITS = {
    "SHORT": {"max_words": 150, "max_characters": 1000, "max_sentences": 8},
    "MEDIUM": {"max_words": 500, "max_characters": 3500, "max_sentences": 20},
    "LONG": {"max_words": 1200, "max_characters": 9000, "max_sentences": 50},
}


@dataclass(frozen=True)
class ConcisenessSettings:
    enabled: bool = False
    max_words: Optional[int] = None
    max_characters: Optional[int] = None
    max_sentences: Optional[int] = None
    response_length: str = "MEDIUM"
    action: str = "FLAG"
    failure_mode: str = "BLOCK"
    repetition_threshold: float = 0.6


@dataclass(frozen=True)
class ConcisenessFinding:
    code: str
    message: str
    actual: Optional[float] = None
    allowed: Optional[float] = None


@dataclass(frozen=True)
class ConcisenessResult:
    word_count: int
    character_count: int
    sentence_count: int
    repetition_ratio: float
    requested_length: Optional[str]
    findings: tuple[ConcisenessFinding, ...]

    @property
    def detected(self) -> bool:
        return bool(self.findings)


class ConcisenessGuardrailError(RuntimeError):
    """Raised when an enabled conciseness evaluation cannot complete safely."""


def settings_from_config(config: Optional[dict[str, Any]]) -> ConcisenessSettings:
    cfg = config or {}
    response_length = str(cfg.get("response_length", "MEDIUM")).upper()
    action = str(cfg.get("action", "FLAG")).upper()
    failure_mode = str(cfg.get("failure_mode", "BLOCK")).upper()
    if response_length not in RESPONSE_LENGTHS:
        raise ValueError(f"Unsupported conciseness response_length: {response_length}")
    if action not in SUPPORTED_ACTIONS:
        raise ValueError(f"Unsupported conciseness action: {action}")
    if failure_mode not in SUPPORTED_FAILURE_MODES:
        raise ValueError(f"Unsupported conciseness failure mode: {failure_mode}")
    repetition_threshold = float(cfg.get("repetition_threshold", 0.6))
    if not 0 <= repetition_threshold <= 1:
        raise ValueError("Conciseness repetition_threshold must be between 0 and 1.")

    defaults = DEFAULT_LIMITS[response_length]

    def positive_int(name: str) -> Optional[int]:
        value = cfg.get(name)
        if value is None:
            return defaults[name]
        parsed = int(value)
        if parsed <= 0:
            raise ValueError(f"Conciseness {name} must be positive.")
        return parsed

    return ConcisenessSettings(
        enabled=bool(cfg.get("enabled", False)),
        max_words=positive_int("max_words"),
        max_characters=positive_int("max_characters"),
        max_sentences=positive_int("max_sentences"),
        response_length=response_length,
        action=action,
        failure_mode=failure_mode,
        repetition_threshold=repetition_threshold,
    )


def requested_length_from_prompt(prompt: str) -> Optional[str]:
    lowered = prompt.lower()
    if re.search(r"\b(?:very\s+)?short\b|\bbrief(?:ly)?\b|\bin\s+a\s+few\s+words\b", lowered):
        return "SHORT"
    if re.search(r"\bmedium[- ]length\b|\bmoderate\s+detail\b", lowered):
        return "MEDIUM"
    if re.search(r"\b(?:very\s+)?long\b|\bdetailed\s+(?:explanation|response|answer)\b", lowered):
        return "LONG"
    return None


def _sentence_count(text: str) -> int:
    if not text.strip():
        return 0
    return len([part for part in re.split(r"(?<=[.!?])\s+|\n+", text.strip()) if part.strip()])


def _repetition_ratio(text: str) -> float:
    sentences = [re.sub(r"\s+", " ", sentence.lower()).strip() for sentence in re.split(r"(?<=[.!?])\s+|\n+", text.strip()) if sentence.strip()]
    if len(sentences) < 2:
        return 0.0
    duplicates = len(sentences) - len(set(sentences))
    return round(duplicates / len(sentences), 4)


class ConcisenessGuardrail:
    def evaluate(
        self,
        text: str,
        config: Optional[dict[str, Any]],
        requested_length: Optional[str] = None,
    ) -> ConcisenessResult:
        settings = settings_from_config(config)
        if not settings.enabled:
            return ConcisenessResult(0, 0, 0, 0.0, requested_length, tuple())
        try:
            safe_text = text or ""
            word_count = len(re.findall(r"\S+", safe_text))
            character_count = len(safe_text)
            sentence_count = _sentence_count(safe_text)
            repetition_ratio = _repetition_ratio(safe_text)
            effective_length = (requested_length or settings.response_length or "MEDIUM").upper()
            if effective_length not in RESPONSE_LENGTHS:
                effective_length = settings.response_length
            limits = DEFAULT_LIMITS[effective_length]
            findings: list[ConcisenessFinding] = []

            checks = (
                ("MAX_WORDS", word_count, settings.max_words or limits["max_words"], "word"),
                ("MAX_CHARACTERS", character_count, settings.max_characters or limits["max_characters"], "character"),
                ("MAX_SENTENCES", sentence_count, settings.max_sentences or limits["max_sentences"], "sentence"),
            )
            for code, actual, allowed, label in checks:
                if actual > allowed:
                    findings.append(ConcisenessFinding(
                        code, f"Response has {actual} {label}s; maximum is {allowed}.", actual, allowed
                    ))
            if repetition_ratio >= settings.repetition_threshold:
                findings.append(ConcisenessFinding(
                    "REPETITION", f"Repeated sentences account for {repetition_ratio:.0%} of the response.",
                    repetition_ratio, settings.repetition_threshold
                ))
            return ConcisenessResult(
                word_count, character_count, sentence_count, repetition_ratio,
                requested_length, tuple(findings),
            )
        except Exception as error:
            raise ConcisenessGuardrailError("Conciseness evaluation failed safely.") from error

    def apply(
        self,
        text: str,
        config: Optional[dict[str, Any]],
        requested_length: Optional[str] = None,
    ) -> ConcisenessResult:
        settings = settings_from_config(config)
        try:
            return self.evaluate(text, config, requested_length)
        except ConcisenessGuardrailError:
            if settings.failure_mode == "ALLOW":
                return ConcisenessResult(0, 0, 0, 0.0, requested_length, tuple())
            raise


conciseness_guardrail = ConcisenessGuardrail()
