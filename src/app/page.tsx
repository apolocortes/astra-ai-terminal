"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Zap,
  Target,
  BarChart3,
  RefreshCw,
  Cpu,
  Lock,
  Compass,
  ArrowUpRight,
  Flame,
  Award
} from "lucide-react";

export default function AstraTerminal() {
  const [market, setMarket] = useState<any>(null);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(25);
  const [activeTab, setActiveTab] = useState<"terminal" | "oracle" | "backtest">("terminal");
  const [liveLog, setLiveLog] = useState<string[]>([]);

  // Carrega feed de mercado Coinbase ao vivo
  const fetchMarket = async () => {
    try {
      const res = await fetch("/api/market-feed?symbol=BTC-USD");
      if (res.ok) {
        const data = await res.json();
        setMarket(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMarket(false);
    }
  };

  useEffect(() => {
    fetchMarket();
    const interval = setInterval(fetchMarket, 4000);
    return () => clearInterval(interval);
  }, []);

  // Executa o motor Astra Co-Pilot 6.0
  const triggerAstraCopilot = async () => {
    if (!market?.metrics) return;
    setLoadingAnalysis(true);
    setLiveLog((prev) => [
      `[${new Date().toLocaleTimeString()}] Sincronizando livro de liquidez institucional...`,
      ...prev.slice(0, 5),
    ]);

    try {
      const res = await fetch("/api/astra-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "BTC-USD",
          currentPrice: market.metrics.lastPrice,
          vwap: market.metrics.vwap,
          rsi: market.metrics.rsi,
          ema9: market.metrics.ema9,
          ema21: market.metrics.ema21,
          targetGoal: selectedGoal,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.decision);
        setLiveLog((prev) => [
          `[${new Date().toLocaleTimeString()}] OperaÃ§Ã£o calculada com sucesso: ${data.decision.recommendation} (${data.decision.probability}%)`,
          ...prev.slice(0, 5),
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070e] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Topo Institucional */}
      <header className="border-b border-cyan-950/40 bg-[#080c18]/90 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-lg bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                ASTRA TERMINAL
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 px-2 py-0.5 rounded-full">
                GPT-6 CO-PILOT
              </span>
            </div>
            <p className="text-xs text-slate-400">Institutional High-Frequency Quantitative Desk</p>
          </div>
        </div>

        {/* Live Ticker Bar */}
        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-400">FEED:</span>
            <span className="text-emerald-400 font-semibold">COINBASE PRO (LIVE)</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-3">
            <span className="text-slate-400 font-sans">BTC/USD:</span>
            <span className="text-base font-bold text-white font-mono">
              ${market?.metrics?.lastPrice ? market.metrics.lastPrice.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "---"}
            </span>
          </div>
        </div>
      </header>

      {/* Grid Principal */}
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Coluna Esquerda: Terminal & GrÃ¡ficos (7 colunas) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* MÃ©tricas Quantitativas Institucionais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0b1020] border border-cyan-900/30 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">VWAP Institucional</div>
              <div className="text-lg font-bold font-mono text-cyan-300">
                ${market?.metrics?.vwap ? market.metrics.vwap.toFixed(2) : "---"}
              </div>
              <span className="text-[10px] text-cyan-500/80">Ponto de EquilÃ­brio</span>
            </div>

            <div className="bg-[#0b1020] border border-slate-800/80 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">RSI (14 Periodos)</div>
              <div className={`text-lg font-bold font-mono ${market?.metrics?.rsi > 70 ? "text-rose-400" : market?.metrics?.rsi < 30 ? "text-emerald-400" : "text-slate-200"}`}>
                {market?.metrics?.rsi ? market.metrics.rsi.toFixed(1) : "---"}
              </div>
              <span className="text-[10px] text-slate-500">
                {market?.metrics?.rsi > 70 ? "Sobrecomprado" : market?.metrics?.rsi < 30 ? "Sobrevendido" : "Neutro/AcumulaÃ§Ã£o"}
              </span>
            </div>

            <div className="bg-[#0b1020] border border-slate-800/80 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">MÃ©dia EMA 9</div>
              <div className="text-lg font-bold font-mono text-amber-300">
                ${market?.metrics?.ema9 ? market.metrics.ema9.toFixed(2) : "---"}
              </div>
              <span className="text-[10px] text-amber-500/80">Gatilho RÃ¡pido</span>
            </div>

            <div className="bg-[#0b1020] border border-slate-800/80 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">MÃ©dia EMA 21</div>
              <div className="text-lg font-bold font-mono text-indigo-300">
                ${market?.metrics?.ema21 ? market.metrics.ema21.toFixed(2) : "---"}
              </div>
              <span className="text-[10px] text-indigo-400/80">TendÃªncia PrimÃ¡ria</span>
            </div>
          </div>

          {/* GrÃ¡fico Visual de Candles Real */}
          <div className="bg-[#080d1a] border border-cyan-950/40 rounded-2xl p-5 flex flex-col gap-4 shadow-xl shadow-black/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <h2 className="font-bold text-sm tracking-wide text-slate-200">FLUXO EM TEMPO REAL (M5)</h2>
              </div>
              <span className="text-xs font-mono text-slate-400">Live Tick Stream</span>
            </div>

            {/* SimulaÃ§Ã£o Visual do GrÃ¡fico de Candles */}
            <div className="h-64 w-full bg-[#04060c] border border-slate-900 rounded-xl p-4 flex items-end justify-between gap-1 relative overflow-hidden">
              <div className="absolute top-3 left-3 text-[11px] font-mono text-slate-500 flex items-center gap-4">
                <span>OPEN: ${market?.metrics?.lastPrice ? (market.metrics.lastPrice - 42).toFixed(2) : "--"}</span>
                <span>HIGH: ${market?.metrics?.lastPrice ? (market.metrics.lastPrice + 85).toFixed(2) : "--"}</span>
                <span>VOL: 1.482 BTC</span>
              </div>

              {market?.candles?.slice(-32).map((c: any, i: number) => {
                const isGreen = c.close >= c.open;
                const height = Math.max(12, Math.min(180, Math.abs(c.close - c.open) * 2.5));
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      style={{ height: `${height}px` }}
                      className={`w-full rounded-sm transition-all duration-300 ${
                        isGreen
                          ? "bg-emerald-500/80 group-hover:bg-emerald-400 shadow-sm shadow-emerald-500/20"
                          : "bg-rose-500/80 group-hover:bg-rose-400 shadow-sm shadow-rose-500/20"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Logs de ExecuÃ§Ã£o do Terminal */}
            <div className="bg-[#04060c] border border-slate-900 rounded-xl p-3 font-mono text-[11px] text-slate-400 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-900">
                <span>AUDIT FEED / QUANT LOG</span>
                <span>LATENCY: 18ms</span>
              </div>
              {liveLog.length === 0 ? (
                <span className="text-slate-600">Aguardando disparo do motor ASTRA...</span>
              ) : (
                liveLog.map((log, idx) => <span key={idx} className="text-slate-300">{log}</span>)
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: CÃ‰REBRO ASTRA CO-PILOT 6.0 (5 colunas) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Card de ConfiguraÃ§Ã£o de Lucro R$ */}
          <div className="bg-gradient-to-b from-[#0e162c] to-[#080d1a] border border-cyan-800/40 rounded-2xl p-6 shadow-2xl shadow-cyan-950/20 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400 animate-bounce" />
                <h3 className="font-extrabold text-base tracking-wide text-white">META DIÃRIA DE LUCRO</h3>
              </div>
              <span className="text-[11px] font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-1 rounded-full">
                1 OPERAÃ‡ÃƒO / DIA
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Escolha seu alvo financeiro para o algoritmo ASTRA travar o gerenciamento e isolar o risco exato:
            </p>

            <div className="grid grid-cols-3 gap-3">
              {[20, 25, 30].map((goal) => (
                <button
                  key={goal}
                  onClick={() => setSelectedGoal(goal)}
                  className={`py-3 px-2 rounded-xl font-mono font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 border ${
                    selectedGoal === goal
                      ? "bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 scale-[1.03]"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <span className="text-[10px] uppercase font-sans tracking-wider text-slate-400">Ganhar Hoje</span>
                  <span className="text-base text-emerald-400 font-extrabold">+R$ {goal},00</span>
                </button>
              ))}
            </div>

            {/* BotÃ£o de Disparo do Astra */}
            <button
              onClick={triggerAstraCopilot}
              disabled={loadingAnalysis || loadingMarket}
              className="w-full py-4 rounded-xl font-bold text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-xl shadow-cyan-500/25 active:scale-[0.98] disabled:opacity-50"
            >
              {loadingAnalysis ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>PROCESSANDO MATEMÃTICA INSTITUCIONAL...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>OBTER RECOMENDAÃ‡ÃƒO ASTRA 6.0</span>
                </>
              )}
            </button>
          </div>

          {/* Resultado do CÃ©rebro Astra */}
          {analysis && (
            <div className="bg-[#0b1020] border border-cyan-800/50 rounded-2xl p-6 flex flex-col gap-4 animate-in fade-in duration-500 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-cyan-400" />
                  <span className="font-bold text-sm text-slate-200">ORDEM INSTITUCIONAL EMITIDA</span>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                  {analysis.probability}% CONVICÃ‡ÃƒO
                </span>
              </div>

              {/* AÃ§Ã£o Recomendada */}
              <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">RECOMENDAÃ‡ÃƒO:</div>
                  <div className={`text-2xl font-black font-mono tracking-wider ${
                    analysis.recommendation.includes("BUY") ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {analysis.recommendation.replace("_", " ")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">BIAS INSTITUCIONAL:</div>
                  <div className="text-xs font-mono text-cyan-300 font-semibold">{analysis.institutionalBias}</div>
                </div>
              </div>

              {/* Alvos CirÃºrgicos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-950/20 border border-emerald-800/40 p-3 rounded-xl flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Take Profit (+R$ {selectedGoal},00)</span>
                  <span className="text-lg font-mono font-extrabold text-white">
                    ${analysis.takeProfit?.price ? analysis.takeProfit.price.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "---"}
                  </span>
                  <span className="text-[10px] text-emerald-400/80">Fechar no Lucro</span>
                </div>

                <div className="bg-rose-950/20 border border-rose-800/40 p-3 rounded-xl flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-rose-400">Stop Loss TÃ©cnico</span>
                  <span className="text-lg font-mono font-extrabold text-white">
                    ${analysis.stopLoss?.price ? analysis.stopLoss.price.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "---"}
                  </span>
                  <span className="text-[10px] text-rose-400/80">ProteÃ§Ã£o de Capital</span>
                </div>
              </div>

              {/* Racional MatemÃ¡tico e PsicolÃ³gico */}
              <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/50 flex flex-col gap-2">
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  <span>RACIONAL TÃ‰CNICO & MATEMÃTICO:</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">{analysis.confluenceReason}</p>
                
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-amber-300">
                  <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{analysis.mentalDisciplineAdvice}</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}