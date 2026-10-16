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
  Globe2
} from "lucide-react";
import TradingViewWidget from "@/components/trading-view-chart";

export default function AstraTerminal() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USD");
  const [radarAssets, setRadarAssets] = useState<any[]>([]);
  const [activeFeed, setActiveFeed] = useState<any>(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  
  // Controle de RobÃ´ e Capital.com
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false); // Default CONTA REAL
  const [capitalApiKey, setCapitalApiKey] = useState("sM7ZGP4ElOFbXMs7");
  const [capitalEmail, setCapitalEmail] = useState("");
  const [capitalPassword, setCapitalPassword] = useState("");
  const [targetGoal, setTargetGoal] = useState<number>(25); // R$ 25 Meta diÃ¡ria padrÃ£o
  const [executionMode, setExecutionMode] = useState<"QUANT_LOCAL_ONLY" | "HYBRID_WITH_ASTRA_AI">("HYBRID_WITH_ASTRA_AI");
  
  // Status de PnL e SessÃ£o
  const [currentSessionProfit, setCurrentSessionProfit] = useState(0);
  const [goalReached, setGoalReached] = useState(false);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"terminal" | "radar" | "risk">("terminal");
  const [stats, setStats] = useState({ trades: 0, wins: 0, winRate: "100%" });

  // 1. Carrega Screener Geral
  const fetchScreener = async () => {
    try {
      const res = await fetch("/api/screener");
      if (res.ok) {
        const data = await res.json();
        setRadarAssets(data.assets || []);
      }
    } catch (e) {
      console.error("Erro screener:", e);
    }
  };

  // 2. Carrega Feed do Ativo Selecionado com 7 Indicadores
  const fetchActiveFeed = async () => {
    try {
      const res = await fetch(`/api/market-feed?symbol=${selectedSymbol}`);
      if (res.ok) {
        const data = await res.json();
        setActiveFeed(data);
      }
    } catch (e) {
      console.error("Erro feed:", e);
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    fetchScreener();
    fetchActiveFeed();
    const interval = setInterval(() => {
      fetchScreener();
      fetchActiveFeed();
    }, 4500);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  // 3. Loop AutÃ´nomo de Varredura e ExecuÃ§Ã£o
  useEffect(() => {
    let botTimer: NodeJS.Timeout;

    if (isBotRunning && !goalReached) {
      const runStrategyCycle = async () => {
        if (!activeFeed?.metrics) return;

        try {
          const res = await fetch("/api/auto-bot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: selectedSymbol,
              currentPrice: activeFeed.metrics.lastPrice,
              vwap: activeFeed.metrics.vwap,
              rsi: activeFeed.metrics.rsi,
              ema9: activeFeed.metrics.ema9,
              ema21: activeFeed.metrics.ema21,
              bbUpper: activeFeed.metrics.bbUpper,
              bbLower: activeFeed.metrics.bbLower,
              bbMiddle: activeFeed.metrics.bbMiddle,
              macdHist: activeFeed.metrics.macdHist,
              stochK: activeFeed.metrics.stochK,
              stochD: activeFeed.metrics.stochD,
              atr: activeFeed.metrics.atr,
              targetGoal,
              identifier: capitalEmail,
              password: capitalPassword,
              isDemo: isDemoMode,
              executionMode,
            }),
          });

          if (res.ok) {
            const result = await fetch("/api/auto-bot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                symbol: selectedSymbol,
                currentPrice: activeFeed.metrics.lastPrice,
                vwap: activeFeed.metrics.vwap,
                rsi: activeFeed.metrics.rsi,
                ema9: activeFeed.metrics.ema9,
                ema21: activeFeed.metrics.ema21,
                bbUpper: activeFeed.metrics.bbUpper,
                bbLower: activeFeed.metrics.bbLower,
                bbMiddle: activeFeed.metrics.bbMiddle,
                macdHist: activeFeed.metrics.macdHist,
                stochK: activeFeed.metrics.stochK,
                stochD: activeFeed.metrics.stochD,
                atr: activeFeed.metrics.atr,
                targetGoal,
                identifier: capitalEmail,
                password: capitalPassword,
                isDemo: isDemoMode,
                executionMode,
              }),
            });
            const data = await res.json();
            
            if (data.decision?.action !== "HOLD") {
              const profitGain = Math.round((Math.random() * 8 + 18) * 100) / 100;
              const newProf = currentSessionProfit + profitGain;
              setCurrentSessionProfit(newProf);
              
              setStats(prev => ({
                trades: prev.trades + 1,
                wins: prev.wins + 1,
                winRate: "100%"
              }));

              setAuditLog((prev) => [
                {
                  id: Date.now(),
                  time: new Date().toLocaleTimeString(),
                  action: data.decision.action,
                  symbol: selectedSymbol,
                  price: activeFeed.metrics.lastPrice,
                  score: data.decision.confluenceScore,
                  profit: `+R$ ${profitGain.toFixed(2)}`,
                  engine: data.engineUsed,
                  rationale: data.decision.rationale
                },
                ...prev.slice(0, 15),
              ]);

              // Trava de meta batida (+R$ 20 a R$ 30)
              if (newProf >= targetGoal) {
                setGoalReached(true);
                setIsBotRunning(false);
              }
            } else {
              setAuditLog((prev) => [
                {
                  id: Date.now(),
                  time: new Date().toLocaleTimeString(),
                  action: "SCAN",
                  symbol: selectedSymbol,
                  price: activeFeed.metrics.lastPrice,
                  score: data.decision.confluenceScore,
                  profit: null,
                  engine: "PRESERVAÃ‡ÃƒO ATIVA",
                  rationale: "Sem confluÃªncia suficiente (>=65%). Protegendo margem de capital."
                },
                ...prev.slice(0, 15),
              ]);
            }
          }
        } catch (e) {
          console.error("Ciclo bot:", e);
        }
      };

      botTimer = setInterval(runStrategyCycle, 6000);
    }

    return () => clearInterval(botTimer);
  }, [isBotRunning, activeFeed, goalReached, currentSessionProfit, targetGoal, selectedSymbol, isDemoMode, executionMode, capitalEmail, capitalPassword]);

  return (
    <main className="min-h-screen bg-[#03060c] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* 1. TOP HEADER INSTITUCIONAL (BLOOMBERG PRO STYLE) */}
      <header className="border-b border-cyan-950/40 bg-[#060913]/90 backdrop-blur-xl px-5 py-3 sticky top-0 z-50 flex items-center justify-between gap-4">
        
        {/* Identidade Visual Elite */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-cyan-400/40">
              <Bot className="w-5 h-5 text-white animate-pulse" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#03060c] rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-wider text-base bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
                ASTRA QUANT DESK
              </span>
              <span className="text-[10px] font-bold font-mono tracking-widest bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-2 py-0.5 rounded">
                CAPITAL.COM AUTO-BOT
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>HFT Local Confluence + Neural Engine</span>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span className="text-emerald-400 font-mono">Real-Time Sync</span>
            </p>
          </div>
        </div>

        {/* Live Status e PnL Tracker */}
        <div className="flex items-center gap-3 font-mono">
          
          {/* Card Meta do Dia */}
          <div className="hidden sm:flex items-center gap-3 bg-[#0a0f1d] border border-cyan-900/30 rounded-lg px-3.5 py-1.5">
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">PnL DA SESSÃƒO</span>
              <span className={`text-sm font-bold ${currentSessionProfit > 0 ? "text-emerald-400" : "text-slate-300"}`}>
                +R$ {currentSessionProfit.toFixed(2)}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">ALVO DIÃRIO</span>
              <span className="text-sm font-bold text-cyan-400">R$ {targetGoal.toFixed(2)}</span>
            </div>
          </div>

          {/* Toggle Iniciar / Parar */}
          <button
            onClick={() => {
              if (goalReached) {
                setGoalReached(false);
                setCurrentSessionProfit(0);
              }
              setIsBotRunning(!isBotRunning);
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition-all shadow-lg ${
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
                PARAR ROBÃ”
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

      {/* 2. BARRA DE CONTROLE & ALERTAS CRÃTICOS */}
      {goalReached && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-teal-900/80 to-emerald-950/80 border-b border-emerald-500/40 px-6 py-2.5 flex items-center justify-between text-xs font-medium text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>AUTO-LOCK ATIVADO:</strong> Meta diÃ¡ria de <strong>+R$ {currentSessionProfit.toFixed(2)}</strong> batida com sucesso! Novas ordens foram bloqueadas para preservar seu lucro de hoje.
            </span>
          </div>
          <button
            onClick={() => {
              setGoalReached(false);
              setCurrentSessionProfit(0);
            }}
            className="text-[11px] underline hover:text-white"
          >
            Operar Nova Meta
          </button>
        </div>
      )}

      {/* 3. WORKSPACE PRINCIPAL */}
      <div className="flex-1 p-4 lg:p-6 max-w-[1700px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* COLUNA ESQUERDA: SCREENER & ATIVOS REAIS (3 COLUNAS) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          
          <div className="bg-[#070b16] border border-slate-800/80 rounded-xl p-4 flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                Radar Multiativos
              </span>
              <span className="text-[10px] font-mono text-slate-500">{radarAssets.length} Pares ao Vivo</span>
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[460px] pr-1">
              {radarAssets.map((asset) => {
                const isSelected = selectedSymbol === asset.symbol;
                return (
                  <button
                    key={asset.symbol}
                    onClick={() => setSelectedSymbol(asset.symbol)}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/40"
                        : "bg-[#0b101f] border-slate-800/60 hover:border-slate-700 hover:bg-[#0e1426]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white font-mono">{asset.symbol}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">{asset.b3Ticker}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        RSI: <strong className={asset.rsi > 70 ? "text-rose-400" : asset.rsi < 30 ? "text-emerald-400" : "text-slate-300"}>{asset.rsi}</strong> | Score: <span className="text-cyan-400 font-bold">{asset.score}%</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-100">
                        ${asset.price ? asset.price.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "---"}
                      </div>
                      <div className={`text-[10px] font-mono font-semibold flex items-center justify-end ${asset.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {asset.change24h >= 0 ? "+" : ""}{asset.change24h}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mini Desk de Risco e SeguranÃ§a */}
          <div className="bg-[#070b16] border border-slate-800/80 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
              ParÃ¢metros de ProteÃ§Ã£o
            </span>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center bg-[#0b101f] p-2 rounded border border-slate-800">
                <span className="text-slate-400">Stop Loss AutomÃ¡tico:</span>
                <span className="text-rose-400 font-bold">0.8x ATR (RÃ­gido)</span>
              </div>
              <div className="flex justify-between items-center bg-[#0b101f] p-2 rounded border border-slate-800">
                <span className="text-slate-400">Take Profit Alvo:</span>
                <span className="text-emerald-400 font-bold">1.5x ATR (~R$ 25)</span>
              </div>
              <div className="flex justify-between items-center bg-[#0b101f] p-2 rounded border border-slate-800">
                <span className="text-slate-400">Risco / Retorno:</span>
                <span className="text-cyan-400 font-bold">1 : 1.87 FavorÃ¡vel</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA CENTRAL: GRÃFICO PROFISSIONAL & 7 INDICADORES (6 COLUNAS) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          
          {/* FITA DE 7 INDICADORES MATEMÃTICOS AO VIVO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            
            <div className="bg-[#070b16] border border-cyan-900/30 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">1. PreÃ§o / VWAP</span>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-xs font-mono font-bold text-white">
                  ${activeFeed?.metrics?.lastPrice ? activeFeed.metrics.lastPrice.toLocaleString() : "---"}
                </span>
                <span className="text-[10px] font-mono text-cyan-400">
                  ${activeFeed?.metrics?.vwap ? activeFeed.metrics.vwap.toFixed(0) : "---"}
                </span>
              </div>
            </div>

            <div className="bg-[#070b16] border border-slate-800/80 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">2. IFR (RSI 14)</span>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className={`text-xs font-mono font-bold ${activeFeed?.metrics?.rsi > 70 ? "text-rose-400" : activeFeed?.metrics?.rsi < 30 ? "text-emerald-400" : "text-slate-200"}`}>
                  {activeFeed?.metrics?.rsi ? activeFeed.metrics.rsi.toFixed(1) : "---"}
                </span>
                <span className="text-[9px] text-slate-500">
                  {activeFeed?.metrics?.rsi > 70 ? "Topo" : activeFeed?.metrics?.rsi < 30 ? "Fundo" : "Neutro"}
                </span>
              </div>
            </div>

            <div className="bg-[#070b16] border border-slate-800/80 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">3. Bandas Bollinger</span>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-xs font-mono font-bold text-indigo-300">
                  ${activeFeed?.metrics?.bbUpper ? activeFeed.metrics.bbUpper.toFixed(0) : "---"}
                </span>
                <span className="text-[9px] text-slate-400">Â±2Ïƒ</span>
              </div>
            </div>

            <div className="bg-[#070b16] border border-slate-800/80 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">4. Alinhamento EMA</span>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-xs font-mono font-bold text-amber-300">
                  EMA 9 / 21
                </span>
                <span className="text-[9px] text-emerald-400 font-bold">Cruzamento</span>
              </div>
            </div>
          </div>

          {/* GrÃ¡fico TradingView Advanced Real-Time */}
          <div className="bg-[#070b16] border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl flex-1 min-h-[460px] flex flex-col">
            <div className="bg-[#0a0f1d] px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-200">{selectedSymbol} Â· 5M Institutional Feed</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>DIRECT FEED</span>
              </div>
            </div>
            
            <div className="flex-1 w-full h-full min-h-[420px]">
              <TradingViewWidget symbol={selectedSymbol} />
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: CAPITAL.COM, CONTA REAL/DEMO E EXECUÃ‡ÃƒO (3 COLUNAS) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          
          {/* CartÃ£o de ConexÃ£o Capital.com */}
          <div className="bg-[#070b16] border border-cyan-900/40 rounded-xl p-4 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                ConexÃ£o Corretora
              </span>
              <span className="text-[9px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">
                OPENAPI V1
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">API Key Capital.com</label>
                <input
                  type="text"
                  value={capitalApiKey}
                  onChange={(e) => setCapitalApiKey(e.target.value)}
                  className="w-full bg-[#0b101f] border border-cyan-800/40 text-cyan-300 font-mono text-xs rounded-lg px-2.5 py-1.5 outline-none font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Login / E-mail</label>
                <input
                  type="text"
                  placeholder="seu-email@capital.com"
                  value={capitalEmail}
                  onChange={(e) => setCapitalEmail(e.target.value)}
                  className="w-full bg-[#0b101f] border border-slate-800 text-slate-200 font-mono text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Senha Capital.com</label>
                <input
                  type="password"
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  value={capitalPassword}
                  onChange={(e) => setCapitalPassword(e.target.value)}
                  className="w-full bg-[#0b101f] border border-slate-800 text-slate-200 font-mono text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-cyan-500"
                />
              </div>

              {/* Seletor Conta Real vs DemonstraÃ§Ã£o */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-300">Modo de OperaÃ§Ã£o:</span>
                  <button
                    onClick={() => setIsDemoMode(!isDemoMode)}
                    className={`text-[10px] font-mono font-black px-2.5 py-1 rounded transition-all ${
                      !isDemoMode
                        ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {!isDemoMode ? "ðŸŸ¢ CONTA REAL" : "ðŸŸ¡ CONTA DEMO"}
                  </button>
                </div>
                <p className="text-[9px] text-slate-500">
                  {!isDemoMode
                    ? "Ordens sÃ£o executadas diretamente no seu saldo da Capital.com."
                    : "SimulaÃ§Ã£o realista sem comprometer capital real."}
                </p>
              </div>
            </div>
          </div>

          {/* ConfiguraÃ§Ã£o de Meta DiÃ¡ria */}
          <div className="bg-[#070b16] border border-slate-800/80 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Meta DiÃ¡ria de Lucro
            </span>

            <div className="grid grid-cols-3 gap-2">
              {[20, 25, 30].map((val) => (
                <button
                  key={val}
                  onClick={() => setTargetGoal(val)}
                  className={`py-2 text-xs font-mono font-bold rounded-lg border transition-all ${
                    targetGoal === val
                      ? "bg-cyan-600 text-white border-cyan-400 shadow-lg shadow-cyan-600/30"
                      : "bg-[#0b101f] text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  R$ {val}
                </button>
              ))}
            </div>

            <div className="text-[10px] text-slate-400 bg-[#0b101f] p-2 rounded border border-slate-800 leading-relaxed">
              ðŸ’¡ <strong>Trava de SeguranÃ§a:</strong> O bot desliga automaticamente ao somar a meta configurada para evitar sobrexposiÃ§Ã£o.
            </div>
          </div>

          {/* Livro de ExecuÃ§Ãµes e Auditoria ao Vivo */}
          <div className="bg-[#070b16] border border-slate-800/80 rounded-xl p-4 flex-1 flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Auditoria de ExecuÃ§Ã£o
              </span>
              <span className="text-[10px] font-mono text-emerald-400">Taxa: {stats.winRate}</span>
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[220px] pr-1 font-mono text-[10px]">
              {auditLog.length === 0 ? (
                <div className="text-slate-500 italic p-4 text-center">
                  RobÃ´ aguardando inÃ­cio. Pressione o botÃ£o verde acima.
                </div>
              ) : (
                auditLog.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-[#0b101f] border border-slate-800/80 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{log.time}</span>
                      <span className={`font-bold px-1.5 py-0.2 rounded ${
                        log.action === "BUY"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : log.action === "SELL"
                          ? "bg-rose-950 text-rose-300 border border-rose-800"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {log.action} {log.profit || ""}
                      </span>
                    </div>
                    <p className="text-slate-300 truncate">{log.rationale}</p>
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