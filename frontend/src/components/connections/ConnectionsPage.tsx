import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../layout/AppHeader';
import type { Connection } from '../../types';
import { getConnection, testConnection as testConn, resetConnection } from '../../services/mock/mockService';
import { ExternalLink, Copy, Check, AlertCircle, Zap, CheckCircle2 } from 'lucide-react';

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

  const handleReset = async () => {
    await resetConnection(user?.id);
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
        padding: '28px',
        borderColor: isVerified ? '#86EFAC' : isFailed ? '#FCA5A5' : '#D5E3F5',
        boxShadow: isVerified ? '0 0 0 1px #86EFAC, 0 4px 20px rgba(22, 163, 74, 0.10)' : undefined,
        maxWidth: isVerified ? '820px' : '520px',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}>
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

      {/* ── CONNECTED STATE ── */}
      {isVerified ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Left: status + ARN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
            }}>
              <CheckCircle2 size={18} style={{ color: '#16A34A', flexShrink: 0, marginTop: '1px' }} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#15803D', margin: '0 0 2px' }}>
                  Connected successfully
                </p>
                <p style={{ fontSize: '12px', color: '#166534', margin: 0, lineHeight: 1.5 }}>
                  Foundation models are accessible via IAM role assumption.
                </p>
              </div>
            </div>

            {connection.roleArn && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 800, color: '#0B1F3A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  IAM Role ARN
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F5F9FD', border: '1px solid #D5E3F5', borderRadius: '6px', padding: '8px 12px' }}>
                  <code style={{ fontSize: '11.5px', color: '#0B1F3A', fontFamily: 'monospace', flex: 1, wordBreak: 'break-all', lineHeight: 1.5 }}>
                    {connection.roleArn}
                  </code>
                  <button
                    onClick={copyArn}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066FF', padding: '2px', flexShrink: 0 }}
                    aria-label="Copy Role ARN"
                  >
                    {copiedArn ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleReset}
              style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', color: '#5C728D', fontSize: '13px', padding: '8px 16px', width: '100%', marginTop: 'auto' }}
            >
              Disconnect
            </button>
          </div>

          {/* Right: connection details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Provider', value: 'Amazon Web Services' },
              { label: 'Service', value: 'AWS Bedrock' },
              { label: 'Auth Method', value: 'IAM Role Assumption' },
              { label: 'External ID', value: externalId, mono: true, copy: true, onCopy: copyId, copied: copiedId },
            ].map(({ label, value, mono, copy, onCopy, copied }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#5C728D', fontWeight: 600, flexShrink: 0 }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#0B1F3A', fontWeight: 700, fontFamily: mono ? 'monospace' : undefined, textAlign: 'right', wordBreak: 'break-all' }}>
                    {value}
                  </span>
                  {copy && onCopy && (
                    <button onClick={onCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066FF', padding: '2px', flexShrink: 0 }} aria-label={`Copy ${label}`}>
                      {copied ? <Check size={13} style={{ color: '#16A34A' }} /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: '#5C728D', lineHeight: 1.6, marginBottom: '20px' }}>
            Connect your AWS account to access foundation models available to your organization via IAM role assumption.
          </p>

          {/* External ID */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0B1F3A', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>EXTERNAL ID</span>
            <code style={{ fontSize: '11px', color: '#0B1F3A', fontFamily: 'monospace', background: '#F5F9FD', padding: '3px 8px', borderRadius: '4px', border: '1px solid #D5E3F5', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {externalId}
            </code>
            <button
              onClick={copyId}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066FF', padding: '4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
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
                href="https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/template"
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

          {connection.status === 'failed' && (
            <button
              type="button"
              onClick={handleReset}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8EA3BD', fontSize: '12px', textAlign: 'center', textDecoration: 'underline', marginTop: '8px', width: '100%' }}
            >
              Reset
            </button>
          )}
        </>
      )}
    </div>
  );
}



// ─── Connections Page ─────────────────────────────────────────────────────────
export function ConnectionsPage() {
  const { connection, setConnection, initialLoading } = useConnectionState();

  return (
    <ConnCtx.Provider value={{ connection, setConnection }}>
      <div style={{ background: 'var(--cs-gray-bg)' }}>
        <AppHeader activePath="/connections" />

        <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '40px 24px 64px' }}>

          {/* Page heading */}
          <div style={{ marginBottom: '28px' }}>
            <h1 className="cs-heading" style={{ fontSize: '28px', marginBottom: '0' }}>
              AI Provider Connections
            </h1>
            <p style={{ fontSize: '14px', color: '#5C728D', marginTop: '12px', maxWidth: '540px', lineHeight: 1.6 }}>
              Connect your cloud AI providers to securely access and govern available foundation models.
            </p>
          </div>

          {initialLoading ? (
            <div className="cs-card" style={{ padding: '24px', maxWidth: '520px', height: '220px' }}>
              <div className="cs-skeleton" style={{ height: '44px', width: '60px', borderRadius: '8px', marginBottom: '16px' }} />
              <div className="cs-skeleton" style={{ height: '16px', width: '140px', marginBottom: '8px' }} />
              <div className="cs-skeleton" style={{ height: '12px', width: '80px' }} />
            </div>
          ) : (
            <BedrockCard />
          )}

        </main>
      </div>
    </ConnCtx.Provider>
  );
}
