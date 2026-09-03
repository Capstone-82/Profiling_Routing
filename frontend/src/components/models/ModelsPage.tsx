import { useState, useEffect } from 'react';
import { AppHeader } from '../layout/AppHeader';

import type { Model } from '../../types';
import { getAvailableModels } from '../../services/mock/mockService';
import {
  Layers, Search,
  Tag, Activity, Shield
} from 'lucide-react';

export function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');

  useEffect(() => {
    getAvailableModels().then(ms => {
      setModels(ms);
      setLoading(false);
    });
  }, []);

  const filtered = models.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.providerModelId.toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase());

    const matchesProvider = filterProvider === 'all' || m.provider.toLowerCase() === filterProvider.toLowerCase();

    return matchesSearch && matchesProvider;
  });


  const providers = ['all', 'Anthropic', 'Amazon', 'Meta', 'Mistral'];

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

        {/* Filters and Search Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px',
          border: '1.5px solid #D5E3F5', marginBottom: '24px', flexWrap: 'wrap', gap: '14px'
        }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8EA3BD' }} />
            <input
              type="text"
              placeholder="Search by model name or Bedrock ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px 9px 36px', borderRadius: '6px',
                border: '1.5px solid #E2E8F0', fontSize: '13.5px', color: '#0B1F3A', outline: 'none'
              }}
            />
          </div>

          {/* Provider Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginRight: '4px' }}>Provider:</span>
            {providers.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setFilterProvider(p)}
                style={{
                  padding: '5px 12px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 700,
                  background: filterProvider === p ? '#0066FF' : '#F1F5F9',
                  color: filterProvider === p ? '#FFFFFF' : '#475569',
                  transition: 'all 0.15s ease'
                }}
              >
                {p === 'all' ? 'All Providers' : p}
              </button>
            ))}
          </div>
        </div>

        {/* Grid of Models */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="cs-skeleton" style={{ height: '160px', borderRadius: '10px' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {filtered.map(m => (
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
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0B1F3A', margin: 0 }}>
                      {m.name}
                    </h3>
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
        )}
      </main>
    </div>
  );
}
