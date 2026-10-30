import { useState, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Cpu,
  Sliders,
  Lock,
  Save,
  ShieldAlert,
  FileCheck2
} from 'lucide-react';
import type { Model } from '../../types';

interface GuardrailConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  allModels: Model[];
  allowedBedrockIds: string[];
  setAllowedBedrockIds: (ids: string[]) => void;
  maxInputTokens: number;
  setMaxInputTokens: (val: number) => void;
  maxOutputTokens: number;
  setMaxOutputTokens: (val: number) => void;
  maxTotalTokens: number;
  setMaxTotalTokens: (val: number) => void;
  rateLimitRpm: number;
  setRateLimitRpm: (val: number) => void;
  dailyTokenQuota: number;
  setDailyTokenQuota: (val: number) => void;
  piiEnabled: boolean;
  setPiiEnabled: (val: boolean) => void;
  piiScanInput: boolean;
  setPiiScanInput: (val: boolean) => void;
  piiScanOutput: boolean;
  setPiiScanOutput: (val: boolean) => void;
  piiAction: 'ALLOW' | 'MASK' | 'BLOCK';
  setPiiAction: (val: 'ALLOW' | 'MASK' | 'BLOCK') => void;
  piiEntities: string[];
  setPiiEntities: (val: string[]) => void;
  toxicityEnabled: boolean;
  setToxicityEnabled: (val: boolean) => void;
  toxicityScanInput: boolean;
  setToxicityScanInput: (val: boolean) => void;
  toxicityScanOutput: boolean;
  setToxicityScanOutput: (val: boolean) => void;
  toxicityAction: 'ALLOW' | 'FLAG' | 'BLOCK' | 'REGENERATE';
  setToxicityAction: (val: 'ALLOW' | 'FLAG' | 'BLOCK' | 'REGENERATE') => void;
  toxicityThreshold: number;
  setToxicityThreshold: (val: number) => void;
  toxicityCategories: string[];
  setToxicityCategories: (val: string[]) => void;
  injectionEnabled: boolean;
  setInjectionEnabled: (val: boolean) => void;
  injectionThreshold: number;
  setInjectionThreshold: (val: number) => void;
  injectionAction: 'ALLOW' | 'FLAG' | 'BLOCK' | 'REVIEW';
  setInjectionAction: (val: 'ALLOW' | 'FLAG' | 'BLOCK' | 'REVIEW') => void;
  hallucinationEnabled: boolean;
  setHallucinationEnabled: (val: boolean) => void;
  hallucinationProvider: string;
  setHallucinationProvider: (val: string) => void;
  hallucinationAction: 'ALLOW' | 'FLAG' | 'BLOCK' | 'REVIEW' | 'REGENERATE';
  setHallucinationAction: (val: 'ALLOW' | 'FLAG' | 'BLOCK' | 'REVIEW' | 'REGENERATE') => void;
  hallucinationThreshold: number;
  setHallucinationThreshold: (val: number) => void;
  hallucinationFailureMode: 'BLOCK' | 'ALLOW' | 'REVIEW';
  setHallucinationFailureMode: (val: 'BLOCK' | 'ALLOW' | 'REVIEW') => void;
  concisenessEnabled: boolean;
  setConcisenessEnabled: (val: boolean) => void;
  concisenessMaxWords: number;
  setConcisenessMaxWords: (val: number) => void;
  concisenessMaxCharacters: number;
  setConcisenessMaxCharacters: (val: number) => void;
  concisenessMaxSentences: number;
  setConcisenessMaxSentences: (val: number) => void;
  concisenessLength: 'SHORT' | 'MEDIUM' | 'LONG';
  setConcisenessLength: (val: 'SHORT' | 'MEDIUM' | 'LONG') => void;
  concisenessAction: 'ALLOW' | 'FLAG' | 'BLOCK' | 'REVIEW' | 'REGENERATE';
  setConcisenessAction: (val: 'ALLOW' | 'FLAG' | 'BLOCK' | 'REVIEW' | 'REGENERATE') => void;
  concisenessFailureMode: 'BLOCK' | 'ALLOW' | 'REVIEW';
  setConcisenessFailureMode: (val: 'BLOCK' | 'ALLOW' | 'REVIEW') => void;
  racialBiasEnabled: boolean;
  setRacialBiasEnabled: (val: boolean) => void;
  racialBiasProvider: string;
  setRacialBiasProvider: (val: string) => void;
  racialBiasThreshold: number;
  setRacialBiasThreshold: (val: number) => void;
  racialBiasAction: 'ALLOW' | 'FLAG' | 'BLOCK' | 'REVIEW' | 'REGENERATE';
  setRacialBiasAction: (val: 'ALLOW' | 'FLAG' | 'BLOCK' | 'REVIEW' | 'REGENERATE') => void;
  racialBiasFailureMode: 'BLOCK' | 'ALLOW' | 'REVIEW';
  setRacialBiasFailureMode: (val: 'BLOCK' | 'ALLOW' | 'REVIEW') => void;
  savingRules: boolean;
  rulesSaveOk: boolean;
  rulesSaveErr: string;
  onSave: () => Promise<void>;
}

