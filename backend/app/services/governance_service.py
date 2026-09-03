import time
import datetime
from typing import List, Dict, Optional, Any, Tuple
from pydantic import BaseModel, Field
import httpx

from app.config import settings
from app.services.supabase_service import ensure_uuid, get_supabase_headers
from app.services.routing.router import count_input_tokens

class GovernanceRuleConfig(BaseModel):
    # allow_list
    allowed_models: Optional[List[str]] = None
    
    # context_window
    max_input_tokens: Optional[int] = 200000
    min_input_tokens: Optional[int] = 1
    max_output_tokens: Optional[int] = 65536
    max_total_tokens: Optional[int] = 250000
    
    # throttle
    rate_limit_rpm: Optional[int] = 60         # Requests per minute
    burst_limit: Optional[int] = 10            # Max concurrent / burst in short window
    quota_per_day_tokens: Optional[int] = 2000000 # 2M tokens/day
    quota_per_day_requests: Optional[int] = 1000

class GovernanceRule(BaseModel):
    id: Optional[str] = None
    org_id: str
    rule_type: str    # 'allow_list' | 'throttle' | 'context_window' | 'moderation' | 'io_tokens'
    scope: str = "org" # 'org' | 'application' | 'user'
    scope_target: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    mode: str = "dry_run" # 'dry_run' | 'enforce'
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class GovernanceEvaluation(BaseModel):
    rule_type: str
    passed: bool
    mode: str        # 'dry_run' | 'enforce'
    message: str
    details: Optional[Dict[str, Any]] = None

class GovernanceResult(BaseModel):
    passed: bool
    blocked_by_enforce: bool
    evaluations: List[GovernanceEvaluation]
    allowed_models: Optional[List[str]] = None
    estimated_input_tokens: int = 0


# In-memory throttle tracker for rate/volume limits per org
class ThrottleTracker:
    def __init__(self):
        # org_id -> list of timestamps
        self.request_timestamps: Dict[str, List[float]] = {}
        # org_id -> list of (timestamp, token_count)
        self.token_history: Dict[str, List[Tuple[float, int]]] = {}

    def record_request(self, org_id: str, tokens: int = 0):
        now = time.time()
        if org_id not in self.request_timestamps:
            self.request_timestamps[org_id] = []
        if org_id not in self.token_history:
            self.token_history[org_id] = []

        self.request_timestamps[org_id].append(now)
        self.token_history[org_id].append((now, tokens))

        # Cleanup entries older than 24h
        cutoff_24h = now - 86400
        self.request_timestamps[org_id] = [t for t in self.request_timestamps[org_id] if t >= cutoff_24h]
        self.token_history[org_id] = [item for item in self.token_history[org_id] if item[0] >= cutoff_24h]

    def get_stats(self, org_id: str) -> Dict[str, int]:
        now = time.time()
        cutoff_1m = now - 60
        cutoff_24h = now - 86400

        timestamps = self.request_timestamps.get(org_id, [])
        tokens_list = self.token_history.get(org_id, [])

        rpm = sum(1 for t in timestamps if t >= cutoff_1m)
        reqs_24h = sum(1 for t in timestamps if t >= cutoff_24h)
        tokens_24h = sum(tok for t, tok in tokens_list if t >= cutoff_24h)

        return {
            "rpm": rpm,
            "requests_24h": reqs_24h,
            "tokens_24h": tokens_24h,
        }


throttle_tracker = ThrottleTracker()

# In-memory store for local testing and caching
ORG_RULES_CACHE: Dict[str, List[GovernanceRule]] = {}

DEFAULT_GOVERNANCE_RULES = [
    {
        "rule_type": "context_window",
        "mode": "enforce",
        "config": {
            "max_input_tokens": 200000,
            "min_input_tokens": 1,
            "max_output_tokens": 65536,
            "max_total_tokens": 265536
        }
    },
    {
        "rule_type": "throttle",
        "mode": "dry_run",
        "config": {
            "rate_limit_rpm": 60,
            "burst_limit": 15,
            "quota_per_day_tokens": 5000000,
            "quota_per_day_requests": 2000
        }
    },
    {
        "rule_type": "allow_list",
        "mode": "enforce",
        "config": {
            "allowed_models": [
                "claude-sonnet-5",
                "claude-haiku-4-5-20251001",
                "claude-opus-5",
                "amazon-nova-pro",
                "amazon-nova-lite",
                "amazon-nova-micro",
                "llama-3.3-70b",
                "llama-4-scout",
                "mistral-large-3",
                "mistral-small"
            ]
        }
    }
]


