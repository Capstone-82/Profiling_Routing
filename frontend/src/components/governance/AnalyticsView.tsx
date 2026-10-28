import { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  DollarSign,
  Lock,
  RefreshCw,
  BarChart2,
  AlertOctagon,
  Layers,
} from 'lucide-react';
import type { GovernanceAnalytics } from '../../types';
import { fetchGovernanceAnalytics } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';

export function AnalyticsView() {
  const { user } = useAuth();
  const [data, setData] = useState<GovernanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetchGovernanceAnalytics(user?.id);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [user?.id]);

  if (loading) {
    return (
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
        <p style={{ fontSize: '13px', fontWeight: 600 }}>Loading Governance & Routing Analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
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
        <AlertOctagon size={32} style={{ color: '#EF4444', margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
          Unable to Load Analytics
        </h3>
        <p style={{ fontSize: '12.5px', color: '#64748B' }}>Could not fetch governance metrics from backend.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Top Header with Refresh ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            AI Governance & Routing Intelligence
          </h2>
          <p style={{ fontSize: '12.5px', color: '#64748B', marginTop: '3px', margin: 0 }}>
            Live metrics on prompt safety enforcement, guardrail actions, and multi-model cost savings.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAnalytics}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '8px',
            background: '#0F172A',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} />
          Refresh Metrics
        </button>
      </div>

      {/* ── 4 Executive KPI Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Total Requests */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Governed Requests
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0066FF',
              }}
            >
              <Layers size={16} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', marginTop: '10px' }}>
            {data.total_requests}
          </div>
          <div style={{ fontSize: '11.5px', color: '#10B981', fontWeight: 600, marginTop: '4px' }}>
            {data.passed_requests} passed ({((data.passed_requests / data.total_requests) * 100).toFixed(0)}%)
          </div>
        </div>

        {/* Card 2: Cost Saved */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Routing Cost Saved
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}
            >
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#10B981', marginTop: '10px' }}>
            ${data.cost_saved_usd.toFixed(2)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
            {data.savings_percentage}% saved vs top-tier baseline
          </div>
        </div>

        {/* Card 3: Block Rate */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Safety Violations Blocked
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#FEF2F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
              }}
            >
              <ShieldCheck size={16} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#EF4444', marginTop: '10px' }}>
            {data.blocked_requests}
          </div>
          <div style={{ fontSize: '11.5px', color: '#DC2626', fontWeight: 600, marginTop: '4px' }}>
            {data.block_rate_percentage}% threat rejection rate
          </div>
        </div>

        {/* Card 4: PII Masked & Reviews */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              PII Entities Anonymized
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#F0FDFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0F766E',
              }}
            >
              <Lock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0F766E', marginTop: '10px' }}>
            {data.masked_requests}
          </div>
          <div style={{ fontSize: '11.5px', color: '#0D9488', fontWeight: 600, marginTop: '4px' }}>
            {data.review_requests} held in review queue
          </div>
        </div>
      </div>

      {/* ── Two-Column Breakdown: Guardrails vs Cost Comparison ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '20px',
        }}
      >
        {/* Left: Guardrail Triggers Distribution */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 0 16px 0',
            }}
          >
            <BarChart2 size={16} style={{ color: '#0066FF' }} />
            Safety Guardrail Triggers
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {data.guardrail_breakdown.map(item => (
              <div key={item.guardrail}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}
                >
                  <span style={{ color: '#334155' }}>{item.guardrail}</span>
                  <span style={{ color: '#0F172A', fontWeight: 700 }}>
                    {item.trigger_count} ({item.percentage}%)
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '7px',
                    background: '#F1F5F9',
                    borderRadius: '999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${item.percentage}%`,
                      height: '100%',
                      background:
                        item.guardrail.includes('PII')
                          ? '#0284C7'
                          : item.guardrail.includes('Injection')
                          ? '#7C3AED'
                          : item.guardrail.includes('Toxicity')
                          ? '#DC2626'
                          : item.guardrail.includes('Hallucination')
                          ? '#2563EB'
                          : item.guardrail.includes('Conciseness')
                          ? '#0D9488'
                          : '#EA580C',
                      borderRadius: '999px',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cost & Token Savings */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 800,
                color: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 0 16px 0',
              }}
            >
              <TrendingUp size={16} style={{ color: '#10B981' }} />
              Intelligent Routing Efficiency
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#F8FAFC',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 600 }}>
                  Actual Cloud Spend:
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                  ${data.total_cost_usd.toFixed(2)}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#F8FAFC',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 600 }}>
                  Unrouted Baseline (Claude 3.5 Sonnet):
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#64748B' }}>
                  ${data.baseline_cost_usd.toFixed(2)}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: '#ECFDF5',
                  borderRadius: '8px',
                  border: '1.5px solid #A7F3D0',
                }}
              >
                <span style={{ fontSize: '12.5px', color: '#065F46', fontWeight: 700 }}>
                  Net Cost Reduction:
                </span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#047857' }}>
                  -${data.cost_saved_usd.toFixed(2)} ({data.savings_percentage}%)
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: '16px',
              borderTop: '1px solid #F1F5F9',
              fontSize: '11.5px',
              color: '#64748B',
              lineHeight: 1.5,
            }}
          >
            <strong>Cost Optimization Engine:</strong> Automatically routes low-complexity intent to
            Tier 3/4 foundation models (Amazon Nova Micro, Llama 3 8B) while preserving Tier 1 for
            advanced reasoning.
          </div>
        </div>
      </div>

      {/* ── Recent Governance Audit Logs Table ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #E2E8F0',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
        }}
      >
        <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: '0 0 14px 0' }}>
          Recent Governance & Dispatch Audit Logs
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #E2E8F0', color: '#64748B', fontWeight: 700 }}>
                <th style={{ padding: '8px 12px' }}>Timestamp</th>
                <th style={{ padding: '8px 12px' }}>Prompt Snippet</th>
                <th style={{ padding: '8px 12px' }}>Model Selected</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px' }}>Latency</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_activity.map(evt => (
                <tr key={evt.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F172A' }}>
                    {evt.prompt_snippet}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#475569', fontFamily: 'monospace' }}>
                    {evt.model_used.replace('anthropic.', '').replace('meta.', '').replace('amazon.', '')}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background:
                          evt.status === 'PASSED'
                            ? '#ECFDF5'
                            : evt.status === 'MASKED'
                            ? '#EFF6FF'
                            : evt.status === 'REVIEW'
                            ? '#FEF3C7'
                            : '#FEE2E2',
                        color:
                          evt.status === 'PASSED'
                            ? '#065F46'
                            : evt.status === 'MASKED'
                            ? '#1D4ED8'
                            : evt.status === 'REVIEW'
                            ? '#92400E'
                            : '#991B1B',
                      }}
                    >
                      {evt.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748B' }}>
                    {evt.latency_ms > 0 ? `${evt.latency_ms}ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
