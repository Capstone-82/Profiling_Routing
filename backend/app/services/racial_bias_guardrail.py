"""Conservative, replaceable racial-bias detection guardrail.

The built-in provider is a transparent baseline, not a comprehensive fairness
classifier. It combines group-reference and discriminatory-context signals and
explicitly lowers confidence for educational, historical, quoted, and
anti-discrimination discussion.
"""

from dataclasses import dataclass
import re
from typing import Any, Optional, Protocol

SUPPORTED_ACTIONS = {"ALLOW", "FLAG", "BLOCK", "REVIEW", "REGENERATE"}
SUPPORTED_FAILURE_MODES = {"BLOCK", "ALLOW", "REVIEW"}
SUPPORTED_STATUSES = {"CLEAR", "POTENTIAL_BIAS", "REVIEW_REQUIRED"}

GROUP_TERMS = (
    "black", "white", "asian", "hispanic", "latino", "latina", "indian",
    "arab", "jewish", "african", "immigrant", "ethnic group", "racial group",
)
GENERALIZATION_TERMS = (
    "are", "always", "never", "all", " inherently", "naturally", "typically",
    "usually", "more likely", "less capable", "criminal", "lazy", "inferior",
    "superior", "violent", "untrustworthy", "stupid",
)
DISCRIMINATION_TERMS = (
    "exclude", "reject", "deny", "ban", "segregate", "hire", "promote",
    "pay", "access", "prefer", "avoid", "deport", "treat differently",
)
CONTEXT_MARKERS = (
    "racism", "discrimination", "bias", "anti-racist", "equality",
    "historical", "history", "education", "educational", "research",
    "discuss", "analyze", "quotation", "quoted", "counter",
)


@dataclass(frozen=True)
class RacialBiasSettings:
    enabled: bool = False
    confidence_threshold: float = 0.75
    action: str = "FLAG"
    failure_mode: str = "BLOCK"
    provider: str = "conservative_baseline"


@dataclass(frozen=True)
class RacialBiasFinding:
    category: str
    confidence: float
    explanation: str


@dataclass(frozen=True)
class RacialBiasResult:
    status: str
    confidence: float
    findings: tuple[RacialBiasFinding, ...]
    explanation: str

    @property
    def detected(self) -> bool:
        return self.status == "POTENTIAL_BIAS"


class RacialBiasGuardrailError(RuntimeError):
    """Raised when an enabled bias provider cannot safely produce a result."""


class RacialBiasProvider(Protocol):
    def detect(self, text: str) -> RacialBiasResult:
        ...


def settings_from_config(config: Optional[dict[str, Any]]) -> RacialBiasSettings:
    cfg = config or {}
    action = str(cfg.get("action", "FLAG")).upper()
    failure_mode = str(cfg.get("failure_mode", "BLOCK")).upper()
    if action not in SUPPORTED_ACTIONS:
        raise ValueError(f"Unsupported racial bias action: {action}")
    if failure_mode not in SUPPORTED_FAILURE_MODES:
        raise ValueError(f"Unsupported racial bias failure mode: {failure_mode}")
    threshold = float(cfg.get("confidence_threshold", 0.75))
    if not 0 <= threshold <= 1:
        raise ValueError("Racial bias confidence_threshold must be between 0 and 1.")
    provider = str(cfg.get("provider", "conservative_baseline")).strip() or "conservative_baseline"
    return RacialBiasSettings(
        enabled=bool(cfg.get("enabled", False)),
        confidence_threshold=threshold,
        action=action,
        failure_mode=failure_mode,
        provider=provider,
    )


def _contains_group(text: str) -> bool:
    lowered = text.lower()
    return any(re.search(rf"\b{re.escape(term)}\b", lowered) for term in GROUP_TERMS)


def _has_term(text: str, terms: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(re.search(rf"\b{re.escape(term.strip())}\b", lowered) for term in terms)


class ConservativeBaselineProvider:
    """Local fallback with explainable signals and intentionally limited scope."""

    def detect(self, text: str) -> RacialBiasResult:
        if not text.strip() or not _contains_group(text):
            return RacialBiasResult("CLEAR", 0.0, tuple(), "No group-targeted discriminatory pattern was detected.")

        lowered = text.lower()
        educational = _has_term(text, CONTEXT_MARKERS)
        generalization = _has_term(text, GENERALIZATION_TERMS)
        differential = _has_term(text, DISCRIMINATION_TERMS)
        findings: list[RacialBiasFinding] = []

        if generalization:
            findings.append(RacialBiasFinding(
                "UNSUPPORTED_GENERALIZATION",
                0.86 if not educational else 0.58,
                "A group reference appears alongside a broad or negative generalization.",
            ))
        if differential:
            findings.append(RacialBiasFinding(
                "DIFFERENTIAL_TREATMENT",
                0.9 if not educational else 0.62,
                "The response appears to recommend unequal treatment based on group identity.",
            ))
        if re.search(r"\b(?:superior|inferior|dehumaniz|less human|subhuman)\b", lowered):
            findings.append(RacialBiasFinding(
                "SUPERIORITY_OR_DEHUMANIZATION",
                0.95 if not educational else 0.65,
                "The response contains a possible superiority, inferiority, or dehumanizing claim.",
            ))

        if not findings or educational and not differential and not re.search(
            r"\b(?:should|must|deserve|recommend|refuse|deny)\b", lowered
        ):
            return RacialBiasResult(
                "CLEAR", 0.0, tuple(),
                "Group references appear in an educational, historical, analytical, or anti-discrimination context.",
            )
        confidence = round(max(finding.confidence for finding in findings), 4)
        return RacialBiasResult(
            "POTENTIAL_BIAS", confidence, tuple(findings),
            "Potentially discriminatory content was detected; confidence is not proof of discrimination.",
        )


class RacialBiasGuardrail:
    """Validate provider output and apply the configured fail-safe behavior."""

    def __init__(self, provider: Optional[RacialBiasProvider] = None) -> None:
        self._provider = provider or ConservativeBaselineProvider()

    def scan(self, text: str, config: Optional[dict[str, Any]]) -> RacialBiasResult:
        settings = settings_from_config(config)
        if not settings.enabled:
            return RacialBiasResult("CLEAR", 0.0, tuple(), "Racial bias detection is disabled.")
        try:
            result = self._provider.detect(text or "")
            if not isinstance(result, RacialBiasResult) or result.status not in SUPPORTED_STATUSES:
                raise RacialBiasGuardrailError("Racial bias provider returned an invalid result.")
            if not 0 <= result.confidence <= 1 or any(
                not 0 <= finding.confidence <= 1 for finding in result.findings
            ):
                raise RacialBiasGuardrailError("Racial bias provider returned invalid confidence.")
            return result
        except RacialBiasGuardrailError:
            raise
        except Exception as error:
            raise RacialBiasGuardrailError("Racial bias detection failed safely.") from error

    def apply(self, text: str, config: Optional[dict[str, Any]]) -> RacialBiasResult:
        settings = settings_from_config(config)
        try:
            return self.scan(text, config)
        except RacialBiasGuardrailError:
            if settings.failure_mode == "ALLOW":
                return RacialBiasResult("REVIEW_REQUIRED", 0.0, tuple(), "Provider failed; response allowed by configured failure policy.")
            if settings.failure_mode == "REVIEW":
                return RacialBiasResult("REVIEW_REQUIRED", 0.0, tuple(), "Provider failed; manual review is required.")
            raise


racial_bias_guardrail = RacialBiasGuardrail()
