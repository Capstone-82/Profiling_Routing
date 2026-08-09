import { CoreStackLogo } from '../common/Logo';
import { Layers, ShieldCheck, GitFork, Activity, CheckCircle2, Lock, Cloud } from 'lucide-react';

export function BrandPanel() {
  const featureRows = [
    {
      icon: Layers,
      title: 'Foundation Model Governance',
      description: 'Govern and allow-list foundation models via AWS Bedrock integration.',
    },
    {
      icon: ShieldCheck,
      title: 'Zero-trust IAM Security',
      description: 'Enforce ExternalId-based IAM role assumption for every user workload.',
    },
    {
      icon: GitFork,
      title: 'Intelligent Model Routing',
      description: 'Route requests dynamically across allow-listed models with automated fallback.',
    },
    {
      icon: Activity,
      title: 'Real-time Cost & Latency Metrics',
      description: 'Track model usage, token consumption, latency, and estimated spend.',
    },
  ];

  const trustMetrics = [
    { value: '99.99%', label: 'Routing availability', icon: Activity, color: '#16A34A' },
    { value: 'Zero-Trust', label: 'Identity controls', icon: Lock, color: '#0066FF' },
    { value: 'AWS Bedrock', label: 'Cloud provider V1', icon: Cloud, color: '#0284C7' },
  ];

  return (
    <div
      className="cs-auth-left"
      style={{
        background: 'linear-gradient(160deg, #F5F9FD 0%, #EBF3FF 45%, #E2EDFC 100%)',
        padding: '48px 52px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        borderRight: '1.5px solid #D5E3F5',
      }}
    >
      {/* Subtle background grid pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(#0066FF 0.75px, transparent 0.75px)',
          backgroundSize: '24px 24px',
          opacity: 0.04,
          pointerEvents: 'none',
        }}
      />

      <div style={{ zIndex: 1 }} className="cs-animate-entrance">
        {/* Brand */}
        <div style={{ marginBottom: '36px' }}>
          <CoreStackLogo size="lg" />
        </div>

        {/* Headline */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ width: '36px', height: '3.5px', background: '#0066FF', borderRadius: '2px', marginBottom: '14px' }} />
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0B1F3A', lineHeight: 1.2, letterSpacing: '-0.4px', marginBottom: '10px' }}>
            Govern AI.<br />Ship with confidence.
          </h1>
          <p style={{ fontSize: '14px', color: '#5C728D', lineHeight: 1.6, maxWidth: '420px' }}>
            Secure, route, observe, and optimize AI workloads across foundation models from a single control plane.
          </p>
        </div>

        {/* Feature Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
          {featureRows.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className={`cs-feature-row cs-animate-entrance cs-stagger-${(i % 3) + 1}`}>
                <div
                  className="cs-feature-icon"
                  style={{
                    width: '32px', height: '32px', borderRadius: '6px',
                    background: '#FFFFFF', border: '1px solid #D5E3F5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#5C728D', flexShrink: 0, transition: 'all 200ms ease',
                  }}
                >
                  <Icon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0B1F3A', lineHeight: 1.3 }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#5C728D', marginTop: '2px', lineHeight: 1.4 }}>
                    {f.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Bottom Trust Metrics & Provider Pills */}
      <div style={{ zIndex: 1, paddingTop: '20px', borderTop: '1px solid rgba(0, 102, 255, 0.15)' }}>
        {/* Trust Metrics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {trustMetrics.map(m => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="cs-card" style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(6px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800, color: m.color, marginBottom: '2px' }}>
                  <Icon size={13} /> {m.value}
                </div>
                <div style={{ fontSize: '10.5px', color: '#5C728D', fontWeight: 600 }}>{m.label}</div>
              </div>
            );
          })}
        </div>

        {/* Provider Pills */}
        <p style={{ fontSize: '10.5px', color: '#8EA3BD', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          Supported Cloud AI Providers
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11px', fontWeight: 700, color: '#0B1F3A',
              background: '#FFFFFF', border: '1.5px solid #16A34A',
              padding: '4px 10px', borderRadius: '6px',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              boxShadow: '0 1px 3px rgba(11, 31, 58, 0.04)',
            }}
          >
            <CheckCircle2 size={12} style={{ color: '#16A34A' }} />
            AWS Bedrock (Active V1)
          </span>
          <span
            style={{
              fontSize: '11px', fontWeight: 600, color: '#8EA3BD',
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              padding: '4px 10px', borderRadius: '6px',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}
          >
            Vertex AI (Soon)
          </span>
          <span
            style={{
              fontSize: '11px', fontWeight: 600, color: '#8EA3BD',
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              padding: '4px 10px', borderRadius: '6px',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}
          >
            Azure AI (Soon)
          </span>
        </div>
      </div>
    </div>
  );
}
