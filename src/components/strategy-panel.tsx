"use client";
import { BrainCircuit, CheckCircle2, CircleX, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { STRATEGIES,type StrategyDecision,type StrategyMode } from '@/lib/strategy-engine';
export default function StrategyPanel({decision,mode,timeframe,disabled,onMode,onTimeframe}:{decision:StrategyDecision|null;mode:StrategyMode;timeframe:number;disabled:boolean;onMode:(v:StrategyMode)=>void;onTimeframe:(v:number)=>void}){
  return <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-sm font-semibold"><BrainCircuit size={18} className="text-cyan-300"/>Motor adaptativo · lógica explicável</h2><p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">Identifica o contexto e só entra quando as condições de uma hipótese passam. Ficar fora do mercado também é uma decisão.</p></div>
      <Link href="/laboratorio" className="flex items-center gap-2 text-xs text-cyan-300 hover:text-white">Testar no histórico<ExternalLink size={13}/></Link>
    </div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-slate-400">Modo de decisão<select aria-label="Modo de estratégia" disabled={disabled} value={mode} onChange={e=>onMode(e.target.value as StrategyMode)} className="mt-2 w-full rounded-lg border border-slate-700 bg-[#080e19] p-3 text-sm text-white outline-none focus:border-cyan-500 disabled:opacity-50"><option value="auto">Automático · adaptar ao regime</option>{STRATEGIES.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="text-xs text-slate-400">Intervalo de decisão<select aria-label="Timeframe do motor" disabled={disabled} value={timeframe} onChange={e=>onTimeframe(Number(e.target.value))} className="mt-2 w-full rounded-lg border border-slate-700 bg-[#080e19] p-3 text-sm text-white outline-none focus:border-cyan-500 disabled:opacity-50"><option value={3600}>1 hora · mesmo intervalo do laboratório</option><option value={60}>1 minuto · hipótese ainda não avaliada no laboratório</option></select></label>
    </div>
    <div className="mb-4 grid grid-cols-3 gap-3 border-y border-slate-800 py-4">
      <div><p className="text-[10px] tracking-wider text-slate-500">REGIME</p><p className="mt-1 font-mono text-sm text-white">{decision?.regime||'AGUARDANDO'}</p></div>
      <div><p className="text-[10px] tracking-wider text-slate-500">CONFLUÊNCIA · NÃO CHANCE</p><p className="mt-1 font-mono text-sm text-cyan-300">{decision?`${decision.score}/100`:'—'}</p></div>
      <div><p className="text-[10px] tracking-wider text-slate-500">SINAL · ANTES DE CUSTOS</p><p className={`mt-1 font-mono text-sm ${decision?.action==='BUY'?'text-emerald-300':'text-amber-200'}`}>{decision?.action==='BUY'?'CANDIDATO':'AGUARDAR'}</p></div>
    </div>
    <p className="mb-4 text-sm leading-relaxed text-slate-300">{decision?.reason||'Carregando candles fechados. Sem dados suficientes, o motor não cria sinais.'}</p>
    <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">{decision?.checks.map((check,n)=><div key={`${check.label}-${n}`} className="flex items-start gap-2 text-xs">{check.passed?<CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-300"/>:<CircleX size={15} className="mt-0.5 shrink-0 text-slate-500"/>}<div><span className={check.passed?'text-slate-200':'text-slate-400'}>{check.label}</span><p className="mt-1 font-mono text-[11px] text-slate-500">{check.value}</p></div></div>)}</div>
    {decision?.features&&<div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-800 pt-4 font-mono text-[11px] text-slate-400"><span>RSI Wilder {decision.features.rsi.toFixed(1)}</span><span>ATR Wilder ${decision.features.atr.toFixed(4)}</span><span>Eficiência {decision.features.efficiency.toFixed(2)}</span><span>Volume {decision.features.volumeRatio.toFixed(2)}x</span></div>}
    <p className="mt-4 text-[11px] leading-relaxed text-slate-500">Entradas apenas no primeiro minuto após o candle fechar; uma entrada por candle. Spread, retorno/risco líquido ≥1,5 e limites da carteira ainda podem vetar um candidato. Nenhuma estratégia tem lucro comprovado.</p>
  </section>;
}
