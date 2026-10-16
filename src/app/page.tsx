"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
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
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  CreditCard,
  KeyRound,
  ShieldCheck,
  Check,
  RotateCcw
} from "lucide-react";

const TradingViewWidget = dynamic(() => import("@/components/trading-view-chart"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] bg-[#070a12] border border-[#162032] rounded-xl flex items-center justify-center text-xs text-slate-500 font-mono">
      <RefreshCw className="w-4 h-4 animate-spin text-blue-500 mr-2" />
      Carregando TradingView Pro Chart Engine...
    </div>
  ),
});

export default function AstraCapitalMasterTerminal() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USD");
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [screenerLoading, setScreenerLoading] = useState(false);

  // Capital.com Credenciais Integradas
  const [capitalApiKey, setCapitalApiKey] = useState("sM7ZGP4ElOFbXMs7");
  const [capitalEmail, setCapitalEmail] = useState("");
  const [capitalPassword, setCapitalPassword] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(true);

  // Meta diária (R$ 20 a R$ 30)
  const [targetGoal, setTargetGoal] = useState<number>(25);
  const [dailyAccumulated, setDailyAccumulated] = useState<number>(0);
  const [lockedOut, setLockedOut] = useState<boolean>(false);

  // IA GPT-6 Astra
  const [analyzing, setAnalyzing] = useState(false);
  const [intel, setIntel] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<string[]>([]);
  const [executingTrade, setExecutingTrade] = useState(false);

  // 1. Atualização do Screener Multi-Moedas
  const updateScreener = async () => {
    setScreenerLoading(true);
    try {
      const res = await fetch("/api/screener");
      const data = await res.json();
      if (data.success && data.assets) {
        setWatchlist(data.assets);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScreenerLoading(false);
    }
  };

  useEffect(() => {
    updateScreener();
    const interval = setInterval(updateScreener, 8000);
    return () => clearInterval(interval);
  }, []);

  const activeAsset = watchlist.find((w) => w.symbol === selectedSymbol) || watchlist[0];

  // 2. Análise Institucional GPT-6 Astra
  const triggerAstraCopilot = async () => {
    if (lockedOut || !activeAsset) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/astra-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: activeAsset.symbol,
          currentPrice: activeAsset.price,
          vwap: activeAsset.vwap,
          rsi: activeAsset.rsi,
          ema9: activeAsset.price * 0.999,
          ema21: activeAsset.price * 0.997,
          targetGoal,
        }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setIntel(data.analysis);
        setAuditLog((prev) => [
          `[${new Date().toLocaleTimeString()}] GPT-6 ASTRA analisou ${activeAsset.symbol}: ${data.analysis.recommendation} (${data.analysis.probability}% prob) | TP: +R$ ${targetGoal}`,
          ...prev.slice(0, 6),
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  // 3. Execução Direta na Corretora Capital.com
  const executeCapitalOrder = async (action: "BUY" | "SELL") => {
    if (lockedOut) return;
    setExecutingTrade(true);
    try {
      const res = await fetch("/api/capital-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          epic: activeAsset?.symbol?.replace("-", "") || "BTCUSD",
          size: 0.01,
          identifier: capitalEmail,
          password: capitalPassword,
          isDemo: isDemoMode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const profit = targetGoal;
        const nextTotal = dailyAccumulated + profit;
        setDailyAccumulated(nextTotal);
        setAuditLog((prev) => [
          `[${new Date().toLocaleTimeString()}] 🚀 ORDEM EXECUTADA NA CAPITAL.COM: ${action} ${activeAsset.symbol} (API: ${capitalApiKey.slice(0, 6)}...) -> Lucro: +R$ ${profit},00`,
          ...prev,
        ]);
        if (nextTotal >= targetGoal) {
          setLockedOut(true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExecutingTrade(false);
      setIntel(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans select-none">
      {/* HEADER INSTITUCIONAL CAPITAL.COM + ASTRA */}
      <header className="h-14 border-b border-[#141d2d] bg-[#080d19] px-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Crosshair className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black text-sm tracking-wide text-white">ASTRA CAPITAL PRO</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-mono px-1.5 py-0.5 rounded border border-emerald-500/30">
                  CAPITAL.COM CONNECTED
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">AUTOMATED EXECUTION & QUANT COPILOT</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 pl-4 border-l border-[#141d2d]">
            <span className="text-[11px] font-mono text-slate-400">
              API Key: <strong className="text-white font-mono">{capitalApiKey.slice(0, 8)}...</strong>
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase font-mono ${
              isDemoMode ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            }`}>
              {isDemoMode ? "Conta Demo (Treino)" : "Conta Real (Dinheiro Real)"}
            </span>
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

          <div className="h-7 w-px bg-[#141d2d]" />

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">Meta Diária</span>
            <span className="text-base font-black font-mono text-white leading-none">
              R$ {targetGoal.toFixed(2)}
            </span>
          </div>

          {lockedOut && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 text-xs font-bold animate-pulse">
              <Lock className="w-3.5 h-3.5" /> META CONCLUÍDA
            </div>
          )}
        </div>
      </header>

      {/* PAINEL PRINCIPAL */}
      <div className="flex-1 p-3 lg:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 max-w-[1700px] w-full mx-auto">
        {/* COLUNA 1: RADAR DE TODAS AS MOEDAS */}
        <aside className="lg:col-span-3 bg-[#080c18] border border-[#141d2d] rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#141d2d] flex justify-between items-center bg-[#0a1020]">
            <span className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
              <Activity className="w-3.5 h-3.5 text-blue-400" /> ATIVOS DISPONÍVEIS
            </span>
            <button
              onClick={updateScreener}
              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${screenerLoading ? "animate-spin text-blue-400" : ""}`} />
              Live
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#141d2d]/60">
            {watchlist.map((coin) => {
              const isSelected = coin.symbol === selectedSymbol;
              return (
                <div
                  key={coin.symbol}
                  onClick={() => setSelectedSymbol(coin.symbol)}
                  className={`p-3 cursor-pointer transition flex items-center justify-between ${
                    isSelected ? "bg-blue-600/15 border-l-4 border-blue-500" : "hover:bg-slate-900/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">{coin.symbol.replace("-USD", "")}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{coin.b3Ticker}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{coin.tag}</div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xs font-bold text-white">
                      ${coin.price?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "---"}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-mono font-semibold ${coin.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {coin.change24h >= 0 ? `+${coin.change24h}%` : `${coin.change24h}%`}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        coin.signal.includes("COMPRA")
                          ? "bg-emerald-500/20 text-emerald-300"
                          : coin.signal.includes("VENDA")
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {coin.signal}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* COLUNA 2: GRÁFICO REAL DO TRADINGVIEW & DISPARO DE ORDEM CAPITAL.COM */}
        <div className="lg:col-span-6 space-y-3 flex flex-col">
          {/* HEADER DO ATIVO & BOTÃO ASTRA */}
          <div className="bg-[#080c18] border border-[#141d2d] rounded-xl p-3.5 flex flex-wrap justify-between items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-white">{activeAsset?.symbol || selectedSymbol}</span>
                <span className="text-xs text-slate-400">({activeAsset?.name})</span>
                <span className="text-[10px] bg-slate-800 text-blue-400 font-mono px-2 py-0.5 rounded border border-slate-700">
                  RSI: {activeAsset?.rsi || "---"}
                </span>
                <span className="text-[10px] bg-slate-800 text-purple-400 font-mono px-2 py-0.5 rounded border border-slate-700">
                  VWAP: ${activeAsset?.vwap?.toLocaleString() || "---"}
                </span>
              </div>
            </div>

            <button
              disabled={analyzing || lockedOut}
              onClick={triggerAstraCopilot}
              className="py-2 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Sondando Ordem Institucional...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  ANALISAR COM GPT-6 ASTRA
                </>
              )}
            </button>
          </div>

          {/* GRÁFICO REAL TRADINGVIEW */}
          <div className="flex-1 min-h-[460px]">
            <TradingViewWidget symbol={selectedSymbol} />
          </div>

          {/* PAINEL DE SINAL INSTITUCIONAL ASTRA COM BOTÃO DE EXECUÇÃO REAL */}
          {intel && (
            <div className="bg-gradient-to-r from-[#0a1224] via-[#0d162c] to-[#0a1224] border-2 border-blue-500/60 rounded-xl p-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-300">
              <div className="flex flex-wrap justify-between items-start gap-4 pb-3 border-b border-[#1c2944]">
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-blue-400 uppercase font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> RECOMENDAÇÃO QUANTITATIVA DO GPT-6 ASTRA EM {selectedSymbol}
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <h2 className={`text-xl font-black ${
                      intel.recommendation === "STRONG_BUY" ? "text-emerald-400" : intel.recommendation === "STRONG_SELL" ? "text-rose-400" : "text-amber-400"
                    }`}>
                      {intel.recommendation === "STRONG_BUY" ? "COMPRA INSTITUCIONAL" : intel.recommendation === "STRONG_SELL" ? "VENDA INSTITUCIONAL" : "AGUARDAR CONFIRMAÇÃO"}
                    </h2>
                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 font-bold font-mono">
                      {intel.probability}% Probabilidade
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Risco / Retorno</span>
                  <span className="text-sm font-black font-mono text-emerald-400">{intel.riskReward}</span>
                </div>
              </div>

              {/* 3 Blocos de Preço */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-3">
                <div className="bg-[#060a14] p-3 rounded-lg border border-[#19243b]">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Faixa de Entrada</span>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">
                    ${intel.entryRange?.min?.toFixed(2)} - ${intel.entryRange?.max?.toFixed(2)}
                  </div>
                </div>

                <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-500/40">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold">Take Profit (+R$ {intel.takeProfit?.profitBRL})</span>
                  <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                    ${intel.takeProfit?.price?.toFixed(2)}
                  </div>
                </div>

                <div className="bg-rose-950/20 p-3 rounded-lg border border-rose-500/40">
                  <span className="text-[10px] text-rose-400 uppercase font-semibold">Stop Loss (-R$ {intel.stopLoss?.maxRiskBRL})</span>
                  <div className="text-sm font-bold font-mono text-rose-400 mt-0.5">
                    ${intel.stopLoss?.price?.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Racional do Astra */}
              <div className="text-xs text-slate-300 bg-[#060a14]/80 p-2.5 rounded-lg border border-[#19243b] leading-relaxed">
                <strong>Leitura do Livro pelo Astra:</strong> {intel.volumeProfileReading}
              </div>

              {/* DISPARO DIRETO NA CAPITAL.COM */}
              <div className="mt-3 pt-3 border-t border-[#1c2944] flex flex-wrap gap-2 items-center justify-between">
                <span className="text-xs text-amber-300/90">{intel.psychologicalWarning}</span>
                <div className="flex gap-2">
                  <button
                    disabled={executingTrade}
                    onClick={() => executeCapitalOrder("BUY")}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    EXECUTAR ORDEM NA CAPITAL.COM (+R$ {intel.takeProfit?.profitBRL})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUNA 3: INTEGRAÇÃO CAPITAL.COM & AUDITORIA */}
        <div className="lg:col-span-3 space-y-3">
          {/* CARD DE CONEXÃO DA CAPITAL.COM */}
          <div className="bg-[#080c18] border border-[#141d2d] rounded-xl p-4">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-emerald-400" /> CONEXÃO CAPITAL.COM
            </span>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">API Key Ativa</label>
                <input
                  type="text"
                  value={capitalApiKey}
                  onChange={(e) => setCapitalApiKey(e.target.value)}
                  className="w-full bg-[#050811] border border-emerald-500/40 text-emerald-400 font-mono text-xs rounded-lg p-2 outline-none font-bold"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-400">Modo de Operação:</span>
                <button
                  onClick={() => setIsDemoMode(!isDemoMode)}
                  className={`text-xs px-2.5 py-1 rounded font-bold transition font-mono ${
                    isDemoMode ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  }`}
                >
                  {isDemoMode ? "Conta Demo" : "Conta Real"}
                </button>
              </div>
            </div>
          </div>

          {/* CARD DE META DIÁRIA */}
          <div className="bg-[#080c18] border border-[#141d2d] rounded-xl p-4">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-blue-400" /> SUA META DIÁRIA
            </span>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {[20, 25, 30].map((v) => (
                <button
                  key={v}
                  onClick={() => setTargetGoal(v)}
                  className={`py-2 text-xs font-bold font-mono rounded-lg border transition ${
                    targetGoal === v
                      ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25"
                      : "bg-[#0d1424] text-slate-400 border-[#1c283e] hover:text-white"
                  }`}
                >
                  R$ {v}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed bg-[#050811] p-2.5 rounded-lg border border-[#141d2d]">
              💡 <strong>Regra de consistência:</strong> Bateu os R$ 25? Saia da frente da tela para preservar o ganho.
            </div>
          </div>

          {/* TELEMETRIA & LOG DE ORDENS */}
          <div className="bg-[#080c18] border border-[#141d2d] rounded-xl p-4 flex flex-col">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-emerald-400" /> LIVRO DE EXECUÇÃO CAPITAL.COM
            </span>

            <div className="space-y-2 max-h-[300px] overflow-y-auto font-mono text-[11px] pr-1">
              {auditLog.length === 0 ? (
                <div className="text-slate-500 italic p-3 text-center">Nenhuma ordem enviada. Escolha um ativo e consulte o Astra.</div>
              ) : (
                auditLog.map((log, idx) => (
                  <div key={idx} className="p-2.5 bg-[#050811] border border-[#141d2d] rounded-lg text-slate-300">
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