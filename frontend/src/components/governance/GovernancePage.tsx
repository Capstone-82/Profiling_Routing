import { useState, useEffect } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck, Sliders, Lock, Save, AlertCircle,
  CheckCircle2, Check, Send, Sparkles, BarChart2,
  Cpu, Clock, Activity, CheckCircle, XCircle,
  AlertTriangle, Settings2, X, Copy, Zap
} from 'lucide-react';
import type { Model, ModelResponse } from '../../types';
import { getAvailableModels, sendPrompt } from '../../services/mock/mockService';

interface GovernanceRule {
  rule_type: string;
  mode: string;
  config: Record<string, unknown>;
}

interface ProfileResult {
  profile: {
    domain: string; intent: string; task_type: string;
    resolved_tier: string; complexity_score: number; confidence: number;
    input_token_count: number; est_output_tokens: number;
    dimensions: {
      d1_semantic_complexity: number; d2_domain_specificity: number;
      d3_output_formality: number; d4_research_dependency: number; d5_context_requirement: number;
    };
  };
  resolved_tier: string;
  recommendations: Array<{
    rank: number; model_id: string; bedrock_model_id?: string;
    provider: string; tier: string; estimated_cost_usd: number;
    reasons: string[]; routing_score?: number;
  }>;
  governance_evaluations: Array<{ rule_type: string; passed: boolean; mode: string; message: string }>;
  warnings: string[];
}

const SAMPLE_PROMPTS = [
  {
    title: 'Full-Stack Roadmap',
    category: 'Engineering',
    prompt: "I'm planning a 3-month roadmap to learn full-stack web development while studying in college. I already know basic Python and HTML. Create a week-by-week plan that balances frontend, backend, databases, and one portfolio project. Limit the study time to 2 hours per day on weekdays and 4 hours on weekends. Include milestones, recommended topics, and how to measure progress each week."
  },
  {
    title: 'Financial Sentiment',
    category: 'Finance & Risk',
    prompt: "Analyze the Q3 earnings transcript of a multinational semiconductor company. Identify key revenue drivers, supply chain risks, capital expenditure shifts, and management sentiment regarding forward margin guidance. Summarize findings in executive bullet points with risk ratings."
  },
  {
    title: 'Client Meeting Reschedule',
    category: 'Productivity',
    prompt: "Draft a concise, professional email to an enterprise client explaining that our architectural review meeting scheduled for tomorrow needs to be pushed back by 48 hours due to unforeseen infrastructure maintenance. Offer two alternative 45-minute slots on Thursday and Friday afternoon."
  },
  {
    title: 'Database Sharding Design',
    category: 'System Design',
    prompt: "Design a horizontally scalable database architecture for a multi-tenant SaaS application handling 50,000 write operations per second with 99.99% availability. Detail partition key strategies, consistent hashing, cross-shard query mitigation, read-replica replication lag handling, and backup failover procedures."
  }
];

function DimBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  const color = pct <= 30 ? '#10B981' : pct <= 60 ? '#3B82F6' : pct <= 80 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value.toFixed(2)}</span>
      </div>
      <div style={{ width: '100%', height: '5px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

export function GovernancePage() {
  const { user } = useAuth();

  // Governance state
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [maxInputTokens, setMaxInputTokens] = useState(200000);
  const [maxTotalTokens, setMaxTotalTokens] = useState(250000);
  const [rateLimitRpm, setRateLimitRpm] = useState(60);
  const [dailyTokenQuota, setDailyTokenQuota] = useState(5000000);

  // Guardrails modal/drawer toggle
  const [guardrailsOpen, setGuardrailsOpen] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSaveOk, setRulesSaveOk] = useState(false);
  const [rulesSaveErr, setRulesSaveErr] = useState('');

  // Interactive prompt state
  const [prompt, setPrompt] = useState('');
  const [userPreferredModelId, setUserPreferredModelId] = useState<string>('');
  const [profiling, setProfiling] = useState(false);
  const [profileResult, setProfileResult] = useState<ProfileResult | null>(null);
  const [profileErr, setProfileErr] = useState('');

  const [routing, setRouting] = useState(false);
  const [response, setResponse] = useState<ModelResponse | null>(null);
  const [responseErr, setResponseErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getAvailableModels().then(ms => {
      setAllModels(ms);
      const allIds = ms.map(m => m.id);
      setAllowedModels(allIds);

      if (user?.id) {
        fetch('http://localhost:8000/api/governance/rules', { headers: { 'X-User-ID': user.id } })
          .then(r => r.ok ? r.json() : [])
          .then((rules: GovernanceRule[]) => {
            rules.forEach(r => {
              if (r.rule_type === 'allow_list' && r.config.allowed_models) {
                const savedIds = r.config.allowed_models as string[];
                const matched = ms
                  .filter(m => savedIds.some(sid => sid === m.id || sid === m.providerModelId || m.providerModelId?.includes(sid) || m.id?.includes(sid)))
                  .map(m => m.id);
                if (matched.length > 0) setAllowedModels(matched);
              } else if (r.rule_type === 'context_window') {
                if (r.config.max_input_tokens) setMaxInputTokens(r.config.max_input_tokens as number);
                if (r.config.max_total_tokens) setMaxTotalTokens(r.config.max_total_tokens as number);
              } else if (r.rule_type === 'throttle') {
                if (r.config.rate_limit_rpm) setRateLimitRpm(r.config.rate_limit_rpm as number);
                if (r.config.quota_per_day_tokens) setDailyTokenQuota(r.config.quota_per_day_tokens as number);
              }
            });
          })
          .catch(() => {});
      }
    });
  }, [user?.id]);

  const permittedModels = allModels.filter(m => allowedModels.includes(m.id));

  const handleSaveGuardrails = async () => {
    setSavingRules(true); setRulesSaveOk(false); setRulesSaveErr('');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (user?.id) headers['X-User-ID'] = user.id;
    try {
      await Promise.all([
        fetch('http://localhost:8000/api/governance/rules', {
          method: 'POST', headers,
          body: JSON.stringify({ rule_type: 'allow_list', mode: 'enforce', config: { allowed_models: allowedModels } })
        }),
        fetch('http://localhost:8000/api/governance/rules', {
          method: 'POST', headers,
          body: JSON.stringify({ rule_type: 'context_window', mode: 'enforce', config: { max_input_tokens: maxInputTokens, max_total_tokens: maxTotalTokens } })
        }),
        fetch('http://localhost:8000/api/governance/rules', {
          method: 'POST', headers,
          body: JSON.stringify({ rule_type: 'throttle', mode: 'enforce', config: { rate_limit_rpm: rateLimitRpm, quota_per_day_tokens: dailyTokenQuota } })
        }),
      ]);
      setRulesSaveOk(true);
      setTimeout(() => {
        setRulesSaveOk(false);
        setGuardrailsOpen(false);
      }, 1500);
    } catch (e) {
      setRulesSaveErr(e instanceof Error ? e.message : 'Failed to save guardrails');
    } finally {
      setSavingRules(false);
    }
  };

  const handleProfileOnly = async () => {
    if (!prompt.trim()) return;
    setProfiling(true); setProfileResult(null); setProfileErr(''); setResponseErr('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.id) headers['X-User-ID'] = user.id;
      const res = await fetch('http://localhost:8000/api/prompt/profile', {
        method: 'POST', headers,
        body: JSON.stringify({
          prompt,
          preferredModelId: userPreferredModelId || undefined
        }),
      });
      if (!res.ok) throw new Error(`Profiling failed with status ${res.status}`);
      const data: ProfileResult = await res.json();
      setProfileResult(data);
    } catch (e) {
      setProfileErr(e instanceof Error ? e.message : 'Profiling failed');
    } finally {
      setProfiling(false);
    }
  };

  const handleRouteAndInvoke = async () => {
    if (!prompt.trim()) return;
    setRouting(true); setResponse(null); setResponseErr('');
    try {
      const result = await sendPrompt({
        prompt,
        preferredModelId: userPreferredModelId || undefined,
        mode: 'auto'
      }, user?.id);

      setResponse(result);

      if (result.profile_summary && result.recommendations) {
        setProfileResult({
          profile: result.profile_summary,
          resolved_tier: result.tier || result.profile_summary.resolved_tier,
          recommendations: result.recommendations,
          governance_evaluations: result.governance_evaluations || [],
          warnings: result.warnings || [],
        });
      }
    } catch (e) {
      setResponseErr(e instanceof Error ? e.message : 'Routing and invocation failed');
    } finally {
      setRouting(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeRecommendations = response?.recommendations || profileResult?.recommendations || [];

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <AppHeader activePath="/governance" />

      <main style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '28px 24px 60px', flex: 1 }}>

        {/* ── Top Header & Policy Control Bar ── */}
        <div style={{
          background: '#FFFFFF',
          border: '1.5px solid #E2E8F0',
          borderRadius: '16px',
          padding: '24px 28px',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700, color: '#1D4ED8', marginBottom: '8px' }}>
                <ShieldCheck size={13} /> AI Governance & Intelligent Routing Engine
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                Enterprise AI Policy & Model Router
              </h1>
              <p style={{ fontSize: '13.5px', color: '#64748B', marginTop: '6px', maxWidth: '820px', lineHeight: 1.5 }}>
                Define permitted foundation models and governance guardrails. Prompts are analyzed by semantic profilers, filtered by governance limits, ranked across Top 3 models from your allowed list, and invoked with automated 3-tier cascade fallback (Rank 1 → Rank 2 → Rank 3).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setGuardrailsOpen(true)}
              className="cs-btn"
              style={{
                height: '42px',
                padding: '0 18px',
                background: '#0F172A',
                color: '#FFFFFF',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
                transition: 'all 0.15s ease'
              }}
            >
              <Settings2 size={15} /> Configure Guardrails ({permittedModels.length} Models)
            </button>
          </div>

          {/* Active Policies Indicator Pill Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingTop: '14px',
            borderTop: '1px solid #F1F5F9'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Guardrails:
            </span>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
              <Lock size={12} style={{ color: '#0284C7' }} />
              <strong>{permittedModels.length}</strong> of {allModels.length} Bedrock Models Permitted
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
              <Sliders size={12} style={{ color: '#0284C7' }} />
              Max Input: <strong>{(maxInputTokens / 1000).toFixed(0)}K tokens</strong>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
              <Activity size={12} style={{ color: '#0284C7' }} />
              Rate Limit: <strong>{rateLimitRpm} RPM</strong>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#065F46', marginLeft: 'auto' }}>
              <CheckCircle2 size={12} /> Cascade Fallback: Top 1 → Top 2 → Top 3 Active
            </div>
          </div>
        </div>

        {/* ── Main Two-Column Layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '24px', alignItems: 'start' }}>

          {/* ════════ LEFT COLUMN: Prompt Input & Profiler Breakdown ════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Prompt Card */}
            <div style={{
              background: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Sparkles size={16} style={{ color: '#0066FF' }} /> Enter Prompt to Profile & Route
                </h2>
                <span style={{ fontSize: '11.5px', color: '#94A3B8', fontWeight: 500 }}>
                  {prompt.length} chars
                </span>
              </div>

              {/* Sample Prompts */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  Quick Sample Prompts:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {SAMPLE_PROMPTS.map(sp => (
                    <button
                      key={sp.title}
                      type="button"
                      onClick={() => setPrompt(sp.prompt)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: prompt === sp.prompt ? '#EFF6FF' : '#F1F5F9',
                        border: `1px solid ${prompt === sp.prompt ? '#3B82F6' : '#E2E8F0'}`,
                        color: prompt === sp.prompt ? '#1D4ED8' : '#334155',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.1s'
                      }}
                    >
                      {sp.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Enter prompt to evaluate against governance rules and automatically route to the optimal model from your allowed list..."
                style={{
                  width: '100%',
                  minHeight: '160px',
                  borderRadius: '10px',
                  border: '1.5px solid #CBD5E1',
                  padding: '14px',
                  fontSize: '13.5px',
                  lineHeight: 1.6,
                  color: '#0F172A',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  background: '#FDFEFE'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#0066FF'}
                onBlur={e => e.currentTarget.style.borderColor = '#CBD5E1'}
              />

              {/* Optional User Preference for Benchmarking */}
              <div style={{ marginTop: '16px', padding: '12px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Compare Against User Choice (Optional Benchmark)
                  </label>
                  {userPreferredModelId && (
                    <button
                      type="button"
                      onClick={() => setUserPreferredModelId('')}
                      style={{ background: 'none', border: 'none', fontSize: '11px', color: '#64748B', cursor: 'pointer' }}
                    >
                      Clear preference
                    </button>
                  )}
                </div>
                <select
                  value={userPreferredModelId}
                  onChange={e => setUserPreferredModelId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    padding: '0 10px',
                    fontSize: '12.5px',
                    color: '#0F172A',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">No preference — router selects purely based on prompt profile & governance</option>
                  {permittedModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.provider})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '5px' }}>
                  If selected, the router will evaluate all allowed models, recommend the top 3, and benchmark against your choice.
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '18px' }}>
                <button
                  type="button"
                  onClick={handleProfileOnly}
                  disabled={!prompt.trim() || profiling || routing}
                  className="cs-btn cs-btn-outline"
                  style={{
                    flex: 1,
                    height: '44px',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    gap: '8px',
                    justifyContent: 'center',
                    cursor: !prompt.trim() || profiling || routing ? 'not-allowed' : 'pointer'
                  }}
                >
                  {profiling ? (
                    <><span className="cs-spinner" style={{ width: '14px', height: '14px' }} /> Profiling...</>
                  ) : (
                    <><BarChart2 size={16} /> Profile Prompt</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRouteAndInvoke}
                  disabled={!prompt.trim() || routing || profiling}
                  className="cs-btn cs-btn-primary"
                  style={{
                    flex: 1.2,
                    height: '44px',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    borderRadius: '10px',
                    gap: '8px',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)',
                    cursor: !prompt.trim() || routing || profiling ? 'not-allowed' : 'pointer'
                  }}
                >
                  {routing ? (
                    <><span className="cs-spinner" style={{ width: '14px', height: '14px' }} /> Routing & Invoking...</>
                  ) : (
                    <><Send size={15} /> Route & Invoke</>
                  )}
                </button>
              </div>

              {profileErr && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', color: '#991B1B' }}>
                  <AlertCircle size={14} /> {profileErr}
                </div>
              )}
            </div>

            {/* Semantic Profiler & Governance Evaluation Card */}
            {(profileResult || profiling) && (
              <div style={{
                background: '#FFFFFF',
                border: '1.5px solid #E2E8F0',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart2 size={16} style={{ color: '#0066FF' }} />
                    <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Prompt Profiling & Governance Checks
                    </h3>
                  </div>
                  {profileResult && (
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: profileResult.resolved_tier === 'T3' ? '#FEE2E2' : profileResult.resolved_tier === 'T2' ? '#FEF3C7' : '#DCFCE7',
                      color: profileResult.resolved_tier === 'T3' ? '#991B1B' : profileResult.resolved_tier === 'T2' ? '#92400E' : '#166534',
                      fontSize: '11.5px',
                      fontWeight: 800
                    }}>
                      Tier {profileResult.resolved_tier} · Score {profileResult.profile.complexity_score.toFixed(3)}
                    </span>
                  )}
                </div>

                {profiling && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="cs-skeleton" style={{ height: '14px', width: '80%' }} />
                    <div className="cs-skeleton" style={{ height: '14px', width: '60%' }} />
                    <div className="cs-skeleton" style={{ height: '14px', width: '90%' }} />
                  </div>
                )}

                {profileResult && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Domain & Intent Badges */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Domain</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{profileResult.profile.domain}</div>
                      </div>
                      <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Intent</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{profileResult.profile.intent}</div>
                      </div>
                      <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Task Type</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{profileResult.profile.task_type}</div>
                      </div>
                    </div>

                    {/* Dimensions Progress */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <DimBar label="D1 Semantic Complexity" value={profileResult.profile.dimensions.d1_semantic_complexity} />
                      <DimBar label="D2 Domain Specificity" value={profileResult.profile.dimensions.d2_domain_specificity} />
                      <DimBar label="D3 Output Formality" value={profileResult.profile.dimensions.d3_output_formality} />
                      <DimBar label="D4 Research Dependency" value={profileResult.profile.dimensions.d4_research_dependency} />
                      <DimBar label="D5 Context Requirement" value={profileResult.profile.dimensions.d5_context_requirement} />
                    </div>

                    {/* Governance Evaluations */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                        Governance Policy Verification
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {profileResult.governance_evaluations.map((ev, i) => (
                          <span
                            key={i}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              background: ev.passed ? '#ECFDF5' : '#FEE2E2',
                              border: `1px solid ${ev.passed ? '#A7F3D0' : '#FECACA'}`,
                              color: ev.passed ? '#065F46' : '#991B1B'
                            }}
                            title={ev.message}
                          >
                            {ev.passed ? <CheckCircle size={11} /> : <XCircle size={11} />}
                            {ev.rule_type.replace('_', ' ')}: {ev.passed ? 'Passed' : 'Violation'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════════ RIGHT COLUMN: Top 3 Recommendations & Invocation ════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Top 3 Recommendations Card */}
            <div style={{
              background: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Cpu size={16} style={{ color: '#0066FF' }} /> Top 3 Models from Allowed List
                </h2>
                <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '2px 8px', background: '#EFF6FF', color: '#1D4ED8', borderRadius: '6px' }}>
                  Allowed Pool: {permittedModels.length} Models
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                Ranked by prompt semantic complexity, provider capability match, context safety margin, and price/performance efficiency.
              </p>

              {activeRecommendations.length === 0 && !routing && !profiling && (
                <div style={{ textAlign: 'center', padding: '36px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                  <Cpu size={24} style={{ color: '#94A3B8', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>No recommendations yet</p>
                  <p style={{ fontSize: '12px', color: '#64748B', maxWidth: '320px', margin: '0 auto' }}>
                    Enter a prompt and click "Profile Prompt" or "Route & Invoke" to evaluate optimal models.
                  </p>
                </div>
              )}

              {(routing || profiling) && activeRecommendations.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[1, 2, 3].map(n => (
                    <div key={n} className="cs-skeleton" style={{ height: '72px', borderRadius: '10px' }} />
                  ))}
                </div>
              )}

              {activeRecommendations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeRecommendations.slice(0, 3).map(rec => {
                    const isRank1 = rec.rank === 1;
                    const isRank2 = rec.rank === 2;
                    const isRank3 = rec.rank === 3;

                    // Match actual model invoked
                    const isModelUsed = response?.model_used_name?.toLowerCase().includes(rec.model_id.replace(/-/g, ' ').toLowerCase()) ||
                                        response?.routed_model_id === rec.model_id ||
                                        (response?.model_used && rec.bedrock_model_id && response.model_used.includes(rec.bedrock_model_id));

                    return (
                      <div
                        key={rec.rank}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          background: isRank1 ? '#F0F7FF' : '#FFFFFF',
                          border: `1.5px solid ${isRank1 ? '#3B82F6' : '#E2E8F0'}`,
                          boxShadow: isRank1 ? '0 4px 12px rgba(59, 130, 246, 0.08)' : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              width: '24px', height: '24px',
                              borderRadius: '50%',
                              background: isRank1 ? '#1D4ED8' : isRank2 ? '#64748B' : '#94A3B8',
                              color: '#FFFFFF',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: 800
                            }}>
                              #{rec.rank}
                            </span>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                                {rec.model_id.replace(/-/g, ' ').toUpperCase()}
                              </span>
                              <span style={{ fontSize: '11.5px', color: '#64748B', marginLeft: '8px' }}>
                                {rec.provider} · {rec.tier}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                              ${rec.estimated_cost_usd.toFixed(6)}
                            </span>
                            {isModelUsed && (
                              <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', fontSize: '10.5px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <CheckCircle2 size={11} /> Invoked
                              </span>
                            )}
                            {isRank1 && (
                              <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#DBEAFE', color: '#1E40AF', fontSize: '10.5px', fontWeight: 800 }}>
                                Primary Choice
                              </span>
                            )}
                            {isRank2 && (
                              <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#F1F5F9', color: '#475569', fontSize: '10.5px', fontWeight: 700 }}>
                                Standby Fallback 1
                              </span>
                            )}
                            {isRank3 && (
                              <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#F1F5F9', color: '#475569', fontSize: '10.5px', fontWeight: 700 }}>
                                Standby Fallback 2
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Reason / Score Tags */}
                        {rec.reasons && rec.reasons.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                            {rec.reasons.map((r, ri) => (
                              <span key={ri} style={{ fontSize: '11px', color: '#334155', background: isRank1 ? '#E0EDFF' : '#F1F5F9', padding: '2px 8px', borderRadius: '4px' }}>
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Response Card */}
            <div style={{
              background: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '380px'
            }}>
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#FDFEFE'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Send size={15} style={{ color: '#0066FF' }} />
                  <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A' }}>
                    Model Invocation Response
                  </span>
                </div>
                {response && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: '#DCFCE7',
                      border: '1px solid #86EFAC',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      color: '#166534'
                    }}>
                      <CheckCircle2 size={12} /> Invoked: {response.model_used_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(response.text)}
                      style={{
                        background: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Copy size={11} /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {!response && !routing && !responseErr && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                      <Send size={20} style={{ color: '#0066FF' }} />
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>Ready for Invocation</p>
                    <p style={{ fontSize: '12.5px', color: '#64748B', maxWidth: '340px', lineHeight: 1.5 }}>
                      Click "Route & Invoke" to profile prompt complexity and execute automatic invocation on AWS Bedrock through your connected account.
                    </p>
                  </div>
                )}

                {routing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0066FF', fontWeight: 700 }}>
                      <span className="cs-spinner cs-spinner-blue" /> Evaluating Governance → Profiling → Attempting Invocation (Rank 1 → 2 → 3)...
                    </div>
                    {[100, 85, 95, 75, 90, 60].map((w, i) => (
                      <div key={i} className="cs-skeleton" style={{ height: '14px', width: `${w}%` }} />
                    ))}
                  </div>
                )}

                {responseErr && (
                  <div style={{ padding: '14px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <AlertCircle size={18} style={{ color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#991B1B', marginBottom: '2px' }}>Invocation Error</div>
                      <div style={{ fontSize: '12px', color: '#B91C1C', lineHeight: 1.5 }}>{responseErr}</div>
                    </div>
                  </div>
                )}

                {response && (
                  <>
                    {/* Fallback Banner */}
                    {response.fallback_used ? (
                      <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '12.5px', color: '#92400E' }}>
                        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <div>
                          Primary model ({response.fallback_from}) failed invocation. Intelligent router automatically fell back to <strong>{response.model_used_name}</strong> without request failure.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', fontSize: '12px', color: '#065F46', fontWeight: 600 }}>
                        <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                        Rank #1 model invoked directly on AWS Bedrock with 100% success.
                      </div>
                    )}

                    {/* Benchmark Comparison Insight */}
                    {response.comparison_insight && (
                      <div style={{ padding: '10px 14px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '12px', color: '#1E293B', lineHeight: 1.5 }}>
                        <strong>Benchmark Insight: </strong>
                        {response.comparison_insight}
                      </div>
                    )}

                    {/* Output Text */}
                    <div style={{
                      fontSize: '13.5px',
                      color: '#0F172A',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      background: '#FDFEFE',
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      flex: 1
                    }}>
                      {response.text}
                    </div>

                    {/* Latency & Token Usage Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '10px', fontSize: '12px', color: '#64748B' }}>
                      {response.latency_ms !== undefined && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} style={{ color: '#0284C7' }} /> Latency: <strong>{response.latency_ms} ms</strong>
                        </span>
                      )}
                      {response.tokens_used !== undefined && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Zap size={13} style={{ color: '#F59E0B' }} /> Tokens: <strong>{response.tokens_used.toLocaleString()}</strong>
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* ════════ GUARDRAILS CONFIGURATION MODAL / DRAWER ════════ */}
      {guardrailsOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            maxWidth: '780px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Organization AI Guardrails & Allowed Models
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>
                  Models checked below form the permitted routing pool for prompts in this organization.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGuardrailsOpen(false)}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>

              {/* 1. Allowed Models Policy */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={14} style={{ color: '#0066FF' }} /> Permitted Models ({allowedModels.length} Selected)
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setAllowedModels(allModels.map(m => m.id))}
                      style={{ background: 'none', border: 'none', color: '#0066FF', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (allModels[0]) setAllowedModels([allModels[0].id]); }}
                      style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {allModels.map(m => {
                    const isSel = allowedModels.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          if (isSel) {
                            if (allowedModels.length > 1) setAllowedModels(allowedModels.filter(x => x !== m.id));
                          } else {
                            setAllowedModels([...allowedModels, m.id]);
                          }
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: `1.5px solid ${isSel ? '#0066FF' : '#CBD5E1'}`,
                          background: isSel ? '#EFF6FF' : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.1s'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{m.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{m.provider} · {m.contextWindow || '128K'}</div>
                        </div>
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '4px',
                          border: `1.5px solid ${isSel ? '#0066FF' : '#CBD5E1'}`,
                          background: isSel ? '#0066FF' : '#FFFFFF',
                          color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {isSel && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Context Window Guardrail */}
              <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Sliders size={14} style={{ color: '#0066FF' }} /> Context Window Token Limits
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Max Input Tokens Cap
                    </span>
                    <input
                      type="number"
                      value={maxInputTokens}
                      onChange={e => setMaxInputTokens(Number(e.target.value))}
                      className="cs-input"
                      style={{ height: '38px', fontSize: '13px' }}
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {[32000, 128000, 200000, 300000].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setMaxInputTokens(v)}
                          style={{
                            padding: '2px 6px', borderRadius: '4px',
                            background: maxInputTokens === v ? '#DBEAFE' : '#E2E8F0',
                            color: maxInputTokens === v ? '#1E40AF' : '#475569',
                            fontSize: '10.5px', fontWeight: 600, border: 'none', cursor: 'pointer'
                          }}
                        >
                          {(v / 1000).toFixed(0)}K
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Max Total Tokens (In + Out)
                    </span>
                    <input
                      type="number"
                      value={maxTotalTokens}
                      onChange={e => setMaxTotalTokens(Number(e.target.value))}
                      className="cs-input"
                      style={{ height: '38px', fontSize: '13px' }}
                    />
                    <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                      Protects against unbounded generational cost.
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Rate & Quota Guardrail */}
              <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Activity size={14} style={{ color: '#0066FF' }} /> Throttling & Daily Quotas
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Rate Limit (Requests / Min)
                    </span>
                    <input
                      type="number"
                      value={rateLimitRpm}
                      onChange={e => setRateLimitRpm(Number(e.target.value))}
                      className="cs-input"
                      style={{ height: '38px', fontSize: '13px' }}
                    />
                    <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                      Prevents surge traffic and API exhaustion.
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Daily Token Budget
                    </span>
                    <input
                      type="number"
                      value={dailyTokenQuota}
                      onChange={e => setDailyTokenQuota(Number(e.target.value))}
                      className="cs-input"
                      style={{ height: '38px', fontSize: '13px' }}
                    />
                    <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                      {(dailyTokenQuota / 1000000).toFixed(1)}M tokens per 24 hours.
                    </span>
                  </div>
                </div>
              </div>

              {rulesSaveOk && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '8px', fontSize: '12.5px', color: '#15803D', fontWeight: 700 }}>
                  <CheckCircle2 size={16} /> Enterprise guardrails successfully saved and active.
                </div>
              )}

              {rulesSaveErr && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12.5px', color: '#991B1B', fontWeight: 600 }}>
                  <AlertCircle size={16} /> {rulesSaveErr}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setGuardrailsOpen(false)}
                className="cs-btn cs-btn-outline"
                style={{ height: '40px', padding: '0 16px', fontSize: '13px' }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveGuardrails}
                disabled={savingRules}
                className="cs-btn cs-btn-primary"
                style={{ height: '40px', padding: '0 20px', fontSize: '13px', gap: '6px', fontWeight: 700 }}
              >
                {savingRules ? (
                  <><span className="cs-spinner" style={{ width: '13px', height: '13px' }} /> Saving...</>
                ) : (
                  <><Save size={14} /> Save Guardrails</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
