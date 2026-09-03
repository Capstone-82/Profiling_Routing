import { useState, useEffect, useRef } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck, Sliders, Lock, Save, AlertCircle,
  CheckCircle2, ChevronDown, Check, Send, Sparkles, BarChart2,
  Cpu, Clock, DollarSign, Activity, CheckCircle, XCircle,
  AlertTriangle, Info, Settings2, ChevronRight
} from 'lucide-react';
import type { Model, ModelResponse } from '../../types';
import { getAvailableModels, sendPrompt } from '../../services/mock/mockService';

interface GovernanceRule {
  rule_type: string;
  mode: 'dry_run' | 'enforce';
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

function ModeToggle({ value, onChange }: { value: 'dry_run' | 'enforce'; onChange: (v: 'dry_run' | 'enforce') => void }) {
  return (
    <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: '999px', gap: '2px' }}>
      {(['dry_run', 'enforce'] as const).map(m => (
        <button key={m} type="button" onClick={() => onChange(m)} style={{
          padding: '3px 10px', borderRadius: '999px', border: 'none', cursor: 'pointer',
          fontSize: '11px', fontWeight: 700, transition: 'all 0.15s',
          background: value === m ? (m === 'enforce' ? '#0066FF' : '#E2E8F0') : 'transparent',
          color: value === m ? (m === 'enforce' ? '#fff' : '#0F172A') : '#64748B',
        }}>
          {m === 'dry_run' ? 'Dry-Run' : 'Enforce'}
        </button>
      ))}
    </div>
  );
}