const ALL_PII_ENTITIES = [
  'EMAIL_ADDRESS',
  'PHONE_NUMBER',
  'PERSON',
  'ADDRESS',
  'IN_AADHAAR',
  'IN_PAN'
];

const ALL_TOXICITY_CATEGORIES = [
  'toxicity',
  'severe_toxicity',
  'insult',
  'threat',
  'identity_hate',
  'obscene',
  'profanity'
];

function ProviderLogoMark({ provider }: { provider: string }) {
  const p = provider.toLowerCase();
  if (p.includes('anthropic')) {
    return (
      <div className="w-6 h-6 rounded flex items-center justify-center bg-amber-500/10 text-amber-600 font-mono text-[10px] font-bold border border-amber-300/40">
        ANT
      </div>
    );
  }
  if (p.includes('meta')) {
    return (
      <div className="w-6 h-6 rounded flex items-center justify-center bg-blue-500/10 text-blue-600 font-mono text-[10px] font-bold border border-blue-300/40">
        META
      </div>
    );
  }
  if (p.includes('mistral')) {
    return (
      <div className="w-6 h-6 rounded flex items-center justify-center bg-orange-500/10 text-orange-600 font-mono text-[10px] font-bold border border-orange-300/40">
        MIST
      </div>
    );
  }
  if (p.includes('amazon')) {
    return (
      <div className="w-6 h-6 rounded flex items-center justify-center bg-emerald-500/10 text-emerald-600 font-mono text-[10px] font-bold border border-emerald-300/40">
        AWS
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded flex items-center justify-center bg-slate-500/10 text-slate-600 font-mono text-[10px] font-bold border border-slate-300/40">
      {provider.slice(0, 3).toUpperCase()}
    </div>
  );
}

function SensitivitySlider({
  label,
  value,
  min = 0.3,
  max = 0.95,
  step = 0.05,
  onChange,
  hint
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  hint?: string;
}) {
  const percentage = Math.max(0, Math.min(100, Math.round(((value - min) / (max - min)) * 100)));
  const getDescriptor = (v: number) => {
    if (v >= 0.8) return { label: 'Strict Enforcement', color: 'text-rose-700 bg-rose-50 border-rose-200' };
    if (v >= 0.65) return { label: 'Balanced Policy', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    return { label: 'Lenient / Permissive', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  };
  const desc = getDescriptor(value);

  return (
    <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-800">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${desc.color}`}>
            {desc.label}
          </span>
          <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
            {value.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="relative flex items-center py-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
          style={{
            background: `linear-gradient(to right, #2563eb 0%, #2563eb ${percentage}%, #cbd5e1 ${percentage}%, #cbd5e1 100%)`
          }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
        <button
          type="button"
          onClick={() => onChange(0.5)}
          className={`hover:text-slate-900 cursor-pointer transition ${Math.abs(value - 0.5) < 0.04 ? 'font-bold text-blue-600' : ''}`}
        >
          0.50 Lenient
        </button>
        <button
          type="button"
          onClick={() => onChange(0.7)}
          className={`hover:text-slate-900 cursor-pointer transition ${Math.abs(value - 0.7) < 0.04 ? 'font-bold text-blue-600' : ''}`}
        >
          0.70 Balanced
        </button>
        <button
          type="button"
          onClick={() => onChange(0.85)}
          className={`hover:text-slate-900 cursor-pointer transition ${Math.abs(value - 0.85) < 0.04 ? 'font-bold text-blue-600' : ''}`}
        >
          0.85 Strict
        </button>
      </div>

      {hint && <p className="text-[11px] text-slate-500 leading-snug">{hint}</p>}
    </div>
  );
}

export function GuardrailConfigModal(props: GuardrailConfigModalProps) {
  const {
    isOpen,
    onClose,
    allModels,
    allowedBedrockIds,
    setAllowedBedrockIds,
    maxInputTokens,
    setMaxInputTokens,
    maxOutputTokens,
    setMaxOutputTokens,
    maxTotalTokens,
    setMaxTotalTokens,
    rateLimitRpm,
    setRateLimitRpm,
    dailyTokenQuota,
    setDailyTokenQuota,
    piiEnabled,
    setPiiEnabled,
    piiScanInput,
    setPiiScanInput,
    piiScanOutput,
    setPiiScanOutput,
    piiAction,
    setPiiAction,
    piiEntities,
    setPiiEntities,
    toxicityEnabled,
    setToxicityEnabled,
    toxicityScanInput,
    setToxicityScanInput,
    toxicityScanOutput,
    setToxicityScanOutput,
    toxicityAction,
    setToxicityAction,
    toxicityThreshold,
    setToxicityThreshold,
    toxicityCategories,
    setToxicityCategories,
    injectionEnabled,
    setInjectionEnabled,
    injectionThreshold,
    setInjectionThreshold,
    injectionAction,
    setInjectionAction,
    hallucinationEnabled,
    setHallucinationEnabled,
    hallucinationProvider,
    setHallucinationProvider,
    hallucinationAction,
    setHallucinationAction,
    hallucinationThreshold,
    setHallucinationThreshold,
    hallucinationFailureMode,
    setHallucinationFailureMode,
    concisenessEnabled,
    setConcisenessEnabled,
    concisenessMaxWords,
    setConcisenessMaxWords,
    concisenessMaxCharacters,
    setConcisenessMaxCharacters,
    concisenessMaxSentences,
    setConcisenessMaxSentences,
    concisenessLength,
    setConcisenessLength,
    concisenessAction,
    setConcisenessAction,
    concisenessFailureMode,
    setConcisenessFailureMode,
    racialBiasEnabled,
    setRacialBiasEnabled,
    racialBiasProvider,
    setRacialBiasProvider,
    racialBiasThreshold,
    setRacialBiasThreshold,
    racialBiasAction,
    setRacialBiasAction,
    racialBiasFailureMode,
    setRacialBiasFailureMode,
    savingRules,
    rulesSaveOk,
    rulesSaveErr,
    onSave
  } = props;

  const [activeNav, setActiveNav] = useState<'MODELS' | 'INPUT_GUARDRAILS' | 'OUTPUT_GUARDRAILS' | 'BUDGETS'>('MODELS');
  const [modelSearch, setModelSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('ALL');

  const uniqueProviders = useMemo(() => {
    const set = new Set<string>();
    allModels.forEach(m => {
      if (m.provider) set.add(m.provider);
    });
    return Array.from(set).sort();
  }, [allModels]);

  const filteredModels = useMemo(() => {
    return allModels.filter(m => {
      const matchSearch =
        !modelSearch.trim() ||
        m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.providerModelId.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.provider.toLowerCase().includes(modelSearch.toLowerCase());
      const matchProvider = selectedProvider === 'ALL' || m.provider.toLowerCase() === selectedProvider.toLowerCase();
      return matchSearch && matchProvider;
    });
  }, [allModels, modelSearch, selectedProvider]);

  const activeGuardrailCount = [
    piiEnabled,
    toxicityEnabled,
    injectionEnabled,
    hallucinationEnabled,
    concisenessEnabled,
    racialBiasEnabled
  ].filter(Boolean).length;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6"
      style={{
        background: 'rgba(9, 14, 26, 0.72)',
        backdropFilter: 'blur(8px)',
        animation: 'cs-fade-slide-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-5xl h-[88vh] max-h-[820px] flex flex-col shadow-2xl border border-slate-200/80 overflow-hidden"
        style={{
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.06)'
        }}
      >
        {/* ── Top Bar ── */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                  Policy Governance & Model Pool
                </h3>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                  org.bedrock.policy
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure candidate routing models, active threat detection, and context boundaries.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{allowedBedrockIds.length} Models Active</span>
              <span className="text-slate-300">|</span>
              <span>{activeGuardrailCount} Guardrails</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Main Two-Column Layout ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar Navigation */}
          <div className="w-60 border-r border-slate-100 bg-slate-50/40 p-3 flex flex-col gap-1 select-none">
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Control Planes
            </div>

            <button
              type="button"
              onClick={() => setActiveNav('MODELS')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeNav === 'MODELS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Cpu size={15} />
                <span>Allowed Models</span>
              </div>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                  activeNav === 'MODELS' ? 'bg-blue-700 text-white' : 'bg-slate-200/60 text-slate-600'
                }`}
              >
                {allowedBedrockIds.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('INPUT_GUARDRAILS')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeNav === 'INPUT_GUARDRAILS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={15} />
                <span>Input Guardrails</span>
              </div>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                  activeNav === 'INPUT_GUARDRAILS' ? 'bg-blue-700 text-white' : 'bg-slate-200/60 text-slate-600'
                }`}
              >
                {[piiEnabled, toxicityEnabled, injectionEnabled].filter(Boolean).length}/3
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('OUTPUT_GUARDRAILS')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeNav === 'OUTPUT_GUARDRAILS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileCheck2 size={15} />
                <span>Output Guardrails</span>
              </div>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                  activeNav === 'OUTPUT_GUARDRAILS' ? 'bg-blue-700 text-white' : 'bg-slate-200/60 text-slate-600'
                }`}
              >
                {[hallucinationEnabled, concisenessEnabled, racialBiasEnabled].filter(Boolean).length}/3
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('BUDGETS')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeNav === 'BUDGETS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sliders size={15} />
                <span>Token Limits & RPM</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">Quota</span>
            </button>

            <div className="mt-auto p-3 bg-slate-100/70 rounded-xl border border-slate-200/70 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
                <Lock size={12} className="text-slate-600" />
                <span>Tenant Isolation</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Policies persist directly into Supabase under your unique organization ID.
              </p>
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">

            {/* ════════ VIEW 1: ALLOWED MODELS ════════ */}
            {activeNav === 'MODELS' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Bedrock Foundation Candidate Pool</h4>
                    <p className="text-xs text-slate-500">Only models checked here can be selected by the routing engine.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAllowedBedrockIds(allModels.map(m => m.providerModelId))}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    >
                      Select All ({allModels.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (allModels[0]) setAllowedBedrockIds([allModels[0].providerModelId]);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                    >
                      Reset Single
                    </button>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={e => setModelSearch(e.target.value)}
                      placeholder="Filter models by name or family (e.g., Claude, Llama 3.3, Nova)..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setSelectedProvider('ALL')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition ${
                        selectedProvider === 'ALL'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All Providers
                    </button>
                    {uniqueProviders.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedProvider(p)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition ${
                          selectedProvider === p
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Models List Table-like Card Stack */}
                <div className="border border-slate-200/80 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {filteredModels.map(m => {
                    const isSelected = allowedBedrockIds.includes(m.providerModelId);
                    return (
                      <div
                        key={m.providerModelId}
                        onClick={() => {
                          if (isSelected) {
                            if (allowedBedrockIds.length > 1) {
                              setAllowedBedrockIds(allowedBedrockIds.filter(x => x !== m.providerModelId));
                            }
                          } else {
                            setAllowedBedrockIds([...allowedBedrockIds, m.providerModelId]);
                          }
                        }}
                        className={`px-4 py-3 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                          isSelected ? 'bg-slate-50/70 hover:bg-slate-100/60' : 'bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ProviderLogoMark provider={m.provider} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 truncate">{m.name}</span>
                              <span className="font-mono text-[10px] text-slate-400 truncate hidden md:inline">
                                {m.providerModelId}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-medium text-slate-500">{m.provider}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono text-[11px] text-slate-500">
                                {m.contextWindow || '128K tokens'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold ${
                              isSelected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {isSelected ? 'PERMITTED' : 'EXCLUDED'}
                          </span>
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ════════ VIEW 2: INPUT GUARDRAILS ════════ */}
            {activeNav === 'INPUT_GUARDRAILS' && (
              <div className="space-y-6">
                <div className="pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900">Pre-Execution Input Guardrails</h4>
                  <p className="text-xs text-slate-500">
                    Scans incoming user prompts prior to ML profiling and Bedrock model dispatch.
                  </p>
                </div>

                {/* PII Guardrail */}
                <div className="border border-slate-200/90 rounded-xl p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          PII Redaction & Masking
                        </span>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          Presidio Engine
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Detects sensitive personal data in user prompts and sanitizes them before routing.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPiiEnabled(!piiEnabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        piiEnabled ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          piiEnabled ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {piiEnabled && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            Action on PII Detection
                          </label>
                          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                            {(['MASK', 'BLOCK', 'ALLOW'] as const).map(act => (
                              <button
                                key={act}
                                type="button"
                                onClick={() => setPiiAction(act)}
                                className={`text-[11px] font-bold py-1 rounded-md transition ${
                                  piiAction === act ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                {act}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            Execution Stages
                          </label>
                          <div className="flex items-center gap-4 mt-2">
                            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={piiScanInput}
                                onChange={e => setPiiScanInput(e.target.checked)}
                                className="rounded border-slate-300 text-slate-900 focus:ring-0"
                              />
                              <span>Prompt Input</span>
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={piiScanOutput}
                                onChange={e => setPiiScanOutput(e.target.checked)}
                                className="rounded border-slate-300 text-slate-900 focus:ring-0"
                              />
                              <span>Model Output</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                          Active Entity Recognizers:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_PII_ENTITIES.map(ent => {
                            const isSel = piiEntities.includes(ent);
                            return (
                              <button
                                key={ent}
                                type="button"
                                onClick={() => {
                                  setPiiEntities(isSel ? piiEntities.filter(x => x !== ent) : [...piiEntities, ent]);
                                }}
                                className={`font-mono text-[10px] font-medium px-2 py-0.5 rounded border transition ${
                                  isSel
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {ent}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prompt Injection Guardrail */}
                <div className="border border-slate-200/90 rounded-xl p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Prompt Injection & Jailbreak Defense
                        </span>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          ProtectAI DeBERTa-v3
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Detects instruction override attacks, system prompt leaks, and jailbreak payloads.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInjectionEnabled(!injectionEnabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        injectionEnabled ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          injectionEnabled ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {injectionEnabled && (
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Enforcement Action
                        </label>
                        <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg">
                          {(['FLAG', 'BLOCK', 'REVIEW', 'ALLOW'] as const).map(act => (
                            <button
                              key={act}
                              type="button"
                              onClick={() => setInjectionAction(act)}
                              className={`text-[10px] font-bold py-1 rounded-md transition ${
                                injectionAction === act ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {act}
                            </button>
                          ))}
                        </div>
                      </div>

                      <SensitivitySlider
                          label="Classifier Threshold"
                          value={injectionThreshold}
                          min={0.5}
                          max={0.95}
                          step={0.05}
                          onChange={setInjectionThreshold}
                          hint="Higher values require stronger adversarial signal before blocking."
                        />
                    </div>
                  )}
                </div>

                {/* Toxicity Guardrail */}
                <div className="border border-slate-200/90 rounded-xl p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Toxicity & Harmful Language
                        </span>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          Detoxify Transformer
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Scores threats, hate speech, severe insults, obscenity, and profanity.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setToxicityEnabled(!toxicityEnabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        toxicityEnabled ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          toxicityEnabled ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {toxicityEnabled && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            Action
                          </label>
                          <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg">
                            {(['FLAG', 'BLOCK', 'REGENERATE', 'ALLOW'] as const).map(act => (
                              <button
                                key={act}
                                type="button"
                                onClick={() => setToxicityAction(act)}
                                className={`text-[10px] font-bold py-1 rounded-md transition ${
                                  toxicityAction === act ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                {act === 'REGENERATE' ? 'RETRY' : act}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <SensitivitySlider
                              label="Toxicity Sensitivity"
                              value={toxicityThreshold}
                              min={0.3}
                              max={0.95}
                              step={0.05}
                              onChange={setToxicityThreshold}
                              hint="Lower values flag more content; higher values only flag severe toxicity."
                            />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-700">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={toxicityScanInput}
                            onChange={e => setToxicityScanInput(e.target.checked)}
                            className="rounded border-slate-300 text-slate-900"
                          />
                          <span>Scan Input Prompt</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={toxicityScanOutput}
                            onChange={e => setToxicityScanOutput(e.target.checked)}
                            className="rounded border-slate-300 text-slate-900"
                          />
                          <span>Scan Output Response</span>
                        </label>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                          Monitored Toxicity Categories:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_TOXICITY_CATEGORIES.map(cat => {
                            const isSel = toxicityCategories.includes(cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                  setToxicityCategories(
                                    isSel ? toxicityCategories.filter(x => x !== cat) : [...toxicityCategories, cat]
                                  );
                                }}
                                className={`font-mono text-[10px] font-medium px-2 py-0.5 rounded border transition ${
                                  isSel
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {cat}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════ VIEW 3: OUTPUT GUARDRAILS ════════ */}
            {activeNav === 'OUTPUT_GUARDRAILS' && (
              <div className="space-y-6">
                <div className="pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900">Post-Execution Output Guardrails</h4>
                  <p className="text-xs text-slate-500">
                    Runs after Bedrock model generation to enforce factual grounding, conciseness, and fairness.
                  </p>
                </div>

                {/* Hallucination Guardrail */}
                <div className="border border-slate-200/90 rounded-xl p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Evidence-Grounded Hallucination Detection
                        </span>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          Grounding Verifier
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Cross-examines model assertions against supplied reference documents to detect ungrounded claims.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setHallucinationEnabled(!hallucinationEnabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        hallucinationEnabled ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          hallucinationEnabled ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {hallucinationEnabled && (
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Grounding Provider
                        </label>
                        <select
                          value={hallucinationProvider}
                          onChange={e => setHallucinationProvider(e.target.value)}
                          className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                        >
                          <option value="limited_evidence">Limited Evidence (Local)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Action
                        </label>
                        <select
                          value={hallucinationAction}
                          onChange={e => setHallucinationAction(e.target.value as typeof hallucinationAction)}
                          className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                        >
                          <option value="FLAG">FLAG (Include findings in response)</option>
                          <option value="REGENERATE">REGENERATE (1-Shot grounded retry)</option>
                          <option value="REVIEW">REVIEW (Escalate to Human Queue)</option>
                          <option value="BLOCK">BLOCK (Reject response)</option>
                          <option value="ALLOW">ALLOW (Report metrics)</option>
                        </select>
                      </div>

                      <SensitivitySlider
                          label="Confidence Cutoff"
                          value={hallucinationThreshold}
                          min={0.5}
                          max={0.95}
                          step={0.05}
                          onChange={setHallucinationThreshold}
                          hint="Minimum grounding confidence required before the claim is considered verified."
                        />

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Failure Fallback
                        </label>
                        <select
                          value={hallucinationFailureMode}
                          onChange={e => setHallucinationFailureMode(e.target.value as typeof hallucinationFailureMode)}
                          className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                        >
                          <option value="BLOCK">BLOCK (Fail-closed)</option>
                          <option value="REVIEW">REVIEW (Escalate to queue)</option>
                          <option value="ALLOW">ALLOW (Allow with warning)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Conciseness Guardrail */}
                <div className="border border-slate-200/90 rounded-xl p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Conciseness & Repetition Limits
                        </span>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          Deterministic NLP
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Enforces word, character, and sentence bounds while detecting duplicated sentences.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConcisenessEnabled(!concisenessEnabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        concisenessEnabled ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          concisenessEnabled ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {concisenessEnabled && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600 block mb-1">Max Words</label>
                          <input
                            type="number"
                            value={concisenessMaxWords}
                            onChange={e => setConcisenessMaxWords(Number(e.target.value))}
                            className="w-full text-xs font-mono font-semibold p-1.5 border border-slate-200 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600 block mb-1">Max Chars</label>
                          <input
                            type="number"
                            value={concisenessMaxCharacters}
                            onChange={e => setConcisenessMaxCharacters(Number(e.target.value))}
                            className="w-full text-xs font-mono font-semibold p-1.5 border border-slate-200 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600 block mb-1">Max Sentences</label>
                          <input
                            type="number"
                            value={concisenessMaxSentences}
                            onChange={e => setConcisenessMaxSentences(Number(e.target.value))}
                            className="w-full text-xs font-mono font-semibold p-1.5 border border-slate-200 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600 block mb-1">Length Preset</label>
                          <select
                            value={concisenessLength}
                            onChange={e => setConcisenessLength(e.target.value as typeof concisenessLength)}
                            className="w-full text-xs font-semibold p-1.5 border border-slate-200 rounded-md"
                          >
                            <option value="SHORT">SHORT</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LONG">LONG</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Action</label>
                          <select
                            value={concisenessAction}
                            onChange={e => setConcisenessAction(e.target.value as typeof concisenessAction)}
                            className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2"
                          >
                            <option value="FLAG">FLAG (Record metrics & continue)</option>
                            <option value="REGENERATE">REGENERATE (Prompt model to condense)</option>
                            <option value="REVIEW">REVIEW (Escalate to Human Queue)</option>
                            <option value="BLOCK">BLOCK (Block response)</option>
                            <option value="ALLOW">ALLOW (Report metrics)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Failure Fallback</label>
                          <select
                            value={concisenessFailureMode}
                            onChange={e => setConcisenessFailureMode(e.target.value as typeof concisenessFailureMode)}
                            className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2"
                          >
                            <option value="BLOCK">BLOCK (Fail-closed)</option>
                            <option value="REVIEW">REVIEW (Escalate to queue)</option>
                            <option value="ALLOW">ALLOW (Allow with warning)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Racial Bias Guardrail */}
                <div className="border border-slate-200/90 rounded-xl p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Fairness & Bias Baseline
                        </span>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          Context-Aware Baseline
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Detects demographic group generalizations while preserving educational/historical context.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setRacialBiasEnabled(!racialBiasEnabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        racialBiasEnabled ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          racialBiasEnabled ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {racialBiasEnabled && (
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Fairness Provider
                        </label>
                        <select
                          value={racialBiasProvider}
                          onChange={e => setRacialBiasProvider(e.target.value)}
                          className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2"
                        >
                          <option value="conservative_baseline">Conservative Baseline</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Enforcement Action
                        </label>
                        <select
                          value={racialBiasAction}
                          onChange={e => setRacialBiasAction(e.target.value as typeof racialBiasAction)}
                          className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2"
                        >
                          <option value="FLAG">FLAG (Include findings in response)</option>
                          <option value="REGENERATE">REGENERATE (1-Shot debiasing retry)</option>
                          <option value="REVIEW">REVIEW (Escalate to Review Queue)</option>
                          <option value="BLOCK">BLOCK (Block response)</option>
                          <option value="ALLOW">ALLOW (Report metrics)</option>
                        </select>
                      </div>

                      <SensitivitySlider
                          label="Threshold Cutoff"
                          value={racialBiasThreshold}
                          min={0.5}
                          max={0.95}
                          step={0.05}
                          onChange={setRacialBiasThreshold}
                          hint="Confidence required before a demographic generalization is flagged."
                        />

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Failure Fallback
                        </label>
                        <select
                          value={racialBiasFailureMode}
                          onChange={e => setRacialBiasFailureMode(e.target.value as typeof racialBiasFailureMode)}
                          className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2"
                        >
                          <option value="BLOCK">BLOCK (Fail-closed)</option>
                          <option value="REVIEW">REVIEW (Escalate to queue)</option>
                          <option value="ALLOW">ALLOW (Allow with warning)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════ VIEW 4: TOKEN LIMITS & RPM ════════ */}
            {activeNav === 'BUDGETS' && (
              <div className="space-y-6">
                <div className="pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900">Context Window & Rate Limiting</h4>
                  <p className="text-xs text-slate-500">
                    Define strict maximum token envelopes and request quotas per organization.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider font-mono">
                      Max Input Tokens
                    </span>
                    <input
                      type="number"
                      value={maxInputTokens}
                      onChange={e => setMaxInputTokens(Number(e.target.value))}
                      className="w-full text-base font-mono font-bold p-2 bg-white border border-slate-200 rounded-lg"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">{(maxInputTokens / 1000).toFixed(0)}K tokens limit</span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider font-mono">
                      Max Output Tokens
                    </span>
                    <input
                      type="number"
                      value={maxOutputTokens}
                      onChange={e => setMaxOutputTokens(Number(e.target.value))}
                      className="w-full text-base font-mono font-bold p-2 bg-white border border-slate-200 rounded-lg"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">{(maxOutputTokens / 1000).toFixed(1)}K tokens limit</span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider font-mono">
                      Max Combined Total
                    </span>
                    <input
                      type="number"
                      value={maxTotalTokens}
                      onChange={e => setMaxTotalTokens(Number(e.target.value))}
                      className="w-full text-base font-mono font-bold p-2 bg-white border border-slate-200 rounded-lg"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">{(maxTotalTokens / 1000).toFixed(0)}K tokens limit</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider font-mono">
                      Rate Limit (RPM)
                    </span>
                    <input
                      type="number"
                      value={rateLimitRpm}
                      onChange={e => setRateLimitRpm(Number(e.target.value))}
                      className="w-full text-base font-mono font-bold p-2 bg-white border border-slate-200 rounded-lg"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Max requests allowed per minute per org</span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider font-mono">
                      Daily Token Budget
                    </span>
                    <input
                      type="number"
                      value={dailyTokenQuota}
                      onChange={e => setDailyTokenQuota(Number(e.target.value))}
                      className="w-full text-base font-mono font-bold p-2 bg-white border border-slate-200 rounded-lg"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">{(dailyTokenQuota / 1000000).toFixed(1)}M tokens per 24 hours</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div>
            {rulesSaveOk && (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Active governance policy saved successfully.
              </span>
            )}
            {rulesSaveErr && (
              <span className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                <AlertCircle size={14} /> {rulesSaveErr}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={savingRules}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              {savingRules ? (
                <>
                  <span className="cs-spinner w-3 h-3 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={13} />
                  Save Active Policy
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
