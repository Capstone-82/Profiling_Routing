"""Replaceable local prompt-injection classifier.

The default provider uses the open-source ProtectAI prompt-injection
classifier through Transformers. The classifier is intentionally lazy-loaded
so disabled policies do not download a model at API startup.
"""

from dataclasses import dataclass
from typing import Any, Optional, Protocol


SUPPORTED_ACTIONS = {"ALLOW", "FLAG", "BLOCK", "REVIEW"}
SUPPORTED_FAILURE_MODES = {"BLOCK", "ALLOW"}
DEFAULT_MODEL = "protectai/deberta-v3-base-prompt-injection-v2"


@dataclass(frozen=True)
class PromptInjectionSettings:
    enabled: bool = False
    scan_input: bool = True
    action: str = "FLAG"
    score_threshold: float = 0.8
    failure_mode: str = "BLOCK"
    model: str = DEFAULT_MODEL


@dataclass(frozen=True)
class PromptInjectionFinding:
    category: str
    score: float
    label: str


@dataclass(frozen=True)
class PromptInjectionScanResult:
    text: str
    findings: tuple[PromptInjectionFinding, ...]

    @property
    def detected(self) -> bool:
        return bool(self.findings)


class PromptInjectionGuardrailError(RuntimeError):
    """Raised when an enabled prompt-injection scan cannot run safely."""


class PromptInjectionProvider(Protocol):
    def predict(self, text: str) -> tuple[str, float]:
        ...


def settings_from_config(config: Optional[dict[str, Any]]) -> PromptInjectionSettings:
    cfg = config or {}
    action = str(cfg.get("action", "FLAG")).upper()
    failure_mode = str(cfg.get("failure_mode", "BLOCK")).upper()
    if action not in SUPPORTED_ACTIONS:
        raise ValueError(f"Unsupported prompt injection action: {action}")
    if failure_mode not in SUPPORTED_FAILURE_MODES:
        raise ValueError(f"Unsupported prompt injection failure mode: {failure_mode}")
    threshold = float(cfg.get("score_threshold", 0.8))
    if not 0 <= threshold <= 1:
        raise ValueError("Prompt injection score_threshold must be between 0 and 1.")
    model = str(cfg.get("model", DEFAULT_MODEL)).strip() or DEFAULT_MODEL
    return PromptInjectionSettings(
        enabled=bool(cfg.get("enabled", False)),
        scan_input=bool(cfg.get("scan_input", True)),
        action=action,
        score_threshold=threshold,
        failure_mode=failure_mode,
        model=model,
    )


class TransformersPromptInjectionProvider:
    def __init__(self) -> None:
        self._classifiers: dict[str, Any] = {}

    def predict(self, text: str, model_name: str = DEFAULT_MODEL) -> tuple[str, float]:
        classifier = self._classifiers.get(model_name)
        if classifier is None:
            try:
                from transformers import pipeline
                classifier = pipeline("text-classification", model=model_name)
            except ImportError as error:
                raise PromptInjectionGuardrailError(
                    "Prompt injection detection is enabled but Transformers is not installed."
                ) from error
            except Exception as error:
                raise PromptInjectionGuardrailError(
                    "Prompt injection detection model could not be initialized."
                ) from error
            self._classifiers[model_name] = classifier
        try:
            result = classifier(text, truncation=True)[0]
            return str(result["label"]).upper(), float(result["score"])
        except Exception as error:
            raise PromptInjectionGuardrailError(
                "Prompt injection detection failed safely."
            ) from error


class PromptInjectionGuardrail:
    def __init__(self, provider: Optional[PromptInjectionProvider] = None) -> None:
        self._provider = provider or TransformersPromptInjectionProvider()

    def scan(self, text: str, config: Optional[dict[str, Any]]) -> PromptInjectionScanResult:
        settings = settings_from_config(config)
        if not settings.enabled:
            return PromptInjectionScanResult(text=text, findings=tuple())
        import re
        # Fast high-precision heuristic signatures for injection and jailbreak
        heuristic_patterns = [
            r"(?i)\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|prompts|rules)\b",
            r"(?i)\b(system\s+prompt|jailbreak|DAN\s+mode|developer\s+mode\s+active|bypass\s+safety)\b",
            r"(?i)\b(disregard\s+(all\s+)?rules|output\s+(your\s+)?system\s+prompt)\b",
            r"(?i)\b(pretend\s+you\s+have\s+no\s+(restrictions|rules|ethics))\b",
            r"(?i)\b(reveal\s+(your\s+)?internal\s+instructions)\b",
        ]
        for pattern in heuristic_patterns:
            if re.search(pattern, text):
                return PromptInjectionScanResult(
                    text=text,
                    findings=(
                        PromptInjectionFinding(
                            category="prompt_injection",
                            score=0.98,
                            label="INJECTION",
                        ),
                    ),
                )
        try:
            provider = self._provider
            if isinstance(provider, TransformersPromptInjectionProvider):
                label, score = provider.predict(text, settings.model)
            else:
                label, score = provider.predict(text)
            normalized_label = label.upper()
            is_injection = (
                normalized_label in {"INJECTION", "PROMPT_INJECTION", "LABEL_1"}
                or "INJECT" in normalized_label
            )
            if not is_injection or score < settings.score_threshold:
                return PromptInjectionScanResult(text=text, findings=tuple())
            return PromptInjectionScanResult(
                text=text,
                findings=(
                    PromptInjectionFinding(
                        category="prompt_injection",
                        score=round(score, 4),
                        label=normalized_label,
                    ),
                ),
            )
        except PromptInjectionGuardrailError:
            raise
        except Exception as error:
            raise PromptInjectionGuardrailError(
                "Prompt injection detection failed safely."
            ) from error

    def apply(self, text: str, config: Optional[dict[str, Any]]) -> PromptInjectionScanResult:
        settings = settings_from_config(config)
        try:
            return self.scan(text, config)
        except PromptInjectionGuardrailError:
            if settings.failure_mode == "ALLOW":
                return PromptInjectionScanResult(text=text, findings=tuple())
            raise


prompt_injection_guardrail = PromptInjectionGuardrail()
