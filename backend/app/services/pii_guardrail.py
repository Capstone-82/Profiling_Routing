"""Presidio-backed PII guardrail for prompt and model-response inspection.

The service deliberately returns entity metadata only, never detected values.
Presidio is initialized lazily so the API can start with the guardrail disabled,
but an enabled policy fails closed if the analyzer dependencies are unavailable.
"""

from dataclasses import dataclass
from typing import Any, Optional
import re


DEFAULT_ENTITIES = [
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "PERSON",
    "ADDRESS",
    "IN_AADHAAR",
    "IN_PAN",
]
SUPPORTED_ACTIONS = {"ALLOW", "MASK", "BLOCK"}
SUPPORTED_FAILURE_MODES = {"BLOCK", "ALLOW"}


@dataclass(frozen=True)
class PIISettings:
    enabled: bool = False
    scan_input: bool = True
    scan_output: bool = True
    action: str = "BLOCK"
    entities: tuple[str, ...] = tuple(DEFAULT_ENTITIES)
    score_threshold: float = 0.35
    failure_mode: str = "BLOCK"


@dataclass(frozen=True)
class PIIFinding:
    entity_type: str
    count: int
    max_score: float


@dataclass(frozen=True)
class PIIScanResult:
    text: str
    findings: tuple[PIIFinding, ...]
    changed: bool

    @property
    def detected(self) -> bool:
        return bool(self.findings)


class PIIGuardrailError(RuntimeError):
    """Raised when an enabled PII scan cannot be completed safely."""


def settings_from_config(config: Optional[dict[str, Any]]) -> PIISettings:
    cfg = config or {}
    entities = tuple(
        str(value).strip().upper()
        for value in (cfg.get("entities") or DEFAULT_ENTITIES)
        if str(value).strip()
    )
    action = str(cfg.get("action", "BLOCK")).upper()
    failure_mode = str(cfg.get("failure_mode", "BLOCK")).upper()
    if action not in SUPPORTED_ACTIONS:
        raise ValueError(f"Unsupported PII action: {action}")
    if failure_mode not in SUPPORTED_FAILURE_MODES:
        raise ValueError(f"Unsupported PII failure mode: {failure_mode}")
    threshold = float(cfg.get("score_threshold", 0.35))
    if not 0 <= threshold <= 1:
        raise ValueError("PII score_threshold must be between 0 and 1.")
    return PIISettings(
        enabled=bool(cfg.get("enabled", False)),
        scan_input=bool(cfg.get("scan_input", True)),
        scan_output=bool(cfg.get("scan_output", True)),
        action=action,
        entities=entities or tuple(DEFAULT_ENTITIES),
        score_threshold=threshold,
        failure_mode=failure_mode,
    )


class PIIGuardrail:
    def __init__(self) -> None:
        self._analyzer = None
        self._anonymizer = None
        self._initialized = False
        self._operator_config_factory = None

    def _initialize(self) -> None:
        if self._initialized:
            return
        try:
            from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
            from presidio_anonymizer import AnonymizerEngine
        except ImportError as error:
            raise PIIGuardrailError(
                "PII detection is enabled but Presidio is not installed. "
                "Install presidio-analyzer, presidio-anonymizer, and the spaCy English model."
            ) from error

        analyzer = AnalyzerEngine()
        analyzer.registry.add_recognizer(
            PatternRecognizer(
                supported_entity="IN_AADHAAR",
                patterns=[
                    Pattern(
                        name="aadhaar",
                        regex=r"(?<!\d)[2-9]\d{3}(?:[ -]?\d{4}){2}(?!\d)",
                        score=0.85,
                    )
                ],
            )
        )
        analyzer.registry.add_recognizer(
            PatternRecognizer(
                supported_entity="IN_PAN",
                patterns=[
                    Pattern(
                        name="pan",
                        regex=r"(?<![A-Z])[A-Z]{5}\d{4}[A-Z](?![A-Z])",
                        score=0.85,
                    )
                ],
            )
        )
        self._analyzer = analyzer
        self._anonymizer = AnonymizerEngine()
        self._initialized = True

    def scan(self, text: str, config: Optional[dict[str, Any]]) -> PIIScanResult:
        settings = settings_from_config(config)
        if not settings.enabled:
            return PIIScanResult(text=text, findings=tuple(), changed=False)
        try:
            self._initialize()
            results = self._analyzer.analyze(
                text=text,
                language="en",
                entities=list(settings.entities),
                score_threshold=settings.score_threshold,
            )
            findings_by_type: dict[str, list[Any]] = {}
            for result in results:
                findings_by_type.setdefault(result.entity_type, []).append(result)
            findings = tuple(
                PIIFinding(
                    entity_type=entity_type,
                    count=len(matches),
                    max_score=max(float(match.score) for match in matches),
                )
                for entity_type, matches in sorted(findings_by_type.items())
            )
            if not results or settings.action == "ALLOW":
                return PIIScanResult(text=text, findings=findings, changed=False)
            if settings.action == "BLOCK":
                return PIIScanResult(text=text, findings=findings, changed=False)

            operator_config_factory = self._operator_config_factory
            if operator_config_factory is None:
                from presidio_anonymizer.entities import OperatorConfig
                operator_config_factory = OperatorConfig

            operators = {
                entity: operator_config_factory(
                    "replace",
                    {"new_value": f"<{entity}>"},
                )
                for entity in settings.entities
            }
            anonymized = self._anonymizer.anonymize(
                text=text,
                analyzer_results=results,
                operators=operators,
            )
            return PIIScanResult(
                text=anonymized.text,
                findings=findings,
                changed=anonymized.text != text,
            )
        except PIIGuardrailError:
            raise
        except Exception as error:
            raise PIIGuardrailError("PII detection failed safely.") from error

    def apply(self, text: str, config: Optional[dict[str, Any]]) -> PIIScanResult:
        settings = settings_from_config(config)
        try:
            return self.scan(text, config)
        except PIIGuardrailError:
            if settings.failure_mode == "ALLOW":
                return PIIScanResult(text=text, findings=tuple(), changed=False)
            raise


pii_guardrail = PIIGuardrail()
