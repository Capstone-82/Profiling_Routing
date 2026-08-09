import { Cpu, Activity, ShieldCheck, Zap } from 'lucide-react';

export function ControlPlanePreview() {
  return (
    <div className="cs-card" style={{ padding: '20px', background: '#FFFFFF', borderColor: '#D5E3F5', boxShadow: '0 4px 20px rgba(11, 31, 58, 0.06)' }}>
      {/* Topology Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #EEF4FA', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 6px rgba(22, 163, 74, 0.6)' }} />
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#0B1F3A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            AI Control Plane — AWS Bedrock Routing
          </span>
        </div>
        <span style={{ fontSize: '10px', color: '#0066FF', fontWeight: 700, background: '#EBF3FF', padding: '2px 8px', borderRadius: '12px' }}>
          Active Routing
        </span>
      </div>

      {/* SVG Control Plane Node Flow Visualization */}
      <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '16px 12px', marginBottom: '16px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          
          {/* Node 1: Workload */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#FFFFFF', border: '1.5px solid #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              <Activity size={16} />
            </div>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#5C728D' }}>User App</span>
          </div>

          {/* Animated Connecting Line 1 */}
          <div style={{ flex: 1, height: '2px', position: 'relative' }}>
            <svg width="100%" height="6" viewBox="0 0 100 6" preserveAspectRatio="none" style={{ position: 'absolute', top: '-2px' }}>
              <line x1="0" y1="3" x2="100" y2="3" stroke="#0066FF" strokeWidth="2" strokeDasharray="4 4" style={{ animation: 'cs-dash-flow 1s linear infinite' }} />
            </svg>
          </div>

          {/* Node 2: CoreStack Control Plane Hub */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'linear-gradient(135deg, #0066FF 0%, #0040A8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(0, 102, 255, 0.3)' }}>
              <Cpu size={20} />
            </div>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#0066FF' }}>CoreStack OS</span>
          </div>

          {/* Animated Connecting Line 2 */}
          <div style={{ flex: 1, height: '2px', position: 'relative' }}>
            <svg width="100%" height="6" viewBox="0 0 100 6" preserveAspectRatio="none" style={{ position: 'absolute', top: '-2px' }}>
              <line x1="0" y1="3" x2="100" y2="3" stroke="#0066FF" strokeWidth="2" strokeDasharray="4 4" style={{ animation: 'cs-dash-flow 1s linear infinite' }} />
            </svg>
          </div>

          {/* Node 3: Bedrock Foundation Models */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 6px', borderRadius: '4px', textAlign: 'center' }}>
              Claude 3.5
            </div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#0066FF', background: '#EBF3FF', padding: '2px 6px', borderRadius: '4px', textAlign: 'center' }}>
              Nova Pro
            </div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#0284C7', background: '#E0F2FE', padding: '2px 6px', borderRadius: '4px', textAlign: 'center' }}>
              Llama 3.1
            </div>
          </div>

        </div>
      </div>

      {/* Live Stat Counters & Model Traffic Share */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <div style={{ background: '#F5F9FD', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D5E3F5' }}>
          <div style={{ fontSize: '10px', color: '#5C728D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={11} style={{ color: '#0066FF' }} /> Requests / min
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#0B1F3A', marginTop: '2px' }}>1,284</div>
        </div>

        <div style={{ background: '#F5F9FD', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D5E3F5' }}>
          <div style={{ fontSize: '10px', color: '#5C728D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={11} style={{ color: '#16A34A' }} /> Availability
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>99.99%</div>
        </div>
      </div>

      {/* Traffic Share Bars */}
      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#5C728D', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
          Bedrock Model Traffic Distribution
        </div>
        
        {/* Progress bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#0B1F3A', fontWeight: 600, marginBottom: '2px' }}>
              <span>Anthropic Claude 3.5 Sonnet</span>
              <span style={{ color: '#0066FF' }}>52%</span>
            </div>
            <div style={{ height: '4px', background: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: '52%', height: '100%', background: '#0066FF', borderRadius: '2px' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#0B1F3A', fontWeight: 600, marginBottom: '2px' }}>
              <span>Amazon Nova Pro</span>
              <span style={{ color: '#0284C7' }}>31%</span>
            </div>
            <div style={{ height: '4px', background: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: '31%', height: '100%', background: '#0284C7', borderRadius: '2px' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#0B1F3A', fontWeight: 600, marginBottom: '2px' }}>
              <span>Meta Llama 3.1 70B</span>
              <span style={{ color: '#0EA5E9' }}>17%</span>
            </div>
            <div style={{ height: '4px', background: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: '17%', height: '100%', background: '#0EA5E9', borderRadius: '2px' }} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
