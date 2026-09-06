import { useState, useEffect } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { useAuth } from '../../context/AuthContext';

import type { Model } from '../../types';
import { getAvailableModels } from '../../services/mock/mockService';
import {
  Layers, Search,
  Tag, Activity, Shield
} from 'lucide-react';

// Simple abstract brand-colored marks (not official logos) used as clickable provider filters.
function ProviderIcon({ provider, size = 26 }: { provider: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24' };
  switch (provider) {
    case 'Anthropic':
      return (
        <svg {...common}>
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x="11" y="2" width="2" height="8" rx="1" fill="currentColor" transform={`rotate(${i * 45} 12 12)`} />
          ))}
        </svg>
      );
    case 'Amazon':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 13 Q12 19.5 21 13" />
          <path d="M21 13 L16.7 12.2 M21 13 L18.4 16.6" />
        </svg>
      );
    case 'Meta':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 12c0-4.2-3.3-7-6.2-7C3.6 5 2 7.4 2 11c0 4.4 2.3 8 5.3 8 2 0 3.4-1.6 4.7-4.2C13.3 17.4 14.7 19 16.7 19c3 0 5.3-3.6 5.3-8 0-3.6-1.6-6-3.8-6-2.9 0-6.2 2.8-6.2 7zm-2.1 1.8C8.8 16.1 8 16.8 7.3 16.8c-1.3 0-2.5-2.1-2.5-5.8 0-2.4.9-3.8 2-3.8 1.7 0 3.4 2 4.1 4.2-.4.9-.7 1.7-1 2.4zm7.3-6.6c1.1 0 2 1.4 2 3.8 0 3.7-1.2 5.8-2.5 5.8-.7 0-1.5-.7-2.6-2.9-.3-.7-.6-1.5-1-2.4.7-2.2 2.4-4.3 4.1-4.3z" />
        </svg>
      );
    case 'Mistral': {
      const shades = ['#FFB800', '#FF8A00', '#FF5B00', '#E63900'];
      return (
        <svg {...common}>
          {shades.map((c, i) => (
            <rect key={c} x="9" y="3" width="6" height="7" rx="1" fill={c} transform={`rotate(${i * 90} 12 12)`} />
          ))}
        </svg>
      );
    }
    default:
      return <Layers size={size} />;
  }
}

