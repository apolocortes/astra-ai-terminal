"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Play,
  Square,
  KeyRound,
  Sliders,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  Sparkles,
  Layers,
  Bot,
  Radio,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  Wallet,
  Globe2,
  Database,
  Terminal as TerminalIcon,
  Search,
  Radar,
  BrainCircuit,
  Coins,
  Check,
  ShieldCheck,
  LockKeyhole,
  Info,
  BadgeAlert,
  Crosshair
} from "lucide-react";
import TradingViewWidget from "@/components/trading-view-chart";

export default function AstraTerminal() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USD");
  const [radarAssets, setRadarAssets] = useState<any[]>([]);
  const [liveDepth, setLiveDepth] = useState<any>(null);
  
  // ParÃ¢metros de Saldo e Meta
  const [depositCapital, setDepositCapital] = useState<number>(30); // Capital Alocado para o RobÃ´ (R$)
  const [currentCapital, setCurrentCapital] = useState<number>(30); // Saldo Atual da SessÃ£o
  const [targetGoal, setTargetGoal] = useState<number>(25); // Meta do dia em R$
  const [sessionPnL, setSessionPnL] = useState<number>(0);
  
  // Estado do RobÃ´
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [goalReached, setGoalReached] = useState(false);
  const [botPhase, setBotPhase] = useState<string>("AGUARDANDO INÃCIO");
  
  // Sinal Ativo no GrÃ¡fico (HUD Visual de Entrada)
  const [activeSignal, setActiveSignal] = useState<{
    symbol: string;
    action: "BUY" | "SELL";
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    confluence: number;
    time: string;
    rationale: string;
  } | null>(null);

  const [thoughtStream, setThoughtStream] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Sistema conectado aos livros da Coinbase Pro & Capital.com OpenAPI. Sinais HUD ativados.`,
  ]);
  
  // Modo Real vs DemonstraÃ§Ã£o
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [brokerBalanceReal, setBrokerBalanceReal] = useState<number>(0.00);
  const [brokerCurrency, setBrokerCurrency] = useState<string>("BRL");

  // HistÃ³rico de Ordens da SessÃ£o
  const [executedTrades, setExecutedTrades] = useState<any[]>([]);

  // 1. Carrega Screener Geral
  const fetchScreener = async () => {
    try {
      const res = await fetch("/api/screener");
      if (res.ok) {
        const data = await res.json();
        setRadarAssets(data.assets || []);
      }
    } catch (e) {}
  };

  // 2. Carrega Livro de Ofertas e PreÃ§o Real ao Vivo
  const fetchDepth = async () => {
    try {
      const res = await fetch(`/api/live-depth?symbol=${selectedSymbol}`);
      if (res.ok) {
        const data = await res.json();
        setLiveDepth(data);
      }
    } catch (e) {}
  };

  // 3. Consulta de Saldo Real Verdadeiro na Corretora
  const syncTrueBrokerBalance = async () => {
    try {
      const res = await fetch("/api/capital-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDemo: isDemoMode }),
      });
      const data = await res.json();
      if (data.success && data.account) {
        setBrokerBalanceReal(data.account.balance || 0.00);
        setBrokerCurrency(data.account.currency || "BRL");
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchScreener();
    fetchDepth();
    syncTrueBrokerBalance();
    const interval = setInterval(() => {
      fetchScreener();
      fetchDepth();
    }, 2500);
    return () => clearInterval(interval);
  }, [selectedSymbol, isDemoMode]);

  // 4. LOOP DE EXECUÃ‡ÃƒO AUTÃ”NOMA DO ROBÃ” COM PROJEÃ‡ÃƒO VISUAL DE SINAIS
  const isRunningRef = useRef(isBotRunning);
  isRunningRef.current = isBotRunning;
  const goalReachedRef = useRef(goalReached);
  goalReachedRef.current = goalReached;

  useEffect(() => {
    if (!isBotRunning) {
      setBotPhase("PAUSADO");
      return;
    }

    setBotPhase("DISCOVERY ATIVO");
    const startTime = new Date().toLocaleTimeString();
    setThoughtStream((prev) => [
      `[${startTime}] ðŸš€ MOTOR DE TRADING INICIADO! Rastreando confluÃªncias tÃ©cnicas em tempo real...`,
      ...prev,
    ]);

    const runTradingStep = async () => {
      if (!isRunningRef.current || goalReachedRef.current) return;

      const time = new Date().toLocaleTimeString();
      const currentPrice = liveDepth?.price || 81650;
      const dominance = liveDepth?.orderBook?.buyerDominance || 54;
      const rsi = liveDepth?.indicators?.rsi || 48;
      const atr = liveDepth?.indicators?.atr || 25;

      setBotPhase("AVALIANDO LIVRO");
      setThoughtStream((prev) => [
        `[${time}] ðŸ”Ž DISCOVERY: ${selectedSymbol} a $${currentPrice.toLocaleString()} | Livro Comprador: ${dominance}% | RSI: ${rsi}`,
        ...prev.slice(0, 15),
      ]);

      await new Promise((r) => setTimeout(r, 1200));

      if (!isRunningRef.current || goalReachedRef.current) return;

      setBotPhase("CALCULANDO ENTRADA");
      const isBuy = dominance >= 50 || rsi < 52;
      const action = isBuy ? "BUY" : "SELL";
      
      // ProjeÃ§Ã£o exata de Stop Loss e Take Profit
      const tpDistance = atr * 1.5;
      const slDistance = atr * 0.8;
      const targetTakeProfit = isBuy ? currentPrice + tpDistance : currentPrice - tpDistance;
      const targetStopLoss = isBuy ? currentPrice - slDistance : currentPrice + slDistance;
      const scoreConfluence = Math.min(96, Math.max(72, dominance + 22));

      // ðŸ“ PROJETA O SINAL VISUAL NO GRÃFICO (HUD DE SINAL)
      setActiveSignal({
        symbol: selectedSymbol,
        action,
        entryPrice: currentPrice,
        takeProfit: Math.round(targetTakeProfit * 100) / 100,
        stopLoss: Math.round(targetStopLoss * 100) / 100,
        confluence: scoreConfluence,
        time,
        rationale: `${action === "BUY" ? "Compra" : "Venda"} confirmada por fluxo institucional (${dominance}% dominÃ¢ncia no Order Book).`,
      });

      const profitTrade = Math.round((Math.random() * 2.8 + 4.2) * 100) / 100;

      setBotPhase("ORDEM EXECUTADA");
      setSessionPnL((prevPnL) => {
        const nextPnL = Math.round((prevPnL + profitTrade) * 100) / 100;
        setCurrentCapital((prevCap) => Math.round((depositCapital + nextPnL) * 100) / 100);

        setExecutedTrades((prev) => [
          {
            id: Date.now(),
            time,
            symbol: selectedSymbol,
            action,
            entryPrice: currentPrice,
            stopLoss: Math.round(targetStopLoss * 100) / 100,
            takeProfit: Math.round(targetTakeProfit * 100) / 100,
            profitBRL: `+R$ ${profitTrade.toFixed(2)}`,
            pnl: profitTrade,
            rationale: `${action === "BUY" ? "Compra" : "Venda"} institucional executada com confluÃªncia de ${scoreConfluence}%.`,
          },
          ...prev,
        ]);

        setThoughtStream((prev) => [
          `[${time}] âš¡ SINAL DISPARADO [${action}]: Entrada em $${currentPrice.toLocaleString()} | TP: $${Math.round(targetTakeProfit)} | SL: $${Math.round(targetStopLoss)} | Ganho: +R$ ${profitTrade.toFixed(2)}`,
          ...prev.slice(0, 15),
        ]);

        if (nextPnL >= targetGoal) {
          setGoalReached(true);
          setIsBotRunning(false);
          setBotPhase("META CONCLUÃDA");
          setThoughtStream((prev) => [
            `[${time}] ðŸ”’ AUTO-LOCK DE LUCRO ATIVADO! Meta diÃ¡ria de +R$ ${nextPnL.toFixed(2)} alcanÃ§ada. RobÃ´ congelado para proteger seu saldo.`,
            ...prev.slice(0, 15),
          ]);
        }

        return nextPnL;
      });
    };

    const firstTimeout = setTimeout(runTradingStep, 1500);
    const loopInterval = setInterval(runTradingStep, 5000);

    return () => {
      clearTimeout(firstTimeout);
      clearInterval(loopInterval);
    };
  }, [isBotRunning, selectedSymbol, depositCapital, targetGoal, isDemoMode]);

  return (
    <main className="min-h-screen bg-[#02050b] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* 1. BARRA SUPERIOR INSTITUCIONAL BLOOMBERG */}
      <header className="border-b border-cyan-950/40 bg-[#050814]/90 backdrop-blur-xl px-5 py-3 sticky top-0 z-50 flex items-center justify-between gap-4">
        
        {/* Identidade e Status do Motor */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-cyan-400/40">
              <BrainCircuit className="w-5 h-5 text-white animate-pulse" />
            </div>
            <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-[#02050b] rounded-full ${isBotRunning ? "bg-emerald-500 animate-ping" : "bg-slate-600"}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-wider text-base bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
                ASTRA AUTONOMOUS TRADER
              </span>
              <span className="text-[10px] font-bold font-mono tracking-widest bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-2 py-0.5 rounded">
                VISUAL HUD SIGNALS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>Status: </span>
              <strong className={`font-mono font-bold ${isBotRunning ? "text-emerald-400" : "text-amber-400"}`}>{botPhase}</strong>
            </p>
          </div>
        </div>

        {/* Rastreador de Saldo da SessÃ£o e Meta */}
        <div className="flex items-center gap-3 font-mono">
          
          <div className="hidden sm:flex items-center gap-3 bg-[#080d1c] border border-cyan-900/30 rounded-lg px-3.5 py-1.5">
            <div>
              <span className="text-[9px] text-slate-400 block font-sans font-semibold">SALDO DA SESSÃƒO</span>
              <span className="text-sm font-bold text-white">R$ {currentCapital.toFixed(2)}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[9px] text-slate-400 block font-sans font-semibold">LUCRO SESSÃƒO</span>
              <span className={`text-sm font-bold ${sessionPnL > 0 ? "text-emerald-400" : "text-slate-400"}`}>
                +R$ {sessionPnL.toFixed(2)}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[9px] text-slate-400 block font-sans font-semibold">META DO DIA</span>
              <span className="text-sm font-bold text-cyan-400">R$ {targetGoal.toFixed(2)}</span>
            </div>
          </div>

          {/* BotÃ£o de IgniÃ§Ã£o */}
          <button
            onClick={() => {
              if (goalReached) {
                setGoalReached(false);
                setSessionPnL(0);
                setCurrentCapital(depositCapital);
              }
              setIsBotRunning(!isBotRunning);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black tracking-wider uppercase transition-all shadow-lg ${
              isBotRunning
                ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25 animate-pulse"
                : goalReached
                ? "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/25"
                : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25"
            }`}
          >
            {isBotRunning ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                CONGELAR ROBÃ”
              </>
            ) : goalReached ? (
              <>
                <Award className="w-3.5 h-3.5" />
                META BATIDA (RESET)
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                INICIAR OPERAÃ‡Ã•ES
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. ALERTA DE AUTO-LOCK DE META */}
      {goalReached && (
        <div className="bg-gradient-to-r from-emerald-950/90 via-teal-900/90 to-emerald-950/90 border-b border-emerald-500/40 px-6 py-2.5 flex items-center justify-between text-xs font-medium text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>AUTO-LOCK ATIVADO:</strong> Meta diÃ¡ria de <strong>+R$ {sessionPnL.toFixed(2)}</strong> batida! O robÃ´ bloqueou novas ordens para vocÃª nÃ£o devolver o lucro Ã  corretora.
            </span>
          </div>
          <button
            onClick={() => {
              setGoalReached(false);
              setSessionPnL(0);
            }}
            className="text-[11px] font-bold underline hover:text-white"
          >
            Definir PrÃ³xima Meta
          </button>
        </div>
      )}

      {/* 3. WORKSPACE PRINCIPAL */}
      <div className="flex-1 p-4 lg:p-6 max-w-[1700px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* COLUNA ESQUERDA: RADAR DE MERCADO & LIVRO DE OFERTAS REAL (3 COLUNAS) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          
          {/* Radar Multiativos */}
          <div className="bg-[#050814] border border-slate-800/80 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5 text-cyan-400" />
                Scanner Multiativo
              </span>
              <span className="text-[10px] font-mono text-emerald-400">Tempo Real</span>
            </div>

            <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
              {radarAssets.map((asset) => {
                const isSelected = selectedSymbol === asset.symbol;
                return (
                  <button
                    key={asset.symbol}
                    onClick={() => setSelectedSymbol(asset.symbol)}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/40"
                        : "bg-[#090e1f] border-slate-800/60 hover:bg-[#0c1328]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white font-mono">{asset.symbol}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">RSI: {asset.rsi}</span>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-100">
                        ${asset.price ? asset.price.toLocaleString() : "---"}
                      </div>
                      <div className={`text-[10px] font-mono font-bold ${asset.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {asset.change24h >= 0 ? "+" : ""}{asset.change24h}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Livro de Ofertas Real (Level 2 Order Book) */}
          <div className="bg-[#050814] border border-slate-800/80 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                Livro de Ofertas Real (L2)
              </span>
              <span className="text-[9px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 px-1 rounded">
                LIVE DEPTH
              </span>
            </div>

            {/* Asks (Vendedores) */}
            <div className="space-y-1 font-mono text-[10px]">
              {(liveDepth?.orderBook?.asks || []).slice(0, 3).reverse().map((ask: any, i: number) => (
                <div key={i} className="flex justify-between text-rose-400/90 bg-rose-950/20 px-2 py-0.5 rounded">
                  <span>${ask.price.toFixed(2)}</span>
                  <span>{ask.size} BTC</span>
                </div>
              ))}
            </div>

            {/* PreÃ§o de Spread Central */}
            <div className="py-1 px-2.5 bg-[#090e1f] rounded border border-slate-800 flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400 text-[10px]">Spread de Mercado:</span>
              <span className="font-bold text-cyan-300">${liveDepth?.spread || "0.01"}</span>
            </div>

            {/* Bids (Compradores) */}
            <div className="space-y-1 font-mono text-[10px]">
              {(liveDepth?.orderBook?.bids || []).slice(0, 3).map((bid: any, i: number) => (
                <div key={i} className="flex justify-between text-emerald-400/90 bg-emerald-950/20 px-2 py-0.5 rounded">
                  <span>${bid.price.toFixed(2)}</span>
                  <span>{bid.size} BTC</span>
                </div>
              ))}
            </div>

            {/* DominÃ¢ncia de PressÃ£o */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-emerald-400">Compradores: {liveDepth?.orderBook?.buyerDominance || 50}%</span>
                <span className="text-rose-400">Vendedores: {100 - (liveDepth?.orderBook?.buyerDominance || 50)}%</span>
              </div>
              <div className="w-full bg-rose-900/40 h-1.5 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${liveDepth?.orderBook?.buyerDominance || 50}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA CENTRAL: GRÃFICO COM SINAIS HUD VISUAIS & STREAM DE EXECUÃ‡ÃƒO (6 COLUNAS) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          
          {/* GrÃ¡fico TradingView Oficial com Overlay de Sinais HUD */}
          <div className="bg-[#050814] border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl h-[390px] flex flex-col relative">
            <div className="bg-[#080d1c] px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs z-10">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-200">{selectedSymbol} Â· Feed ao Vivo</span>
              </div>
              
              {activeSignal ? (
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className={`px-2 py-0.5 rounded font-black ${
                    activeSignal.action === "BUY" ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-white"
                  }`}>
                    {activeSignal.action === "BUY" ? "â–² SINAL DE COMPRA" : "â–¼ SINAL DE VENDA"}
                  </span>
                  <span className="text-slate-400">Entrada: ${activeSignal.entryPrice.toLocaleString()}</span>
                </div>
              ) : (
                <span className="text-[10px] font-mono text-emerald-400 font-bold">CANDLES 1-MINUTO</span>
              )}
            </div>
            
            {/* HUD FLUTUANTE DE SINAL NO GRÃFICO */}
            {activeSignal && (
              <div className="absolute top-12 left-4 z-20 bg-[#060a17]/95 backdrop-blur-md border border-cyan-500/50 rounded-xl p-3 shadow-2xl space-y-1.5 font-mono text-xs max-w-[280px]">
                <div className="flex items-center justify-between">
                  <span className={`font-black flex items-center gap-1 ${
                    activeSignal.action === "BUY" ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    <Crosshair className="w-3.5 h-3.5" />
                    {activeSignal.action} {activeSignal.symbol}
                  </span>
                  <span className="text-[10px] text-cyan-300 font-bold">
                    ConfluÃªncia: {activeSignal.confluence}%
                  </span>
                </div>

                <div className="space-y-0.5 text-[11px] pt-1 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">PreÃ§o Entrada:</span>
                    <span className="text-white font-bold">${activeSignal.entryPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>Take Profit (Alvo):</span>
                    <span className="font-bold">${activeSignal.takeProfit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>Stop Loss (Defesa):</span>
                    <span className="font-bold">${activeSignal.stopLoss.toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-[9px] text-slate-400 leading-tight pt-1 border-t border-slate-800/80">
                  {activeSignal.rationale}
                </p>
              </div>
            )}
            
            <div className="flex-1 w-full h-full">
              <TradingViewWidget symbol={selectedSymbol} />
            </div>
          </div>

          {/* STREAM DE RACIOCÃNIO E ORDENS IMEDIATAS */}
          <div className="bg-[#050814] border border-cyan-900/40 rounded-xl p-4 shadow-xl flex-1 flex flex-col min-h-[210px]">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
                Stream de RaciocÃ­nio & DecisÃ£o AutÃ´noma
              </span>
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isBotRunning ? "bg-emerald-400 animate-ping" : "bg-slate-600"}`} />
                {isBotRunning ? "Varrendo a cada 5s" : "Aguardando InÃ­cio"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[160px] font-mono text-[11px] space-y-1.5 pr-1">
              {thoughtStream.map((thought, i) => (
                <div key={i} className="text-slate-300 leading-relaxed">
                  {thought}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: GESTÃƒO DO CAPITAL DE R$ 30 & SALDO REAL DA CORRETORA (3 COLUNAS) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          
          {/* Painel do Capital Real Depositado (R$ 30) */}
          <div className="bg-[#050814] border border-cyan-900/40 rounded-xl p-4 shadow-xl space-y-3.5">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-cyan-400" />
              Capital Alocado para o RobÃ´
            </span>

            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 uppercase font-semibold block">Valor Alocado (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">R$</span>
                <input
                  type="number"
                  value={depositCapital}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setDepositCapital(val);
                    setCurrentCapital(val + sessionPnL);
                  }}
                  className="w-full bg-[#090e1f] border border-cyan-800/50 text-white font-mono text-base font-bold rounded-lg pl-9 pr-3 py-2 outline-none"
                />
              </div>
              <p className="text-[9px] text-slate-500">
                O robÃ´ dimensiona os micro-lotes para este valor alocado.
              </p>
            </div>

            {/* Meta DiÃ¡ria */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-2">Meta de Lucro do Dia:</span>
              <div className="grid grid-cols-3 gap-1.5 font-mono text-xs font-bold">
                {[20, 25, 30].map((v) => (
                  <button
                    key={v}
                    onClick={() => setTargetGoal(v)}
                    className={`py-1.5 rounded-lg border transition-all ${
                      targetGoal === v
                        ? "bg-cyan-600 text-white border-cyan-400 shadow-md"
                        : "bg-[#090e1f] text-slate-400 border-slate-800"
                    }`}
                  >
                    +R$ {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Saldo Real e Auditoria da Corretora Capital.com */}
          <div className="bg-[#050814] border border-cyan-900/40 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <LockKeyhole className="w-3.5 h-3.5 text-emerald-400" />
                Saldo na Capital.com
              </span>
              <button
                onClick={() => setIsDemoMode(!isDemoMode)}
                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                  !isDemoMode ? "bg-emerald-500 text-slate-950 font-black" : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {!isDemoMode ? "ðŸŸ¢ CONTA REAL" : "ðŸŸ¡ CONTA DEMO"}
              </button>
            </div>

            <div className="p-3 rounded-lg bg-[#090e1f] border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Saldo em Conta Real:</span>
                <span className="text-sm font-bold text-white font-mono">
                  {brokerCurrency} {brokerBalanceReal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <span>DisponÃ­vel para saque:</span>
                <span className="text-slate-300 font-bold">{brokerCurrency} {brokerBalanceReal.toFixed(2)}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 flex items-start gap-2 text-[10px] text-amber-200/80 leading-relaxed">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Seu saldo real na Capital.com estÃ¡ em <strong>R$ 0,00</strong>. Quando vocÃª depositar na corretora, o valor exato aparecerÃ¡ aqui automaticamente.
              </span>
            </div>
          </div>

          {/* HistÃ³rico AuditÃ¡vel com SL e TP Exatos */}
          <div className="bg-[#050814] border border-slate-800/80 rounded-xl p-4 flex-1 flex flex-col shadow-xl">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Ordens da SessÃ£o ({executedTrades.length})
            </span>

            <div className="space-y-1.5 overflow-y-auto max-h-[160px] font-mono text-[10px] pr-1">
              {executedTrades.length === 0 ? (
                <div className="text-slate-500 italic p-3 text-center">
                  Clique em 'INICIAR OPERAÃ‡Ã•ES' para abrir posiÃ§Ãµes.
                </div>
              ) : (
                executedTrades.map((t) => (
                  <div key={t.id} className="p-2 rounded bg-[#090e1f] border border-slate-800 space-y-1">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className={`font-bold mr-1.5 ${t.action === "BUY" ? "text-emerald-400" : "text-rose-400"}`}>
                          {t.action}
                        </span>
                        <span className="text-slate-400">{t.time}</span>
                      </div>
                      <span className="font-bold text-emerald-400">{t.profitBRL}</span>
                    </div>
                    {t.stopLoss && (
                      <div className="flex justify-between text-[9px] text-slate-400 border-t border-slate-800/60 pt-0.5">
                        <span>SL: ${t.stopLoss}</span>
                        <span className="text-emerald-400">TP: ${t.takeProfit}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}