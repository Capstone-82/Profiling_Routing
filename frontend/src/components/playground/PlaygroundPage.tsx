import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../layout/AppHeader';
import { Footer } from '../layout/Footer';
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
            <span style={{ fontSize: '13.5px', color: '#8EA3BD' }}>Select models to route prompt…</span>
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
            <span>{models.length} Models Available</span>
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
                onClick={() => onChange([models[0]?.id || '1'])}
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
                    {/* Checkbox Icon */}
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
                      </div>
                      <div style={{ fontSize: '11px', color: '#5C728D', marginTop: '1px' }}>
                        {m.provider} • AWS Bedrock
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
    <div className="cs-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '520px', position: 'relative' }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid #EEF4FA',
      }}>
        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0B1F3A' }}>Response</span>
        {state === 'success' && response && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#DCFCE7', border: '1px solid #86EFAC',
            padding: '3px 10px', borderRadius: '999px',
            fontSize: '11px', fontWeight: 700, color: '#15803D',
          }}>
            <CheckCircle2 size={12} />
            {response.model_used_name}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
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
              Your model response will appear here.
            </p>
            <p style={{ fontSize: '13px', color: '#5C728D', maxWidth: '320px', lineHeight: 1.5 }}>
              Select models from the dropdown and enter a prompt to get started.
            </p>
          </div>
        )}

        {/* Loading State */}
        {state === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#0066FF', fontWeight: 600, marginBottom: '8px' }}>
              <span className="cs-spinner cs-spinner-blue" />
              Routing request to best available Bedrock model…
            </div>
            {[100, 85, 92, 70, 88, 55].map((w, i) => (
              <div key={i} className="cs-skeleton" style={{ height: '14px', width: `${w}%` }} />
            ))}
          </div>
        )}

        {/* Success State */}
        {state === 'success' && response && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            <div style={{ fontSize: '14px', color: '#0B1F3A', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {response.text}
            </div>
            {response.fallback_used && (
              <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '12px', color: '#B45309' }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: '1px', color: '#D97706' }} />
                Primary model failed — automatically routed to <strong>{response.model_used_name}</strong> as fallback.
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <AlertCircle size={22} />
            </div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#991B1B', marginBottom: '6px' }}>Unable to generate a response.</p>
            <p style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '18px', maxWidth: '280px', lineHeight: 1.5 }}>{error}</p>
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
            {response.estimated_cost !== undefined && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#5C728D' }}>
                <DollarSign size={12} style={{ color: '#8EA3BD' }} /> ~${response.estimated_cost.toFixed(5)}
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
      setSelectedIds([list[0]?.id || 'model-1']);
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
      const result = await sendPrompt({ prompt, selectedModelIds: selectedIds });
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

      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '40px 24px', flex: 1 }}>

        {/* Page heading */}
        <div style={{ marginBottom: '28px' }}>
          <h1 className="cs-heading" style={{ fontSize: '28px' }}>AI Playground</h1>
          <p style={{ fontSize: '14px', color: '#5C728D', marginTop: '12px', lineHeight: 1.6 }}>
            Route prompts across connected foundation models.
          </p>
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
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#78350F' }}>No provider connected</p>
              <p style={{ fontSize: '12px', color: '#92400E', marginTop: '2px' }}>
                Connect AWS Bedrock on the{' '}
                <button onClick={() => navigate('/connections')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066FF', fontWeight: 700, fontSize: '12px', padding: 0, textDecoration: 'underline' }}>
                  Connections page
                </button>
                {' '}to enable prompt routing.
              </p>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>

          {/* LEFT: Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Model Selector Card (Dropdown) */}
            <div className="cs-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#0B1F3A' }}>Select Target Models</h2>
                  <p style={{ fontSize: '12px', color: '#5C728D', marginTop: '2px' }}>
                    Choose models from your connected AWS Bedrock provider.
                  </p>
                </div>
                {selectedIds.length > 0 && (
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: '#0066FF',
                    background: '#EBF3FF', border: '1px solid #BFD7FF',
                    padding: '3px 10px', borderRadius: '999px',
                  }}>
                    {selectedIds.length} selected
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
                placeholder="Enter your prompt..."
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
                    <><span className="cs-spinner" style={{ width: '15px', height: '15px' }} /> Routing request…</>
                  ) : (
                    <><Send size={15} /> Send Prompt</>
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
      <Footer />
    </div>
  );
}
