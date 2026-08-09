import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../layout/AppHeader';
import type { Connection, Model } from '../../types';
import { getConnection, testConnection as testConn, resetConnection } from '../../services/mock/mockService';
import { ExternalLink, Copy, Check, AlertCircle, Lock, ChevronRight } from 'lucide-react';

// ─── Context plumbing ─────────────────────────────────────────────────────────
const ConnCtx = React.createContext<{
  connection: Connection;
  setConnection: React.Dispatch<React.SetStateAction<Connection>>;
} | undefined>(undefined);

function useConn() {
  const ctx = React.useContext(ConnCtx);
  if (!ctx) throw new Error('No ConnCtx');
  return ctx;
}

function useConnectionState() {
  const [connection, setConnection] = useState<Connection>({ provider: 'aws-bedrock', status: 'not_connected' });
  const [initialLoading, setInitialLoading] = useState(true);
  useEffect(() => {
    getConnection().then(c => { setConnection(c); setInitialLoading(false); });
  }, []);
  return { connection, setConnection, initialLoading };
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Connection['status'] }) {
  const map = {
    not_connected: { cls: 'cs-badge-gray',    label: 'Not Connected' },
    pending:       { cls: 'cs-badge-blue',    label: 'Connecting…' },
    verified:      { cls: 'cs-badge-success', label: 'Connected' },
    failed:        { cls: 'cs-badge-error',   label: 'Failed' },
  };
  const { cls, label } = map[status];

  return (
    <span className={`cs-badge ${cls}`}>
      {status === 'pending' && (
        <span style={{ display: 'inline-block', width: '8px', height: '8px', border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'cs-spin 0.6s linear infinite' }} />
      )}
      {status === 'verified' && (
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--cs-success)', display: 'inline-block' }} />
      )}
      {label}
    </span>
  );
}

