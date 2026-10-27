"""Evidence-aware hallucination verification with a replaceable provider seam.

The default verifier is deliberately conservative. It never labels a response
as factual without trusted reference context; absent evidence produces
INSUFFICIENT_EVIDENCE rather than an invented confidence judgment.
"""

from dataclasses import dataclass
import re
from typing import Any, Optional, Protocol, Sequence

SUPPORTED_ACTIONS = {"ALLOW", "FLAG", "BLOCK", "REVIEW", "REGENERATE"}
SUPPORTED_FAILURE_MODES = {"BLOCK", "ALLOW", "REVIEW"}
SUPPORTED_STATUSES = {"SUPPORTED", "CONTRADICTED", "INSUFFICIENT_EVIDENCE", "REVIEW_REQUIRED"}


@dataclass(frozen=True)
class HallucinationSettings:
    enabled: bool = False
    action: str = "FLAG"
    confidence_threshold: float = 0.7
    failure_mode: str = "BLOCK"
    provider: str = "limited_evidence"


@dataclass(frozen=True)
class HallucinationFinding:
    claim: str
    status: str
    confidence: float
    explanation: str


@dataclass(frozen=True)
class HallucinationVerification:
    status: str
    confidence: float
    findings: tuple[HallucinationFinding, ...]
    explanation: str

    @property
    def requires_action(self) -> bool:
        return any(
            finding.status in {"CONTRADICTED", "INSUFFICIENT_EVIDENCE", "REVIEW_REQUIRED"}
            for finding in self.findings
        )


class HallucinationGuardrailError(RuntimeError):
    """Raised when an enabled verifier cannot safely return a valid result."""


class HallucinationProvider(Protocol):
    def verify(self, response: str, evidence: Sequence[str]) -> HallucinationVerification:
        ...


def settings_from_config(config: Optional[dict[str, Any]]) -> HallucinationSettings:
    cfg = config or {}
    action = str(cfg.get("action", "FLAG")).upper()
    failure_mode = str(cfg.get("failure_mode", "BLOCK")).upper()
    if action not in SUPPORTED_ACTIONS:
        raise ValueError(f"Unsupported hallucination action: {action}")
    if failure_mode not in SUPPORTED_FAILURE_MODES:
        raise ValueError(f"Unsupported hallucination failure mode: {failure_mode}")
    threshold = float(cfg.get("confidence_threshold", 0.7))
    if not 0 <= threshold <= 1:
        raise ValueError("Hallucination confidence_threshold must be between 0 and 1.")
    provider = str(cfg.get("provider", "limited_evidence")).strip() or "limited_evidence"
    return HallucinationSettings(
        enabled=bool(cfg.get("enabled", False)),
        action=action,
        confidence_threshold=threshold,
        failure_mode=failure_mode,
        provider=provider,
    )


def _sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text.strip()) if part.strip()]


def _terms(text: str) -> set[str]:
    return {
        term.lower()
        for term in re.findall(r"[A-Za-z0-9][A-Za-z0-9'-]{2,}", text)
        if term.lower() not in {"the", "and", "that", "this", "with", "from", "are", "was"}
    }


class LimitedEvidenceProvider:
    """Deterministic baseline verifier; suitable only for supplied evidence."""

    def verify(self, response: str, evidence: Sequence[str]) -> HallucinationVerification:
        claims = _sentences(response)
        trusted = [item.strip() for item in evidence if isinstance(item, str) and item.strip()]
        if not claims:
            return HallucinationVerification("SUPPORTED", 1.0, tuple(), "Response contains no verifiable claims.")
        if not trusted:
            findings = tuple(
                HallucinationFinding(claim, "INSUFFICIENT_EVIDENCE", 0.0, "No trusted reference context was supplied.")
                for claim in claims
            )
            return HallucinationVerification(
                "INSUFFICIENT_EVIDENCE", 0.0, findings,
                "Reliable verification is limited because trusted evidence is unavailable.",
            )

        evidence_terms = [_terms(item) for item in trusted]
        findings: list[HallucinationFinding] = []
        for claim in claims:
            claim_terms = _terms(claim)
            overlap = max((len(claim_terms & item) / max(len(claim_terms), 1) for item in evidence_terms), default=0.0)
            negated = bool(re.search(r"\b(not|never|no longer|false|incorrect)\b", claim.lower()))
            status = "SUPPORTED" if overlap >= 0.6 and not negated else (
                "CONTRADICTED" if overlap >= 0.6 and negated else "INSUFFICIENT_EVIDENCE"
            )
            confidence = round(min(1.0, overlap if status != "CONTRADICTED" else max(overlap, 0.8)), 4)
            explanation = {
                "SUPPORTED": "Claim terms are substantially supported by supplied evidence.",
                "CONTRADICTED": "Claim contains a negation while matching supplied evidence; review the claim.",
                "INSUFFICIENT_EVIDENCE": "Supplied evidence does not sufficiently support or contradict this claim.",
            }[status]
            findings.append(HallucinationFinding(claim, status, confidence, explanation))
        statuses = {finding.status for finding in findings}
        overall = "CONTRADICTED" if "CONTRADICTED" in statuses else (
            "INSUFFICIENT_EVIDENCE" if "INSUFFICIENT_EVIDENCE" in statuses else "SUPPORTED"
        )
        confidence = round(min(finding.confidence for finding in findings), 4)
        return HallucinationVerification(overall, confidence, tuple(findings), "Verification used only supplied trusted evidence.")


class HallucinationGuardrail:
    def __init__(self, provider: Optional[HallucinationProvider] = None) -> None:
        self._provider = provider or LimitedEvidenceProvider()

    def scan(self, response: str, evidence: Optional[Sequence[str]], config: Optional[dict[str, Any]]) -> HallucinationVerification:
        settings = settings_from_config(config)
        if not settings.enabled:
            return HallucinationVerification("SUPPORTED", 1.0, tuple(), "Hallucination detection is disabled.")
        try:
            result = self._provider.verify(response, evidence or [])
            if not isinstance(result, HallucinationVerification):
                raise HallucinationGuardrailError("Hallucination verifier returned an invalid result.")
            if result.status not in SUPPORTED_STATUSES or any(
                finding.status not in SUPPORTED_STATUSES
                or not 0 <= finding.confidence <= 1
                for finding in result.findings
            ):
                raise HallucinationGuardrailError("Hallucination verifier returned malformed statuses or confidence.")
            return result
        except HallucinationGuardrailError:
            raise
        except Exception as error:
            raise HallucinationGuardrailError("Hallucination verification failed safely.") from error

    def apply(self, response: str, evidence: Optional[Sequence[str]], config: Optional[dict[str, Any]]) -> HallucinationVerification:
        settings = settings_from_config(config)
        try:
            return self.scan(response, evidence, config)
        except HallucinationGuardrailError:
            if settings.failure_mode == "ALLOW":
                return HallucinationVerification("REVIEW_REQUIRED", 0.0, tuple(), "Verification failed; response allowed by configured failure policy.")
            if settings.failure_mode == "REVIEW":
                return HallucinationVerification("REVIEW_REQUIRED", 0.0, tuple(), "Verification failed; manual review is required.")
            raise


hallucination_guardrail = HallucinationGuardrail()
