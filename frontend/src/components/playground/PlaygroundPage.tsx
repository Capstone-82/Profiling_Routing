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
  Send, ChevronDown, Zap, Clock, DollarSign,
  Activity, AlertCircle, CornerDownRight, Info,
  Trash2, Lock,
} from 'lucide-react';

// ─── Model Selector ───────────────────────────────────────────────────────────
function ModelSelector({
  models,
  selected,
  onChange,
}: {
  models: Model[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const selectedModels = models.filter(m => selected.includes(m.id));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select models"
        style={{
          width: '100%',
          minHeight: '42px',
          padding: '7px 40px 7px 12px',
          background: '#fff',
          border: `1.5px solid ${open ? 'var(--cs-blue)' : 'var(--cs-border)'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '5px',
          textAlign: 'left',
          transition: 'border-color 0.15s',
          boxShadow: open ? '0 0 0 3px rgba(0,114,206,0.10)' : 'none',
          position: 'relative',
        }}
      >
        {selectedModels.length === 0 ? (
          <span style={{ fontSize: '13px', color: 'var(--cs-subtle)' }}>Choose models to route your prompt…</span>
        ) : (
          selectedModels.map(m => (
            <span key={m.id} className="cs-chip">
              {m.name}
              <button
                type="button"
                className="cs-chip-remove"
                onClick={e => { e.stopPropagation(); toggle(m.id); }}
                aria-label={`Remove ${m.name}`}
              >
                ×
              </button>
            </span>
          ))
        )}
        <ChevronDown
          size={15}
          style={{
            position: 'absolute', right: '12px', top: '50%',
            transform: `translateY(-50%) rotate(${open ? '180deg' : '0deg'})`,
            color: 'var(--cs-subtle)',
            transition: 'transform 0.15s',
            flexShrink: 0,
          }}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="Available models"
          style={{
            position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, right: 0,
            background: '#fff',
            border: '1px solid var(--cs-border)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(19,38,63,0.13)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--cs-border-light)',
            background: 'var(--cs-bg-page)',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cs-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {models.length} models available
            </span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => onChange(models.map(m => m.id))} style={{ fontSize: '12px', color: 'var(--cs-blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Select all
              </button>
              <button type="button" onClick={() => onChange([])} style={{ fontSize: '12px', color: 'var(--cs-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Clear
              </button>
            </div>
          </div>

          {/* Options */}
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {models.map(m => {
              const isSelected = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggle(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    width: '100%', padding: '11px 14px', textAlign: 'left',
                    background: isSelected ? 'var(--cs-blue-light)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--cs-border-light)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--cs-bg-page)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                    border: `2px solid ${isSelected ? 'var(--cs-blue)' : 'var(--cs-border)'}`,
                    background: isSelected ? 'var(--cs-blue)' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}>
                    {isSelected && (
                      <svg viewBox="0 0 10 8" fill="none" style={{ width: '9px' }}>
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cs-navy)' }}>{m.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--cs-muted)', fontWeight: 500 }}>{m.provider}</span>
                    </div>
                    <code style={{ fontSize: '10px', color: 'var(--cs-subtle)', fontFamily: 'monospace' }}>{m.providerModelId}</code>
                  </div>

                  {m.contextWindow && (
                    <span style={{ fontSize: '10px', color: 'var(--cs-subtle)', flexShrink: 0 }}>{m.contextWindow}</span>
                  )}
                </button>
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
}: {
  state: ResponseState;
  response?: ModelResponse;
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="cs-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '440px' }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: '1px solid var(--cs-border-light)',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cs-navy)' }}>Response</span>
        {state === 'success' && response && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'var(--cs-blue-light)', border: '1px solid var(--cs-blue-muted)',
            padding: '4px 10px', borderRadius: '20px',
            fontSize: '11px', fontWeight: 700, color: 'var(--cs-blue)',
          }}>
            <Zap size={11} />
            {response.model_used_name}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '18px', display: 'flex', flexDirection: 'column' }}>
        {/* Empty */}
        {state === 'empty' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: 'var(--cs-bg-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '12px',
            }}>
              <CornerDownRight size={18} style={{ color: 'var(--cs-subtle)' }} />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--cs-muted)', marginBottom: '5px' }}>Your model response will appear here.</p>
            <p style={{ fontSize: '12px', color: 'var(--cs-subtle)' }}>Select models and enter a prompt to get started.</p>
          </div>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--cs-muted)', marginBottom: '8px' }}>
              <span className="cs-spinner cs-spinner-blue" />
              Routing request to best available model…
            </div>
            {[100, 80, 90, 65, 85, 50].map((w, i) => (
              <div key={i} className="cs-skeleton" style={{ height: '13px', width: `${w}%` }} />
            ))}
          </div>
        )}

        {/* Success */}
        {state === 'success' && response && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            <div style={{ fontSize: '14px', color: 'var(--cs-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {response.text}
            </div>
            {response.fallback_used && (
              <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', background: 'var(--cs-warning-bg)', border: '1px solid var(--cs-warning-border)', borderRadius: '8px', fontSize: '12px', color: '#78350F' }}>
                <Info size={13} style={{ flexShrink: 0, marginTop: '1px', color: 'var(--cs-warning)' }} />
                Primary model failed — automatically routed to <strong>{response.model_used_name}</strong> as fallback.
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--cs-error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <AlertCircle size={18} style={{ color: 'var(--cs-error)' }} />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#7F1D1D', marginBottom: '5px' }}>Unable to generate a response.</p>
            <p style={{ fontSize: '12px', color: '#991B1B', marginBottom: '16px', maxWidth: '260px', lineHeight: 1.5 }}>{error}</p>
            {onRetry && (
              <button onClick={onRetry} className="cs-btn cs-btn-outline cs-btn-sm">
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metadata footer */}
      {state === 'success' && response && (
        <div style={{
          borderTop: '1px solid var(--cs-border-light)',
          padding: '10px 18px',
          background: 'var(--cs-bg-page)',
          display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
        }}>
          {response.latency_ms !== undefined && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--cs-muted)' }}>
              <Clock size={11} style={{ color: 'var(--cs-subtle)' }} /> {response.latency_ms} ms
            </span>
          )}
          {response.tokens_used !== undefined && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--cs-muted)' }}>
              <Activity size={11} style={{ color: 'var(--cs-subtle)' }} /> {response.tokens_used} tokens
            </span>
          )}
          {response.estimated_cost !== undefined && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--cs-muted)' }}>
              <DollarSign size={11} style={{ color: 'var(--cs-subtle)' }} /> ~${response.estimated_cost.toFixed(5)}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--cs-border)' }}>Mocked — Task 4 will connect Bedrock</span>
        </div>
      )}
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
    // Check connection state — playground only works with verified connection
    getConnection().then(conn => {
      setConnectionVerified(conn.status === 'verified');
    });

    getAvailableModels().then(ms => {
      const list = ms.length > 0 ? ms : MOCK_AVAILABLE_MODELS;
      setModels(list);
      setSelectedIds(list.slice(0, 2).map(m => m.id));
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
    <div style={{ minHeight: '100vh', background: 'var(--cs-bg-page)' }}>
      <AppHeader activePath="/playground" />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: '32px' }}>
          <h1 className="cs-heading" style={{ fontSize: '28px' }}>AI Playground</h1>
          <p style={{ fontSize: '14px', color: 'var(--cs-muted)', marginTop: '14px', lineHeight: 1.65 }}>
            Route prompts across connected foundation models.
          </p>
        </div>

        {/* No connection warning */}
        {!connectionVerified && !loadingModels && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 18px',
            background: 'var(--cs-warning-bg)', border: '1px solid var(--cs-warning-border)',
            borderRadius: '10px', marginBottom: '24px',
          }}>
            <Lock size={16} style={{ color: 'var(--cs-warning)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#78350F' }}>No provider connected</p>
              <p style={{ fontSize: '12px', color: '#92400E', marginTop: '2px' }}>
                Connect AWS Bedrock on the{' '}
                <button onClick={() => navigate('/connections')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cs-blue)', fontWeight: 600, fontSize: '12px', padding: 0, textDecoration: 'underline' }}>
                  Connections page
                </button>
                {' '}to enable prompt routing. Using mock models for preview.
              </p>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(320px, 38%)', gap: '20px', alignItems: 'start' }}>

          {/* LEFT: Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Model selector card */}
            <div className="cs-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--cs-navy)' }}>Available models</h2>
                  <p style={{ fontSize: '12px', color: 'var(--cs-muted)', marginTop: '2px' }}>
                    Models available from your connected providers.
                  </p>
                </div>
                {selectedIds.length > 0 && (
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: 'var(--cs-blue)',
                    background: 'var(--cs-blue-light)', border: '1px solid var(--cs-blue-muted)',
                    padding: '3px 9px', borderRadius: '20px',
                  }}>
                    {selectedIds.length} selected
                  </span>
                )}
              </div>

              {loadingModels ? (
                <div className="cs-skeleton" style={{ height: '42px', borderRadius: '8px' }} />
              ) : (
                <ModelSelector models={models} selected={selectedIds} onChange={setSelectedIds} />
              )}

              {selectedIds.length === 0 && !loadingModels && (
                <p style={{ fontSize: '12px', color: 'var(--cs-warning)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AlertCircle size={11} /> Select at least one model to send a prompt.
                </p>
              )}
            </div>

            {/* Prompt card */}
            <div className="cs-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--cs-navy)' }}>Prompt</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: prompt.length > 4000 ? 'var(--cs-warning)' : 'var(--cs-subtle)' }}>
                    {prompt.length.toLocaleString()} chars
                  </span>
                  {prompt && (
                    <button
                      type="button"
                      onClick={handleClear}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--cs-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                      aria-label="Clear prompt"
                    >
                      <Trash2 size={11} /> Clear
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Enter your prompt..."
                rows={9}
                aria-label="Prompt input"
                style={{
                  width: '100%',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  color: 'var(--cs-navy)',
                  background: 'var(--cs-bg-page)',
                  border: '1.5px solid var(--cs-border)',
                  borderRadius: '8px',
                  padding: '12px',
                  outline: 'none',
                  lineHeight: 1.65,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  display: 'block',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--cs-blue)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0,114,206,0.10)';
                  e.target.style.background = '#fff';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--cs-border)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'var(--cs-bg-page)';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--cs-subtle)' }}>
                  <kbd style={{ background: 'var(--cs-bg-subtle)', border: '1px solid var(--cs-border)', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', fontFamily: 'monospace' }}>
                    ⌘ Enter
                  </kbd>{' '}to send
                </p>

                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={`cs-btn cs-btn-primary ${responseState === 'loading' ? 'is-loading' : ''}`}
                  style={{ gap: '7px' }}
                  aria-label="Send prompt"
                >
                  {responseState === 'loading'
                    ? <><span className="cs-spinner" style={{ width: '14px', height: '14px' }} /> Routing request…</>
                    : <><Send size={14} /> Send Prompt</>
                  }
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Response */}
          <div>
            <ResponsePanel
              state={responseState}
              response={response}
              error={errorMsg}
              onRetry={handleSend}
            />
          </div>

        </div>
      </main>
    </div>
  );
}
