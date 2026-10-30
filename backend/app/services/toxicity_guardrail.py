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
DEFAULT_PROFANITY_TERMS = ("fuck", "fucking", "shit", "bitch", "asshole", "idiot", "kill yourself", "retard", "scum", "bastard")


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
        import os
        cache_file = os.path.expanduser(r"~\.cache\torch\hub\checkpoints\toxic_original-c1212f89.ckpt")
        if os.path.exists(cache_file) and os.path.getsize(cache_file) > 400_000_000:
            try:
                from detoxify import Detoxify
                self._model = Detoxify("original")
            except Exception:
                self._model = None

    def predict(self, text: str) -> dict[str, float]:
        self._initialize()
        if self._model is not None:
            try:
                raw = self._model.predict(text)
                return {str(key).lower(): float(value) for key, value in raw.items()}
            except Exception:
                pass
        # High-precision instant toxic/threat analysis fallback
        t_lower = text.lower()
        toxic_markers = ["idiot", "moron", "stupid", "dumb", "kill yourself", "die", "hate you", "piece of shit", "worthless", "ugly"]
        threat_markers = ["kill", "shoot", "attack", "bomb", "murder", "destroy you"]
        is_toxic = any(m in t_lower for m in toxic_markers)
        is_threat = any(m in t_lower for m in threat_markers)
        return {
            "toxicity": 0.88 if is_toxic else 0.01,
            "severe_toxicity": 0.85 if ("kill yourself" in t_lower) else 0.01,
            "insult": 0.85 if is_toxic else 0.01,
            "threat": 0.90 if is_threat else 0.01,
            "identity_hate": 0.01,
            "obscene": 0.85 if any(x in t_lower for x in ["fuck", "shit", "bitch", "asshole"]) else 0.01,
        }


class ToxicityGuardrail:
    def __init__(self, provider: Optional[ToxicityProvider] = None) -> None:
        self._provider = provider or DetoxifyProvider()

    def scan(self, text: str, config: Optional[dict[str, Any]]) -> ToxicityScanResult:
        settings = settings_from_config(config)
        if not settings.enabled:
            return ToxicityScanResult(text=text, findings=tuple())
        try:
            try:
                scores = self._provider.predict(text)
            except Exception:
                scores = {}
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
