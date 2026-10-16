"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FlaskConical,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import TradingViewWidget from "@/components/trading-view-chart";
import {
  createPaperState,
  DEFAULT_CONFIG,
  equityBRL,
  paperStep,
  snapshotError,
  validateConfig,
  type Config,
  type PaperState,
  type Snapshot,
} from "@/lib/paper-engine";
import { decodePaper, encodePaper, type Evidence } from "@/lib/paper-storage";

const STORAGE = "astra-paper-v1";
const SYMBOLS = [
  "BTC-USD",
  "ETH-USD",
  "SOL-USD",
  "AVAX-USD",
  "LINK-USD",
  "DOGE-USD",
  "XRP-USD",
];
const money = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      });
const price = (value?: number) =>
  value === undefined
    ? "—"
    : value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function AstraTerminal() {
  const [session, setSession] = useState<PaperState>(() => createPaperState());
  const sessionRef = useRef(session);
  const [config, setConfig] = useState<Config>({ ...DEFAULT_CONFIG });
  const [symbol, setSymbol] = useState("BTC-USD");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [logs, setLogs] = useState<Evidence[]>([]);
  const logsRef = useRef<Evidence[]>([]);
  const [status, setStatus] = useState("Aguardando dados de mercado");
  const [now, setNow] = useState(0);
  const [storageError, setStorageError] = useState("");

  function persist() {
    try {
      localStorage.setItem(
        STORAGE,
        encodePaper(sessionRef.current, logsRef.current),
      );
      setStorageError("");
    } catch {
      setStorageError(
        "Não foi possível salvar esta sessão no navegador. Exporte os dados antes de sair.",
      );
    }
  }
  function commit(next: PaperState) {
    sessionRef.current = next;
    setSession(next);
    persist();
  }
  function record(action: string, message: string, data: Snapshot | null) {
    setStatus(message);
    const entry = { at: Date.now(), action, message, snapshot: data };
    logsRef.current = [...logsRef.current, entry].slice(-300);
    setLogs(logsRef.current);
    persist();
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) {
        const restored = decodePaper(saved);
        const parsed = restored.session;
        if (parsed.position && !SYMBOLS.includes(parsed.position.symbol))
          throw new Error("Ativo salvo não suportado.");
        sessionRef.current = parsed;
        setSession(parsed);
        setConfig(parsed.config);
        logsRef.current = restored.evidence;
        setLogs(restored.evidence);
        if (parsed.position) setSymbol(parsed.position.symbol);
        setStatus(
          "Sessão virtual restaurada. Entradas pausadas; posições abertas continuam sendo monitoradas.",
        );
      }
    } catch {
      setStorageError(
        "Sessão salva inválida ou armazenamento indisponível. Uma nova carteira virtual foi carregada.",
      );
    }
    setReady(true);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setSnapshot(null);
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/live-depth?symbol=${encodeURIComponent(symbol)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || data.success !== true || data.symbol !== symbol)
          throw new Error("Feed indisponível. Nenhuma entrada autorizada.");
        const invalid = snapshotError(data, Date.now());
        if (invalid) throw new Error(invalid);
        setSnapshot(data);
        const result = paperStep(
          sessionRef.current,
          data,
          Date.now(),
          runningRef.current,
        );
        commit(result.state);
        if (result.state.locked) {
          runningRef.current = false;
          setRunning(false);
        }
        record(result.action, result.message, data);
      } catch (error) {
        if (cancelled) return;
        setSnapshot(null);
        record(
          "FEED_ERROR",
          error instanceof Error ? error.message : "Erro no feed.",
          null,
        );
      } finally {
        if (!cancelled) timer = setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [symbol, ready]);

  const feedError = snapshotError(snapshot, now || Date.now());
  const equity = feedError
    ? session.position
      ? null
      : session.cashBRL
    : equityBRL(session, snapshot);
  const unrealized =
    equity === null
      ? null
      : equity - session.config.initialBRL - session.realizedBRL;
  const total = equity === null ? null : equity - session.config.initialBRL;
  const age = snapshot
    ? Math.max(0, Math.floor(((now || Date.now()) - snapshot.timestamp) / 1000))
    : null;
  const hasHistory = !!session.position || session.trades.length > 0;
  const panel = "rounded-2xl border border-slate-800 bg-[#0b1220]";
  const input =
    "w-full rounded-lg border border-slate-700 bg-[#080e19] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-50";

  function toggle() {
    if (session.locked) return;
    const next = !runningRef.current;
    runningRef.current = next;
    setRunning(next);
    record(
      next ? "START" : "PAUSE",
      next
        ? "Simulação iniciada. Entradas dependem de confluência e custos; não existe operação obrigatória."
        : "Novas entradas pausadas. Posição virtual aberta continua monitorada.",
      snapshot,
    );
  }
  function apply() {
    try {
      validateConfig(config);
      commit(createPaperState(config));
      record(
        "CONFIG",
        "Parâmetros aplicados à nova carteira virtual. USD/BRL é um valor manual, não cotação ao vivo.",
        null,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Parâmetros inválidos.");
    }
  }
  function reset() {
    if (session.position || running) return;
    if (
      hasHistory &&
      !window.confirm(
        "Reiniciar a carteira apaga o histórico local desta simulação. Exporte os resultados primeiro. Continuar?",
      )
    )
      return;
    try {
      validateConfig(config);
      commit(createPaperState(config));
      logsRef.current = [];
      setLogs([]);
      record(
        "RESET",
        "Nova sessão virtual. Histórico anterior não foi combinado com os novos resultados.",
        null,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Parâmetros inválidos.");
    }
  }
  function exportEvidence() {
    const body = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        mode: "PAPER_SPOT_ONLY",
        strategy: "book-trend-v1-unvalidated",
        fxSource: "MANUAL_FIXED",
        warning:
          "Sem ordens reais. Resultados locais editáveis e não auditados. Logs incluem no máximo os últimos 300 eventos.",
        session,
        evidence: logsRef.current,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([body], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `astra-paper-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#060b14] text-slate-100">
      <header className="border-b border-slate-800 px-4 py-5 sm:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-700/40 bg-cyan-950/40 p-3">
              <Activity className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-[.18em]">
                ASTRA <span className="text-cyan-300">LAB</span>
              </h1>
              <p className="text-xs text-slate-400">
                Pesquisa de estratégia · evidência antes de capital
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-700/50 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-300">
              SIMULAÇÃO · SEM DINHEIRO REAL
            </span>
            <button
              onClick={exportEvidence}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs hover:border-cyan-500"
            >
              <Download size={15} />
              Exportar evidências
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8">
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 text-sm text-amber-100">
          <FlaskConical className="mt-0.5 shrink-0 text-amber-400" size={20} />
          <p>
            <strong>Dados de mercado reais. Carteira e ordens virtuais.</strong>{" "}
            Nenhum depósito é recebido aqui. A estratégia não tem rentabilidade
            comprovada. Taxas, perdas e slippage entram no resultado; R$ 30 não
            viram renda garantida. Esta versão não opera na Capital.com.
          </p>
        </div>
        {storageError && (
          <p role="alert" className="mb-4 text-sm text-rose-300">
            {storageError}
          </p>
        )}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "PATRIMÔNIO VIRTUAL", value: equity, icon: Wallet },
            {
              label: "RESULTADO REALIZADO",
              value: session.realizedBRL,
              icon: ArrowUpRight,
            },
            {
              label: "RESULTADO EM ABERTO",
              value: unrealized,
              icon: ArrowDownRight,
            },
            {
              label: "TAXAS PAGAS NA SIMULAÇÃO",
              value: session.feesBRL,
              icon: ShieldCheck,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className={`${panel} p-4`}>
              <div className="mb-3 flex items-center justify-between gap-2 text-[10px] tracking-wider text-slate-400">
                <span>{label}</span>
                <Icon size={16} />
              </div>
              <p
                className={`font-mono text-lg font-semibold sm:text-2xl ${value !== null && value < 0 ? "text-rose-400" : "text-slate-100"}`}
              >
                {money(value)}
              </p>
            </div>
          ))}
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[250px_minmax(0,1fr)_300px]">
          <aside className="space-y-5">
            <section className={`${panel} p-4`}>
              <h2 className="mb-4 text-xs font-semibold tracking-wider text-slate-300">
                MERCADO SPOT · USD
              </h2>
              <div className="space-y-2">
                {SYMBOLS.map((s) => (
                  <button
                    key={s}
                    disabled={!!session.position || running}
                    onClick={() => setSymbol(s)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm disabled:cursor-not-allowed ${s === symbol ? "border-cyan-700 bg-cyan-950/40 text-cyan-200" : "border-slate-800 text-slate-400 hover:border-slate-600"}`}
                  >
                    {s}
                    <span className="font-mono text-xs">
                      {s === symbol ? price(snapshot?.price) : "→"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Troca de ativo bloqueada enquanto há posição ou novas entradas
                estão ativas.
              </p>
            </section>
            <section className={`${panel} p-4`}>
              <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-300">
                LIVRO COINBASE · 6 NÍVEIS
              </h2>
              <p className="mb-3 flex items-center gap-2 text-xs text-slate-400">
                <Radio
                  size={14}
                  className={feedError ? "text-rose-400" : "text-cyan-300"}
                />
                {feedError
                  ? "Indisponível / antigo"
                  : `Snapshot recebido há ${age}s`}
              </p>
              <div className="space-y-1 font-mono text-xs">
                {(snapshot?.orderBook.asks || [])
                  .slice(0, 3)
                  .reverse()
                  .map((a, n) => (
                    <div
                      key={`a${n}`}
                      className="flex justify-between rounded bg-rose-950/20 p-1.5 text-rose-300"
                    >
                      <span>{price(a.price)}</span>
                      <span>{a.size.toFixed(5)}</span>
                    </div>
                  ))}
                <div className="py-2 text-center text-slate-400">
                  Spread: {snapshot ? price(snapshot.ask - snapshot.bid) : "—"}
                </div>
                {(snapshot?.orderBook.bids || []).slice(0, 3).map((b, n) => (
                  <div
                    key={`b${n}`}
                    className="flex justify-between rounded bg-emerald-950/20 p-1.5 text-emerald-300"
                  >
                    <span>{price(b.price)}</span>
                    <span>{b.size.toFixed(5)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Liquidez compradora:{" "}
                <strong className="text-cyan-300">
                  {snapshot
                    ? `${snapshot.orderBook.buyerDominance.toFixed(1)}%`
                    : "—"}
                </strong>
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Desbalanceamento não identifica instituições e não é
                probabilidade de acerto.
              </p>
            </section>
          </aside>
          <div className="min-w-0 space-y-5">
            <section className={`${panel} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
                <h2 className="text-sm font-semibold">
                  {symbol} <span className="text-slate-500">/ Coinbase</span>
                </h2>
                <span className="text-xs text-slate-400">
                  Gráfico indicativo · 1 minuto
                </span>
              </div>
              <div className="h-[420px]">
                <TradingViewWidget symbol={symbol} />
              </div>
            </section>
            <section className={`${panel} p-4`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Registro de decisões</h2>
                <button
                  disabled={
                    !ready || session.locked || (!running && !!feedError)
                  }
                  onClick={toggle}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${running ? "bg-slate-700 text-white" : "bg-cyan-300 text-slate-950"}`}
                >
                  {running ? <Pause size={15} /> : <Play size={15} />}
                  {running
                    ? "Pausar entradas"
                    : session.locked
                      ? "Sessão bloqueada"
                      : "Iniciar simulação"}
                </button>
              </div>
              <p
                role="status"
                className="mb-4 rounded-lg bg-[#070d17] p-3 text-sm leading-relaxed text-cyan-100"
              >
                {status}
              </p>
              <div className="max-h-60 space-y-2 overflow-auto font-mono text-[11px]">
                {logs.length === 0 ? (
                  <p className="text-slate-500">
                    O feed é consultado sem executar operações reais.
                  </p>
                ) : (
                  [...logs]
                    .reverse()
                    .slice(0, 40)
                    .map((log, n) => (
                      <div
                        key={`${log.at}-${n}`}
                        className="border-l border-slate-700 pl-3 leading-relaxed"
                      >
                        <span className="text-slate-500">
                          {new Date(log.at).toLocaleTimeString("pt-BR")} ·{" "}
                          {log.action}{" "}
                        </span>
                        <span
                          className={
                            log.action === "FEED_ERROR"
                              ? "text-rose-300"
                              : "text-slate-300"
                          }
                        >
                          {log.message}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </section>
            <section className={`${panel} p-4`}>
              <h2 className="mb-4 text-sm font-semibold">
                Operações encerradas{" "}
                <span className="text-slate-500">
                  ({session.trades.length})
                </span>
              </h2>
              {!session.trades.length ? (
                <p className="text-sm text-slate-500">
                  Nenhum resultado fabricado. Lucro ou perda só é registrado
                  após uma saída simulada.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-auto">
                  {[...session.trades].reverse().map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#080e19] p-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold">
                          {t.symbol} · compra spot
                        </p>
                        <p className="mt-1 text-slate-500">
                          {t.reason} ·{" "}
                          {new Date(t.closedAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-mono ${t.pnlBRL >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                        >
                          {money(t.pnlBRL)}
                        </p>
                        <p className="mt-1 text-slate-500">
                          Taxas {money(t.feesBRL)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          <aside className="space-y-5">
            <section className={`${panel} p-4`}>
              <h2 className="mb-4 text-sm font-semibold">
                Parâmetros da carteira virtual
              </h2>
              <div className="space-y-3">
                {[
                  {
                    key: "initialBRL",
                    label: "Capital virtual inicial (R$)",
                    min: 0.01,
                  },
                  {
                    key: "usdBRL",
                    label: "USD/BRL manual, fixo na sessão",
                    min: 0.01,
                  },
                  {
                    key: "feeBps",
                    label: "Taxa por lado (bps; 60 = 0,60%)",
                    min: 0,
                  },
                  {
                    key: "slippageBps",
                    label: "Slippage por lado (bps)",
                    min: 0,
                  },
                ].map(({ key, label, min }) => (
                  <label key={key} className="block text-xs text-slate-400">
                    {label}
                    <input
                      aria-label={label}
                      className={`${input} mt-1.5`}
                      type="number"
                      step="0.01"
                      min={min}
                      disabled={hasHistory || running}
                      value={config[key as keyof Config]}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          [key]: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={apply}
                disabled={hasHistory || running}
                className="mt-4 w-full rounded-lg border border-cyan-800 py-2 text-xs font-semibold text-cyan-200 disabled:opacity-40"
              >
                Aplicar parâmetros
              </button>
              <div className="mt-4 space-y-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
                <p>
                  Risco planejado: até{" "}
                  <strong className="text-white">1% / entrada</strong>
                </p>
                <p>
                  Exposição: até{" "}
                  <strong className="text-white">25% sem alavancagem</strong>
                </p>
                <p>
                  Bloqueio de perda:{" "}
                  <strong className="text-white">3% da sessão</strong>
                </p>
                <p>
                  Meta de lucro:{" "}
                  <strong className="text-white">
                    sem promessa ou obrigação
                  </strong>
                </p>
                <p>Cooldown: 60s · posição: até 15min</p>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-amber-200/70">
                Taxas e câmbio são hipóteses manuais, não tarifas verificadas da
                sua conta. Gaps e intervalos de consulta podem superar o risco
                planejado.
              </p>
            </section>
            <section className={`${panel} p-4`}>
              <h2 className="mb-3 text-sm font-semibold">Posição virtual</h2>
              {session.position ? (
                <>
                  <p className="text-xs text-slate-400">
                    {session.position.quantity.toFixed(8)}{" "}
                    {session.position.symbol.split("-")[0]} · compra
                  </p>
                  <dl className="mt-3 space-y-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <dt>Entrada</dt>
                      <dd>{price(session.position.entry)}</dd>
                    </div>
                    <div className="flex justify-between text-rose-300">
                      <dt>Stop observado</dt>
                      <dd>{price(session.position.stop)}</dd>
                    </div>
                    <div className="flex justify-between text-emerald-300">
                      <dt>Alvo observado</dt>
                      <dd>{price(session.position.target)}</dd>
                    </div>
                  </dl>
                  <button
                    disabled={!!feedError}
                    onClick={() => {
                      const result = paperStep(
                        sessionRef.current,
                        snapshot,
                        Date.now(),
                        false,
                        true,
                      );
                      commit(result.state);
                      if (result.state.locked) {
                        runningRef.current = false;
                        setRunning(false);
                      }
                      record(result.action, result.message, snapshot);
                    }}
                    className="mt-4 w-full rounded-lg border border-rose-800 py-2 text-xs text-rose-200 disabled:opacity-40"
                  >
                    Encerrar posição simulada
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Sem exposição virtual aberta.
                </p>
              )}
              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                Monitoramento somente com a página aberta. Fechar a aba não
                executa stops. Pausar bloqueia entradas, não o monitoramento da
                posição.
              </p>
            </section>
            <section className={`${panel} p-4`}>
              <h2 className="mb-3 text-sm font-semibold">
                Evidência, não promessa
              </h2>
              <p className="text-xs leading-relaxed text-slate-400">
                Resultado total:{" "}
                <span
                  className={
                    total !== null && total < 0 ? "text-rose-300" : "text-white"
                  }
                >
                  {money(total)}
                </span>
                . Ainda não há backtest fora da amostra nem vantagem comprovada.
                A ausência de operação também é um resultado válido.
              </p>
              <p className="mt-3 text-xs text-slate-500">
                RSI simples 14: {snapshot?.indicators.rsi.toFixed(1) ?? "—"}
                <br />
                VWAP móvel 30min: {price(snapshot?.indicators.vwap)}
                <br />
                ATR simples 14: {price(snapshot?.indicators.atr)}
              </p>
              <button
                disabled={!!session.position || running}
                onClick={reset}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 py-2 text-xs text-slate-400 disabled:opacity-30"
              >
                <RotateCcw size={13} />
                Nova sessão virtual
              </button>
            </section>
          </aside>
        </div>
        <footer className="mt-8 border-t border-slate-800 pt-4 text-[11px] leading-relaxed text-slate-500">
          Fonte: Coinbase Exchange REST; gráfico TradingView Coinbase. Polling a
          cada 5s após resposta, não alta frequência. Resultados e parâmetros
          ficam neste navegador e podem ser alterados; exportação não é
          auditoria independente. Não armazenamos credenciais de corretora.
        </footer>
      </div>
    </main>
  );
}
