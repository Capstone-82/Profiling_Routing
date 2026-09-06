import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppHeader } from '../layout/AppHeader';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck, Sliders, Lock, Save, AlertCircle,
  CheckCircle2, Check, Send, Sparkles, BarChart2,
  Cpu, Clock, CheckCircle, XCircle,
  AlertTriangle, Settings2, X, Copy, Zap, RefreshCw, ExternalLink
} from 'lucide-react';
import type { Model, ModelResponse, ModelRecommendation, Connection } from '../../types';
import { getAvailableModels, getConnection, sendPrompt } from '../../services/mock/mockService';
import { fetchGovernanceRules, saveGovernanceRule } from '../../services/apiService';

interface GovernanceRule {
  rule_type: string;
  mode: string;
  config: Record<string, unknown>;
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

const RANK_LABEL: Record<number, string> = { 1: 'Primary Choice', 2: 'Standby Fallback 1', 3: 'Standby Fallback 2' };

export function GovernancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Connection state
  const [connection, setConnection] = useState<Connection>({ provider: 'aws-bedrock', status: 'not_connected' });

  // Governance state -- allow-list is keyed by real Bedrock provider model IDs
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [allowedBedrockIds, setAllowedBedrockIds] = useState<string[]>([]);
  const [maxInputTokens, setMaxInputTokens] = useState(200000);
  const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
  const [maxTotalTokens, setMaxTotalTokens] = useState(250000);
  const [rateLimitRpm, setRateLimitRpm] = useState(60);
  const [dailyTokenQuota, setDailyTokenQuota] = useState(5000000);

