import {
  validateConfig,
  type PaperState,
  type Position,
  type Snapshot,
} from "./paper-engine";
export interface Evidence {
  at: number;
  action: string;
  message: string;
  snapshot: Snapshot | null;
}
export interface StoredPaper {
  version: 2;
  session: PaperState;
  evidence: Evidence[];
}
const finite = (...values: number[]) => values.every(Number.isFinite);
const near = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));
function validatePosition(p: Position, state: PaperState, now: number) {
  const hasPlan = p && [p.strategyId,p.signalCandleTime,p.timeframeSeconds,p.maxHoldingMs].some(v=>v!==undefined);
  if (hasPlan && (!['trend_pullback','range_reversion','breakout'].includes(p.strategyId || '') || !finite(p.signalCandleTime!,p.timeframeSeconds!,p.maxHoldingMs!) || ![60,3600].includes(p.timeframeSeconds!) || p.signalCandleTime! < 0 || (p.signalCandleTime! + p.timeframeSeconds!) * 1000 > p.openedAt || p.maxHoldingMs !== p.timeframeSeconds! * 48 * 1000)) throw new Error('Plano de estratégia salvo inválido.');
  if (
    !p ||
    typeof p.symbol !== "string" ||
    !/^[A-Z0-9]{2,12}-USD$/.test(p.symbol) ||
    !finite(p.quantity, p.entry, p.stop, p.target, p.openedAt, p.entryFeeBRL) ||
    p.quantity <= 0 ||
    p.entry <= 0 ||
    p.stop <= 0 ||
    p.stop >= p.entry ||
    p.target <= p.entry ||
    p.entryFeeBRL < 0 ||
    p.openedAt < 0 ||
    p.openedAt > now + 2000 ||
    !near(
      p.entryFeeBRL,
      (p.quantity * p.entry * state.config.usdBRL * state.config.feeBps) /
        10000,
    )
  )
    throw new Error("Posição salva inválida.");
}
export function validatePaperState(
  input: unknown,
  now = Date.now(),
): PaperState {
  if (!input || typeof input !== "object")
    throw new Error("Sessão salva inválida.");
  const state = input as PaperState;
  validateConfig(state.config);
  if (state.lastSignalCandleTime !== undefined && (!Number.isFinite(state.lastSignalCandleTime) || state.lastSignalCandleTime < 0 || state.lastSignalCandleTime * 1000 > now + 2000)) throw new Error('Último sinal salvo inválido.');
  if (
    state.version !== 1 ||
    !Array.isArray(state.trades) ||
    !finite(
      state.cashBRL,
      state.realizedBRL,
      state.feesBRL,
      state.lastClosedAt,
      state.lastSnapshotAt,
    ) ||
    state.cashBRL < -1e-8 ||
    state.feesBRL < 0 ||
    state.lastClosedAt < 0 ||
    state.lastSnapshotAt < 0 ||
    state.lastClosedAt > now + 2000 ||
    state.lastSnapshotAt > now + 2000 ||
    typeof state.locked !== "boolean" ||
    typeof state.lockReason !== "string"
  )
    throw new Error("Sessão salva inválida.");
  let pnl = 0;
  let fees = 0;
  let previousClose = 0;
  const ids = new Set<string>();
  for (const trade of state.trades) {
    validatePosition(trade, state, now);
    if (
      !finite(trade.closedAt, trade.exit, trade.pnlBRL, trade.feesBRL) ||
      trade.exit <= 0 ||
      trade.feesBRL < trade.entryFeeBRL ||
      trade.closedAt < trade.openedAt ||
      trade.closedAt > now + 2000 ||
      trade.openedAt < previousClose ||
      typeof trade.id !== "string" ||
      !trade.id ||
      ids.has(trade.id) ||
      typeof trade.reason !== "string" ||
      !trade.reason
    )
      throw new Error("Trade salvo inválido.");
    const exitFee =
      (trade.quantity *
        trade.exit *
        state.config.usdBRL *
        state.config.feeBps) /
      10000;
    const expectedPnl =
      trade.quantity * (trade.exit - trade.entry) * state.config.usdBRL -
      trade.entryFeeBRL -
      exitFee;
    if (
      !near(trade.feesBRL, trade.entryFeeBRL + exitFee) ||
      !near(trade.pnlBRL, expectedPnl)
    )
      throw new Error("Resultado salvo inconsistente.");
    ids.add(trade.id);
    pnl += trade.pnlBRL;
    fees += trade.feesBRL;
    previousClose = trade.closedAt;
  }
  if (state.position) {
    validatePosition(state.position, state, now);
    if (state.position.openedAt < previousClose)
      throw new Error("Posição anterior ao fechamento mais recente.");
    fees += state.position.entryFeeBRL;
  } else if (state.position !== null)
    throw new Error("Campo de posição ausente.");
  const committed = state.position
    ? state.position.quantity * state.position.entry * state.config.usdBRL +
      state.position.entryFeeBRL
    : 0;
  if (
    !near(state.realizedBRL, pnl) ||
    !near(state.feesBRL, fees) ||
    !near(state.cashBRL, state.config.initialBRL + pnl - committed) ||
    state.lastClosedAt !== previousClose
  )
    throw new Error("Ledger salvo não reconcilia.");
  const signalTimes = [...state.trades, ...(state.position ? [state.position] : [])].map(p=>p.signalCandleTime).filter((v):v is number=>v!==undefined);
  if(signalTimes.length && state.lastSignalCandleTime !== Math.max(...signalTimes)) throw new Error('Deduplicação de sinais não reconcilia com o ledger.');
  return state;
}
export function encodePaper(session: PaperState, evidence: Evidence[]): string {
  return JSON.stringify({
    version: 2,
    session,
    evidence: evidence.slice(-300),
  } satisfies StoredPaper);
}
export function decodePaper(text: string, now = Date.now()): StoredPaper {
  const input = JSON.parse(text);
  // Compatibilidade com a primeira prévia: restaura o ledger validado sem inventar eventos ausentes.
  if (input?.version === 1)
    return {
      version: 2,
      session: validatePaperState(input, now),
      evidence: [],
    };
  if (
    input?.version !== 2 ||
    !Array.isArray(input.evidence) ||
    input.evidence.length > 300
  )
    throw new Error("Formato salvo inválido.");
  const session = validatePaperState(input.session, now);
  const evidence: Evidence[] = input.evidence;
  if (
    evidence.some(
      (e) =>
        !e ||
        !Number.isFinite(e.at) ||
        e.at < 0 ||
        e.at > now + 2000 ||
        typeof e.action !== "string" ||
        typeof e.message !== "string" ||
        e.action.length > 40 ||
        e.message.length > 3000 ||
        (e.snapshot !== null &&
          (!e.snapshot || typeof e.snapshot !== "object")),
    )
  )
    throw new Error("Evidências salvas inválidas.");
  return { version: 2, session, evidence };
}
