import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../layout/AppHeader';
import { Footer } from '../layout/Footer';
import type { Connection, Model } from '../../types';
import { getConnection, testConnection as testConn, resetConnection } from '../../services/mock/mockService';
import { ExternalLink, Copy, Check, AlertCircle, Zap, Lock } from 'lucide-react';

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
  const { user } = useAuth();
  const [connection, setConnection] = useState<Connection>({ provider: 'aws-bedrock', status: 'not_connected' });
  const [initialLoading, setInitialLoading] = useState(true);
  useEffect(() => {
    getConnection(user?.id).then(c => { setConnection(c); setInitialLoading(false); });
  }, [user?.id]);
  return { connection, setConnection, initialLoading };
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Connection['status'] }) {
  const [animate, setAnimate] = useState(false);
  const prevStatusRef = React.useRef(status);

  useEffect(() => {
    if (prevStatusRef.current !== status) {
      setAnimate(true);
      const t = setTimeout(() => setAnimate(false), 350);
      prevStatusRef.current = status;
      return () => clearTimeout(t);
    }
  }, [status]);

  const map = {
    not_connected: { cls: 'cs-badge-gray',    label: 'Not Connected' },
    pending:       { cls: 'cs-badge-blue',    label: 'Connecting…' },
    verified:      { cls: 'cs-badge-success', label: 'Connected' },
    failed:        { cls: 'cs-badge-error',   label: 'Failed' },
  };
  const { cls, label } = map[status];

  return (
    <span className={`cs-badge ${cls} ${animate ? 'cs-badge-updated' : ''}`}>
      {status === 'pending' && (
        <span style={{ display: 'inline-block', width: '8px', height: '8px', border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'cs-spin 0.6s linear infinite' }} />
      )}
      {status === 'verified' && (
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
      )}
      {label}
    </span>
  );
}

