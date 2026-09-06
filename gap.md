# Routing Logic — Gaps & Correctness Review

Focused specifically on `backend/app/services/routing/router.py` (the ranking/scoring algorithm itself), not the governance/auth/deployment layer around it — that's covered separately in `extended-plan.md`.

## Correctness bug — concrete, not a judgment call

**`_score_candidate()` rewards over-provisioned models over exact tier matches.**

```python
tier_fit = 80.0 if model.tier == resolved_tier else 92.0
```

An exact tier match scores **lower** (80) than a mismatch (92). Since anything *under* the resolved tier is already filtered out earlier in `_filter()`, the `else` branch only ever fires for models that are *over*-provisioned relative to what the prompt actually needs. So whenever both a right-sized model and a pricier higher-tier model survive filtering, the algorithm hands the pricier one a **12-point quality head start** before cost even enters the weighted score. This directly works against the platform's own "cost-optimal routing" pitch — it's a structural bias toward upsell, not a random fluke.

**Fix:** swap the numbers (match = 92, over-provisioned = 80), or reduce the mismatch bonus to something small and intentional if over-provisioning is meant to carry *some* quality-margin credit.

**File:** `backend/app/services/routing/router.py:440`

---

## Real gap — traced in the code, not hypothetical

**Tier-relax only triggers when governance restricted the candidate pool.**

```python
if not survivors and allowed_model_ids:
    survivors, _ = self._filter(..., relax_tier_ceilings=True)
```

If `allowed_model_ids` is `None` (unrestricted candidate pool) and zero models survive purely because none clear the per-dimension ceiling check for the resolved tier, there is **no relax path** — recommendations come back empty, full stop. In the real API this doesn't currently bite because `prompt.py` always passes a non-empty allowed-list before calling the router. But it's a landmine for any other caller of `ModelRouter.route()` (direct library use, a future internal tool, a test that doesn't pass `allowed_model_ids`), and the condition is simply wrong — relaxation should apply whenever there are zero survivors, not only when governance is the reason there are zero survivors.

**Fix:** change the condition to `if not survivors:`.

**File:** `backend/app/services/routing/router.py:557`

---

## Design gap — not a bug, worth a product decision

**No provider diversity in the top-3 ranking.**

Observed live in this session: rank #1 and rank #2 for a real prompt were both Anthropic (Claude Opus 5, Claude Opus 4.7) — the ranker optimizes purely for weighted score, with no notion of "does rank 2 fail independently of rank 1." If a failure is provider-level (account access not enabled, a regional outage, a marketplace subscription issue) rather than model-specific, the manual retry from rank 1 → rank 2 fails for the exact same reason, and the entire point of a fallback chain is defeated. Worth adding a diversity nudge — e.g., prefer a different provider for rank 2 when scores are within the existing `near_tie_points` margin.

**File:** `backend/app/services/routing/router.py` (`_rank_weighted`)

---

## Softer observations — seen in testing, not proven at scale (small sample size)

- **Confidence-escalation may fire more often than the design intends.** The "never downgrade on low confidence" policy escalates one tier whenever confidence is below 0.75. Both live test runs this session landed in the 0.63–0.69 confidence band, triggering escalation both times. If the model's calibration rarely crosses 0.75 in practice, tier escalation becomes the *default* outcome rather than the safety-net exception, quietly undermining cost optimization from the opposite direction of the `tier_fit` bug above. Worth checking against a larger, real prompt sample before trusting the escalation rate as designed.
- **Cost estimates are relative, not predictive.** Every candidate is scored against the same heuristic `est_output_tokens` (a 5-bucket guess derived from one dimension score, not a model-specific estimate). Fine for *ranking* candidates against each other, misleading if a user reads the displayed dollar figure as an actual forecast of what the request will cost.
- **Domain/capability matching is keyword overlap, not learned.** `_count_domain_match` and the capability-tag bonuses in `_score_candidate` are string-matching heuristics sitting next to genuinely learned, embedding-based complexity scoring — lower fidelity than the rest of the "intelligent routing" claim implies.
- **Heuristic fallback profiler is crude by design and silent.** `routing_service.py`'s `_heuristic_profile()` (4 keyword buckets: strategic / analytical / code / default) silently replaces the real ML engine whenever the pickled model fails to load, with only a `warnings` array entry as the visible signal. This is a routing-*quality* cliff specifically, distinct from the reliability angle already flagged in `extended-plan.md` item 7 (malformed registry row crashing `ModelRegistry.__init__`).

---

Branch: `sh/governance-rewrite` · Repo: `Capstone-82/Profiling_Routing`
