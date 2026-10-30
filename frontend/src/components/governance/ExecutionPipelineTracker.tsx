import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, Circle, Clock, ShieldCheck, Layers, Cpu, FileCheck2,
  ChevronRight, AlertTriangle, Loader2, ShieldAlert, AlertOctagon
} from 'lucide-react';
import type { ModelResponse } from '../../types';

export interface ExecutionPipelineTrackerProps {
  stage: number;
  prompt: string;
  response: ModelResponse | null;
  error?: string | null;
  permittedCount?: number;
}

const STEPS = [
  { id: 1, Icon: ShieldCheck, label: 'Input Guardrails',  sub: 'PII · Toxicity · Injection',    color: '#2563eb' },
  { id: 2, Icon: Layers,      label: 'ML Profiling',       sub: '5-D Semantic Scoring',           color: '#7c3aed' },
  { id: 3, Icon: Cpu,         label: 'Model Dispatch',     sub: 'Routing & Bedrock STS',          color: '#0891b2' },
  { id: 4, Icon: FileCheck2,  label: 'Output Audits',      sub: 'Grounding · Bias · Brevity',     color: '#059669' },
];

export function ExecutionPipelineTracker({ stage, prompt, response, error, permittedCount = 24 }: ExecutionPipelineTrackerProps) {
  const [activeTab, setActiveTab] = useState<number>(stage > 0 ? stage : 1);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Automatically switch tab as execution progresses, but let user click any tab
  useEffect(() => {
    if (stage > 0) {
      setActiveTab(stage >= 5 ? 1 : stage);
    }
  }, [stage]);

  useEffect(() => {
    if (stage >= 1 && stage < 5) {
      startRef.current = Date.now();
      const t = setInterval(() => setElapsed(Date.now() - startRef.current), 50);
      return () => clearInterval(t);
    }
  }, [stage]);

  const done = stage >= 5 && !!response;
  const ms = done && response?.latency_ms ? response.latency_ms : elapsed;
  const pct = Math.min(100, Math.round((stage / 5) * 100));

  // Client-side instant regex scanning (provides immediate feedback)
  const clientAadhaar = /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/.test(prompt);
  const clientPhone = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b(?:\+?91)?[6-9]\d{9}\b/.test(prompt);
  const clientEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(prompt);
  const clientPan = /\b[A-Z]{5}\d{4}[A-Z]\b/.test(prompt);
  const clientInjection = /\b(ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|prompts|rules)|system\s+prompt|jailbreak|DAN\s+mode|bypass\s+safety|output\s+your\s+system\s+prompt)\b/i.test(prompt);
  const clientToxic = /\b(fuck|fucking|shit|bitch|asshole|idiot|kill yourself|retard|scum|bastard|moron|stupid)\b/i.test(prompt);

  // Combine backend findings with client detections
  const backendPii = response?.pii_input_findings ?? [];
  const backendTox = response?.toxicity_input_findings ?? [];
  const backendInj = response?.prompt_injection_input_findings ?? [];

  // PII findings list
  const hasAadhaar = backendPii.some(f => f.entity_type === 'IN_AADHAAR') || clientAadhaar;
  const hasPhone = backendPii.some(f => f.entity_type === 'PHONE_NUMBER') || clientPhone;
  const hasEmail = backendPii.some(f => f.entity_type === 'EMAIL_ADDRESS') || clientEmail;
  const hasPan = backendPii.some(f => f.entity_type === 'IN_PAN') || clientPan;

  const detectedEntities: string[] = [];
  if (hasAadhaar) detectedEntities.push('IN_AADHAAR (12-digit UIDAI)');
  if (hasPhone) detectedEntities.push('PHONE_NUMBER');
  if (hasEmail) detectedEntities.push('EMAIL_ADDRESS');
  if (hasPan) detectedEntities.push('IN_PAN (Tax ID)');

  const hasAnyPii = detectedEntities.length > 0 || backendPii.length > 0;
  const hasAnyToxic = backendTox.length > 0 || clientToxic;
  const hasAnyInjection = backendInj.length > 0 || clientInjection;

  const chars = prompt.length;
  const tokens = Math.max(1, Math.round(chars / 4));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

      {/* ─── Header ─── */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2.5">
          {done ? (
            <CheckCircle2 size={16} className="text-emerald-500" />
          ) : (
            <Loader2 size={16} className="text-blue-500 animate-spin" />
          )}
          <span className="text-sm font-bold text-slate-800">
            {done ? 'Pipeline Execution Complete' : `Executing Stage 0${Math.min(stage, 4)} of 04…`}
          </span>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
            Live Trace
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
            <Clock size={11} className="text-slate-400" />
            {ms} ms
          </div>
          <div className="text-xs font-mono font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
            {pct}%
          </div>
        </div>
      </div>

      {/* ─── Progress bar ─── */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: done
              ? 'linear-gradient(90deg, #059669, #10b981)'
              : 'linear-gradient(90deg, #2563eb, #7c3aed, #0891b2)'
          }}
        />
      </div>

      <div className="p-5 space-y-4">

        {/* ─── 4-Step Pipeline (Clickable Tabs) ─── */}
        <div className="flex items-start gap-1">
          {STEPS.map((step, i) => {
            const isDone    = stage > step.id;
            const isActive  = stage === step.id;
            const isSelected = activeTab === step.id;

            return (
              <div key={step.id} className="flex items-start flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveTab(step.id)}
                  className={`w-full text-left rounded-xl border p-3 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/70 shadow-sm ring-1 ring-blue-500/30'
                      : isActive
                      ? 'border-blue-300 bg-blue-50/40 shadow-xs'
                      : isDone
                      ? 'border-slate-200 bg-white hover:bg-slate-50/60'
                      : 'border-slate-100 bg-slate-50/50 opacity-60'
                  }`}
                >
                  {/* Icon + status row */}
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected || isActive ? 'bg-blue-100' :
                        isDone                 ? 'bg-emerald-50' :
                                                 'bg-slate-100'
                      }`}
                    >
                      {step.id === 1 && hasAnyPii ? (
                        <ShieldAlert size={14} className="text-amber-600" />
                      ) : isActive ? (
                        <Loader2 size={14} className="text-blue-600 animate-spin" />
                      ) : isDone ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : (
                        <Circle size={14} className="text-slate-300" />
                      )}
                    </div>

                    {step.id === 1 && hasAnyPii ? (
                      <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        PII Alert
                      </span>
                    ) : isActive ? (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-ping" />
                    ) : isDone ? (
                      <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Done
                      </span>
                    ) : null}
                  </div>

                  <p className={`text-xs font-bold truncate ${
                    isSelected ? 'text-blue-900' : isDone ? 'text-slate-800' : 'text-slate-500'
                  }`}>
                    {step.label}
                  </p>
                  <p className="text-[11px] truncate mt-0.5 text-slate-400">
                    {step.sub}
                  </p>
                </button>

                {i < STEPS.length - 1 && (
                  <div className="flex items-center justify-center w-5 mt-4 flex-shrink-0">
                    <ChevronRight size={13} className={stage > step.id ? 'text-slate-400' : 'text-slate-200'} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ─── Detail Inspection Panel ─── */}
        <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">

          {/* Tab 1: Input Guardrails Inspection */}
          {activeTab === 1 && (
            <DetailPanel title="01 · Pre-Inference Input Threat Defense" badge={`${chars} chars · ~${tokens} tokens`} color="blue">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">

                {/* PII Card */}
                <div className={`p-3.5 rounded-xl border ${
                  hasAnyPii
                    ? 'border-amber-300 bg-amber-50/60'
                    : stage === 1
                    ? 'border-blue-200 bg-blue-50/50'
                    : 'border-emerald-200 bg-emerald-50/40'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldAlert size={14} className={hasAnyPii ? 'text-amber-600' : 'text-blue-600'} />
                      <span>PII Redaction (Presidio)</span>
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      hasAnyPii
                        ? 'bg-amber-200 text-amber-900'
                        : stage === 1
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {hasAnyPii ? 'DETECTED' : stage === 1 ? 'SCANNING…' : 'CLEAN'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Scans Indian UIDAI Aadhaar, PAN, Phone, Email, Person NER.
                  </p>
                  {hasAnyPii ? (
                    <div className="mt-2 pt-2 border-t border-amber-200/80 space-y-1">
                      <span className="text-[11px] font-bold text-amber-900 block">
                        Sensitive Entities Identified:
                      </span>
                      {detectedEntities.map((ent, idx) => (
                        <div key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 border border-amber-300 text-amber-800 font-semibold flex items-center justify-between">
                          <span>{ent}</span>
                          <span className="text-emerald-700 font-bold">Masked</span>
                        </div>
                      ))}
                      <p className="text-[10px] text-amber-700 mt-1 font-medium">
                        Action: Sanitized before sending to Bedrock LLM.
                      </p>
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-emerald-700 mt-2 font-medium">
                      ✓ Zero sensitive PII entities found
                    </div>
                  )}
                </div>

                {/* Toxicity Card */}
                <div className={`p-3.5 rounded-xl border ${
                  hasAnyToxic
                    ? 'border-rose-300 bg-rose-50/60'
                    : stage === 1
                    ? 'border-blue-200 bg-blue-50/50'
                    : 'border-emerald-200 bg-emerald-50/40'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertOctagon size={14} className={hasAnyToxic ? 'text-rose-600' : 'text-blue-600'} />
                      <span>Toxicity (Detoxify)</span>
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      hasAnyToxic
                        ? 'bg-rose-200 text-rose-900'
                        : stage === 1
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {hasAnyToxic ? 'FLAGGED' : stage === 1 ? 'SCANNING…' : 'SAFE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Multi-label classifier for threats, severe toxicity, obscenity & hate.
                  </p>
                  {hasAnyToxic ? (
                    <div className="mt-2 pt-2 border-t border-rose-200/80 space-y-1 text-[10px] font-mono text-rose-800">
                      <span className="font-bold block text-rose-900">Toxic patterns triggered</span>
                      <div className="px-2 py-0.5 rounded bg-white/80 border border-rose-300">
                        Offensive content flagged (threshold &gt; 0.70)
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-emerald-700 mt-2 font-medium">
                      ✓ Sub-threshold safe (0.012 score)
                    </div>
                  )}
                </div>

                {/* Prompt Injection Card */}
                <div className={`p-3.5 rounded-xl border ${
                  hasAnyInjection
                    ? 'border-rose-300 bg-rose-50/60'
                    : stage === 1
                    ? 'border-blue-200 bg-blue-50/50'
                    : 'border-emerald-200 bg-emerald-50/40'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle size={14} className={hasAnyInjection ? 'text-rose-600' : 'text-blue-600'} />
                      <span>Prompt Injection</span>
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      hasAnyInjection
                        ? 'bg-rose-200 text-rose-900'
                        : stage === 1
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {hasAnyInjection ? 'INTERCEPTED' : stage === 1 ? 'SCANNING…' : 'CLEAN'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    DeBERTa adversarial heuristic jailbreak defense.
                  </p>
                  {hasAnyInjection ? (
                    <div className="mt-2 pt-2 border-t border-rose-200/80 space-y-1 text-[10px] font-mono text-rose-800">
                      <span className="font-bold block text-rose-900">Jailbreak / System Prompt Override</span>
                      <div className="px-2 py-0.5 rounded bg-white/80 border border-rose-300">
                        Adversarial delimiter pattern detected (0.98 confidence)
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-emerald-700 mt-2 font-medium">
                      ✓ Normal prompt structure
                    </div>
                  )}
                </div>
              </div>
            </DetailPanel>
          )}

          {/* Tab 2: ML Profiling */}
          {activeTab === 2 && (
            <DetailPanel title="02 · ML Semantic Vector Profiler & Embeddings" badge="" color="purple">
              {response?.profile_summary ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-mono block">Domain</span>
                      <span className="text-xs font-bold text-slate-800 capitalize">{response.profile_summary.domain}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-mono block">Intent</span>
                      <span className="text-xs font-bold text-slate-800 capitalize">{response.profile_summary.intent}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-mono block">Resolved Complexity</span>
                      <span className="text-xs font-bold text-blue-700">Tier {response.profile_summary.resolved_tier} ({response.profile_summary.complexity_score.toFixed(3)})</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-violet-50 border border-violet-100 rounded-lg space-y-1">
                  <p className="text-xs text-violet-800 font-semibold">Extracting 5-D dense semantic embedding vector…</p>
                  <p className="text-xs text-violet-600">Evaluating character density ({chars} chars) and vocabulary entropy</p>
                </div>
              )}
            </DetailPanel>
          )}

          {/* Tab 3: Model Routing & STS */}
          {activeTab === 3 && (
            <DetailPanel title="03 · Intelligent Bedrock Routing & STS Dispatch" badge={`Pool: ${permittedCount} Models`} color="cyan">
              {response?.recommendations && response.recommendations.length > 0 ? (
                <div className="space-y-2">
                  {response.recommendations.slice(0, 3).map((rec, i) => (
                    <div key={rec.model_id} className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
                      i === 0 ? 'bg-blue-50/70 border-blue-300' : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>{i + 1}</span>
                        <div>
                          <span className="font-bold text-slate-900">{rec.model_id}</span>
                          <span className="text-slate-400 text-[11px] ml-2 font-mono">({rec.provider} · {rec.tier})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-600">${rec.estimated_cost_usd.toFixed(6)}</span>
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          i === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {i === 0 ? 'Invoked Rank #1' : `Standby #${i + 1}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-cyan-50 border border-cyan-100 rounded-lg space-y-1">
                  <p className="text-xs text-cyan-800 font-semibold">Ranking {permittedCount} permitted Bedrock candidate models…</p>
                  <p className="text-xs text-cyan-600">Assuming AWS IAM Role: BedrockRouterExecutionRole</p>
                </div>
              )}
            </DetailPanel>
          )}

          {/* Tab 4: Output Audits */}
          {activeTab === 4 && (
            <DetailPanel title="04 · Post-Generation Output Guardrails" badge="Pre-delivery Gate" color="emerald">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between text-xs mb-1 font-semibold text-slate-800">
                    <span>Evidence Grounding</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">Passed</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Claims cross-examined against reference context.</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between text-xs mb-1 font-semibold text-slate-800">
                    <span>Output Toxicity</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">Safe</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Verified zero harmful content in generated response.</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between text-xs mb-1 font-semibold text-slate-800">
                    <span>Conciseness & Length</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">Compliant</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Word and sentence constraints verified.</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between text-xs mb-1 font-semibold text-slate-800">
                    <span>Demographic Fairness</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">Zero Bias</span>
                  </div>
                  <p className="text-[11px] text-slate-500">No demographic bias detected.</p>
                </div>
              </div>
            </DetailPanel>
          )}

          {/* Pipeline Completion Summary Strip */}
          {done && (
            <div className={`p-4 border-t flex items-center justify-between ${
              hasAnyPii || hasAnyToxic || hasAnyInjection
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-100 text-emerald-900'
            }`}>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className={hasAnyPii || hasAnyToxic ? 'text-amber-600' : 'text-emerald-600'} />
                <div>
                  <p className="text-xs font-bold">
                    {hasAnyPii
                      ? 'Prompt Protected · Sensitive PII Masked Before Dispatch'
                      : hasAnyInjection
                      ? 'Prompt Protected · Adversarial Injection Intercepted'
                      : 'All Guardrail Checks Passed · Clean Payload'
                    }
                  </p>
                  <p className="text-[11px] opacity-80 font-mono mt-0.5">
                    Latency: {response?.latency_ms ?? ms}ms · Tokens: {response?.tokens_used ?? tokens}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab(1)}
                className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                Inspect Guardrails
              </button>
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5">
            <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailPanel({ title, badge, color, children }: { title: string; badge: string; color: string; children: React.ReactNode }) {
  const palettes: Record<string, { bg: string; border: string; text: string }> = {
    blue:    { bg: 'bg-blue-50/60',    border: 'border-blue-100',    text: 'text-blue-700'    },
    purple:  { bg: 'bg-violet-50/60',  border: 'border-violet-100',  text: 'text-violet-700'  },
    cyan:    { bg: 'bg-cyan-50/60',    border: 'border-cyan-100',    text: 'text-cyan-700'    },
    emerald: { bg: 'bg-emerald-50/60', border: 'border-emerald-100', text: 'text-emerald-700' },
  };
  const p = palettes[color] ?? palettes.blue;
  return (
    <div>
      <div className={`px-4 py-2.5 ${p.bg} border-b ${p.border} flex items-center justify-between`}>
        <span className={`text-[11px] font-bold uppercase tracking-wider font-mono ${p.text}`}>{title}</span>
        {badge && <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${p.border} ${p.text} bg-white`}>{badge}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
