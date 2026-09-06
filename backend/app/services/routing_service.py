import logging
import os
from pathlib import Path
from typing import Optional, List, Dict, Any

from app.services.routing.routing_models import PromptProfile, RoutingResult, ModelRecommendation
from app.services.routing.features import complexity_score_from_dims, tier_from_score

logger = logging.getLogger(__name__)

class RoutingService:
    """
    Singleton service managing the Prompt Profiling & Model Routing engine.
    Loads the sentence-transformer embeddings and XGBoost heads once at process startup.
    """
    _instance: Optional["RoutingService"] = None

    def __init__(self):
        self.profiler = None
        self.registry = None
        self.router = None
        self.is_initialized = False
        self._init_error = None

    @classmethod
    def get_instance(cls) -> "RoutingService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self):
        """Warm up and load ML models into memory."""
        if self.is_initialized:
            return

        try:
            from app.services.routing.router import PromptProfiler, ModelRegistry, ModelRouter
            logger.info("Initializing PromptProfiler & ModelRegistry...")
            self.profiler = PromptProfiler()
            self.registry = ModelRegistry()
            self.router = ModelRouter(self.profiler, self.registry)
            self.is_initialized = True
            self._init_error = None
            logger.info("RoutingService successfully initialized with ML artifacts.")
        except Exception as e:
            self._init_error = str(e)
            logger.warning(f"ML artifacts could not be loaded ({e}). Falling back to heuristic lightweight profiler.")

    def _heuristic_profile(self, prompt: str, max_tokens: Optional[int] = None) -> PromptProfile:
        """Lightweight heuristic fallback if ML dependencies are not yet installed."""
        from app.services.routing.router import count_input_tokens
        text = prompt.lower()
        words = text.split()
        input_tokens = count_input_tokens(prompt)

        # Basic complexity cues
        is_strategic = any(w in text for w in ["strategic", "architecture", "framework", "governance", "enterprise"])
        is_analytical = any(w in text for w in ["analyze", "evaluate", "compare", "tradeoff", "benchmark"])
        is_code = any(w in text for w in ["def ", "class ", "function", "sql", "json", "yaml", "code", "python"])
        is_reasoning = any(w in text for w in ["step by step", "think", "reason", "why", "how to solve", "derive"])

        if is_strategic:
            d1, d2, d3, d4, d5 = 0.75, 0.75, 0.75, 0.50, 0.50
            domain = "Cloud Computing"
            intent = "STRATEGIC"
            task_type = "architecture_design"
        elif is_analytical:
            d1, d2, d3, d4, d5 = 0.50, 0.50, 0.50, 0.50, 0.25
            domain = "Data Science"
            intent = "ANALYTICAL"
            task_type = "evaluation"
        elif is_code:
            d1, d2, d3, d4, d5 = 0.50, 0.75, 0.50, 0.25, 0.50
            domain = "Programming"
            intent = "SYNTHETIC"
            task_type = "coding"
        else:
            d1, d2, d3, d4, d5 = 0.25, 0.25, 0.25, 0.00, 0.00
            domain = "General Knowledge"
            intent = "FACTUAL"
            task_type = "factual_lookup"

        score = complexity_score_from_dims(d1, d2, d3, d4, d5)
        derived_tier = tier_from_score(score)

        return PromptProfile(
            d1=d1,
            d2=d2,
            d3=d3,
            d4=d4,
            d5=d5,
            domain=domain,
            complexity_score=round(float(score), 4),
            derived_tier=derived_tier,
            intent=intent,
            task_type=task_type,
            reasoning_chain_detected=is_reasoning,
            research_signals=["cloud_infrastructure"] if is_strategic else [],
            confidence=0.85,
            input_token_count=input_tokens,
            est_output_tokens=max_tokens or 1500,
        )

    def route(
        self,
        prompt: str,
        allowed_model_ids: Optional[List[str]] = None,
        max_tokens: Optional[int] = None,
        enterprise_criticality: str = "standard",
        required_capabilities: Optional[List[str]] = None,
        top_n: int = 3,
    ) -> RoutingResult:
        """Route prompt through profiler and candidate filtering."""
        if not self.is_initialized:
            self.initialize()

        if self.is_initialized and self.router:
            return self.router.route(
                prompt=prompt,
                max_tokens=max_tokens,
                top_n=top_n,
                enterprise_criticality=enterprise_criticality,
                required_capabilities=required_capabilities,
                allowed_model_ids=allowed_model_ids,
            )
        else:
            # Fallback heuristic router
            profile = self._heuristic_profile(prompt, max_tokens)
            
            # Simple ranking among allowed_model_ids or default catalog
            candidates = allowed_model_ids or [
                "claude-sonnet-5",
                "claude-haiku-4-5-20251001",
                "amazon-nova-pro",
                "amazon-nova-lite",
            ]

            from app.services.model_mapping_service import model_mapping_service
            recs = []
            for i, m_id in enumerate(candidates[:top_n]):
                b_id = model_mapping_service.get_bedrock_id(m_id) or m_id
                disp_name = model_mapping_service.get_display_name(m_id)
                recs.append(
                    ModelRecommendation(
                        rank=i + 1,
                        model_id=m_id,
                        bedrock_model_id=b_id,
                        display_name=disp_name,
                        provider="Anthropic" if "claude" in m_id else ("Amazon" if "nova" in m_id else ("Meta" if "llama" in m_id else "Mistral")),
                        tier=profile.derived_tier,
                        estimated_cost_usd=round(0.000003 * (profile.input_token_count + profile.est_output_tokens), 6),
                        domain_match_count=1,
                        reasons=[f"Heuristic match for {profile.domain} ({profile.derived_tier})"],
                        routing_score=85.0 - (i * 5),
                    )
                )

            return RoutingResult(
                prompt_profile=profile,
                resolved_tier=profile.derived_tier,
                recommendations=recs,
                rejections={},
                tier_escalated=False,
                escalation_reason=None,
                warnings=["Used heuristic profiler fallback."] if self._init_error else [],
            )


routing_service = RoutingService.get_instance()
