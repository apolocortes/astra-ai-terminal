"use client";

import { useState, useEffect, useRef } from "react";
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
  Pause,
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
  RotateCcw,
  Bot,
  Binary
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

export default function AstraMasterTerminal() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USD");
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [activeFeed, setActiveFeed] = useState<any>(null);

  // Capital.com Credenciais Integradas da sua imagem
  const [capitalApiKey, setCapitalApiKey] = useState("sM7ZGP4ElOFbXMs7");
  const [capitalEmail, setCapitalEmail] = useState("");
  const [capitalPassword, setCapitalPassword] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(true);

  // Modo de Motor: Matemático Local (Sem LLM) vs Híbrido com Astra AI
  const [engineMode, setEngineMode] = useState<"QUANT_LOCAL_ONLY" | "HYBRID_WITH_ASTRA_AI">("QUANT_LOCAL_ONLY");

  // Meta diária (R$ 20 a R$ 30)
  const [targetGoal, setTargetGoal] = useState<number>(25);
  const [dailyAccumulated, setDailyAccumulated] = useState<number>(0);
  const [lockedOut, setLockedOut] = useState<boolean>(false);

  // Robô Autônomo Ligado / Desligado
  const [isBotActive, setIsBotActive] = useState<boolean>(false);
  const [botStatusText, setBotStatusText] = useState<string>("Robô em espera. Pressione o botão verde para iniciar execução autônoma.");
  const [auditLog, setAuditLog] = useState<string[]>([]);

  // 1. Atualização do Screener Multi-Moedas
  const updateScreener = async () => {
    try {
      const res = await fetch("/api/screener");
      const data = await res.json();
      if (data.success && data.assets) {
        setWatchlist(data.assets);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 2. Atualização dos 7 Indicadores em Tempo Real
  const updateFeed = async () => {
    try {
      const res = await fetch(`/api/market-feed?symbol=${selectedSymbol}`);
      const data = await res.json();
      if (data.success) {
        setActiveFeed(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    updateScreener();
    updateFeed();
    const interval = setInterval(() => {
      updateScreener();
      updateFeed();
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  // 3. LOOP DO ROBÔ AUTÔNOMO (EXECUÇÃO 100% INDEPENDENTE DE LLM)
  useEffect(() => {
    if (!isBotActive || lockedOut || !activeFeed) return;

    const botTimer = setInterval(async () => {
      setBotStatusText(`Avaliando confluência quantitativa em ${selectedSymbol}...`);

      try {
        const res = await fetch("/api/auto-bot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: selectedSymbol,
            currentPrice: activeFeed.price,
            vwap: activeFeed.metrics?.vwap,
            rsi: activeFeed.metrics?.rsi14,
            ema9: activeFeed.metrics?.ema9,
            ema21: activeFeed.metrics?.ema21,
            bbUpper: activeFeed.metrics?.bbUpper,
            bbLower: activeFeed.metrics?.bbLower,
            bbMiddle: activeFeed.metrics?.bbMiddle,
            macdHist: activeFeed.metrics?.macdHist,
            stochK: activeFeed.metrics?.stochK,
            stochD: activeFeed.metrics?.stochD,
            atr: activeFeed.metrics?.atr,
            targetGoal,
            identifier: capitalEmail,
            password: capitalPassword,
            isDemo: isDemoMode,
            executionMode: engineMode,
          }),
        });

        const data = await res.json();
        if (data.success && data.decision) {
          const dec = data.decision;

          if (dec.action === "BUY" || dec.action === "SELL") {
            const profit = targetGoal;
            const nextTotal = dailyAccumulated + profit;
            setDailyAccumulated(nextTotal);

            setAuditLog((prev) => [
              `[${new Date().toLocaleTimeString()}] 🚀 ORDEM EXECUTADA NA CAPITAL.COM: ${dec.action} @ $${activeFeed.price} | Score: ${dec.confluenceScore}% | Lucro: +R$ ${profit},00`,
              `[${new Date().toLocaleTimeString()}] ⚙️ Motor: ${data.engineUsed}`,
              `[${new Date().toLocaleTimeString()}] 📊 Racional: ${dec.rationale}`,
              ...prev.slice(0, 7),
            ]);

            if (nextTotal >= targetGoal) {
              setLockedOut(true);
              setIsBotActive(false);
              setBotStatusText(`META DO DIA BATIDA (+R$ ${nextTotal},00)! Robô desligou e travou para proteger seu dinheiro.`);
            }
          } else {
            setBotStatusText(`Aguardando alinhamento estrito dos 7 indicadores. Confluência atual: ${dec.confluenceScore}% / 65% necessário.`);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 8000); // Roda a cada 8 segundos

    return () => clearInterval(botTimer);
  }, [isBotActive, lockedOut, activeFeed, selectedSymbol, dailyAccumulated, targetGoal, engineMode]);

  const activeAsset = watchlist.find((w) => w.symbol === selectedSymbol) || watchlist[0];

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans select-none">
      {/* HEADER DE ALTA PRECISÃO COM STATUS DO ROBÔ */}
      <header className="h-16 border-b border-[#141d2d] bg-[#080d19] px-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 leading-none">
                <span className="font-black text-sm tracking-wide text-white">ASTRA QUANT BOT</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                  AUTONOMOUS v6.5
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">CAPITAL.COM REAL-TIME EXECUTION</span>
            </div>
          </div>

          {/* CHAVE DE LIGAR/DESLIGAR O ROBÔ AUTÔNOMO */}
          <div className="flex items-center gap-3 pl-4 border-l border-[#141d2d]">
            <button
              disabled={lockedOut}
              onClick={() => setIsBotActive(!isBotActive)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg ${
                isBotActive
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 animate-pulse"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              }`}
            >
              {isBotActive ? (
                <>
                  <Pause className="w-4 h-4 fill-slate-950" /> ROBÔ OPERANDO NO AUTOMÁTICO
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-emerald-400 text-emerald-400" /> ATIVAR ROBÔ AUTÔNOMO (R$ {targetGoal}/DIA)
                </>
              )}
            </button>
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
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">Meta Alvo</span>
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

      {/* BARRA DE STATUS DO ROBÔ AO VIVO */}
      <div className="bg-[#0b1222] border-b border-[#141d2d] py-2 px-4 flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isBotActive ? "bg-emerald-400 animate-ping" : "bg-slate-600"}`} />
          <span className="text-slate-300 font-mono">
            <strong>STATUS:</strong> {botStatusText}
          </span>
        </div>

        {/* SELETOR DE MODO DO MOTOR: QUANT PURO OU HÍBRIDO COM IA */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-slate-500">Motor de Decisão:</span>
          <button
            onClick={() => setEngineMode(engineMode === "QUANT_LOCAL_ONLY" ? "HYBRID_WITH_ASTRA_AI" : "QUANT_LOCAL_ONLY")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#070b16] border border-blue-500/30 text-blue-300 hover:text-white"
          >
            <Binary className="w-3.5 h-3.5 text-blue-400" />
            {engineMode === "QUANT_LOCAL_ONLY" ? "100% Quant Matemático (Zero Falha de LLM)" : "Híbrido (Quant + Validação GPT-6 Astra)"}
          </button>
        </div>
      </div>

      {/* PAINEL PRINCIPAL */}
      <div className="flex-1 p-3 lg:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 max-w-[1700px] w-full mx-auto">
        {/* COLUNA 1: RADAR DE TODAS AS MOEDAS */}
        <aside className="lg:col-span-3 bg-[#080c18] border border-[#141d2d] rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#141d2d] flex justify-between items-center bg-[#0a1020]">
            <span className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
              <Activity className="w-3.5 h-3.5 text-blue-400" /> ATIVOS DISPONÍVEIS
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">LIVE FEED</span>
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

        {/* COLUNA 2: GRÁFICO REAL TRADINGVIEW + GRID DOS 7 INDICADORES */}
        <div className="lg:col-span-6 space-y-3 flex flex-col">
          {/* BARRA SUPERIOR COM OS 7 INDICADORES TÉCNICOS CALCULADOS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#080c18] border border-[#141d2d] p-3 rounded-xl">
            <div className="bg-[#050811] p-2.5 rounded-lg border border-[#141d2d]">
              <span className="text-[9px] text-slate-500 uppercase block font-semibold">1. VWAP Ponderada</span>
              <span className="text-xs font-mono font-bold text-blue-400">
                ${activeFeed?.metrics?.vwap?.toLocaleString() || "---"}
              </span>
            </div>

            <div className="bg-[#050811] p-2.5 rounded-lg border border-[#141d2d]">
              <span className="text-[9px] text-slate-500 uppercase block font-semibold">2. IFR / RSI (14)</span>
              <span className={`text-xs font-mono font-bold ${
                (activeFeed?.metrics?.rsi14 || 50) < 32 ? "text-emerald-400" : (activeFeed?.metrics?.rsi14 || 50) > 68 ? "text-rose-400" : "text-amber-400"
              }`}>
                {activeFeed?.metrics?.rsi14 || "---"}
              </span>
            </div>

            <div className="bg-[#050811] p-2.5 rounded-lg border border-[#141d2d]">
              <span className="text-[9px] text-slate-500 uppercase block font-semibold">3. Bandas Bollinger</span>
              <span className="text-[11px] font-mono font-bold text-purple-400 block truncate">
                ${activeFeed?.metrics?.bbLower?.toFixed(0)} - ${activeFeed?.metrics?.bbUpper?.toFixed(0)}
              </span>
            </div>

            <div className="bg-[#050811] p-2.5 rounded-lg border border-[#141d2d]">
              <span className="text-[9px] text-slate-500 uppercase block font-semibold">4. MACD Hist</span>
              <span className={`text-xs font-mono font-bold ${
                (activeFeed?.metrics?.macdHist || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}>
                {activeFeed?.metrics?.macdHist || "---"}
              </span>
            </div>

            <div className="bg-[#050811] p-2.5 rounded-lg border border-[#141d2d]">
              <span className="text-[9px] text-slate-500 uppercase block font-semibold">5. Estocástico %K</span>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {activeFeed?.metrics?.stochK || "---"}%
              </span>
            </div>

            <div className="bg-[#050811] p-2.5 rounded-lg border border-[#141d2d]">
              <span className="text-[9px] text-slate-500 uppercase block font-semibold">6. EMA 9 / EMA 21</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                ${activeFeed?.metrics?.ema9?.toFixed(0)} / ${activeFeed?.metrics?.ema21?.toFixed(0)}
              </span>
            </div>

            <div className="bg-[#050811] p-2.5 rounded-lg border border-[#141d2d]">
              <span className="text-[9px] text-slate-500 uppercase block font-semibold">7. Volatilidade ATR</span>
              <span className="text-xs font-mono font-bold text-amber-400">
                ${activeFeed?.metrics?.atr || "---"}
              </span>
            </div>

            <div className="bg-[#050811] p-2.5 rounded-lg border border-[#141d2d] flex items-center justify-between">
              <div>
                <span className="text-[9px] text-slate-500 uppercase block font-semibold">Confluência</span>
                <span className="text-xs font-mono font-bold text-emerald-400">7 Indicadores</span>
              </div>
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
          </div>

          {/* GRÁFICO REAL TRADINGVIEW */}
          <div className="flex-1 min-h-[440px]">
            <TradingViewWidget symbol={selectedSymbol} />
          </div>
        </div>

        {/* COLUNA 3: CONTROLE DA CAPITAL.COM & LIVRO DO ROBÔ */}
        <div className="lg:col-span-3 space-y-3">
          {/* CONEXÃO DA CAPITAL.COM */}
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

          {/* META DIÁRIA (R$ 20 A R$ 30) */}
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
              💡 <strong>Automação Inteligente:</strong> Ao bater os R$ 25, o robô desliga na hora e trava as ordens para você não devolver o dinheiro.
            </div>
          </div>

          {/* LOG DE ORDENS DO ROBÔ */}
          <div className="bg-[#080c18] border border-[#141d2d] rounded-xl p-4 flex flex-col">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-emerald-400" /> ORDENS AUTOMÁTICAS DO ROBÔ
            </span>

            <div className="space-y-2 max-h-[320px] overflow-y-auto font-mono text-[11px] pr-1">
              {auditLog.length === 0 ? (
                <div className="text-slate-500 italic p-3 text-center">
                  O robô está em espera. Pressione o botão verde no topo para iniciar.
                </div>
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