  const [guardrailsOpen, setGuardrailsOpen] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSaveOk, setRulesSaveOk] = useState(false);
  const [rulesSaveErr, setRulesSaveErr] = useState('');

  // Prompt + routing state
  const [prompt, setPrompt] = useState('');
  const [guessedBedrockModelId, setGuessedBedrockModelId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ModelResponse | null>(null);
  const [responseErr, setResponseErr] = useState('');
  const [retryingRank, setRetryingRank] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getConnection(user?.id).then(setConnection);

    getAvailableModels(user?.id).then(ms => {
      setAllModels(ms);
      const allIds = ms.map(m => m.providerModelId);
      setAllowedBedrockIds(allIds);

      if (user?.id) {
        fetchGovernanceRules(user.id).then((rules: GovernanceRule[]) => {
          rules.forEach(r => {
            if (r.rule_type === 'allow_list' && r.config.allowed_bedrock_model_ids) {
              const saved = r.config.allowed_bedrock_model_ids as string[];
              const matched = ms.filter(m => saved.includes(m.providerModelId)).map(m => m.providerModelId);
              if (matched.length > 0) setAllowedBedrockIds(matched);
            } else if (r.rule_type === 'context_window') {
              if (r.config.max_input_tokens) setMaxInputTokens(r.config.max_input_tokens as number);
              if (r.config.max_output_tokens) setMaxOutputTokens(r.config.max_output_tokens as number);
              if (r.config.max_total_tokens) setMaxTotalTokens(r.config.max_total_tokens as number);
            } else if (r.rule_type === 'throttle') {
              if (r.config.rate_limit_rpm) setRateLimitRpm(r.config.rate_limit_rpm as number);
              if (r.config.quota_per_day_tokens) setDailyTokenQuota(r.config.quota_per_day_tokens as number);
            }
          });
        });
      }
    });
  }, [user?.id]);

  const permittedModels = allModels.filter(m => allowedBedrockIds.includes(m.providerModelId));
  const connectionVerified = connection.status === 'verified';

  const handleSaveGuardrails = async () => {
    setSavingRules(true); setRulesSaveOk(false); setRulesSaveErr('');
    try {
      const results = await Promise.all([
        saveGovernanceRule({ rule_type: 'allow_list', mode: 'enforce', config: { allowed_bedrock_model_ids: allowedBedrockIds } }, user?.id),
        saveGovernanceRule({ rule_type: 'context_window', mode: 'enforce', config: { max_input_tokens: maxInputTokens, max_output_tokens: maxOutputTokens, max_total_tokens: maxTotalTokens } }, user?.id),
        saveGovernanceRule({ rule_type: 'throttle', mode: 'enforce', config: { rate_limit_rpm: rateLimitRpm, quota_per_day_tokens: dailyTokenQuota } }, user?.id),
      ]);
      if (results.some(ok => !ok)) throw new Error('One or more guardrail rules failed to save');
      setRulesSaveOk(true);
      setTimeout(() => { setRulesSaveOk(false); setGuardrailsOpen(false); }, 1500);
    } catch (e) {
      setRulesSaveErr(e instanceof Error ? e.message : 'Failed to save guardrails');
    } finally {
      setSavingRules(false);
    }
  };

  const handleSend = async () => {
    if (!prompt.trim() || !connectionVerified) return;
    setSending(true); setResponse(null); setResponseErr('');
    try {
      const result = await sendPrompt({
        prompt,
        guessed_bedrock_model_id: guessedBedrockModelId || undefined,
      }, user?.id);
      setResponse(result);
    } catch (e) {
      setResponseErr(e instanceof Error ? e.message : 'Routing and invocation failed');
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async (rec: ModelRecommendation) => {
    if (!prompt.trim() || !rec.bedrock_model_id) return;
    setRetryingRank(rec.rank); setResponseErr('');
    try {
      const result = await sendPrompt({
        prompt,
        guessed_bedrock_model_id: guessedBedrockModelId || undefined,
        retry_bedrock_model_id: rec.bedrock_model_id,
      }, user?.id);
      setResponse(result);
    } catch (e) {
      setResponseErr(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setRetryingRank(null);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const recommendations = response?.recommendations || [];
  const failed = !!response?.invocation_error;

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <AppHeader activePath="/governance" />

      <main style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '28px 24px 60px', flex: 1 }}>

        {/* ── Top Header & Policy Control Bar ── */}
        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '24px 28px',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)', marginBottom: '24px',
          display: 'flex', flexDirection: 'column', gap: '16px'
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
                Define permitted Bedrock models and governance guardrails. Prompts are profiled, filtered by
                governance limits, ranked across your top 3 allowed models, and rank #1 is invoked automatically --
                rank #2/#3 are only invoked if you choose to retry.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setGuardrailsOpen(true)}
              className="cs-btn"
              style={{ height: '42px', padding: '0 18px', background: '#0F172A', color: '#FFFFFF', borderRadius: '10px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)' }}
            >
              <Settings2 size={15} /> Configure Guardrails ({permittedModels.length} Models)
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Status:
            </span>

            {connectionVerified ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#065F46' }}>
                <CheckCircle2 size={12} /> AWS Bedrock Connected
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/connections')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#92400E', cursor: 'pointer' }}
              >
                <AlertCircle size={12} /> AWS Bedrock Not Connected <ExternalLink size={11} />
              </button>
            )}

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
              <Lock size={12} style={{ color: '#0284C7' }} />
              <strong>{permittedModels.length}</strong> of {allModels.length} Bedrock Models Permitted
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
              <Sliders size={12} style={{ color: '#0284C7' }} />
              Max Input: <strong>{(maxInputTokens / 1000).toFixed(0)}K tokens</strong>
            </div>
          </div>
        </div>

        {!connectionVerified && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', marginBottom: '24px' }}>
            <Lock size={16} style={{ color: '#D97706', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#78350F' }}>Connect AWS Bedrock to route prompts</p>
              <p style={{ fontSize: '12px', color: '#92400E', marginTop: '2px' }}>
                Prompts can only be routed and invoked against a verified AWS account.{' '}
                <button onClick={() => navigate('/connections')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066FF', fontWeight: 700, fontSize: '12px', padding: 0, textDecoration: 'underline' }}>
                  Connect your AWS account
                </button>.
              </p>
            </div>
          </div>
        )}

        {/* ── Main Two-Column Layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '24px', alignItems: 'start' }}>

          {/* ════════ LEFT COLUMN: Prompt Input & Profiler Breakdown ════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Sparkles size={16} style={{ color: '#0066FF' }} /> Enter Prompt to Profile & Route
                </h2>
                <span style={{ fontSize: '11.5px', color: '#94A3B8', fontWeight: 500 }}>{prompt.length} chars</span>
              </div>

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
                        padding: '4px 10px', borderRadius: '8px',
                        background: prompt === sp.prompt ? '#EFF6FF' : '#F1F5F9',
                        border: `1px solid ${prompt === sp.prompt ? '#3B82F6' : '#E2E8F0'}`,
                        color: prompt === sp.prompt ? '#1D4ED8' : '#334155',
                        fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {sp.title}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Enter prompt to evaluate against governance rules and automatically route to the optimal model from your allowed list..."
                style={{
                  width: '100%', minHeight: '160px', borderRadius: '10px', border: '1.5px solid #CBD5E1',
                  padding: '14px', fontSize: '13.5px', lineHeight: 1.6, color: '#0F172A', fontFamily: 'inherit',
                  resize: 'vertical', boxSizing: 'border-box', outline: 'none', background: '#FDFEFE'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#0066FF'}
                onBlur={e => e.currentTarget.style.borderColor = '#CBD5E1'}
              />

              <div style={{ marginTop: '16px', padding: '12px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Guess the Best Model (Optional)
                  </label>
                  {guessedBedrockModelId && (
                    <button type="button" onClick={() => setGuessedBedrockModelId('')} style={{ background: 'none', border: 'none', fontSize: '11px', color: '#64748B', cursor: 'pointer' }}>
                      Clear guess
                    </button>
                  )}
                </div>
                <select
                  value={guessedBedrockModelId}
                  onChange={e => setGuessedBedrockModelId(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', padding: '0 10px', fontSize: '12.5px', color: '#0F172A', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="">No guess -- router selects purely based on prompt profile & governance</option>
                  {permittedModels.map(m => (
                    <option key={m.providerModelId} value={m.providerModelId}>{m.name} ({m.provider})</option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '5px' }}>
                  If you guess, the router still picks the optimal model -- you'll see whether your guess matched.
                </span>
              </div>

              <button
                type="button"
                onClick={handleSend}
                disabled={!prompt.trim() || sending || !connectionVerified}
                className="cs-btn cs-btn-primary"
                style={{
                  width: '100%', height: '46px', fontSize: '13.5px', fontWeight: 800, borderRadius: '10px',
                  gap: '8px', justifyContent: 'center', marginTop: '16px',
                  background: 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)',
                  cursor: (!prompt.trim() || sending || !connectionVerified) ? 'not-allowed' : 'pointer',
                  opacity: (!prompt.trim() || sending || !connectionVerified) ? 0.6 : 1,
                }}
              >
                {sending ? (<><span className="cs-spinner" style={{ width: '14px', height: '14px' }} /> Routing & Invoking...</>) : (<><Send size={15} /> Route & Invoke</>)}
              </button>

              {responseErr && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', color: '#991B1B' }}>
                  <AlertCircle size={14} /> {responseErr}
                </div>
              )}
            </div>

            {(response || sending) && (
              <div style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart2 size={16} style={{ color: '#0066FF' }} />
                    <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Prompt Profiling & Governance Checks</h3>
                  </div>
                  {response?.profile_summary && (
                    <span style={{
                      padding: '3px 10px', borderRadius: '999px',
                      background: response.profile_summary.resolved_tier === 'T3' ? '#FEE2E2' : response.profile_summary.resolved_tier === 'T2' ? '#FEF3C7' : '#DCFCE7',
                      color: response.profile_summary.resolved_tier === 'T3' ? '#991B1B' : response.profile_summary.resolved_tier === 'T2' ? '#92400E' : '#166534',
                      fontSize: '11.5px', fontWeight: 800
                    }}>
                      Tier {response.profile_summary.resolved_tier} · Score {response.profile_summary.complexity_score.toFixed(3)}
                    </span>
                  )}
                </div>

                {sending && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="cs-skeleton" style={{ height: '14px', width: '80%' }} />
                    <div className="cs-skeleton" style={{ height: '14px', width: '60%' }} />
                    <div className="cs-skeleton" style={{ height: '14px', width: '90%' }} />
                  </div>
                )}

                {response?.profile_summary && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Domain</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{response.profile_summary.domain}</div>
                      </div>
                      <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Intent</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{response.profile_summary.intent}</div>
                      </div>
                      <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Task Type</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{response.profile_summary.task_type}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <DimBar label="D1 Semantic Complexity" value={response.profile_summary.dimensions.d1_semantic_complexity} />
                      <DimBar label="D2 Domain Specificity" value={response.profile_summary.dimensions.d2_domain_specificity} />
                      <DimBar label="D3 Output Formality" value={response.profile_summary.dimensions.d3_output_formality} />
                      <DimBar label="D4 Research Dependency" value={response.profile_summary.dimensions.d4_research_dependency} />
                      <DimBar label="D5 Context Requirement" value={response.profile_summary.dimensions.d5_context_requirement} />
                    </div>

                    {response.governance_evaluations && response.governance_evaluations.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                          Governance Policy Verification
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {response.governance_evaluations.map((ev, i) => (
                            <span key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px',
                              fontSize: '11.5px', fontWeight: 600,
                              background: ev.passed ? '#ECFDF5' : '#FEE2E2',
                              border: `1px solid ${ev.passed ? '#A7F3D0' : '#FECACA'}`,
                              color: ev.passed ? '#065F46' : '#991B1B'
                            }} title={ev.message}>
                              {ev.passed ? <CheckCircle size={11} /> : <XCircle size={11} />}
                              {ev.rule_type.replace('_', ' ')}: {ev.passed ? 'Passed' : 'Violation'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════════ RIGHT COLUMN: Top 3 Recommendations & Invocation ════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)' }}>
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
                Only rank #1 is invoked automatically -- retry rank #2/#3 manually if it fails.
              </p>

              {recommendations.length === 0 && !sending && (
                <div style={{ textAlign: 'center', padding: '36px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                  <Cpu size={24} style={{ color: '#94A3B8', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>No recommendations yet</p>
                  <p style={{ fontSize: '12px', color: '#64748B', maxWidth: '320px', margin: '0 auto' }}>
                    Enter a prompt and click "Route & Invoke" to evaluate optimal models.
                  </p>
                </div>
              )}

              {sending && recommendations.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[1, 2, 3].map(n => <div key={n} className="cs-skeleton" style={{ height: '72px', borderRadius: '10px' }} />)}
                </div>
              )}

              {recommendations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recommendations.slice(0, 3).map(rec => {
                    const isRank1 = rec.rank === 1;
                    const isInvoked = !failed && response?.model_used === rec.bedrock_model_id;
                    const canRetryThis = failed && !isRank1 && response?.model_used !== rec.bedrock_model_id;

                    return (
                      <div key={rec.rank} style={{
                        padding: '14px 16px', borderRadius: '12px',
                        background: isRank1 ? '#F0F7FF' : '#FFFFFF',
                        border: `1.5px solid ${isRank1 ? '#3B82F6' : '#E2E8F0'}`,
                        display: 'flex', flexDirection: 'column', gap: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              width: '24px', height: '24px', borderRadius: '50%',
                              background: isRank1 ? '#1D4ED8' : rec.rank === 2 ? '#64748B' : '#94A3B8',
                              color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800
                            }}>#{rec.rank}</span>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                                {rec.display_name || rec.model_id}
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
                            {isInvoked && (
                              <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', fontSize: '10.5px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <CheckCircle2 size={11} /> Invoked
                              </span>
                            )}
                            <span style={{ padding: '2px 8px', borderRadius: '999px', background: isRank1 ? '#DBEAFE' : '#F1F5F9', color: isRank1 ? '#1E40AF' : '#475569', fontSize: '10.5px', fontWeight: isRank1 ? 800 : 700 }}>
                              {RANK_LABEL[rec.rank] ?? `Rank ${rec.rank}`}
                            </span>
                          </div>
                        </div>

                        {rec.reasons && rec.reasons.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {rec.reasons.map((r, ri) => (
                              <span key={ri} style={{ fontSize: '11px', color: '#334155', background: isRank1 ? '#E0EDFF' : '#F1F5F9', padding: '2px 8px', borderRadius: '4px' }}>{r}</span>
                            ))}
                          </div>
                        )}

                        {canRetryThis && (
                          <button
                            type="button"
                            onClick={() => handleRetry(rec)}
                            disabled={retryingRank !== null}
                            className="cs-btn cs-btn-outline cs-btn-sm"
                            style={{ alignSelf: 'flex-start', gap: '6px', marginTop: '2px' }}
                          >
                            {retryingRank === rec.rank ? (
                              <><span className="cs-spinner" style={{ width: '12px', height: '12px' }} /> Retrying...</>
                            ) : (
                              <><RefreshCw size={12} /> Retry with #{rec.rank}</>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)', display: 'flex', flexDirection: 'column', minHeight: '380px' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FDFEFE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Send size={15} style={{ color: '#0066FF' }} />
                  <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A' }}>Model Invocation Response</span>
                </div>
                {response && !failed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', background: '#DCFCE7', border: '1px solid #86EFAC', fontSize: '11.5px', fontWeight: 800, color: '#166534' }}>
                      <CheckCircle2 size={12} /> Invoked: {response.model_used_name}
                    </span>
                    <button type="button" onClick={() => handleCopyText(response.text)} style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Copy size={11} /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {!response && !sending && (
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

                {sending && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0066FF', fontWeight: 700 }}>
                      <span className="cs-spinner cs-spinner-blue" /> Evaluating governance → Profiling → Invoking rank #1...
                    </div>
                    {[100, 85, 95, 75, 90, 60].map((w, i) => <div key={i} className="cs-skeleton" style={{ height: '14px', width: `${w}%` }} />)}
                  </div>
                )}

                {response && (
                  <>
                    {failed ? (
                      <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12.5px', color: '#991B1B' }}>
                        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <div>
                          <strong>Rank #1 invocation failed</strong> ({response.model_used_name}): {response.invocation_error}
                          <div style={{ marginTop: '4px', fontWeight: 600 }}>Use the retry buttons on rank #2/#3 above to try a fallback model manually.</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', fontSize: '12px', color: '#065F46', fontWeight: 600 }}>
                        <CheckCircle2 size={14} style={{ flexShrink: 0 }} /> Invoked successfully on AWS Bedrock.
                      </div>
                    )}

                    {response.user_guess && (
                      <div style={{ padding: '10px 14px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '12px', color: '#1E293B', lineHeight: 1.5 }}>
                        <strong>Your Guess: </strong>{response.user_guess.insight}
                      </div>
                    )}

                    {!failed && (
                      <div className="markdown-body" style={{
                        fontSize: '13.5px', color: '#0F172A', lineHeight: 1.7, background: '#FDFEFE',
                        padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0', flex: 1, overflowX: 'auto'
                      }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{response.text}</ReactMarkdown>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '10px', fontSize: '12px', color: '#64748B' }}>
                      {response.latency_ms != null && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={13} style={{ color: '#0284C7' }} /> Latency: <strong>{response.latency_ms} ms</strong></span>
                      )}
                      {response.tokens_used != null && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={13} style={{ color: '#F59E0B' }} /> Tokens: <strong>{response.tokens_used.toLocaleString()}</strong></span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ════════ GUARDRAILS CONFIGURATION MODAL ════════ */}
      {guardrailsOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '18px', maxWidth: '780px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Organization AI Guardrails & Allowed Models</h3>
                <p style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>Models checked below form the permitted routing pool for prompts in this organization.</p>
              </div>
              <button type="button" onClick={() => setGuardrailsOpen(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={14} style={{ color: '#0066FF' }} /> Permitted Models ({allowedBedrockIds.length} Selected)
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => setAllowedBedrockIds(allModels.map(m => m.providerModelId))} style={{ background: 'none', border: 'none', color: '#0066FF', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                    <button type="button" onClick={() => { if (allModels[0]) setAllowedBedrockIds([allModels[0].providerModelId]); }} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '12px', cursor: 'pointer' }}>Reset</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {allModels.map(m => {
                    const isSel = allowedBedrockIds.includes(m.providerModelId);
                    return (
                      <div key={m.providerModelId}
                        onClick={() => {
                          if (isSel) {
                            if (allowedBedrockIds.length > 1) setAllowedBedrockIds(allowedBedrockIds.filter(x => x !== m.providerModelId));
                          } else {
                            setAllowedBedrockIds([...allowedBedrockIds, m.providerModelId]);
                          }
                        }}
                        style={{ padding: '10px 12px', borderRadius: '8px', border: `1.5px solid ${isSel ? '#0066FF' : '#CBD5E1'}`, background: isSel ? '#EFF6FF' : '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{m.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{m.provider} · {m.contextWindow || '128K'}</div>
                        </div>
                        <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1.5px solid ${isSel ? '#0066FF' : '#CBD5E1'}`, background: isSel ? '#0066FF' : '#FFFFFF', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isSel && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Sliders size={14} style={{ color: '#0066FF' }} /> Context Window Token Limits
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Max Input Tokens</span>
                    <input type="number" value={maxInputTokens} onChange={e => setMaxInputTokens(Number(e.target.value))} className="cs-input" style={{ height: '38px', fontSize: '13px' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Max Output Tokens</span>
                    <input type="number" value={maxOutputTokens} onChange={e => setMaxOutputTokens(Number(e.target.value))} className="cs-input" style={{ height: '38px', fontSize: '13px' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Max Total Tokens</span>
                    <input type="number" value={maxTotalTokens} onChange={e => setMaxTotalTokens(Number(e.target.value))} className="cs-input" style={{ height: '38px', fontSize: '13px' }} />
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Clock size={14} style={{ color: '#0066FF' }} /> Throttling & Daily Quotas
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Rate Limit (Requests / Min)</span>
                    <input type="number" value={rateLimitRpm} onChange={e => setRateLimitRpm(Number(e.target.value))} className="cs-input" style={{ height: '38px', fontSize: '13px' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Daily Token Budget</span>
                    <input type="number" value={dailyTokenQuota} onChange={e => setDailyTokenQuota(Number(e.target.value))} className="cs-input" style={{ height: '38px', fontSize: '13px' }} />
                    <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block' }}>{(dailyTokenQuota / 1000000).toFixed(1)}M tokens per 24 hours.</span>
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

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => setGuardrailsOpen(false)} className="cs-btn cs-btn-outline" style={{ height: '40px', padding: '0 16px', fontSize: '13px' }}>Cancel</button>
              <button type="button" onClick={handleSaveGuardrails} disabled={savingRules} className="cs-btn cs-btn-primary" style={{ height: '40px', padding: '0 20px', fontSize: '13px', gap: '6px', fontWeight: 700 }}>
                {savingRules ? (<><span className="cs-spinner" style={{ width: '13px', height: '13px' }} /> Saving...</>) : (<><Save size={14} /> Save Guardrails</>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