export function ModelsPage() {
  const { user } = useAuth();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');

  useEffect(() => {
    getAvailableModels(user?.id).then(ms => {
      setModels(ms);
      setLoading(false);
    });
  }, [user?.id]);

  const filtered = models.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.providerModelId.toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase());

    const matchesProvider = filterProvider === 'all' || m.provider.toLowerCase() === filterProvider.toLowerCase();

    return matchesSearch && matchesProvider;
  });


  const providers = ['all', 'Anthropic', 'Amazon', 'Meta', 'Mistral'];
  const PROVIDER_COLOR: Record<string, string> = {
    Anthropic: '#D97706',
    Amazon: '#FF9900',
    Meta: '#0668E1',
    Mistral: '#FF7000',
  };
  const groups = ['Anthropic', 'Amazon', 'Meta', 'Mistral']
    .map(provider => ({ provider, items: filtered.filter(m => m.provider === provider) }))
    .filter(g => g.items.length > 0);
  // Anything from a provider outside the known four still shows up, grouped by its own name.
  const knownProviders = new Set(['Anthropic', 'Amazon', 'Meta', 'Mistral']);
  const otherProviders = Array.from(new Set(filtered.map(m => m.provider).filter(p => !knownProviders.has(p))));
  for (const provider of otherProviders) {
    groups.push({ provider, items: filtered.filter(m => m.provider === provider) });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cs-gray-bg)', display: 'flex', flexDirection: 'column' }}>
      <AppHeader activePath="/models" />

      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '36px 24px', flex: 1 }}>
        {/* Page Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 className="cs-heading" style={{ fontSize: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={28} style={{ color: '#0066FF' }} /> Bedrock Foundation Models Registry
          </h1>
          <p style={{ fontSize: '14px', color: '#5C728D', marginTop: '6px', lineHeight: 1.5 }}>
            Maintained catalog of supported AWS Bedrock models with capability tiers, context windows, and mappings.
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8EA3BD' }} />
          <input
            type="text"
            placeholder="Search by model name or Bedrock ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '11px 12px 11px 36px', borderRadius: '10px',
              border: '1.5px solid #D5E3F5', fontSize: '13.5px', color: '#0B1F3A', outline: 'none',
              background: '#FFFFFF', boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Provider Icon Tiles -- click a brand icon to filter to that provider */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
          <button
            type="button"
            onClick={() => setFilterProvider('all')}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', borderRadius: '12px',
              border: `1.5px solid ${filterProvider === 'all' ? '#0066FF' : '#E2E8F0'}`,
              background: filterProvider === 'all' ? '#EBF3FF' : '#FFFFFF', cursor: 'pointer', transition: 'all 0.15s ease'
            }}
          >
            <Layers size={22} style={{ color: filterProvider === 'all' ? '#0066FF' : '#64748B' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0B1F3A' }}>All Providers</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>{models.length} models</div>
            </div>
          </button>

          {providers.filter(p => p !== 'all').map(p => {
            const count = models.filter(m => m.provider === p).length;
            const color = PROVIDER_COLOR[p] || '#64748B';
            const active = filterProvider === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setFilterProvider(active ? 'all' : p)}
                title={`Show ${p} models`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', borderRadius: '12px',
                  border: `1.5px solid ${active ? color : '#E2E8F0'}`,
                  background: active ? `${color}14` : '#FFFFFF', cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                <span style={{ color, display: 'flex' }}><ProviderIcon provider={p} /></span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0B1F3A' }}>{p}</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>{count} model{count === 1 ? '' : 's'}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Models grouped by provider */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="cs-skeleton" style={{ height: '160px', borderRadius: '10px' }} />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', background: '#FFFFFF', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>No models match your search/filter.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {groups.map(({ provider, items }) => (
              <div key={provider}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <span style={{ color: PROVIDER_COLOR[provider] || '#64748B', display: 'flex' }}><ProviderIcon provider={provider} size={20} /></span>
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0B1F3A', margin: 0 }}>{provider}</h2>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#5C728D', background: '#EEF4FA', padding: '2px 8px', borderRadius: '999px' }}>
                    {items.length} model{items.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                  {items.map(m => (
                    <div
                      key={m.id}
                      className="cs-card"
                      style={{
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: PROVIDER_COLOR[m.provider] || '#64748B', display: 'flex', flexShrink: 0 }}>
                              <ProviderIcon provider={m.provider} size={18} />
                            </span>
                            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0B1F3A', margin: 0 }}>
                              {m.name}
                            </h3>
                          </div>
                          <span style={{
                            fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                            background: '#EBF3FF', color: '#0066FF', flexShrink: 0
                          }}>
                            {m.provider}
                          </span>
                        </div>

                        <code style={{
                          fontSize: '11px', color: '#64748B', fontFamily: 'monospace',
                          display: 'block', marginTop: '6px', wordBreak: 'break-all'
                        }}>
                          {m.providerModelId}
                        </code>
                      </div>

                      <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: '8px',
                        paddingTop: '12px', borderTop: '1px solid #EEF4FA', fontSize: '11.5px', color: '#475569'
                      }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F8FAFC', padding: '3px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                          <Activity size={12} style={{ color: '#0066FF' }} /> {m.contextWindow || '128K tokens'}
                        </span>
                        {m.category && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F8FAFC', padding: '3px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                            <Tag size={12} style={{ color: '#10B981' }} /> {m.category}
                          </span>
                        )}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ECFDF5', padding: '3px 8px', borderRadius: '4px', color: '#065F46', fontWeight: 600 }}>
                          <Shield size={12} /> Allow-List Eligible
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
