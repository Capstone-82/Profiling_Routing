import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

function CoreStackLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M16 2L25 7.5V17L16 22.5L7 17V7.5L16 2Z" fill="#E8334A" opacity="0.9"/>
      <path d="M16 2L25 7.5V12L16 17.5L7 12V7.5L16 2Z" fill="#F5A623" opacity="0.9"/>
      <path d="M16 7.5L22.5 11.2V17.3L16 21L9.5 17.3V11.2L16 7.5Z" fill="#0072CE"/>
      <path d="M16 11.5L20 13.8V18.2L16 20.5L12 18.2V13.8L16 11.5Z" fill="#fff" opacity="0.85"/>
    </svg>
  );
}

export function Footer() {
  return (
    <footer style={{ marginTop: 'auto', background: 'var(--cs-navy)', color: '#fff', borderTop: '1px solid var(--cs-navy-light)' }}>
      {/* Top Banner Strip */}
      <div style={{
        background: 'linear-gradient(90deg, #004F9F 0%, #0072CE 50%, #0096D6 100%)',
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ color: '#fff', fontSize: '20px', fontWeight: 800, margin: 0 }}>
              Accelerate Innovation with Multi-Provider AI Governance
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', marginTop: '4px', margin: 0 }}>
              Unify AWS Bedrock, Google Vertex AI, and Azure AI Foundry under continuous compliance.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link to="/playground" className="cs-btn" style={{ background: '#fff', color: 'var(--cs-blue)', borderRadius: 'var(--cs-radius-pill)', fontWeight: 700, padding: '0 24px' }}>
              Explore AI Gateway
            </Link>
            <a href="https://www.corestack.io" target="_blank" rel="noreferrer" className="cs-btn" style={{ background: 'transparent', border: '2px solid #fff', color: '#fff', borderRadius: 'var(--cs-radius-pill)', fontWeight: 600, padding: '0 24px', textDecoration: 'none' }}>
              CoreStack.io <ExternalLink size={13} style={{ marginLeft: '4px' }} />
            </a>
          </div>
        </div>
      </div>

      {/* Main Footer Links — 4 Columns */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '56px 24px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '36px', marginBottom: '48px' }}>
          
          {/* Brand Col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CoreStackLogo />
              <div style={{ lineHeight: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>
                  CORESTACK
                </div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#0072CE', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px' }}>
                  AI Governance OS
                </div>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
              Enterprise cloud & AI governance platform enabling velocity with total control across multi-cloud environments.
            </p>
          </div>

          {/* Col 1: By Product */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
              By Product
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li><Link to="/playground" style={{ color: '#CBD5E1', textDecoration: 'none' }}>AI Model Gateway</Link></li>
              <li><Link to="/connections" style={{ color: '#CBD5E1', textDecoration: 'none' }}>Cloud Provider IAM Trust</Link></li>
              <li><a href="https://www.corestack.io" target="_blank" rel="noreferrer" style={{ color: '#CBD5E1', textDecoration: 'none' }}>FinOps+ Cost Optimization</a></li>
              <li><a href="https://www.corestack.io" target="_blank" rel="noreferrer" style={{ color: '#CBD5E1', textDecoration: 'none' }}>SecOps+ Security Guardrails</a></li>
            </ul>
          </div>

          {/* Col 2: By Solutions */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
              By Solutions
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li><span style={{ color: '#CBD5E1' }}>AWS Bedrock Governance</span></li>
              <li><span style={{ color: '#CBD5E1' }}>Multi-LLM Fallback Routing</span></li>
              <li><span style={{ color: '#CBD5E1' }}>Continuous Compliance (ISO/NIST)</span></li>
              <li><span style={{ color: '#CBD5E1' }}>Enterprise IAM Policy Engine</span></li>
            </ul>
          </div>

          {/* Col 3: Resources & Partners */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
              Resources & Partners
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li><a href="https://www.corestack.io" target="_blank" rel="noreferrer" style={{ color: '#CBD5E1', textDecoration: 'none' }}>Documentation</a></li>
              <li><a href="https://www.corestack.io" target="_blank" rel="noreferrer" style={{ color: '#CBD5E1', textDecoration: 'none' }}>AWS Marketplace</a></li>
              <li><a href="https://www.corestack.io" target="_blank" rel="noreferrer" style={{ color: '#CBD5E1', textDecoration: 'none' }}>Partner Network</a></li>
              <li><a href="https://www.corestack.io" target="_blank" rel="noreferrer" style={{ color: '#CBD5E1', textDecoration: 'none' }}>Security & Trust Center</a></li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright */}
        <div style={{ borderTop: '1px solid var(--cs-navy-light)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#64748B' }}>
          <p style={{ margin: 0 }}>© {new Date().getFullYear()} CoreStack. All rights reserved. Built for Multi-Provider AI Governance.</p>
          <div style={{ display: 'flex', gap: '20px' }}>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Security</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