class GovernanceService:
    """Service to evaluate governance policies on prompt requests."""

    async def get_rules_for_org(self, org_id: str) -> List[GovernanceRule]:
        clean_org_id = ensure_uuid(org_id)

        # Check local cache first
        if clean_org_id in ORG_RULES_CACHE and ORG_RULES_CACHE[clean_org_id]:
            return ORG_RULES_CACHE[clean_org_id]

        # Try fetching from Supabase
        if settings.SUPABASE_URL and (settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY):
            url = f"{settings.SUPABASE_URL}/rest/v1/governance_rules?org_id=eq.{clean_org_id}&select=*"
            try:
                async with httpx.AsyncClient() as client:
                    res = await client.get(url, headers=get_supabase_headers(), timeout=4.0)
                    if res.status_code == 200:
                        rows = res.json()
                        if rows:
                            rules = [GovernanceRule(**r) for r in rows]
                            ORG_RULES_CACHE[clean_org_id] = rules
                            return rules
            except Exception as e:
                print(f"Error fetching governance rules from Supabase: {e}")

        # Fallback to default initial rules for new orgs
        default_rules = []
        for r_def in DEFAULT_GOVERNANCE_RULES:
            default_rules.append(
                GovernanceRule(
                    org_id=clean_org_id,
                    rule_type=r_def["rule_type"],
                    scope="org",
                    config=r_def["config"],
                    mode=r_def["mode"],
                )
            )
        ORG_RULES_CACHE[clean_org_id] = default_rules
        return default_rules

    async def save_rule(self, rule: GovernanceRule) -> GovernanceRule:
        clean_org_id = ensure_uuid(rule.org_id)
        rule.org_id = clean_org_id
        
        # Update cache
        existing = await self.get_rules_for_org(clean_org_id)
        updated = [r for r in existing if r.rule_type != rule.rule_type]
        updated.append(rule)
        ORG_RULES_CACHE[clean_org_id] = updated

        # Save to Supabase if configured
        if settings.SUPABASE_URL and (settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY):
            url = f"{settings.SUPABASE_URL}/rest/v1/governance_rules"
            headers = get_supabase_headers()
            headers["Prefer"] = "resolution=merge-duplicates,return=representation"
            payload = {
                "org_id": clean_org_id,
                "rule_type": rule.rule_type,
                "scope": rule.scope,
                "scope_target": rule.scope_target,
                "config": rule.config,
                "mode": rule.mode,
                "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(url, headers=headers, json=payload, timeout=4.0)
            except Exception as e:
                print(f"Error saving governance rule to Supabase: {e}")

        return rule

    async def evaluate_prompt(
        self,
        org_id: str,
        prompt: str,
        user_specified_models: Optional[List[str]] = None,
        max_tokens: Optional[int] = None
    ) -> GovernanceResult:
        """
        Executes governance evaluations (Context Window, Throttle, Allow-list) against the prompt.
        """
        rules = await self.get_rules_for_org(org_id)
        est_tokens = count_input_tokens(prompt)
        stats = throttle_tracker.get_stats(org_id)

        evaluations: List[GovernanceEvaluation] = []
        blocked_by_enforce = False
        allowed_models_result: Optional[List[str]] = None

        for rule in rules:
            cfg = rule.config or {}
            mode = rule.mode.lower() # 'enforce' or 'dry_run'

            if rule.rule_type == "context_window":
                max_inp = cfg.get("max_input_tokens", 200000)
                min_inp = cfg.get("min_input_tokens", 1)
                max_total = cfg.get("max_total_tokens", 250000)
                est_total = est_tokens + (max_tokens or 1500)

                passed = True
                msg = f"Context window bounds OK ({est_tokens:,} input tokens)."

                if est_tokens > max_inp:
                    passed = False
                    msg = f"Input tokens ({est_tokens:,}) exceed configured limit ({max_inp:,})."
                elif est_tokens < min_inp:
                    passed = False
                    msg = f"Input tokens ({est_tokens:,}) below configured minimum ({min_inp:,})."
                elif est_total > max_total:
                    passed = False
                    msg = f"Estimated total tokens ({est_total:,}) exceed max total limit ({max_total:,})."

                if not passed and mode == "enforce":
                    blocked_by_enforce = True

                evaluations.append(GovernanceEvaluation(
                    rule_type="context_window",
                    passed=passed,
                    mode=mode,
                    message=msg,
                    details={"input_tokens": est_tokens, "max_input_tokens": max_inp}
                ))

            elif rule.rule_type == "throttle":
                limit_rpm = cfg.get("rate_limit_rpm", 60)
                daily_tokens = cfg.get("quota_per_day_tokens", 5000000)
                daily_reqs = cfg.get("quota_per_day_requests", 2000)

                passed = True
                msg = f"Throttling rate OK ({stats['rpm']} req/min, limit {limit_rpm})."

                if stats["rpm"] >= limit_rpm:
                    passed = False
                    msg = f"Rate limit exceeded: {stats['rpm']} req/min (limit: {limit_rpm} req/min)."
                elif stats["tokens_24h"] + est_tokens > daily_tokens:
                    passed = False
                    msg = f"Daily token quota exceeded: {stats['tokens_24h']:,} tokens used (limit: {daily_tokens:,})."
                elif stats["requests_24h"] >= daily_reqs:
                    passed = False
                    msg = f"Daily request quota exceeded: {stats['requests_24h']} requests (limit: {daily_reqs})."

                if not passed and mode == "enforce":
                    blocked_by_enforce = True

                evaluations.append(GovernanceEvaluation(
                    rule_type="throttle",
                    passed=passed,
                    mode=mode,
                    message=msg,
                    details=stats
                ))

            elif rule.rule_type == "allow_list":
                allowed = cfg.get("allowed_models", [])
                allowed_models_result = allowed
                passed = True
                msg = f"Allow-list policy active ({len(allowed)} models permitted)."

                if not allowed:
                    passed = False
                    msg = "Allow-list is empty. No models permitted."

                if not passed and mode == "enforce":
                    blocked_by_enforce = True

                evaluations.append(GovernanceEvaluation(
                    rule_type="allow_list",
                    passed=passed,
                    mode=mode,
                    message=msg,
                    details={"allowed_count": len(allowed)}
                ))

        overall_passed = not blocked_by_enforce

        # Record this request for throttling metrics
        throttle_tracker.record_request(org_id, est_tokens)

        return GovernanceResult(
            passed=overall_passed,
            blocked_by_enforce=blocked_by_enforce,
            evaluations=evaluations,
            allowed_models=allowed_models_result,
            estimated_input_tokens=est_tokens
        )


governance_service = GovernanceService()
