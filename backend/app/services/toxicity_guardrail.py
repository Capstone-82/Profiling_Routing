"""Replaceable local toxicity guardrail.

Detoxify supplies open-source transformer predictions for toxicity, severe
toxicity, obscenity, threats, insults, and identity hate. Profanity is added
with a deliberately small configurable lexicon because it is not a distinct
Detoxify output. Raw text is never included in findings or errors.
"""

from dataclasses import dataclass
from typing import Any, Optional, Protocol
import re


DEFAULT_CATEGORIES = (
    "toxicity",
    "severe_toxicity",
    "insult",
    "threat",
    "identity_hate",
    "obscene",
    "profanity",
)
SUPPORTED_ACTIONS = {"ALLOW", "FLAG", "BLOCK", "REGENERATE"}
SUPPORTED_FAILURE_MODES = {"BLOCK", "ALLOW"}
DEFAULT_PROFANITY_TERMS = ("fuck", "fucking", "shit", "bitch", "asshole")


@dataclass(frozen=True)
class ToxicitySettings:
    enabled: bool = False
    scan_input: bool = True
    scan_output: bool = True
    action: str = "FLAG"
    categories: tuple[str, ...] = DEFAULT_CATEGORIES
    score_threshold: float = 0.7
    failure_mode: str = "BLOCK"
    profanity_terms: tuple[str, ...] = DEFAULT_PROFANITY_TERMS


@dataclass(frozen=True)
class ToxicityFinding:
    category: str
    score: float
    count: int = 1


@dataclass(frozen=True)
class ToxicityScanResult:
    text: str
    findings: tuple[ToxicityFinding, ...]

    @property
    def detected(self) -> bool:
        return bool(self.findings)


class ToxicityGuardrailError(RuntimeError):
    """Raised when an enabled toxicity scan cannot be completed safely."""


class ToxicityProvider(Protocol):
    def predict(self, text: str) -> dict[str, float]:
        ...


def settings_from_config(config: Optional[dict[str, Any]]) -> ToxicitySettings:
    cfg = config or {}
    categories = tuple(
        str(value).strip().lower()
        for value in (cfg.get("categories") or DEFAULT_CATEGORIES)
        if str(value).strip()
    )
    action = str(cfg.get("action", "FLAG")).upper()
    failure_mode = str(cfg.get("failure_mode", "BLOCK")).upper()
    if action not in SUPPORTED_ACTIONS:
        raise ValueError(f"Unsupported toxicity action: {action}")
    if failure_mode not in SUPPORTED_FAILURE_MODES:
        raise ValueError(f"Unsupported toxicity failure mode: {failure_mode}")
    threshold = float(cfg.get("score_threshold", 0.7))
    if not 0 <= threshold <= 1:
        raise ValueError("Toxicity score_threshold must be between 0 and 1.")
    terms = tuple(
        str(value).strip().lower()
        for value in (cfg.get("profanity_terms") or DEFAULT_PROFANITY_TERMS)
        if str(value).strip()
    )
    return ToxicitySettings(
        enabled=bool(cfg.get("enabled", False)),
        scan_input=bool(cfg.get("scan_input", True)),
        scan_output=bool(cfg.get("scan_output", True)),
        action=action,
        categories=categories or DEFAULT_CATEGORIES,
        score_threshold=threshold,
        failure_mode=failure_mode,
        profanity_terms=terms,
    )


class DetoxifyProvider:
    def __init__(self) -> None:
        self._model: Any = None

    def _initialize(self) -> None:
        if self._model is not None:
            return
        try:
            from detoxify import Detoxify
            self._model = Detoxify("original")
        except ImportError as error:
            raise ToxicityGuardrailError(
                "Toxicity detection is enabled but Detoxify is not installed. "
                "Install detoxify and its model dependencies."
            ) from error
        except Exception as error:
            raise ToxicityGuardrailError(
                "Toxicity detection model could not be initialized."
            ) from error

    def predict(self, text: str) -> dict[str, float]:
        self._initialize()
        try:
            raw = self._model.predict(text)
            return {str(key).lower(): float(value) for key, value in raw.items()}
        except Exception as error:
            raise ToxicityGuardrailError("Toxicity detection failed safely.") from error


class ToxicityGuardrail:
    def __init__(self, provider: Optional[ToxicityProvider] = None) -> None:
        self._provider = provider or DetoxifyProvider()

    def scan(self, text: str, config: Optional[dict[str, Any]]) -> ToxicityScanResult:
        settings = settings_from_config(config)
        if not settings.enabled:
            return ToxicityScanResult(text=text, findings=tuple())
        try:
            scores = self._provider.predict(text)
            findings = [
                ToxicityFinding(category=category, score=round(scores[category], 4))
                for category in settings.categories
                if category != "profanity"
                and category in scores
                and scores[category] >= settings.score_threshold
            ]
            if "profanity" in settings.categories:
                matches = re.findall(
                    r"\b(?:%s)\b" % "|".join(re.escape(term) for term in settings.profanity_terms),
                    text.lower(),
                )
                if matches:
                    findings.append(ToxicityFinding("profanity", 1.0, len(matches)))
            return ToxicityScanResult(
                text=text,
                findings=tuple(sorted(findings, key=lambda finding: finding.category)),
            )
        except ToxicityGuardrailError:
            raise
        except Exception as error:
            raise ToxicityGuardrailError("Toxicity detection failed safely.") from error

    def apply(self, text: str, config: Optional[dict[str, Any]]) -> ToxicityScanResult:
        settings = settings_from_config(config)
        try:
            return self.scan(text, config)
        except ToxicityGuardrailError:
            if settings.failure_mode == "ALLOW":
                return ToxicityScanResult(text=text, findings=tuple())
            raise


toxicity_guardrail = ToxicityGuardrail()
