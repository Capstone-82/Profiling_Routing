import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppHeader } from '../layout/AppHeader';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck, Lock, Save, AlertCircle,
  CheckCircle2, Check, Send, Sparkles,
  Cpu, Clock, Activity, AlertTriangle, Settings2,
  Copy, RefreshCw, ArrowRight, CheckCircle,
  Layers, ExternalLink
} from 'lucide-react';
import type {
  Model,
  ModelResponse,
  ProfileOnlyResponse,
  Connection,
  GovernanceRule
} from '../../types';
import {
  fetchConnectionFromBackend,
  fetchAllowedCatalog,
  fetchGovernanceRules,
  saveGovernanceRule,
  profilePrompt,
  routePrompt
} from '../../services/apiService';

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
  const color = pct <= 30 ? '#10B981' : pct <= 60 ? '#0284C7' : pct <= 80 ? '#F59E0B' : '#EF4444';
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
  const navigate = useNavigate();

  // AWS Connection state
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loadingConn, setLoadingConn] = useState(true);

  // Governance Models & Policies state
  const [allBedrockModels, setAllBedrockModels] = useState<Model[]>([]);
  const [allowedBedrockIds, setAllowedBedrockIds] = useState<string[]>([]);
  const [maxInputTokens, setMaxInputTokens] = useState(200000);
  const [maxTotalTokens, setMaxTotalTokens] = useState(250000);
  const [rateLimitRpm, setRateLimitRpm] = useState(60);
  const [dailyTokenQuota, setDailyTokenQuota] = useState(5000000);
  const [allowListMode, setAllowListMode] = useState<'enforce' | 'dry_run'>('enforce');
  const [contextMode, setContextMode] = useState<'enforce' | 'dry_run'>('enforce');
  const [throttleMode, setThrottleMode] = useState<'enforce' | 'dry_run'>('dry_run');

  // Guardrails drawer & saving feedback
  const [guardrailsOpen, setGuardrailsOpen] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSaveOk, setRulesSaveOk] = useState(false);
  const [rulesSaveErr, setRulesSaveErr] = useState('');

  // Interactive Prompt & Route state
  const [prompt, setPrompt] = useState('');
  const [guessedBedrockId, setGuessedBedrockId] = useState<string>('');
  
  // Profiling state
  const [profiling, setProfiling] = useState(false);
  const [profileResult, setProfileResult] = useState<ProfileOnlyResponse | null>(null);
  const [profileErr, setProfileErr] = useState('');

  // Execution & Response state
  const [routing, setRouting] = useState(false);
  const [retryingModelId, setRetryingModelId] = useState<string | null>(null);
  const [response, setResponse] = useState<ModelResponse | null>(null);
  const [responseErr, setResponseErr] = useState('');
  const [copied, setCopied] = useState(false);

  // 1. Initial Load: Connection, Models & Governance Rules
  useEffect(() => {
    let isMounted = true;
    setLoadingConn(true);

    const loadData = async () => {
      try {
        const [conn, catalog, rules] = await Promise.all([
          fetchConnectionFromBackend(user?.id),
          fetchAllowedCatalog(),
          fetchGovernanceRules(user?.id)
        ]);

        if (!isMounted) return;

        setConnection(conn);

        // Populate available Bedrock models
        const models = (conn?.availableModels && conn.availableModels.length > 0)
          ? conn.availableModels
          : catalog;
        setAllBedrockModels(models);

        const allIds = models.map(m => m.providerModelId || m.id);

        // Parse saved rules
        let loadedAllowList = allIds;
        if (rules && rules.length > 0) {
          rules.forEach(r => {
            if (r.rule_type === 'allow_list') {
              setAllowListMode(r.mode || 'enforce');
              const savedList = r.config?.allowed_bedrock_model_ids || r.config?.allowed_models;
              if (Array.isArray(savedList) && savedList.length > 0) {
                // Filter to match available Bedrock provider model IDs
                const validMatches = savedList.filter(id => allIds.includes(id));
                if (validMatches.length > 0) {
                  loadedAllowList = validMatches;
                }
              }
            } else if (r.rule_type === 'context_window') {
              setContextMode(r.mode || 'enforce');
              if (r.config?.max_input_tokens) setMaxInputTokens(Number(r.config.max_input_tokens));
              if (r.config?.max_total_tokens) setMaxTotalTokens(Number(r.config.max_total_tokens));
            } else if (r.rule_type === 'throttle') {
              setThrottleMode(r.mode || 'dry_run');
              if (r.config?.rate_limit_rpm) setRateLimitRpm(Number(r.config.rate_limit_rpm));
              if (r.config?.quota_per_day_tokens) setDailyTokenQuota(Number(r.config.quota_per_day_tokens));
            }
          });
        }
        setAllowedBedrockIds(loadedAllowList);
      } catch (err) {
        console.error('Failed loading initial governance data:', err);
      } finally {
        if (isMounted) setLoadingConn(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [user?.id]);

  // Model selection toggle
  const toggleModelAllowed = (bedrockId: string) => {
    setAllowedBedrockIds(prev =>
      prev.includes(bedrockId) ? prev.filter(id => id !== bedrockId) : [...prev, bedrockId]
    );
  };

  const selectAllModels = () => {
    setAllowedBedrockIds(allBedrockModels.map(m => m.providerModelId || m.id));
  };

  const deselectAllModels = () => {
    setAllowedBedrockIds([]);
  };

  // Save Governance Rules
  const handleSaveGovernance = async () => {
    setSavingRules(true);
    setRulesSaveOk(false);
    setRulesSaveErr('');

    try {
      const allowListRule: GovernanceRule = {
        rule_type: 'allow_list',
        mode: allowListMode,
        config: { allowed_bedrock_model_ids: allowedBedrockIds },
      };

      const contextRule: GovernanceRule = {
        rule_type: 'context_window',
        mode: contextMode,
        config: {
          max_input_tokens: maxInputTokens,
          min_input_tokens: 1,
          max_total_tokens: maxTotalTokens,
          max_output_tokens: 65536,
        },
      };

      const throttleRule: GovernanceRule = {
        rule_type: 'throttle',
        mode: throttleMode,
        config: {
          rate_limit_rpm: rateLimitRpm,
          burst_limit: 15,
          quota_per_day_tokens: dailyTokenQuota,
          quota_per_day_requests: 2000,
        },
      };

      await Promise.all([
        saveGovernanceRule(allowListRule, user?.id),
        saveGovernanceRule(contextRule, user?.id),
        saveGovernanceRule(throttleRule, user?.id),
      ]);

      setRulesSaveOk(true);
      setTimeout(() => setRulesSaveOk(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save rules';
      setRulesSaveErr(msg);
    } finally {
      setSavingRules(false);
    }
  };

  // 2. Profile Prompt (ML analysis & governance preview without Bedrock invocation)
  const handleProfilePrompt = async () => {
    if (!prompt.trim()) return;
    setProfiling(true);
    setProfileErr('');
    setProfileResult(null);

    try {
      const res = await profilePrompt(
        {
          prompt: prompt.trim(),
          guessed_bedrock_model_id: guessedBedrockId || undefined,
          max_tokens: 1500,
        },
        user?.id
      );
      setProfileResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Profiling failed';
      setProfileErr(msg);
    } finally {
      setProfiling(false);
    }
  };

  // 3. Route & Invoke (Rank #1 live dispatch or manual retry)
  const handleRouteAndInvoke = async (retryBedrockId?: string) => {
    if (!prompt.trim()) return;
    setRouting(true);
    setResponseErr('');
    if (retryBedrockId) setRetryingModelId(retryBedrockId);

    try {
      const res = await routePrompt(
        {
          prompt: prompt.trim(),
          guessed_bedrock_model_id: guessedBedrockId || undefined,
          retry_bedrock_model_id: retryBedrockId || undefined,
          max_tokens: 1500,
        },
        user?.id
      );
      setResponse(res);
      // Also update profiling results if not already present
      if (res.profile_summary && res.recommendations) {
        setProfileResult({
          profile: res.profile_summary,
          resolved_tier: res.tier || res.profile_summary.resolved_tier,
          recommendations: res.recommendations,
          rejections: {},
          governance_evaluations: res.governance_evaluations || [],
          warnings: res.warnings || [],
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Model routing invocation failed';
      setResponseErr(msg);
    } finally {
      setRouting(false);
      setRetryingModelId(null);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isConnected = connection?.status === 'verified';
  const permittedModels = allBedrockModels.filter(m => allowedBedrockIds.includes(m.providerModelId || m.id));

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <AppHeader activePath="/governance" />

      {/* Top Breadcrumb & Status Bar */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '14px 28px' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Governance & Intelligent Routing
              </span>
              <span style={{ fontSize: '11px', background: '#F0F9FF', color: '#0284C7', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, border: '1px solid #BAE6FD' }}>
                Single-Mode Bedrock Production
              </span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
              Enterprise AI Governance Control Plane
            </h1>
          </div>

          {/* Connection Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {loadingConn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B' }}>
                <span className="cs-spinner" style={{ width: '14px', height: '14px', borderColor: '#CBD5E1', borderTopColor: '#0284C7' }} />
                Verifying AWS Connection...
              </div>
            ) : isConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '6px 12px', borderRadius: '8px', fontSize: '12.5px', color: '#166534', fontWeight: 600 }}>
                  <CheckCircle size={15} color="#16A34A" />
                  <span>Connected to AWS Bedrock</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                  {connection?.roleArn ? `${connection.roleArn.slice(0, 24)}...` : 'Role Verified'}
                </div>
                <button
                  onClick={() => navigate('/connections')}
                  style={{ fontSize: '12px', color: '#0284C7', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Manage <ExternalLink size={12} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FEF2F2', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: '8px', fontSize: '12.5px', color: '#991B1B', fontWeight: 600 }}>
                  <AlertCircle size={15} color="#DC2626" />
                  <span>AWS Disconnected</span>
                </div>
                <button
                  onClick={() => navigate('/connections')}
                  style={{ fontSize: '12.5px', background: '#0284C7', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  Connect AWS IAM Role <ArrowRight size={13} />
                </button>
              </div>
            )}

            <button
              onClick={() => setGuardrailsOpen(!guardrailsOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: guardrailsOpen ? '#0284C7' : '#FFFFFF',
                color: guardrailsOpen ? '#FFFFFF' : '#334155',
                border: guardrailsOpen ? '1px solid #0284C7' : '1px solid #CBD5E1',
                cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              <Settings2 size={15} />
              <span>Policy Guardrails</span>
              <span style={{ background: guardrailsOpen ? 'rgba(255,255,255,0.25)' : '#F1F5F9', color: guardrailsOpen ? '#FFF' : '#0284C7', fontSize: '11px', padding: '1px 6px', borderRadius: '999px', marginLeft: '2px' }}>
                {permittedModels.length}/{allBedrockModels.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', padding: '24px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Guardrails Configuration Drawer (Collapsible) */}
        {guardrailsOpen && (
          <div style={{ background: '#FFFFFF', border: '1px solid #BAE6FD', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 20px rgba(2, 132, 199, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} color="#0284C7" />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Governance Rules & Allowed Bedrock Models</h3>
                  <p style={{ fontSize: '12.5px', color: '#64748B' }}>
                    Configure model allow-lists, context token ceilings, rate limits, and enforcement modes.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {rulesSaveOk && (
                  <span style={{ fontSize: '12.5px', color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Policies Saved Successfully!
                  </span>
                )}
                {rulesSaveErr && (
                  <span style={{ fontSize: '12.5px', color: '#DC2626', fontWeight: 600 }}>
                    {rulesSaveErr}
                  </span>
                )}
                <button
                  onClick={handleSaveGovernance}
                  disabled={savingRules}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 18px', background: '#0284C7', color: '#FFFFFF',
                    border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                    cursor: savingRules ? 'not-allowed' : 'pointer', opacity: savingRules ? 0.7 : 1
                  }}
                >
                  <Save size={14} />
                  {savingRules ? 'Saving...' : 'Save Governance Policies'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              {/* Allowed Bedrock Models Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13.5px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={15} color="#0284C7" /> Allowed Bedrock Models ({allowedBedrockIds.length})
                  </label>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                    <button onClick={selectAllModels} style={{ color: '#0284C7', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>All</button>
                    <span style={{ color: '#CBD5E1' }}>|</span>
                    <button onClick={deselectAllModels} style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>None</button>
                  </div>
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', background: '#F8FAFC' }}>
                  {allBedrockModels.map(m => {
                    const bId = m.providerModelId || m.id;
                    const isAllowed = allowedBedrockIds.includes(bId);
                    return (
                      <label
                        key={bId}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '7px 10px', borderRadius: '6px',
                          background: isAllowed ? '#FFFFFF' : 'transparent',
                          border: isAllowed ? '1px solid #BAE6FD' : '1px solid transparent',
                          cursor: 'pointer', transition: 'all 0.1s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={isAllowed}
                            onChange={() => toggleModelAllowed(bId)}
                            style={{ accentColor: '#0284C7', width: '15px', height: '15px', cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: isAllowed ? '#0F172A' : '#64748B' }}>
                              {m.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>
                              {bId}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', background: '#F1F5F9', padding: '2px 7px', borderRadius: '4px' }}>
                          {m.provider}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Context Window & Token Ceilings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ fontSize: '13.5px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={15} color="#0284C7" /> Token & Context Window Limits
                </label>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#475569', marginBottom: '4px' }}>
                    <span>Max Input Tokens:</span>
                    <strong style={{ color: '#0F172A' }}>{maxInputTokens.toLocaleString()} tokens</strong>
                  </div>
                  <input
                    type="range" min={10000} max={1000000} step={10000}
                    value={maxInputTokens} onChange={e => setMaxInputTokens(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#0284C7' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#475569', marginBottom: '4px' }}>
                    <span>Max Total Request Tokens:</span>
                    <strong style={{ color: '#0F172A' }}>{maxTotalTokens.toLocaleString()} tokens</strong>
                  </div>
                  <input
                    type="range" min={20000} max={1000000} step={10000}
                    value={maxTotalTokens} onChange={e => setMaxTotalTokens(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#0284C7' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={{ fontSize: '12.5px', color: '#475569' }}>Context Policy Mode:</span>
                  <select
                    value={contextMode} onChange={e => setContextMode(e.target.value as 'enforce' | 'dry_run')}
                    style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFF' }}
                  >
                    <option value="enforce">Strict Enforce (Block 403)</option>
                    <option value="dry_run">Dry Run (Audit Only)</option>
                  </select>
                </div>
              </div>

              {/* Rate Limits & Daily Quotas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ fontSize: '13.5px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={15} color="#0284C7" /> Throttling & Daily Quotas
                </label>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#475569', marginBottom: '4px' }}>
                    <span>Rate Limit (RPM):</span>
                    <strong style={{ color: '#0F172A' }}>{rateLimitRpm} req/min</strong>
                  </div>
                  <input
                    type="range" min={10} max={300} step={5}
                    value={rateLimitRpm} onChange={e => setRateLimitRpm(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#0284C7' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#475569', marginBottom: '4px' }}>
                    <span>Daily Token Quota:</span>
                    <strong style={{ color: '#0F172A' }}>{(dailyTokenQuota / 1000000).toFixed(1)}M tokens/day</strong>
                  </div>
                  <input
                    type="range" min={500000} max={20000000} step={500000}
                    value={dailyTokenQuota} onChange={e => setDailyTokenQuota(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#0284C7' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={{ fontSize: '12.5px', color: '#475569' }}>Throttle Policy Mode:</span>
                  <select
                    value={throttleMode} onChange={e => setThrottleMode(e.target.value as 'enforce' | 'dry_run')}
                    style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFF' }}
                  >
                    <option value="enforce">Strict Enforce (Block 403)</option>
                    <option value="dry_run">Dry Run (Audit Only)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Workspace Grid: Prompt Input & Top Recommendations */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)', gap: '20px' }}>

          {/* Left Column: Prompt Studio & Sample Templates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
              
              {/* Sample Prompts Pills */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Sample Production Prompts
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                {SAMPLE_PROMPTS.map((sp, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(sp.prompt)}
                    style={{
                      fontSize: '12px', fontWeight: 600, padding: '5px 10px', borderRadius: '6px',
                      background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0',
                      cursor: 'pointer', transition: 'all 0.1s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#E0F2FE'; e.currentTarget.style.color = '#0369A1'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#334155'; }}
                  >
                    {sp.title}
                  </button>
                ))}
              </div>

              {/* Prompt Textarea */}
              <div style={{ position: 'relative' }}>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Enter your enterprise prompt here (e.g. cloud architecture, regulatory analysis, code generation, financial review)..."
                  rows={6}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '8px',
                    border: '1px solid #CBD5E1', fontSize: '13.5px', lineHeight: 1.6,
                    color: '#0F172A', outline: 'none', resize: 'vertical',
                    fontFamily: 'inherit', background: '#FFFFFF'
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#0284C7'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#CBD5E1'; }}
                />
              </div>

              {/* Guessed Best Model Selector & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 500 }}>Optional Guess:</span>
                  <select
                    value={guessedBedrockId}
                    onChange={e => setGuessedBedrockId(e.target.value)}
                    style={{ fontSize: '12.5px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFF', color: '#0F172A', maxWidth: '240px' }}
                  >
                    <option value="">-- Guess which model is optimal --</option>
                    {permittedModels.map(m => (
                      <option key={m.providerModelId || m.id} value={m.providerModelId || m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={handleProfilePrompt}
                    disabled={profiling || !prompt.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                      background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1',
                      cursor: (profiling || !prompt.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (profiling || !prompt.trim()) ? 0.6 : 1
                    }}
                  >
                    <Sparkles size={14} color="#0284C7" />
                    {profiling ? 'Profiling...' : 'Analyze & Profile'}
                  </button>

                  <button
                    onClick={() => handleRouteAndInvoke()}
                    disabled={routing || !prompt.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                      background: '#0284C7', color: '#FFFFFF', border: 'none',
                      cursor: (routing || !prompt.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (routing || !prompt.trim()) ? 0.6 : 1,
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                    }}
                  >
                    <Send size={14} />
                    {routing ? 'Routing & Invoking Bedrock...' : 'Route & Invoke with Bedrock'}
                  </button>
                </div>
              </div>

              {/* Error messages */}
              {profileErr && (
                <div style={{ marginTop: '12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#991B1B' }}>
                  <AlertCircle size={16} />
                  <span>{profileErr}</span>
                </div>
              )}
              {responseErr && (
                <div style={{ marginTop: '12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#991B1B' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <AlertTriangle size={16} />
                    <span>Bedrock Invocation Error</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px' }}>{responseErr}</p>
                  {profileResult?.recommendations && profileResult.recommendations.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Manual Retry Available:</span>
                      {profileResult.recommendations.slice(1, 3).map(rec => (
                        <button
                          key={rec.bedrock_model_id}
                          onClick={() => handleRouteAndInvoke(rec.bedrock_model_id)}
                          disabled={routing}
                          style={{
                            fontSize: '11.5px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px',
                            background: '#0284C7', color: '#FFF', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <RefreshCw size={11} /> Retry with #{rec.rank} ({rec.display_name})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Prompt Profile & Governance Evaluation Card */}
            {profileResult && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu size={18} color="#0284C7" />
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Prompt Complexity & Profiling Breakdown</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
                      background: profileResult.resolved_tier === 'T3' ? '#FEF2F2' : profileResult.resolved_tier === 'T2' ? '#EFF6FF' : '#F0FDF4',
                      color: profileResult.resolved_tier === 'T3' ? '#DC2626' : profileResult.resolved_tier === 'T2' ? '#0284C7' : '#16A34A',
                      border: `1px solid ${profileResult.resolved_tier === 'T3' ? '#FECACA' : profileResult.resolved_tier === 'T2' ? '#BAE6FD' : '#BBF7D0'}`
                    }}>
                      Resolved: Tier {profileResult.resolved_tier}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                      Score: {profileResult.profile.complexity_score.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 5 Dimensions Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <DimBar label="d1 Complexity" value={profileResult.profile.dimensions.d1_semantic_complexity} />
                  <DimBar label="d2 Domain" value={profileResult.profile.dimensions.d2_domain_specificity} />
                  <DimBar label="d3 Formality" value={profileResult.profile.dimensions.d3_output_formality} />
                  <DimBar label="d4 Research" value={profileResult.profile.dimensions.d4_research_dependency} />
                  <DimBar label="d5 Context" value={profileResult.profile.dimensions.d5_context_requirement} />
                </div>

                {/* Semantic Tags & Governance Checks */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ background: '#F1F5F9', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Domain: {profileResult.profile.domain}
                  </span>
                  <span style={{ background: '#F1F5F9', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Intent: {profileResult.profile.intent}
                  </span>
                  <span style={{ background: '#F1F5F9', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Tokens: ~{profileResult.profile.input_token_count}
                  </span>

                  {profileResult.governance_evaluations.map((ge, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: ge.passed ? '#F0FDF4' : '#FEF2F2',
                        color: ge.passed ? '#166534' : '#991B1B',
                        border: `1px solid ${ge.passed ? '#BBF7D0' : '#FECACA'}`,
                        padding: '3px 8px', borderRadius: '4px', fontWeight: 600
                      }}
                    >
                      {ge.passed ? <CheckCircle2 size={12} color="#16A34A" /> : <AlertCircle size={12} color="#DC2626" />}
                      {ge.rule_type}: {ge.passed ? 'Passed' : 'Blocked'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Top 3 Model Recommendations & User Guess Insight */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="#0284C7" />
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Top Recommended Bedrock Models</h3>
                </div>
                <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>
                  Ranked by ML Cost-Performance Score
                </span>
              </div>

              {profileResult?.recommendations && profileResult.recommendations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {profileResult.recommendations.map(rec => {
                    const isRank1 = rec.rank === 1;
                    const isUsed = response?.model_used === rec.bedrock_model_id;
                    return (
                      <div
                        key={rec.bedrock_model_id}
                        style={{
                          border: isUsed ? '2px solid #0284C7' : isRank1 ? '1.5px solid #BAE6FD' : '1px solid #E2E8F0',
                          borderRadius: '8px', padding: '12px 14px',
                          background: isUsed ? '#F0F9FF' : isRank1 ? '#FAFCFF' : '#FFFFFF',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              background: isRank1 ? '#0284C7' : '#E2E8F0',
                              color: isRank1 ? '#FFFFFF' : '#475569',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11.5px', fontWeight: 700
                            }}>
                              #{rec.rank}
                            </span>
                            <div>
                              <strong style={{ fontSize: '13.5px', color: '#0F172A' }}>{rec.display_name}</strong>
                              <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '6px' }}>({rec.provider} - {rec.tier})</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0284C7' }}>
                              Score: {rec.routing_score ? rec.routing_score.toFixed(1) : '--'}
                            </span>
                            {!isRank1 && (
                              <button
                                onClick={() => handleRouteAndInvoke(rec.bedrock_model_id)}
                                disabled={routing}
                                style={{
                                  fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px',
                                  background: retryingModelId === rec.bedrock_model_id ? '#CBD5E1' : '#FFFFFF',
                                  color: '#0284C7', border: '1px solid #BAE6FD', cursor: 'pointer'
                                }}
                              >
                                {retryingModelId === rec.bedrock_model_id ? 'Invoking...' : 'Invoke Manually'}
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: '11.5px', color: '#64748B', fontFamily: 'monospace', marginBottom: '6px' }}>
                          {rec.bedrock_model_id}
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {rec.reasons.slice(0, 2).map((r, rIdx) => (
                            <span key={rIdx} style={{ fontSize: '11px', color: '#475569', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>
                              • {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                  Enter a prompt and click "Analyze & Profile" or "Route & Invoke" to see optimal model recommendations.
                </div>
              )}

              {/* User Guess Benchmark Box */}
              {response?.user_guess && (
                <div style={{ marginTop: '14px', background: response.user_guess.is_match ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${response.user_guess.is_match ? '#BBF7D0' : '#FDE68A'}`, borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: response.user_guess.is_match ? '#166534' : '#92400E' }}>
                    <Sparkles size={14} />
                    <span>Your Model Guess Comparison</span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: response.user_guess.is_match ? '#166534' : '#92400E', lineHeight: 1.5 }}>
                    {response.user_guess.comparison_insight}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Bedrock Markdown Response View */}
        {response && (
          <div style={{ background: '#FFFFFF', border: '1px solid #BAE6FD', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 20px rgba(2, 132, 199, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={20} color="#16A34A" />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Bedrock Output: {response.model_used_name}
                  </h3>
                  <div style={{ fontSize: '11.5px', color: '#64748B', fontFamily: 'monospace' }}>
                    Model ID: {response.model_used}
                  </div>
                </div>
              </div>

              {/* Execution Metrics Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {response.latency_ms && (
                  <span style={{ fontSize: '12px', color: '#475569', background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} color="#64748B" /> {response.latency_ms.toFixed(0)} ms
                  </span>
                )}
                {response.tokens_used && (
                  <span style={{ fontSize: '12px', color: '#475569', background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px' }}>
                    {response.tokens_used} tokens
                  </span>
                )}
                {response.cost_estimate !== undefined && (
                  <span style={{ fontSize: '12px', color: '#166534', background: '#F0FDF4', padding: '4px 8px', borderRadius: '6px', fontWeight: 600, border: '1px solid #BBF7D0' }}>
                    ${response.cost_estimate.toFixed(5)}
                  </span>
                )}
                <button
                  onClick={() => handleCopyText(response.text)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    background: '#FFFFFF', color: '#334155', border: '1px solid #CBD5E1', cursor: 'pointer'
                  }}
                >
                  {copied ? <Check size={13} color="#16A34A" /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy Output'}
                </button>
              </div>
            </div>

            {/* Rendered Markdown Body */}
            <div className="cs-markdown" style={{ background: '#FAFCFF', padding: '18px 22px', borderRadius: '8px', border: '1px solid #EEF2F6' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {response.text}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