// ─── Model list (shown when verified) ────────────────────────────────────────
function ModelList({ models }: { models: Model[] }) {
  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 800, color: '#0B1F3A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        Available Models
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {models.map(m => (
          <div
            key={m.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              gap: '8px',
            }}
          >
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0B1F3A' }}>{m.name}</span>
              <span style={{ fontSize: '11px', color: '#5C728D', marginLeft: '6px', fontWeight: 500 }}>{m.provider}</span>
            </div>
            <code style={{ fontSize: '10.5px', color: '#0066FF', fontFamily: 'monospace', flexShrink: 0, background: '#EBF3FF', padding: '2px 6px', borderRadius: '4px' }}>
              {m.providerModelId}
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
  const [copiedId, setCopiedId] = useState(false);
  const [copiedArn, setCopiedArn] = useState(false);
  const externalId = user?.id || '—';

  useEffect(() => {
    if (connection.roleArn && !roleArn) setRoleArn(connection.roleArn);
  }, [connection.roleArn]);

  const copyId = () => {
    navigator.clipboard.writeText(externalId).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const copyArn = () => {
    navigator.clipboard.writeText(roleArn).catch(() => {});
    setCopiedArn(true);
    setTimeout(() => setCopiedArn(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setConnection(prev => ({ ...prev, status: 'pending' }));
    const result = await testConn(roleArn, externalId);
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
        borderColor: isVerified ? '#86EFAC' : isFailed ? '#FCA5A5' : '#D5E3F5',
        boxShadow: isVerified ? '0 0 0 1px #86EFAC, 0 4px 16px rgba(22, 163, 74, 0.08)' : undefined,
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
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#0B1F3A' }}>AWS Bedrock</div>
            <div style={{ fontSize: '12px', color: '#5C728D', marginTop: '1px' }}>Amazon Web Services</div>
          </div>
        </div>
        <StatusBadge status={connection.status} />
      </div>

      <p style={{ fontSize: '13px', color: '#5C728D', lineHeight: 1.6, marginBottom: '14px' }}>
        Connect your AWS account to access foundation models available to your organization via IAM role assumption.
      </p>

      {/* Compact External ID */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#0B1F3A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>EXTERNAL ID</span>
        <code style={{ fontSize: '11px', color: '#0B1F3A', fontFamily: 'monospace', background: '#F5F9FD', padding: '3px 8px', borderRadius: '4px', border: '1px solid #D5E3F5' }}>
          {externalId}
        </code>
        <button
          onClick={copyId}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066FF', padding: '4px', display: 'flex', alignItems: 'center' }}
          aria-label="Copy External ID"
        >
          {copiedId ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} />}
        </button>
      </div>

      {/* Step 1 */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 800, color: '#0B1F3A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          STEP 1 — DEPLOY CLOUDFORMATION STACK
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a
            href={`data:text/yaml;charset=utf-8,${encodeURIComponent(`AWSTemplateFormatVersion: '2010-09-09'
Description: 'CloudFormation template to create IAM Role for AI Profiling & Routing Platform Bedrock integration'

Parameters:
  ExternalId:
    Type: String
    Description: 'User External ID (Supabase Auth UUID) required for IAM Role assumption security'
  TrustedAccountId:
    Type: String
    Default: '108839616732'
    Description: 'The AWS Account ID of the AI Routing Platform server'

Resources:
  BedrockAccessRole:
    Type: 'AWS::IAM::Role'
    Properties:
      RoleName: !Sub 'AIRoutingBedrockRole-\${ExternalId}'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              AWS: !Sub 'arn:aws:iam::\${TrustedAccountId}:root'
            Action: 'sts:AssumeRole'
            Condition:
              StringEquals:
                'sts:ExternalId': !Ref ExternalId
      Policies:
        - PolicyName: BedrockAccessPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - 'bedrock:ListFoundationModels'
                  - 'bedrock:InvokeModel'
                  - 'bedrock:InvokeModelWithResponseStream'
                Resource: '*'

Outputs:
  RoleArn:
    Description: 'The ARN of the created IAM Role. Copy and paste this back into the AI Routing Platform Connections page.'
    Value: !GetAtt BedrockAccessRole.Arn`)}`}
            download="bedrock-role-template.yaml"
            className="cs-btn cs-btn-outline"
            style={{ width: '100%', textDecoration: 'none', justifyContent: 'center', height: '42px', fontSize: '13px' }}
          >
            1. Download Template (.yaml) <ExternalLink size={13} style={{ marginLeft: '4px' }} />
          </a>
          <a
            href={`https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/template`}
            target="_blank"
            rel="noreferrer"
            className="cs-btn cs-btn-primary"
            style={{ width: '100%', textDecoration: 'none', justifyContent: 'center', height: '42px', fontSize: '13px' }}
          >
            2. Open AWS CloudFormation Console <ExternalLink size={13} />
          </a>
        </div>
        <p style={{ fontSize: '11px', color: '#8EA3BD', marginTop: '8px', lineHeight: 1.4 }}>
          Upload the downloaded <code style={{ fontSize: '10.5px' }}>bedrock-role-template.yaml</code> file into CloudFormation, paste your External ID above when prompted, and create the stack.
        </p>
      </div>

      {/* Step 2 */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 800, color: '#0B1F3A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          STEP 2 — PASTE ROLE ARN
        </p>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={roleArn}
            onChange={e => setRoleArn(e.target.value)}
            placeholder="arn:aws:iam::123456789012:role/RoleName"
            className={`cs-input ${arnFormatError ? 'cs-input-error' : ''}`}
            style={{ fontFamily: 'monospace', fontSize: '12px', paddingRight: '40px', height: '42px' }}
            aria-label="IAM Role ARN"
          />
          {roleArn && (
            <button
              onClick={copyArn}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#0066FF', padding: '2px' }}
              aria-label="Copy Role ARN"
            >
              {copiedArn ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} />}
            </button>
          )}
        </div>
        {arnFormatError && (
          <p style={{ fontSize: '11px', color: 'var(--cs-error)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={12} /> {arnFormatError}
          </p>
        )}
      </div>

      {/* Error message */}
      {isFailed && connection.error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#DC2626', marginBottom: '4px' }}>
            <AlertCircle size={14} /> Connection failed
          </div>
          <p style={{ fontSize: '12px', color: '#7F1D1D', fontFamily: 'monospace', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {connection.error}
          </p>
        </div>
      )}

      {/* Verified model list */}
      {isVerified && connection.availableModels?.length && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ height: '1px', background: '#E2E8F0', margin: '0 0 16px' }} />
          <ModelList models={connection.availableModels} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={handleTest}
          disabled={testing || !roleArn.trim() || Boolean(arnFormatError)}
          className={`cs-btn cs-btn-primary ${testing ? 'is-loading' : ''}`}
          style={{ width: '100%', height: '44px', fontSize: '14px', justifyContent: 'center' }}
        >
          {testing ? (
            <><span className="cs-spinner" style={{ width: '16px', height: '16px' }} /> Verifying connection…</>
          ) : (
            <><Zap size={15} /> Test Connection</>
          )}
        </button>

        {connection.status !== 'not_connected' && (
          <button
            type="button"
            onClick={handleReset}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8EA3BD', fontSize: '12px', textAlign: 'center', textDecoration: 'underline', marginTop: '2px' }}
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
    <div className="cs-card" style={{ padding: '24px', opacity: 0.7 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '8px',
            background: iconBg, border: `1px solid ${iconBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 900, color: iconColor, flexShrink: 0,
          }}>
            {abbrev}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#0B1F3A' }}>{name}</div>
            <div style={{ fontSize: '12px', color: '#5C728D', marginTop: '1px' }}>{provider}</div>
          </div>
        </div>
        <span className="cs-badge cs-badge-gray">COMING SOON</span>
      </div>

      <p style={{ fontSize: '13px', color: '#5C728D', lineHeight: 1.6, marginBottom: '20px' }}>
        {description}
      </p>

      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8EA3BD', marginBottom: '8px' }}>
          <Lock size={12} /> Integration not available in V1
        </div>
        <div style={{ height: '32px', background: '#E2E8F0', borderRadius: '6px' }} />
      </div>

      <button
        disabled
        className="cs-btn"
        style={{ width: '100%', background: '#EEF4FA', borderColor: '#D5E3F5', color: '#8EA3BD', cursor: 'not-allowed', height: '42px' }}
      >
        Available in a future release
      </button>
    </div>
  );
}

// ─── Connections Page ─────────────────────────────────────────────────────────
export function ConnectionsPage() {
  const { connection, setConnection, initialLoading } = useConnectionState();

  return (
    <ConnCtx.Provider value={{ connection, setConnection }}>
      <div style={{ minHeight: '100vh', background: 'var(--cs-gray-bg)', display: 'flex', flexDirection: 'column' }}>
        <AppHeader activePath="/connections" />

        <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '40px 24px', flex: 1 }}>

          {/* Page heading */}
          <div style={{ marginBottom: '28px' }}>
            <h1 className="cs-heading" style={{ fontSize: '28px', marginBottom: '0' }}>
              AI Provider Connections
            </h1>
            <p style={{ fontSize: '14px', color: '#5C728D', marginTop: '12px', maxWidth: '540px', lineHeight: 1.6 }}>
              Connect your cloud AI providers to securely access and govern available foundation models.
            </p>
          </div>

          {/* Provider grid */}
          {initialLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              {[1,2,3].map(i => (
                <div key={i} className="cs-card" style={{ padding: '24px', height: '340px' }}>
                  <div className="cs-skeleton" style={{ height: '44px', width: '60px', borderRadius: '8px', marginBottom: '16px' }} />
                  <div className="cs-skeleton" style={{ height: '16px', width: '140px', marginBottom: '8px' }} />
                  <div className="cs-skeleton" style={{ height: '12px', width: '80px' }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px', alignItems: 'flex-start' }}>
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

        </main>
        <Footer />
      </div>
    </ConnCtx.Provider>
  );
}
