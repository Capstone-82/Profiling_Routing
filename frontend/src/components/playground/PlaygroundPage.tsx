import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../layout/AppHeader';

import type { Model, ModelResponse } from '../../types';
import {
  getConnection,
  getAvailableModels,
  sendPrompt,
  MOCK_AVAILABLE_MODELS,
} from '../../services/mock/mockService';
import {
  Send, Clock, DollarSign,
  Activity, AlertCircle, CornerUpLeft, Info,
  Trash2, Lock, CheckCircle2, ChevronDown, Check,
  ShieldCheck, Cpu, Sparkles, BarChart2, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';

// ─── Custom Model Selection Dropdown ──────────────────────────────────────────
function ModelDropdownSelector({
  models,
  selected,
  onChange,
}: {
  models: Model[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleModel = (id: string) => {
    if (selected.includes(id)) {
      if (selected.length > 1) {
        onChange(selected.filter(s => s !== id));
      }
    } else {
      onChange([...selected, id]);
    }
  };

  const selectedModels = models.filter(m => selected.includes(m.id));

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Dropdown Trigger Box */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          minHeight: '46px',
          padding: '8px 14px',
          background: '#FFFFFF',
          border: `1.5px solid ${open ? '#0066FF' : '#D5E3F5'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: open ? '0 0 0 3px rgba(0, 102, 255, 0.12)' : '0 1px 3px rgba(11, 31, 58, 0.04)',
          transition: 'all 0.15s ease',
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {selectedModels.length === 0 ? (
            <span style={{ fontSize: '13.5px', color: '#8EA3BD' }}>Select models to permit for routing…</span>
          ) : (
            selectedModels.map(m => (
              <span
                key={m.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  background: '#EBF3FF',
                  border: '1px solid #BFD7FF',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#0066FF',
                }}
              >
                {m.name}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    toggleModel(m.id);
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#0066FF', fontSize: '14px', lineHeight: 1, padding: 0,
                  }}
                  aria-label={`Remove ${m.name}`}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>

        <ChevronDown
          size={16}
          style={{
            color: '#5C728D',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown Options Popover Panel */}
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 50,
            background: '#FFFFFF',
            border: '1.5px solid #D5E3F5',
            borderRadius: '10px',
            boxShadow: '0 10px 28px rgba(11, 31, 58, 0.12)',
            overflow: 'hidden',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {/* Header Action Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
            fontSize: '11px', fontWeight: 700, color: '#5C728D', letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            <span>{models.length} Bedrock Models in Catalog</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => onChange(models.map(m => m.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066FF', fontWeight: 700, fontSize: '11px' }}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange([models[0]?.id || 'model-claude-3-5-sonnet'])}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8EA3BD', fontWeight: 600, fontSize: '11px' }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Model Items */}
          <div style={{ padding: '6px' }}>
            {models.map(m => {
              const isSelected = selected.includes(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => toggleModel(m.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: isSelected ? '#EBF3FF' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                    marginBottom: '2px',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '4px',
                      border: `1.5px solid ${isSelected ? '#0066FF' : '#CBD5E1'}`,
                      background: isSelected ? '#0066FF' : '#FFFFFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#FFFFFF', flexShrink: 0,
                    }}>
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0B1F3A' }}>{m.name}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#5C728D', background: '#EEF4FA', padding: '1px 6px', borderRadius: '4px' }}>
                          {m.provider}
                        </span>
                        {m.category && (
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#0066FF', background: '#EBF3FF', padding: '1px 6px', borderRadius: '4px' }}>
                            {m.category}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#5C728D', marginTop: '1px' }}>
                        Context: {m.contextWindow || '128K tokens'}
                      </div>
                    </div>
                  </div>

                  <code style={{ fontSize: '10.5px', color: '#0066FF', fontFamily: 'monospace', flexShrink: 0 }}>
                    {m.providerModelId}
                  </code>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dimension Bar Gauge Component ────────────────────────────────────────────
function DimensionBar({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100);
  const color = percentage <= 25 ? '#10B981' : percentage <= 50 ? '#3B82F6' : percentage <= 75 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value.toFixed(2)}</span>
      </div>
      <div style={{ width: '100%', height: '5px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${percentage}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

// ─── Response Panel ───────────────────────────────────────────────────────────
type ResponseState = 'empty' | 'loading' | 'success' | 'error';

function ResponsePanel({
  state,
  response,
  error,
  onRetry,
  onClear,
}: {
  state: ResponseState;
  response?: ModelResponse;
  error?: string;
  onRetry?: () => void;
  onClear: () => void;
}) {
  return (
    <div className="cs-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '560px', position: 'relative' }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid #EEF4FA',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} style={{ color: '#0066FF' }} />
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#0B1F3A' }}>Routed Response & Insights</span>
        </div>

        {state === 'success' && response && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#DCFCE7', border: '1px solid #86EFAC',
            padding: '3px 10px', borderRadius: '999px',
            fontSize: '11px', fontWeight: 700, color: '#15803D',
          }}>
            <CheckCircle2 size={12} />
            Answered by: {response.model_used_name} ({response.tier || 'T1'})
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        {/* Empty State */}
        {state === 'empty' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: '#EBF3FF', color: '#0066FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <CornerUpLeft size={22} />
            </div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#0B1F3A', marginBottom: '6px' }}>
              Your intelligent model response will appear here.
            </p>
            <p style={{ fontSize: '13px', color: '#5C728D', maxWidth: '360px', lineHeight: 1.5 }}>
              Enter a prompt. The engine will evaluate governance policies, profile semantic complexity, and route to the cost-optimal model on AWS Bedrock.
            </p>
          </div>
        )}

        {/* Loading State */}
        {state === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#0066FF', fontWeight: 600, marginBottom: '8px' }}>
              <span className="cs-spinner cs-spinner-blue" />
              Evaluating governance → Profiling complexity → Routing to optimal model…
            </div>
            {[100, 85, 92, 70, 88, 55].map((w, i) => (
              <div key={i} className="cs-skeleton" style={{ height: '14px', width: `${w}%` }} />
            ))}
          </div>
        )}

        {/* Success State */}
        {state === 'success' && response && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
            
            {/* 1. Governance Evaluations Bar */}
            {response.governance_evaluations && response.governance_evaluations.length > 0 && (
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  <ShieldCheck size={14} style={{ color: '#0066FF' }} /> Governance Policy Evaluations
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {response.governance_evaluations.map((ev, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: ev.passed ? '#ECFDF5' : (ev.mode === 'dry_run' ? '#FEF3C7' : '#FEE2E2'),
                        border: `1px solid ${ev.passed ? '#A7F3D0' : (ev.mode === 'dry_run' ? '#FDE68A' : '#FECACA')}`,
                        color: ev.passed ? '#065F46' : (ev.mode === 'dry_run' ? '#92400E' : '#991B1B'),
                      }}
                      title={ev.message}
                    >
                      {ev.passed ? <CheckCircle size={12} /> : (ev.mode === 'dry_run' ? <AlertTriangle size={12} /> : <XCircle size={12} />)}
                      <span>{ev.rule_type.replace('_', ' ')} ({ev.mode}): {ev.passed ? 'Passed' : 'Flagged'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Profiling & Routing Explanation Card */}
            {response.profile_summary && (
              <div style={{
                background: '#F0F7FF',
                border: '1px solid #BFDBFE',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase' }}>
                    <BarChart2 size={14} /> Prompt Complexity & Tier
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF', background: '#DBEAFE', padding: '2px 8px', borderRadius: '4px' }}>
                    Tier: {response.profile_summary.resolved_tier} (Score: {response.profile_summary.complexity_score.toFixed(3)})
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#64748B', fontSize: '11px' }}>Domain:</span>{' '}
                    <strong style={{ color: '#0F172A' }}>{response.profile_summary.domain}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: '11px' }}>Intent:</span>{' '}
                    <strong style={{ color: '#0F172A' }}>{response.profile_summary.intent}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: '11px' }}>Task Type:</span>{' '}
                    <strong style={{ color: '#0F172A' }}>{response.profile_summary.task_type}</strong>
                  </div>
                </div>

                {/* Dimensions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px', borderTop: '1px dashed #BFDBFE', paddingTop: '8px' }}>
                  <DimensionBar label="D1 Semantic Complexity" value={response.profile_summary.dimensions.d1_semantic_complexity} />
                  <DimensionBar label="D2 Domain Specificity" value={response.profile_summary.dimensions.d2_domain_specificity} />
                  <DimensionBar label="D3 Output Formality" value={response.profile_summary.dimensions.d3_output_formality} />
                  <DimensionBar label="D4 Research Dependency" value={response.profile_summary.dimensions.d4_research_dependency} />
                </div>
              </div>
            )}

            {/* 3. Routing Reasons */}
            {response.routing_reason && response.routing_reason.length > 0 && (
              <div style={{ fontSize: '12px', color: '#475569', background: '#F8FAFC', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                <strong style={{ color: '#0F172A', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                  <Cpu size={13} style={{ color: '#0066FF' }} /> Why this model was chosen:
                </strong>
                <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.4 }}>
                  {response.routing_reason.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Fallback Notice */}
            {response.fallback_used && (
              <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '12px', color: '#B45309' }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: '1px', color: '#D97706' }} />
                Primary model failed ({response.fallback_from}) — automatically routed to <strong>{response.model_used_name}</strong> as fallback.
              </div>
            )}

            {/* Main Generated Text */}
            <div style={{ fontSize: '14px', color: '#0B1F3A', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#FFFFFF', padding: '12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              {response.text}
            </div>

          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <AlertCircle size={22} />
            </div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#991B1B', marginBottom: '6px' }}>Unable to generate a response.</p>
            <p style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '18px', maxWidth: '340px', lineHeight: 1.5 }}>{error}</p>
            {onRetry && (
              <button onClick={onRetry} className="cs-btn cs-btn-outline cs-btn-sm">
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer bar with Clear Button on bottom right */}
      <div style={{
        borderTop: '1px solid #EEF4FA',
        padding: '12px 20px',
        background: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px',
      }}>
        {state === 'success' && response ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {response.latency_ms !== undefined && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#5C728D' }}>
                <Clock size={12} style={{ color: '#8EA3BD' }} /> {response.latency_ms} ms
              </span>
            )}
            {response.tokens_used !== undefined && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#5C728D' }}>
                <Activity size={12} style={{ color: '#8EA3BD' }} /> {response.tokens_used} tokens
              </span>
            )}
            {response.cost_estimate !== undefined && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#5C728D' }}>
                <DollarSign size={12} style={{ color: '#8EA3BD' }} /> Est: ~${response.cost_estimate.toFixed(6)}
              </span>
            )}
          </div>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={onClear}
          className="cs-btn cs-btn-outline cs-btn-sm"
          style={{ gap: '6px', height: '34px', fontSize: '12px', marginLeft: 'auto' }}
        >
          <Trash2 size={13} /> Clear
        </button>
      </div>
    </div>
  );
}

// ─── Playground Page ──────────────────────────────────────────────────────────
export function PlaygroundPage() {
  const navigate = useNavigate();
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [routingMode, setRoutingMode] = useState<'auto' | 'legacy'>('auto');
  const [responseState, setResponseState] = useState<ResponseState>('empty');
  const [response, setResponse] = useState<ModelResponse | undefined>();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getConnection().then(conn => {
      setConnectionVerified(conn.status === 'verified');
    });

    getAvailableModels().then(ms => {
      const list = ms.length > 0 ? ms : MOCK_AVAILABLE_MODELS;
      setModels(list);
      setSelectedIds(list.map(m => m.id)); // Default: allow all available Bedrock models
      setLoadingModels(false);
    });
  }, []);

  const canSend = prompt.trim().length > 0 && selectedIds.length > 0 && responseState !== 'loading';

  const handleSend = async () => {
    if (!canSend) return;
    setResponseState('loading');
    setResponse(undefined);
    setErrorMsg('');
    try {
      const result = await sendPrompt({
        prompt,
        selectedModelIds: selectedIds,
        mode: routingMode
      });
      setResponse(result);
      setResponseState('success');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setResponseState('error');
    }
  };

  const handleClear = () => {
    setPrompt('');
    setResponseState('empty');
    setResponse(undefined);
    setErrorMsg('');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cs-gray-bg)', display: 'flex', flexDirection: 'column' }}>
      <AppHeader activePath="/playground" />

      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '36px 24px', flex: 1 }}>

        {/* Page heading with Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="cs-heading" style={{ fontSize: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              AI Governance & Routing Playground
            </h1>
            <p style={{ fontSize: '14px', color: '#5C728D', marginTop: '6px', lineHeight: 1.5 }}>
              Prompt Profiler + Multi-Gate Model Routing + Bedrock Dispatch using your AWS Account.
            </p>
          </div>

          {/* Mode Pill Switcher */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#E2E8F0',
            padding: '3px',
            borderRadius: '999px',
            border: '1px solid #CBD5E1'
          }}>
            <button
              type="button"
              onClick={() => setRoutingMode('auto')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: 700,
                background: routingMode === 'auto' ? '#0066FF' : 'transparent',
                color: routingMode === 'auto' ? '#FFFFFF' : '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={14} /> Auto-Routed (Enforced)
            </button>
            <button
              type="button"
              onClick={() => setRoutingMode('legacy')}
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: 700,
                background: routingMode === 'legacy' ? '#FFFFFF' : 'transparent',
                color: routingMode === 'legacy' ? '#0F172A' : '#475569',
                boxShadow: routingMode === 'legacy' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Manual / Legacy Mode
            </button>
          </div>
        </div>

        {/* No connection warning */}
        {!connectionVerified && !loadingModels && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 18px',
            background: '#FEF3C7', border: '1px solid #FDE68A',
            borderRadius: '8px', marginBottom: '24px',
          }}>
            <Lock size={16} style={{ color: '#D97706', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#78350F' }}>Demo Simulation Mode (AWS Bedrock Disconnected)</p>
              <p style={{ fontSize: '12px', color: '#92400E', marginTop: '2px' }}>
                Connect your AWS IAM Role on the{' '}
                <button onClick={() => navigate('/connections')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066FF', fontWeight: 700, fontSize: '12px', padding: 0, textDecoration: 'underline' }}>
                  Connections page
                </button>
                {' '}to dispatch requests directly to your own Bedrock billing.
              </p>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>

          {/* LEFT: Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Model Selector Card */}
            <div className="cs-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#0B1F3A' }}>
                    {routingMode === 'auto' ? 'Permitted Model Allow-List' : 'Target Models'}
                  </h2>
                  <p style={{ fontSize: '12px', color: '#5C728D', marginTop: '2px' }}>
                    {routingMode === 'auto'
                      ? 'The routing engine will score and pick the optimal model from this permitted list.'
                      : 'Manually select which model should answer your prompt.'}
                  </p>
                </div>
                {selectedIds.length > 0 && (
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: '#0066FF',
                    background: '#EBF3FF', border: '1px solid #BFD7FF',
                    padding: '3px 10px', borderRadius: '999px',
                  }}>
                    {selectedIds.length} permitted
                  </span>
                )}
              </div>

              {loadingModels ? (
                <div className="cs-skeleton" style={{ height: '46px', borderRadius: '8px' }} />
              ) : (
                <ModelDropdownSelector models={models} selected={selectedIds} onChange={setSelectedIds} />
              )}
            </div>

            {/* Prompt input card */}
            <div className="cs-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#0B1F3A' }}>Prompt</h2>
                <span style={{ fontSize: '12px', color: '#8EA3BD', fontFamily: 'monospace' }}>
                  {prompt.length} chars
                </span>
              </div>

              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Enter prompt (e.g. 'Design a multi-cloud enterprise architecture with compliance risk assessment...')"
                rows={7}
                aria-label="Prompt input"
                style={{
                  width: '100%',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  color: '#0B1F3A',
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '14px',
                  outline: 'none',
                  lineHeight: 1.6,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  display: 'block',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#0066FF';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0,102,255,0.10)';
                  e.target.style.background = '#FFFFFF';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = '#F8FAFC';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                <p style={{ fontSize: '12px', color: '#8EA3BD' }}>
                  <kbd style={{ background: '#EEF4FA', border: '1px solid #D5E3F5', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace' }}>
                    ⌘ Enter
                  </kbd>{' '}to send
                </p>

                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={`cs-btn cs-btn-primary ${responseState === 'loading' ? 'is-loading' : ''}`}
                  style={{ height: '42px', fontSize: '14px', gap: '8px' }}
                  aria-label="Send prompt"
                >
                  {responseState === 'loading' ? (
                    <><span className="cs-spinner" style={{ width: '15px', height: '15px' }} /> Profiling & Routing…</>
                  ) : (
                    <><Send size={15} /> Route Prompt</>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT: Response Panel */}
          <div>
            <ResponsePanel
              state={responseState}
              response={response}
              error={errorMsg}
              onRetry={handleSend}
              onClear={handleClear}
            />
          </div>

        </div>
      </main>
    </div>
  );
}
