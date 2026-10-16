"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Zap,
  Activity,
  DollarSign,
  Lock,
  RefreshCw,
  Cpu,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  Maximize2,
  Terminal,
  Crosshair,
  Wifi,
  Sliders,
  Compass
} from "lucide-react";

export default function AstraEliteTradingTerminal() {
  const [symbol, setSymbol] = useState("BTC-USD");
  const [feed, setFeed] = useState<any>(null);
  const [feedLoading, setFeedLoading] = useState(false);

  // Meta diária configurável
  const [targetGoal, setTargetGoal] = useState<number>(25);
  const [dailyAccumulated, setDailyAccumulated] = useState<number>(0);
  const [lockedOut, setLockedOut] = useState<boolean>(false);

  // Análise GPT-6 Astra
  const [analyzing, setAnalyzing] = useState(false);
  const [intel, setIntel] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<string[]>([]);

  // 1. Atualização do Feed de Mercado
  const updateMarketData = async () => {
    setFeedLoading(true);
    try {
      const res = await fetch(`/api/market-feed?symbol=${symbol}`);
      const data = await res.json();
      if (data.success) {
        setFeed(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    updateMarketData();
    const interval = setInterval(updateMarketData, 6000);
    return () => clearInterval(interval);
  }, [symbol]);

  // 2. Disparo de Análise Institucional GPT-6 Astra
  const triggerAstraCopilot = async () => {
    if (lockedOut || !feed) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/astra-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          currentPrice: feed.price,
          vwap: feed.metrics?.vwap,
          rsi: feed.metrics?.rsi14,
          ema9: feed.metrics?.ema9,
          ema21: feed.metrics?.ema21,
          targetGoal,
        }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setIntel(data.analysis);
        setAuditLog((prev) => [
          `[${new Date().toLocaleTimeString()}] GPT-6 ASTRA confirmou: ${data.analysis.recommendation} | Bias: ${data.analysis.institutionalBias} (${data.analysis.probability}% prob)`,
          ...prev.slice(0, 6),
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  // 3. Simulação de Execução com Ganho Real de Meta
  const executeOrder = (type: "WIN" | "STOP") => {
    if (type === "WIN") {
      const profit = targetGoal;
      const nextTotal = dailyAccumulated + profit;
      setDailyAccumulated(nextTotal);
      setAuditLog((prev) => [
        `[${new Date().toLocaleTimeString()}] ✅ TAKE PROFIT EXECUTADO: +R$ ${profit},00! Total do dia: R$ ${nextTotal},00`,
        ...prev,
      ]);
      if (nextTotal >= targetGoal) {
        setLockedOut(true);
      }
    } else {
      const loss = 15;
      const nextTotal = dailyAccumulated - loss;
      setDailyAccumulated(nextTotal);
      setAuditLog((prev) => [
        `[${new Date().toLocaleTimeString()}] 🛑 STOP LOSS RESPEITADO: -R$ ${loss},00. Total do dia: R$ ${nextTotal},00`,
        ...prev,
      ]);
      if (Math.abs(nextTotal) >= 15 && nextTotal < 0) {
        setLockedOut(true);
      }
    }
    setIntel(null);
  };

  return (
    <div className="min-h-screen bg-[#06080f] text-slate-100 flex flex-col font-sans select-none">
      {/* HEADER DE ALTA FREQUÊNCIA INSTITUCIONAL */}
      <header className="h-14 border-b border-[#151c2c] bg-[#090d18] px-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Crosshair className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black text-sm tracking-wide text-white">ASTRA TERMINAL</span>
                <span className="text-[9px] bg-blue-500/20 text-blue-400 font-mono px-1.5 py-0.5 rounded border border-blue-500/30">v6.0 PRO</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">QUANTITATIVE DAY TRADE COPILOT</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[#151c2c]">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-[#0f1627] border border-[#1e293b] text-xs font-bold text-slate-200 px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="BTC-USD">BTC/USD (Bitcoin Spot)</option>
              <option value="ETH-USD">ETH/USD (Ethereum Spot)</option>
              <option value="SOL-USD">SOL/USD (Solana Spot)</option>
            </select>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 font-mono">
              <Wifi className="w-3 h-3 animate-pulse" /> LIVE COINBASE EXCHANGE
            </div>
          </div>
        </div>

        {/* STATUS DO DIA & TRAVA DE GANHO */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">Lucro Real Hoje</span>
            <span className={`text-base font-black font-mono leading-none ${dailyAccumulated >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              R$ {dailyAccumulated.toFixed(2)}
            </span>
          </div>

          <div className="h-7 w-px bg-[#151c2c]" />

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">Meta Alvo</span>
            <span className="text-base font-black font-mono text-white leading-none">
              R$ {targetGoal.toFixed(2)}
            </span>
          </div>

          {lockedOut && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 text-xs font-bold animate-bounce">
              <Lock className="w-3.5 h-3.5" /> META CONCLUÍDA
            </div>
          )}
        </div>
      </header>

      {/* PAINEL PRINCIPAL — GRID DE 3 COLUNAS ESTILO BLOOMBERG */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-[1600px] w-full mx-auto">
        {/* COLUNA 1 & 2: GRÁFICO, CANDLES E TELA INSTITUCIONAL */}
        <div className="lg:col-span-3 space-y-4 flex flex-col">
          {/* BARRA SUPERIOR DE COTAÇÕES EM TEMPO REAL */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[#0a0f1d] border border-[#151c2c] p-3.5 rounded-xl">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Preço Spot</span>
              <span className="text-xl font-black font-mono text-white">
                ${feed?.price?.toLocaleString() || "Carregando..."}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">VWAP Diária</span>
              <span className="text-xl font-black font-mono text-blue-400">
                ${feed?.metrics?.vwap?.toLocaleString() || "---"}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">IFR / RSI (14)</span>
              <span className={`text-xl font-black font-mono ${
                (feed?.metrics?.rsi14 || 50) < 35 ? "text-emerald-400" : (feed?.metrics?.rsi14 || 50) > 65 ? "text-rose-400" : "text-amber-400"
              }`}>
                {feed?.metrics?.rsi14 || "---"}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">EMA 9 / 21</span>
              <span className="text-xl font-black font-mono text-purple-400">
                ${feed?.metrics?.ema9?.toLocaleString() || "---"}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 flex flex-col justify-center">
              <button
                disabled={analyzing || lockedOut}
                onClick={triggerAstraCopilot}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Sondando Livro...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    CONSULTAR ASTRA AI
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SIMULADOR GRÁFICO DE CANDLESTICKS REAL */}
          <div className="flex-1 min-h-[300px] bg-[#090d18] border border-[#151c2c] rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
              <span className="font-mono flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" /> FLUXO DE CANDLES M5 — ÚLTIMAS HORAS
              </span>
              <span className="text-[11px] font-mono text-slate-500">Média Ponderada Institucional (VWAP)</span>
            </div>

            {/* Visualizador de Candles SVG */}
            <div className="flex-1 w-full flex items-end justify-between gap-1 py-4 px-2">
              {feed?.candles?.slice(-35).map((c: any, i: number) => {
                const isGreen = c.close >= c.open;
                const minPrice = feed?.low24h || 80000;
                const maxPrice = feed?.high24h || 85000;
                const range = maxPrice - minPrice || 1;
                const heightPercent = Math.max(10, Math.min(95, ((c.high - c.low) / range) * 500));
                
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-44 group relative">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-black/90 border border-slate-700 text-[10px] font-mono px-2 py-0.5 rounded text-white z-20 pointer-events-none whitespace-nowrap">
                      ${c.close.toFixed(1)}
                    </div>
                    {/* Pavio */}
                    <div className={`w-[1px] h-full ${isGreen ? "bg-emerald-500/60" : "bg-rose-500/60"}`} />
                    {/* Corpo do Candle */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[12px] rounded-sm ${isGreen ? "bg-emerald-500" : "bg-rose-500"}`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between text-[10px] text-slate-500 font-mono border-t border-[#151c2c] pt-2">
              <span>Abertura da Sessão</span>
              <span className="text-blue-400">Preço em Equilíbrio Institucional</span>
              <span>Tempo Real Agora</span>
            </div>
          </div>

          {/* PAINEL DE SINAL INSTITUCIONAL ASTRA (QUANDO DISPARADO) */}
          {intel && (
            <div className="bg-gradient-to-r from-[#0c1428] via-[#0e162d] to-[#0c1428] border-2 border-blue-500/60 rounded-xl p-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-300">
              <div className="flex flex-wrap justify-between items-start gap-4 pb-3 border-b border-[#1c2944]">
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-blue-400 uppercase font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> RECOMENDAÇÃO QUANTITATIVA DO GPT-6 ASTRA
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <h2 className={`text-2xl font-black ${
                      intel.recommendation === "STRONG_BUY" ? "text-emerald-400" : intel.recommendation === "STRONG_SELL" ? "text-rose-400" : "text-amber-400"
                    }`}>
                      {intel.recommendation === "STRONG_BUY" ? "COMPRA INSTITUCIONAL" : intel.recommendation === "STRONG_SELL" ? "VENDA INSTITUCIONAL" : "AGUARDAR CONFIRMAÇÃO"}
                    </h2>
                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/30 font-bold font-mono">
                      {intel.probability}% Probabilidade
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Relação Risco / Retorno</span>
                  <span className="text-base font-black font-mono text-emerald-400">{intel.riskReward}</span>
                </div>
              </div>

              {/* 3 Blocos de Execução */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                <div className="bg-[#070b16] p-3.5 rounded-lg border border-[#19243b]">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Faixa de Entrada</span>
                  <div className="text-base font-bold font-mono text-white mt-0.5">
                    ${intel.entryRange?.min?.toFixed(1)} - ${intel.entryRange?.max?.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">{intel.orderFlowSignal}</div>
                </div>

                <div className="bg-emerald-950/20 p-3.5 rounded-lg border border-emerald-500/40">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold">Take Profit (+R$ {intel.takeProfit?.profitBRL})</span>
                  <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                    ${intel.takeProfit?.price?.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-emerald-300/80 mt-1">Alvo configurado para a meta do dia</div>
                </div>

                <div className="bg-rose-950/20 p-3.5 rounded-lg border border-rose-500/40">
                  <span className="text-[10px] text-rose-400 uppercase font-semibold">Stop Loss (-R$ {intel.stopLoss?.maxRiskBRL})</span>
                  <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
                    ${intel.stopLoss?.price?.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-rose-300/80 mt-1">{intel.stopLoss?.invalidation}</div>
                </div>
              </div>

              {/* Racional de Volume */}
              <div className="text-xs text-slate-300 bg-[#070b16]/70 p-3 rounded-lg border border-[#19243b] leading-relaxed">
                <strong>Leitura do Livro pelo Astra:</strong> {intel.volumeProfileReading}
              </div>

              {/* Ação de Execução */}
              <div className="mt-4 pt-3 border-t border-[#1c2944] flex flex-wrap gap-3 items-center justify-between">
                <div className="text-xs text-amber-300/90 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{intel.psychologicalWarning}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => executeOrder("WIN")}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    Registrar Gain (+R$ {intel.takeProfit?.profitBRL})
                  </button>
                  <button
                    onClick={() => executeOrder("STOP")}
                    className="px-4 py-2.5 bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    Registrar Stop (-R$ 15)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUNA 3: CONTROLE DE RISCO, REGRAS DE R$ 20-30 E LOGS */}
        <div className="space-y-4">
          {/* CARD DE CONFIGURAÇÃO DE META */}
          <div className="bg-[#090d18] border border-[#151c2c] rounded-xl p-4">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-blue-400" /> DEFINA SUA META DE HOJE
            </span>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {[20, 25, 30].map((v) => (
                <button
                  key={v}
                  onClick={() => setTargetGoal(v)}
                  className={`py-2 text-xs font-bold font-mono rounded-lg border transition ${
                    targetGoal === v
                      ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25"
                      : "bg-[#0f1627] text-slate-400 border-[#1e293b] hover:text-white"
                  }`}
                >
                  R$ {v}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed bg-[#06080f] p-2.5 rounded-lg border border-[#151c2c]">
              💡 <strong>Regra de consistência:</strong> R$ 25 por dia em 20 dias úteis = <strong>R$ 500/mês</strong> com 1 único trade curto de 15 minutos.
            </div>
          </div>

          {/* TELEMETRIA & LOG DE ORDENS */}
          <div className="bg-[#090d18] border border-[#151c2c] rounded-xl p-4 flex flex-col">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-emerald-400" /> LIVRO DE EXECUÇÃO QUANT
            </span>

            <div className="space-y-2 max-h-[350px] overflow-y-auto font-mono text-[11px] pr-1">
              {auditLog.length === 0 ? (
                <div className="text-slate-500 italic p-3 text-center">Nenhum evento registrado. Clique em "CONSULTAR ASTRA AI" acima.</div>
              ) : (
                auditLog.map((log, idx) => (
                  <div key={idx} className="p-2.5 bg-[#06080f] border border-[#151c2c] rounded-lg text-slate-300">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}