function ModelDropdown({ models, selected, onChange, placeholder }: {
  models: Model[]; selected: string[]; onChange: (ids: string[]) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (id: string) => {
    if (selected.includes(id)) { if (selected.length > 1) onChange(selected.filter(s => s !== id)); }
    else onChange([...selected, id]);
  };

  const sel = models.filter(m => selected.includes(m.id));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        width: '100%', minHeight: '42px', padding: '6px 12px',
        background: '#fff', border: `1.5px solid ${open ? '#0066FF' : '#D5E3F5'}`,
        borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '8px', transition: 'all 0.15s',
        boxShadow: open ? '0 0 0 3px rgba(0,102,255,0.1)' : undefined,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1 }}>
          {sel.length === 0
            ? <span style={{ fontSize: '12.5px', color: '#8EA3BD' }}>{placeholder || 'Select models…'}</span>
            : sel.map(m => (
              <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: '#EBF3FF', border: '1px solid #BFD7FF', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#0066FF' }}>
                {m.name}
                <button type="button" onClick={e => { e.stopPropagation(); toggle(m.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066FF', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
        </div>
        <ChevronDown size={14} style={{ color: '#5C728D', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1.5px solid #D5E3F5', borderRadius: '10px', boxShadow: '0 8px 24px rgba(11,31,58,0.12)', maxHeight: '280px', overflowY: 'auto' }}>
          <div style={{ padding: '8px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#5C728D', textTransform: 'uppercase' }}>
            <span>{models.length} model{models.length !== 1 ? 's' : ''} available</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => onChange(models.map(m => m.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066FF', fontWeight: 700, fontSize: '11px' }}>All</button>
              <button type="button" onClick={() => { if (models[0]) onChange([models[0].id]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8EA3BD', fontSize: '11px' }}>Reset</button>
            </div>
          </div>
          <div style={{ padding: '4px' }}>
            {models.map(m => {
              const isSel = selected.includes(m.id);
              return (
                <div key={m.id} onClick={() => toggle(m.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px', background: isSel ? '#EBF3FF' : 'transparent', cursor: 'pointer', marginBottom: '2px' }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC'; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1.5px solid ${isSel ? '#0066FF' : '#CBD5E1'}`, background: isSel ? '#0066FF' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isSel && <Check size={10} strokeWidth={3} color="#fff" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0B1F3A' }}>{m.name}</span>
                    <span style={{ fontSize: '10px', color: '#5C728D', marginLeft: '6px' }}>{m.provider}</span>
                  </div>
                  <code style={{ fontSize: '10px', color: '#0066FF', fontFamily: 'monospace' }}>{m.providerModelId?.split('.').slice(-1)[0]}</code>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DimBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct <= 25 ? '#10B981' : pct <= 50 ? '#3B82F6' : pct <= 75 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#475569' }}>
        <span>{label}</span><span style={{ fontWeight: 700, color }}>{value.toFixed(2)}</span>
      </div>
      <div style={{ width: '100%', height: '4px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px' }} />
      </div>
    </div>
  );
}

function RulesPanel({
  user, allowedModels, setAllowedModels, allowListMode, setAllowListMode, allModels,
  contextMode, setContextMode, maxInputTokens, setMaxInputTokens, maxTotalTokens, setMaxTotalTokens,
  throttleMode, setThrottleMode, rateLimitRpm, setRateLimitRpm, dailyTokenQuota, setDailyTokenQuota,
}: {
  user: { id: string } | null;
  allowedModels: string[]; setAllowedModels: (v: string[]) => void;
  allowListMode: 'dry_run' | 'enforce'; setAllowListMode: (v: 'dry_run' | 'enforce') => void;
  allModels: Model[];
  contextMode: 'dry_run' | 'enforce'; setContextMode: (v: 'dry_run' | 'enforce') => void;
  maxInputTokens: number; setMaxInputTokens: (v: number) => void;
  maxTotalTokens: number; setMaxTotalTokens: (v: number) => void;
  throttleMode: 'dry_run' | 'enforce'; setThrottleMode: (v: 'dry_run' | 'enforce') => void;
  rateLimitRpm: number; setRateLimitRpm: (v: number) => void;
  dailyTokenQuota: number; setDailyTokenQuota: (v: number) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [err, setErr] = useState('');
  const [openSection, setOpenSection] = useState<string | null>('allow_list');

  const handleSave = async () => {
    setSaving(true); setSavedOk(false); setErr('');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (user?.id) headers['X-User-ID'] = user.id;
    try {
      await Promise.all([
        fetch('http://localhost:8000/api/governance/rules', { method: 'POST', headers, body: JSON.stringify({ rule_type: 'allow_list', mode: allowListMode, config: { allowed_models: allowedModels } }) }),
        fetch('http://localhost:8000/api/governance/rules', { method: 'POST', headers, body: JSON.stringify({ rule_type: 'context_window', mode: contextMode, config: { max_input_tokens: maxInputTokens, max_total_tokens: maxTotalTokens } }) }),
        fetch('http://localhost:8000/api/governance/rules', { method: 'POST', headers, body: JSON.stringify({ rule_type: 'throttle', mode: throttleMode, config: { rate_limit_rpm: rateLimitRpm, quota_per_day_tokens: dailyTokenQuota } }) }),
      ]);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const sections = [
    { id: 'allow_list', icon: <Lock size={14} />, label: 'Model Allow-List', badge: `${allowedModels.length} permitted`, mode: allowListMode },
    { id: 'context_window', icon: <Sliders size={14} />, label: 'Context Window', badge: `${(maxInputTokens / 1000).toFixed(0)}K max`, mode: contextMode },
    { id: 'throttle', icon: <ShieldCheck size={14} />, label: 'Rate & Throttle', badge: `${rateLimitRpm} RPM`, mode: throttleMode },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings2 size={16} style={{ color: '#0066FF' }} />
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#0B1F3A' }}>Governance Rules</span>
        </div>
        <button onClick={handleSave} disabled={saving} className="cs-btn cs-btn-primary" style={{ height: '34px', fontSize: '12px', padding: '0 14px', gap: '6px' }}>
          {saving ? <span className="cs-spinner" style={{ width: '13px', height: '13px' }} /> : <Save size={13} />}
          Save
        </button>
      </div>

      {savedOk && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '6px', fontSize: '12px', color: '#15803D', fontWeight: 600 }}>
          <CheckCircle2 size={14} /> Policies saved.
        </div>
      )}
      {err && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '6px', fontSize: '12px', color: '#991B1B' }}>
          <AlertCircle size={14} /> {err}
        </div>
      )}

      {sections.map(sec => (
        <div key={sec.id} className="cs-card" style={{ padding: 0, overflow: 'hidden' }}>
          <button type="button" onClick={() => setOpenSection(p => p === sec.id ? null : sec.id)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', gap: '6px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ color: '#0066FF' }}>{sec.icon}</span>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0B1F3A' }}>{sec.label}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px', background: '#EBF3FF', color: '#0066FF' }}>{sec.badge}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px', background: sec.mode === 'enforce' ? '#0066FF' : '#E2E8F0', color: sec.mode === 'enforce' ? '#fff' : '#475569' }}>
                {sec.mode === 'enforce' ? 'Enforce' : 'Dry-Run'}
              </span>
            </div>
            <ChevronRight size={13} style={{ color: '#8EA3BD', transform: openSection === sec.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
          </button>

          {openSection === sec.id && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid #EEF4FA' }}>
              {sec.id === 'allow_list' && (
                <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#5C728D' }}>Models this org can route to</span>
                    <ModeToggle value={allowListMode} onChange={setAllowListMode} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                    {allModels.map(m => {
                      const isSel = allowedModels.includes(m.id);
                      return (
                        <div key={m.id} onClick={() => {
                          if (isSel) { if (allowedModels.length > 1) setAllowedModels(allowedModels.filter(x => x !== m.id)); }
                          else setAllowedModels([...allowedModels, m.id]);
                        }} style={{ padding: '7px 9px', borderRadius: '6px', border: `1.5px solid ${isSel ? '#0066FF' : '#E2E8F0'}`, background: isSel ? '#F0F7FF' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0B1F3A' }}>{m.name}</div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>{m.provider}</div>
                          </div>
                          <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '999px', background: isSel ? '#0066FF' : '#CBD5E1', color: '#fff' }}>
                            {isSel ? '✓' : '✗'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sec.id === 'context_window' && (
                <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ModeToggle value={contextMode} onChange={setContextMode} />
                  </div>
                  {[
                    { label: 'Max Input Tokens', value: maxInputTokens, onChange: setMaxInputTokens, hint: 'Default: 200,000' },
                    { label: 'Max Total Tokens', value: maxTotalTokens, onChange: setMaxTotalTokens, hint: 'Default: 250,000' },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>{f.label}</label>
                      <input type="number" value={f.value} onChange={e => f.onChange(Number(e.target.value))} className="cs-input" style={{ height: '36px', fontSize: '13px' }} />
                      <span style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px', display: 'block' }}>{f.hint}</span>
                    </div>
                  ))}
                </div>
              )}

              {sec.id === 'throttle' && (
                <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ModeToggle value={throttleMode} onChange={setThrottleMode} />
                  </div>
                  {[
                    { label: 'Rate Limit (RPM)', value: rateLimitRpm, onChange: setRateLimitRpm, hint: 'Default: 60 RPM' },
                    { label: 'Daily Token Quota', value: dailyTokenQuota, onChange: setDailyTokenQuota, hint: 'Default: 5,000,000/day' },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>{f.label}</label>
                      <input type="number" value={f.value} onChange={e => f.onChange(Number(e.target.value))} className="cs-input" style={{ height: '36px', fontSize: '13px' }} />
                      <span style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px', display: 'block' }}>{f.hint}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function GovernancePage() {
  const { user } = useAuth();

  const [allModels, setAllModels] = useState<Model[]>([]);
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [allowListMode, setAllowListMode] = useState<'dry_run' | 'enforce'>('enforce');
  const [contextMode, setContextMode] = useState<'dry_run' | 'enforce'>('enforce');
  const [maxInputTokens, setMaxInputTokens] = useState(200000);
  const [maxTotalTokens, setMaxTotalTokens] = useState(250000);
  const [throttleMode, setThrottleMode] = useState<'dry_run' | 'enforce'>('dry_run');
  const [rateLimitRpm, setRateLimitRpm] = useState(60);
  const [dailyTokenQuota, setDailyTokenQuota] = useState(5000000);

  const [prompt, setPrompt] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  const [profiling, setProfiling] = useState(false);
  const [profileResult, setProfileResult] = useState<ProfileResult | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileErr, setProfileErr] = useState('');

  const [routing, setRouting] = useState(false);
  const [response, setResponse] = useState<ModelResponse | null>(null);
  const [responseErr, setResponseErr] = useState('');

  useEffect(() => {
    // Load models first, then fetch rules and reconcile IDs
    getAvailableModels().then(ms => {
      setAllModels(ms);
      const allIds = ms.map(m => m.id);
      setAllowedModels(allIds);
      setSelectedModelIds(allIds);

      if (user?.id) {
        fetch('http://localhost:8000/api/governance/rules', { headers: { 'X-User-ID': user.id } })
          .then(r => r.ok ? r.json() : [])
          .then((rules: GovernanceRule[]) => {
            rules.forEach(r => {
              if (r.rule_type === 'allow_list') {
                setAllowListMode(r.mode);
                if (r.config.allowed_models) {
                  const savedIds = r.config.allowed_models as string[];
                  // Reconcile: keep only IDs that exist in loaded models (match by id or providerModelId)
                  const matched = ms
                    .filter(m => savedIds.some(sid => sid === m.id || sid === m.providerModelId || m.providerModelId?.includes(sid) || m.id?.includes(sid)))
                    .map(m => m.id);
                  setAllowedModels(matched.length > 0 ? matched : allIds);
                  setSelectedModelIds(matched.length > 0 ? matched : allIds);
                }
              } else if (r.rule_type === 'context_window') {
                setContextMode(r.mode);
                if (r.config.max_input_tokens) setMaxInputTokens(r.config.max_input_tokens as number);
                if (r.config.max_total_tokens) setMaxTotalTokens(r.config.max_total_tokens as number);
              } else if (r.rule_type === 'throttle') {
                setThrottleMode(r.mode);
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
  const effectiveModels = permittedModels.filter(m => selectedModelIds.includes(m.id));

  const handleProfile = async () => {
    if (!prompt.trim()) return;
    setProfiling(true); setProfileResult(null); setProfileErr(''); setResponse(null); setResponseErr('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.id) headers['X-User-ID'] = user.id;
      const res = await fetch('http://localhost:8000/api/prompt/profile', {
        method: 'POST', headers,
        body: JSON.stringify({ prompt, selectedModelIds: effectiveModels.map(m => m.id) }),
      });
      if (!res.ok) throw new Error(`Profile failed (${res.status})`);
      setProfileResult(await res.json());
      setProfileOpen(true);
    } catch (e) {
      setProfileErr(e instanceof Error ? e.message : 'Profiling failed');
    } finally { setProfiling(false); }
  };

  const handleRoute = async () => {
    if (!prompt.trim()) return;
    setRouting(true); setResponse(null); setResponseErr('');
    try {
      const result = await sendPrompt({ prompt, selectedModelIds: effectiveModels.map(m => m.id), mode: 'auto' }, user?.id);
      setResponse(result);
    } catch (e) {
      setResponseErr(e instanceof Error ? e.message : 'Routing failed');
    } finally { setRouting(false); }
  };

  const canProfile = prompt.trim().length > 0 && effectiveModels.length > 0 && !profiling && !routing;
  const canRoute = prompt.trim().length > 0 && effectiveModels.length > 0 && !routing && !profiling;

  return (
    <div style={{ background: 'var(--cs-gray-bg)' }}>
      <AppHeader activePath="/governance" />
      <main style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '32px 24px 48px' }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 className="cs-heading" style={{ fontSize: '26px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 0 }}>
            <ShieldCheck size={24} style={{ color: '#0066FF' }} /> Governance Policy Playground
          </h1>
          <p style={{ fontSize: '13px', color: '#5C728D', marginTop: '6px' }}>
            Set governance rules, test prompts against them, and route through permitted models only.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: '20px', alignItems: 'start' }}>

          {/* LEFT: Rules */}
          <RulesPanel
            user={user}
            allowedModels={allowedModels} setAllowedModels={setAllowedModels}
            allowListMode={allowListMode} setAllowListMode={setAllowListMode}
            allModels={allModels}
            contextMode={contextMode} setContextMode={setContextMode}
            maxInputTokens={maxInputTokens} setMaxInputTokens={setMaxInputTokens}
            maxTotalTokens={maxTotalTokens} setMaxTotalTokens={setMaxTotalTokens}
            throttleMode={throttleMode} setThrottleMode={setThrottleMode}
            rateLimitRpm={rateLimitRpm} setRateLimitRpm={setRateLimitRpm}
            dailyTokenQuota={dailyTokenQuota} setDailyTokenQuota={setDailyTokenQuota}
          />

          {/* CENTER: Prompt + Profile */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div className="cs-card" style={{ padding: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#0B1F3A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={14} style={{ color: '#0066FF' }} /> Prompt
              </h2>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                  Route against ({permittedModels.length} permitted)
                </label>
                {permittedModels.length === 0 ? (
                  <div className="cs-skeleton" style={{ height: '42px', borderRadius: '8px' }} />
                ) : (
                  <ModelDropdown
                    models={permittedModels}
                    selected={selectedModelIds}
                    onChange={setSelectedModelIds}
                    placeholder="Select from permitted models…"
                  />
                )}
                {effectiveModels.length === 0 && selectedModelIds.length > 0 && (
                  <p style={{ fontSize: '10.5px', color: '#DC2626', marginTop: '4px' }}>
                    No permitted models selected — update the allow-list or selection.
                  </p>
                )}
              </div>

              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Enter your prompt to test against governance rules and route through allowed models…"
                className="cs-input"
                style={{ width: '100%', minHeight: '148px', resize: 'vertical', fontFamily: 'inherit', fontSize: '13.5px', lineHeight: 1.6, padding: '12px', boxSizing: 'border-box' }}
              />

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button onClick={handleProfile} disabled={!canProfile} className="cs-btn cs-btn-outline"
                  style={{ flex: 1, height: '40px', fontSize: '13px', gap: '6px', justifyContent: 'center' }}>
                  {profiling
                    ? <><span className="cs-spinner" style={{ width: '13px', height: '13px' }} /> Profiling…</>
                    : <><BarChart2 size={14} /> Profile Prompt</>}
                </button>
                <button onClick={handleRoute} disabled={!canRoute} className="cs-btn cs-btn-primary"
                  style={{ flex: 1, height: '40px', fontSize: '13px', gap: '6px', justifyContent: 'center' }}>
                  {routing
                    ? <><span className="cs-spinner" style={{ width: '13px', height: '13px' }} /> Routing…</>
                    : <><Send size={14} /> Route & Invoke</>}
                </button>
              </div>
            </div>

            {/* Profile result accordion */}
            {(profileResult || profiling || profileErr) && (
              <div className="cs-card" style={{ padding: 0, overflow: 'hidden' }}>
                <button type="button" onClick={() => setProfileOpen(v => !v)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 16px', background: profileResult ? '#F0F7FF' : '#fff',
                  border: 'none', cursor: 'pointer', borderBottom: profileOpen ? '1px solid #DBEAFE' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart2 size={14} style={{ color: '#1D4ED8' }} />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1E3A5F' }}>Profile & Routing Recommendations</span>
                    {profileResult && (
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 8px', borderRadius: '999px', background: '#DBEAFE', color: '#1D4ED8' }}>
                        Tier {profileResult.resolved_tier} · {profileResult.profile.complexity_score.toFixed(3)}
                      </span>
                    )}
                  </div>
                  <ChevronDown size={13} style={{ color: '#5C728D', transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {profileOpen && (
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {profiling && [90, 70, 80, 55].map((w, i) => <div key={i} className="cs-skeleton" style={{ height: '11px', width: `${w}%` }} />)}
                    {profileErr && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#DC2626' }}><AlertCircle size={13} /> {profileErr}</div>}

                    {profileResult && (
                      <>
                        {profileResult.governance_evaluations.length > 0 && (
                          <div>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <ShieldCheck size={11} /> Governance
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                              {profileResult.governance_evaluations.map((ev, i) => (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, background: ev.passed ? '#ECFDF5' : (ev.mode === 'dry_run' ? '#FEF3C7' : '#FEE2E2'), border: `1px solid ${ev.passed ? '#A7F3D0' : (ev.mode === 'dry_run' ? '#FDE68A' : '#FECACA')}`, color: ev.passed ? '#065F46' : (ev.mode === 'dry_run' ? '#92400E' : '#991B1B') }} title={ev.message}>
                                  {ev.passed ? <CheckCircle size={10} /> : (ev.mode === 'dry_run' ? <AlertTriangle size={10} /> : <XCircle size={10} />)}
                                  {ev.rule_type.replace('_', ' ')} · {ev.passed ? 'Pass' : 'Flag'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ background: '#F8FAFC', borderRadius: '7px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '6px', fontSize: '11.5px' }}>
                            {[['Domain', profileResult.profile.domain], ['Intent', profileResult.profile.intent], ['Task', profileResult.profile.task_type]].map(([k, v]) => (
                              <div key={k}><span style={{ color: '#64748B', fontSize: '10.5px' }}>{k}: </span><strong style={{ color: '#0B1F3A' }}>{v}</strong></div>
                            ))}
                          </div>
                          <DimBar label="D1 Semantic Complexity" value={profileResult.profile.dimensions.d1_semantic_complexity} />
                          <DimBar label="D2 Domain Specificity" value={profileResult.profile.dimensions.d2_domain_specificity} />
                          <DimBar label="D3 Output Formality" value={profileResult.profile.dimensions.d3_output_formality} />
                          <DimBar label="D4 Research Dependency" value={profileResult.profile.dimensions.d4_research_dependency} />
                        </div>

                        {profileResult.recommendations.length > 0 && (
                          <div>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Cpu size={11} /> Top Routing Picks
                            </p>
                            {profileResult.recommendations.slice(0, 3).map(rec => (
                              <div key={rec.rank} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', marginBottom: '4px', background: rec.rank === 1 ? '#F0F7FF' : '#F8FAFC', border: `1px solid ${rec.rank === 1 ? '#BFDBFE' : '#E2E8F0'}`, borderRadius: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: rec.rank === 1 ? '#1D4ED8' : '#64748B', width: '18px', flexShrink: 0 }}>#{rec.rank}</span>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0B1F3A' }}>{rec.model_id}</span>
                                  <span style={{ fontSize: '10.5px', color: '#64748B', marginLeft: '5px' }}>{rec.provider} · {rec.tier}</span>
                                </div>
                                <span style={{ fontSize: '10.5px', color: '#5C728D', fontFamily: 'monospace' }}>${rec.estimated_cost_usd.toFixed(6)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Response */}
          <div className="cs-card" style={{ padding: 0, overflow: 'hidden', minHeight: '460px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid #EEF4FA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={14} style={{ color: '#0066FF' }} />
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0B1F3A' }}>Response</span>
              </div>
              {response && (
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#DCFCE7', border: '1px solid #86EFAC', color: '#15803D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={10} /> {response.model_used_name}
                </span>
              )}
            </div>

            <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
              {!response && !routing && !responseErr && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#EBF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <Send size={18} style={{ color: '#0066FF' }} />
                  </div>
                  <p style={{ fontSize: '13.5px', fontWeight: 700, color: '#0B1F3A', marginBottom: '5px' }}>No response yet</p>
                  <p style={{ fontSize: '12px', color: '#5C728D', maxWidth: '260px', lineHeight: 1.5 }}>
                    Profile your prompt first, then route it through governance-filtered models.
                  </p>
                </div>
              )}

              {routing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#0066FF', fontWeight: 600 }}>
                    <span className="cs-spinner cs-spinner-blue" /> Governance → Routing → Invoking Bedrock…
                  </div>
                  {[100, 85, 92, 70, 88, 55].map((w, i) => <div key={i} className="cs-skeleton" style={{ height: '12px', width: `${w}%` }} />)}
                </div>
              )}

              {responseErr && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px' }}>
                  <AlertCircle size={14} style={{ color: '#DC2626', flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#991B1B', marginBottom: '2px' }}>Routing failed</p>
                    <p style={{ fontSize: '12px', color: '#B91C1C', lineHeight: 1.5 }}>{responseErr}</p>
                  </div>
                </div>
              )}

              {response && (
                <>
                  {response.governance_evaluations && response.governance_evaluations.length > 0 && (
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '7px', padding: '9px 12px' }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldCheck size={11} style={{ color: '#0066FF' }} /> Policy Results
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {response.governance_evaluations.map((ev, i) => (
                          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, background: ev.passed ? '#ECFDF5' : (ev.mode === 'dry_run' ? '#FEF3C7' : '#FEE2E2'), border: `1px solid ${ev.passed ? '#A7F3D0' : (ev.mode === 'dry_run' ? '#FDE68A' : '#FECACA')}`, color: ev.passed ? '#065F46' : (ev.mode === 'dry_run' ? '#92400E' : '#991B1B') }}>
                            {ev.passed ? <CheckCircle size={10} /> : <XCircle size={10} />}
                            {ev.rule_type.replace('_', ' ')} · {ev.passed ? 'Pass' : 'Flag'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {response.routing_reason && response.routing_reason.length > 0 && (
                    <div style={{ background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: '7px', padding: '9px 12px', fontSize: '12px' }}>
                      <strong style={{ color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                        <Cpu size={11} /> Why this model:
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: '15px', lineHeight: 1.6, color: '#1E3A5F' }}>
                        {response.routing_reason.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}

                  {response.fallback_used && (
                    <div style={{ display: 'flex', gap: '7px', padding: '9px 12px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '7px', fontSize: '12px', color: '#B45309' }}>
                      <Info size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                      Primary ({response.fallback_from}) failed — fell back to <strong>{response.model_used_name}</strong>.
                    </div>
                  )}

                  <div style={{ fontSize: '13.5px', color: '#0B1F3A', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#fff', padding: '12px', borderRadius: '7px', border: '1px solid #E2E8F0' }}>
                    {response.text}
                  </div>
                </>
              )}
            </div>

            {response && (
              <div style={{ borderTop: '1px solid #EEF4FA', padding: '10px 16px', background: '#FAFCFF', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                {response.latency_ms !== undefined && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#5C728D' }}>
                    <Clock size={11} style={{ color: '#8EA3BD' }} /> {response.latency_ms} ms
                  </span>
                )}
                {response.tokens_used !== undefined && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#5C728D' }}>
                    <Activity size={11} style={{ color: '#8EA3BD' }} /> {response.tokens_used} tokens
                  </span>
                )}
                {response.cost_estimate !== undefined && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#5C728D' }}>
                    <DollarSign size={11} style={{ color: '#8EA3BD' }} /> ~${response.cost_estimate.toFixed(6)}
                  </span>
                )}
                <button type="button" onClick={() => { setResponse(null); setProfileResult(null); setPrompt(''); }}
                  style={{ marginLeft: 'auto', background: 'none', border: '1px solid #E2E8F0', borderRadius: '5px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', color: '#5C728D' }}>
                  Clear
                </button>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