// ─── Model list (shown when verified) ────────────────────────────────────────
function ModelList({ models }: { models: Model[] }) {
  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cs-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        Available models
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {models.map(m => (
          <div
            key={m.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 10px',
              background: 'var(--cs-bg-page)',
              border: '1px solid var(--cs-border-light)',
              borderRadius: '6px',
              gap: '8px',
            }}
          >
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cs-navy)' }}>{m.name}</span>
              <span style={{ fontSize: '12px', color: 'var(--cs-muted)', marginLeft: '6px' }}>{m.provider}</span>
            </div>
            <code style={{ fontSize: '10px', color: 'var(--cs-subtle)', fontFamily: 'monospace', flexShrink: 0 }}>
              {m.providerModelId.split('.').slice(-1)[0]}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AWS Bedrock Card ─────────────────────────────────────────────────────────
function BedrockCard() {
  const { user } = useAuth();
  const { connection, setConnection } = useConn();
  const [roleArn, setRoleArn] = useState(connection.roleArn || '');
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const externalId = user?.id || '—';
  const cfUrl = `https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/quickcreate?param_ExternalId=${externalId}`;

  useEffect(() => {
    if (connection.roleArn && !roleArn) setRoleArn(connection.roleArn);
  }, [connection.roleArn]);

  const copyId = () => {
    navigator.clipboard.writeText(externalId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    // Show pending immediately
    setConnection(prev => ({ ...prev, status: 'pending' }));
    const result = await testConn(roleArn);
    setConnection(result);
    setTesting(false);
  };

  const handleReset = () => {
    resetConnection();
    setConnection({ provider: 'aws-bedrock', status: 'not_connected' });
    setRoleArn('');
  };

  const arnFormatError = roleArn.trim() && !roleArn.startsWith('arn:aws:iam::')
    ? 'Invalid ARN format. Expected: arn:aws:iam::<ACCOUNT_ID>:role/<NAME>'
    : '';

  const isVerified = connection.status === 'verified';
  const isFailed = connection.status === 'failed';

  return (
    <div
      className="cs-card"
      style={{
        padding: '24px',
        borderColor: isVerified ? 'var(--cs-success-border)' : isFailed ? 'var(--cs-error-border)' : undefined,
        boxShadow: isVerified ? '0 0 0 1px var(--cs-success-border), 0 4px 16px rgba(26,127,75,0.10)' : undefined,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '8px',
            background: '#FFF7ED', border: '1px solid #FED7AA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 900, color: '#C05621',
            letterSpacing: '-0.5px', flexShrink: 0,
          }}>
            AWS
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--cs-navy)' }}>AWS Bedrock</div>
            <div style={{ fontSize: '12px', color: 'var(--cs-muted)', marginTop: '1px' }}>Amazon Web Services</div>
          </div>
        </div>
        <StatusBadge status={connection.status} />
      </div>

      <p style={{ fontSize: '13px', color: 'var(--cs-muted)', lineHeight: 1.6, marginBottom: '12px' }}>
        Connect your AWS account to access foundation models available to your organization via IAM role assumption.
      </p>

      {/* Compact External ID */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cs-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>External ID</span>
        <code style={{ fontSize: '11px', color: 'var(--cs-navy)', fontFamily: 'monospace', background: 'var(--cs-bg-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--cs-border)' }}>
          {externalId}
        </code>
        <button
          onClick={copyId}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cs-blue)', padding: '4px', display: 'flex', alignItems: 'center' }}
          aria-label="Copy External ID"
        >
          {copied ? <Check size={13} style={{ color: 'var(--cs-success)' }} /> : <Copy size={13} />}
        </button>
      </div>

      {/* Step 1 */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cs-navy)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Step 1 — Deploy CloudFormation Stack
        </p>
        <a
          href={cfUrl}
          target="_blank"
          rel="noreferrer"
          className="cs-btn cs-btn-primary"
          style={{ width: '100%', textDecoration: 'none' }}
        >
          Connect AWS Bedrock <ExternalLink size={13} />
        </a>
      </div>

      {/* Step 2 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cs-navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Step 2 — Paste Role ARN
          </p>
        </div>
        <input
          type="text"
          value={roleArn}
          onChange={e => setRoleArn(e.target.value)}
          placeholder="arn:aws:iam::123456789012:role/RoleName"
          className={`cs-input ${arnFormatError ? 'cs-input-error' : ''}`}
          style={{ fontFamily: 'monospace', fontSize: '12px' }}
          aria-label="IAM Role ARN"
        />
        {arnFormatError && (
          <p style={{ fontSize: '11px', color: 'var(--cs-error)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={11} /> {arnFormatError}
          </p>
        )}
      </div>

      {/* Error message */}
      {isFailed && connection.error && (
        <div style={{
          background: 'var(--cs-error-bg)', border: '1px solid var(--cs-error-border)',
          borderRadius: '8px', padding: '12px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: 'var(--cs-error)', marginBottom: '4px' }}>
            <AlertCircle size={13} /> Connection failed
          </div>
          <p style={{ fontSize: '12px', color: '#7F1D1D', fontFamily: 'monospace', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {connection.error}
          </p>
        </div>
      )}

      {/* Verified model list */}
      {isVerified && connection.availableModels?.length && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ height: '1px', background: 'var(--cs-border-light)', margin: '0 0 16px' }} />
          <ModelList models={connection.availableModels} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {isFailed ? (
          <button
            onClick={handleTest}
            disabled={testing || !roleArn.trim() || Boolean(arnFormatError)}
            className={`cs-btn cs-btn-primary ${testing ? 'is-loading' : ''}`}
            style={{ width: '100%' }}
          >
            {testing ? <><span className="cs-spinner" style={{ width: '14px', height: '14px' }} /> Verifying…</> : 'Try Again'}
          </button>
        ) : (
          <button
            onClick={handleTest}
            disabled={testing || !roleArn.trim() || Boolean(arnFormatError)}
            className={`cs-btn cs-btn-primary ${testing ? 'is-loading' : ''}`}
            style={{ width: '100%' }}
          >
            {testing ? <><span className="cs-spinner" style={{ width: '14px', height: '14px' }} /> Verifying connection…</> : 'Test Connection'}
          </button>
        )}
        {connection.status !== 'not_connected' && (
          <button
            type="button"
            onClick={handleReset}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cs-subtle)', fontSize: '12px', textAlign: 'center', textDecoration: 'underline' }}
          >
            Reset connection
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Coming Soon Card ─────────────────────────────────────────────────────────
interface ComingSoonCardProps {
  abbrev: string;
  name: string;
  provider: string;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  description: string;
}

function ComingSoonCard({ abbrev, name, provider, iconBg, iconBorder, iconColor, description }: ComingSoonCardProps) {
  return (
    <div className="cs-card" style={{ padding: '24px', opacity: 0.7, alignSelf: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '8px',
            background: iconBg, border: `1px solid ${iconBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 900, color: iconColor, flexShrink: 0,
          }}>
            {abbrev}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--cs-navy)' }}>{name}</div>
            <div style={{ fontSize: '12px', color: 'var(--cs-muted)' }}>{provider}</div>
          </div>
        </div>
        <span className="cs-badge cs-badge-gray" style={{ fontSize: '10px' }}>Coming Soon</span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--cs-subtle)', lineHeight: 1.5, margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

// ─── Connections Page ─────────────────────────────────────────────────────────
export function ConnectionsPage() {
  const navigate = useNavigate();
  const { connection, setConnection, initialLoading } = useConnectionState();
  const isVerified = connection.status === 'verified';

  return (
    <ConnCtx.Provider value={{ connection, setConnection }}>
      <div style={{ minHeight: '100vh', background: 'var(--cs-bg-page)' }}>
        <AppHeader activePath="/connections" />

        <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>

          {/* Page heading */}
          <div style={{ marginBottom: '24px' }}>
            <h1 className="cs-heading" style={{ fontSize: '28px', marginBottom: '0' }}>
              AI Provider Connections
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--cs-muted)', marginTop: '10px', maxWidth: '540px', lineHeight: 1.5 }}>
              Connect your cloud AI providers to securely access and govern available foundation models.
            </p>
          </div>

          {/* Provider grid */}
          {initialLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {[1,2,3].map(i => (
                <div key={i} className="cs-card" style={{ padding: '24px', height: '320px' }}>
                  <div className="cs-skeleton" style={{ height: '44px', width: '60px', borderRadius: '8px', marginBottom: '12px' }} />
                  <div className="cs-skeleton" style={{ height: '16px', width: '140px', marginBottom: '8px' }} />
                  <div className="cs-skeleton" style={{ height: '12px', width: '80px' }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', alignItems: 'flex-start', marginBottom: '32px' }}>
              <BedrockCard />
              <ComingSoonCard
                abbrev="GCP"
                name="Vertex AI"
                provider="Google Cloud"
                iconBg="#EFF6FF" iconBorder="#BFDBFE" iconColor="#1D4ED8"
                description="Vertex AI integration will be available in a future release. Access Gemini models through Workload Identity Federation."
              />
              <ComingSoonCard
                abbrev="MS"
                name="Azure AI Foundry"
                provider="Microsoft Azure"
                iconBg="#F0F9FF" iconBorder="#BAE6FD" iconColor="#0369A1"
                description="Azure AI Foundry integration will be available in a future release. Access GPT-4o and Phi-3 models via Managed Identity."
              />
            </div>
          )}

          {/* Removed redundant bottom CTA entirely */}

        </main>
      </div>
    </ConnCtx.Provider>
  );
}
