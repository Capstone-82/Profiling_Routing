import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Search,
} from 'lucide-react';
import type { ReviewQueueItem } from '../../types';
import { fetchReviewQueue, resolveReviewItem } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';

export function ReviewQueueView() {
  const { user } = useAuth();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await fetchReviewQueue(user?.id, filter === 'ALL' ? undefined : filter);
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [filter, user?.id]);

  const handleResolve = async (itemId: string, status: 'APPROVED' | 'REJECTED') => {
    setProcessingId(itemId);
    try {
      const notes = actionNotes[itemId] || (status === 'APPROVED' ? 'Approved by compliance admin' : 'Rejected by compliance admin');
      const updated = await resolveReviewItem(itemId, status, notes, user?.id);
      if (updated) {
        setItems(prev => prev.map(item => (item.id === itemId ? updated : item)));
      }
    } finally {
      setProcessingId(null);
    }
  };

  const filteredItems = items.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.prompt.toLowerCase().includes(term) ||
      item.guardrail.toLowerCase().includes(term) ||
      (item.model_intended && item.model_intended.toLowerCase().includes(term))
    );
  });

  const getGuardrailBadge = (guardrail: string) => {
    switch (guardrail.toLowerCase()) {
      case 'prompt_injection':
        return { label: 'Prompt Injection', bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' };
      case 'hallucination':
        return { label: 'Hallucination', bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' };
      case 'racial_bias':
        return { label: 'Racial Bias', bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' };
      case 'conciseness':
        return { label: 'Conciseness Limit', bg: '#F0FDFA', border: '#99F6E4', text: '#0F766E' };
      case 'toxicity':
        return { label: 'Toxicity & Profanity', bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C' };
      default:
        return { label: guardrail, bg: '#F1F5F9', border: '#CBD5E1', text: '#334155' };
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'HIGH':
        return { bg: '#FEE2E2', text: '#991B1B', border: '#F87171' };
      case 'MEDIUM':
        return { bg: '#FEF3C7', text: '#92400E', border: '#FBBF24' };
      default:
        return { bg: '#E2E8F0', text: '#475569', border: '#94A3B8' };
    }
  };

  const pendingCount = items.filter(i => i.status === 'PENDING').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Subheader Controls ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#FFFFFF',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1.5px solid #E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: filter === tab ? '1.5px solid #0066FF' : '1px solid #CBD5E1',
                background: filter === tab ? '#EFF6FF' : '#F8FAFC',
                color: filter === tab ? '#0066FF' : '#475569',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              {tab === 'PENDING' && <Clock size={13} />}
              {tab === 'APPROVED' && <CheckCircle size={13} />}
              {tab === 'REJECTED' && <XCircle size={13} />}
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
              {tab === 'PENDING' && pendingCount > 0 && (
                <span
                  style={{
                    background: '#EF4444',
                    color: '#FFFFFF',
                    fontSize: '10.5px',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    fontWeight: 800,
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }}
            />
            <input
              type="text"
              placeholder="Search prompts or guardrails..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                paddingLeft: '32px',
                paddingRight: '12px',
                height: '34px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                fontSize: '12.5px',
                outline: 'none',
                width: '230px',
              }}
            />
          </div>

          <button
            type="button"
            onClick={loadQueue}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Queue Item Cards ── */}
      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1.5px solid #E2E8F0',
            color: '#64748B',
          }}
        >
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '13px', fontWeight: 600 }}>Loading Human Review Queue...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1.5px solid #E2E8F0',
            color: '#64748B',
          }}
        >
          <CheckCircle size={32} style={{ color: '#10B981', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
            Queue is Clear
          </h3>
          <p style={{ fontSize: '12.5px', color: '#64748B', maxWidth: '400px', margin: '0 auto' }}>
            No requests currently require human compliance verification for filter "{filter}".
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredItems.map(item => {
            const gBadge = getGuardrailBadge(item.guardrail);
            const sBadge = getSeverityBadge(item.severity);

            return (
              <div
                key={item.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1.5px solid #E2E8F0',
                  padding: '20px',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {/* Card Top Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: gBadge.bg,
                        border: `1px solid ${gBadge.border}`,
                        color: gBadge.text,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <ShieldAlert size={12} />
                      {gBadge.label}
                    </span>

                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: sBadge.bg,
                        border: `1px solid ${sBadge.border}`,
                        color: sBadge.text,
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {item.severity} Severity
                    </span>

                    {item.confidence !== undefined && item.confidence !== null && (
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                        Score: <strong>{(item.confidence * 100).toFixed(0)}%</strong>
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: '6px',
                        background:
                          item.status === 'PENDING'
                            ? '#FEF3C7'
                            : item.status === 'APPROVED'
                            ? '#ECFDF5'
                            : '#FEE2E2',
                        color:
                          item.status === 'PENDING'
                            ? '#92400E'
                            : item.status === 'APPROVED'
                            ? '#065F46'
                            : '#991B1B',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {item.status === 'PENDING' && <Clock size={11} />}
                      {item.status === 'APPROVED' && <CheckCircle size={11} />}
                      {item.status === 'REJECTED' && <XCircle size={11} />}
                      {item.status}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Prompt Box */}
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      marginBottom: '4px',
                    }}
                  >
                    Flagged Request Prompt:
                  </div>
                  <div
                    style={{
                      padding: '12px 14px',
                      background: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '13px',
                      color: '#0F172A',
                      lineHeight: 1.5,
                      fontFamily: 'monospace',
                    }}
                  >
                    {item.prompt}
                  </div>
                </div>

                {/* Model & Reference Context */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px' }}>
                  {item.model_intended && (
                    <div style={{ color: '#475569' }}>
                      <span style={{ fontWeight: 600 }}>Intended Model:</span>{' '}
                      <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>
                        {item.model_intended}
                      </code>
                    </div>
                  )}

                  {item.reference_context && item.reference_context.length > 0 && (
                    <div style={{ color: '#475569' }}>
                      <span style={{ fontWeight: 600 }}>Reference Context:</span>{' '}
                      <span style={{ color: '#0F172A' }}>{item.reference_context[0]}</span>
                    </div>
                  )}
                </div>

                {/* Findings Details */}
                {item.findings && item.findings.length > 0 && (
                  <div
                    style={{
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      borderRadius: '8px',
                      padding: '10px 14px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#92400E',
                        marginBottom: '4px',
                      }}
                    >
                      Guardrail Findings:
                    </div>
                    {item.findings.map((finding, idx) => (
                      <div key={idx} style={{ fontSize: '12px', color: '#78350F' }}>
                        {finding.explanation
                          ? String(finding.explanation)
                          : finding.message
                          ? String(finding.message)
                          : JSON.stringify(finding)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Row for Pending Items */}
                {item.status === 'PENDING' ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid #F1F5F9',
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Add compliance notes (optional)..."
                      value={actionNotes[item.id] || ''}
                      onChange={e =>
                        setActionNotes(prev => ({ ...prev, [item.id]: e.target.value }))
                      }
                      style={{
                        flex: '1',
                        minWidth: '220px',
                        height: '34px',
                        borderRadius: '6px',
                        border: '1.5px solid #CBD5E1',
                        padding: '0 10px',
                        fontSize: '12.5px',
                      }}
                    />

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => handleResolve(item.id, 'APPROVED')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <CheckCircle size={13} />
                        Approve
                      </button>

                      <button
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => handleResolve(item.id, 'REJECTED')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: '#EF4444',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <XCircle size={13} />
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      paddingTop: '10px',
                      borderTop: '1px solid #F1F5F9',
                      fontSize: '11.5px',
                      color: '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <UserCheck size={13} style={{ color: '#0066FF' }} />
                    <span>
                      Reviewed by <strong>{item.reviewed_by}</strong> on{' '}
                      {item.reviewed_at ? new Date(item.reviewed_at).toLocaleDateString() : 'N/A'}.
                      {item.resolution_notes && (
                        <span style={{ fontStyle: 'italic', marginLeft: '6px' }}>
                          "{item.resolution_notes}"
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
