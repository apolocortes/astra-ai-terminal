// Simulação spot educacional. Nenhuma função envia ordens a uma corretora.
export interface Snapshot {
  success: true;
  symbol: string;
  timestamp: number;
  price: number;
  bid: number;
  ask: number;
  source: string;
  marketTimestamp: number;
  orderBook: {
    buyerDominance: number;
    bids: { price: number; size: number }[];
    asks: { price: number; size: number }[];
  };
  indicators: { rsi: number; vwap: number; atr: number };
}
export interface Config {
  initialBRL: number;
  usdBRL: number;
  feeBps: number;
  slippageBps: number;
  riskPct: number;
  maxAllocationPct: number;
  maxLossPct: number;
  targetBRL: number;
  cooldownMs: number;
  maxHoldingMs: number;
}
export const DEFAULT_CONFIG: Config = {
  initialBRL: 30,
  usdBRL: 5,
  feeBps: 60,
  slippageBps: 5,
  riskPct: 1,
  maxAllocationPct: 25,
  maxLossPct: 3,
  targetBRL: 0,
  cooldownMs: 60000,
  maxHoldingMs: 900000,
};
export interface Position {
  symbol: string;
  quantity: number;
  entry: number;
  stop: number;
  target: number;
  entryFeeBRL: number;
  openedAt: number;
}
export interface Trade extends Position {
  id: string;
  closedAt: number;
  exit: number;
  pnlBRL: number;
  feesBRL: number;
  reason: string;
}
export interface PaperState {
  version: 1;
  config: Config;
  cashBRL: number;
  position: Position | null;
  realizedBRL: number;
  feesBRL: number;
  trades: Trade[];
  lastClosedAt: number;
  lastSnapshotAt: number;
  locked: boolean;
  lockReason: string;
}
export interface Step {
  state: PaperState;
  message: string;
  action: "HOLD" | "OPEN" | "CLOSE";
}
export function validateConfig(c: Config): void {
  if (
    !c ||
    (Object.keys(DEFAULT_CONFIG) as (keyof Config)[]).some(
      (key) => !Number.isFinite(c[key]),
    )
  )
    throw new Error("Todos os parâmetros devem ser números finitos.");
  if (
    c.initialBRL <= 0 ||
    c.usdBRL <= 0 ||
    c.feeBps < 0 ||
    c.feeBps > 1000 ||
    c.slippageBps < 0 ||
    c.slippageBps > 1000 ||
    c.riskPct <= 0 ||
    c.riskPct > 1 ||
    c.maxAllocationPct <= 0 ||
    c.maxAllocationPct > 25 ||
    c.maxLossPct <= 0 ||
    c.maxLossPct > 3 ||
    c.targetBRL < 0 ||
    c.cooldownMs < 60000 ||
    c.maxHoldingMs < 60000
  ) {
    throw new Error("Configuração fora dos limites da simulação.");
  }
}
export function createPaperState(config: Config = DEFAULT_CONFIG): PaperState {
  validateConfig(config);
  return {
    version: 1,
    config: { ...config },
    cashBRL: config.initialBRL,
    position: null,
    realizedBRL: 0,
    feesBRL: 0,
    trades: [],
    lastClosedAt: 0,
    lastSnapshotAt: 0,
    locked: false,
    lockReason: "",
  };
}
export function snapshotError(s: Snapshot | null, now: number): string | null {
  if (!s || s.success !== true)
    return "Feed indisponível. Nenhuma entrada autorizada.";
  if (
    !Number.isFinite(s.timestamp) ||
    now - s.timestamp > 15000 ||
    s.timestamp > now + 2000 ||
    !Number.isFinite(s.marketTimestamp) ||
    now - s.marketTimestamp > 60000 ||
    s.marketTimestamp > now + 2000
  )
    return "Feed antigo ou relógio inválido. Aguardando dados recentes.";
  if (
    ![
      s.price,
      s.bid,
      s.ask,
      s.indicators?.rsi,
      s.indicators?.vwap,
      s.indicators?.atr,
      s.orderBook?.buyerDominance,
    ].every(Number.isFinite) ||
    s.price <= 0 ||
    s.bid <= 0 ||
    s.ask < s.bid ||
    s.indicators.atr <= 0 ||
    s.indicators.vwap <= 0 ||
    s.indicators.rsi < 0 ||
    s.indicators.rsi > 100 ||
    s.orderBook.buyerDominance < 0 ||
    s.orderBook.buyerDominance > 100
  )
    return "Dados inválidos. Nenhum preço substituto será usado.";
  const bids = s.orderBook.bids;
  const asks = s.orderBook.asks;
  if (
    !Array.isArray(bids) ||
    !Array.isArray(asks) ||
    !bids.length ||
    !asks.length ||
    [...bids, ...asks].some(
      (l) =>
        !l ||
        !Number.isFinite(l.price) ||
        !Number.isFinite(l.size) ||
        l.price <= 0 ||
        l.size <= 0,
    ) ||
    bids[0].price !== s.bid ||
    asks[0].price !== s.ask ||
    bids.some((b, n) => n > 0 && b.price > bids[n - 1].price) ||
    asks.some((a, n) => n > 0 && a.price < asks[n - 1].price)
  )
    return "Livro vazio, inválido ou inconsistente.";
  if (Math.abs(s.price - (s.bid + s.ask) / 2) / ((s.bid + s.ask) / 2) > 0.01)
    return "Último negócio diverge mais de 1% do livro. Entrada vetada.";
  const bidValue = bids.reduce((sum, l) => sum + l.price * l.size, 0);
  const askValue = asks.reduce((sum, l) => sum + l.price * l.size, 0);
  if (
    Math.abs(
      s.orderBook.buyerDominance - (bidValue / (bidValue + askValue)) * 100,
    ) > 0.01
  )
    return "Dominância não corresponde aos níveis do livro.";
  return null;
}
export function equityBRL(
  state: PaperState,
  s: Snapshot | null,
): number | null {
  if (!state.position) return state.cashBRL;
  if (
    !s ||
    s.symbol !== state.position.symbol ||
    !Number.isFinite(s.bid) ||
    s.bid <= 0
  )
    return null;
  const exit = s.bid * (1 - state.config.slippageBps / 10000);
  return (
    state.cashBRL +
    state.position.quantity *
      exit *
      state.config.usdBRL *
      (1 - state.config.feeBps / 10000)
  );
}
function close(
  state: PaperState,
  s: Snapshot,
  now: number,
  reason: string,
): Step {
  const p = state.position!;
  const c = state.config;
  const exit = s.bid * (1 - c.slippageBps / 10000);
  const valueBRL = p.quantity * exit * c.usdBRL;
  const exitFee = (valueBRL * c.feeBps) / 10000;
  const pnl =
    valueBRL - exitFee - p.quantity * p.entry * c.usdBRL - p.entryFeeBRL;
  const trade: Trade = {
    ...p,
    id: `${p.symbol}-${p.openedAt}-${now}`,
    closedAt: now,
    exit,
    pnlBRL: pnl,
    feesBRL: p.entryFeeBRL + exitFee,
    reason,
  };
  const next = {
    ...state,
    cashBRL: state.cashBRL + valueBRL - exitFee,
    position: null,
    realizedBRL: state.realizedBRL + pnl,
    feesBRL: state.feesBRL + exitFee,
    lastClosedAt: now,
    trades: [...state.trades, trade],
  };
  if (
    next.cashBRL <= c.initialBRL * (1 - c.maxLossPct / 100) ||
    (c.targetBRL > 0 && next.realizedBRL >= c.targetBRL)
  ) {
    next.locked = true;
    next.lockReason =
      next.realizedBRL > 0
        ? "Meta virtual atingida."
        : "Limite de perda virtual atingido.";
  }
  return {
    state: next,
    action: "CLOSE",
    message: `SAÍDA SIMULADA: ${reason}. Resultado líquido R$ ${pnl.toFixed(4)}; taxas R$ ${trade.feesBRL.toFixed(4)}.`,
  };
}
export function paperStep(
  state: PaperState,
  s: Snapshot | null,
  now: number,
  allowEntry = true,
  forceClose = false,
): Step {
  const hold = (message: string): Step => ({ state, action: "HOLD", message });
  const error = snapshotError(s, now);
  if (error) return hold(error);
  const snap = s!;
  if (state.position && snap.symbol !== state.position.symbol)
    return hold("Selecione o ativo da posição aberta para monitorá-la.");
  if (!forceClose && snap.timestamp <= state.lastSnapshotAt)
    return hold("Snapshot já processado. Aguardando atualização.");
  state = { ...state, lastSnapshotAt: snap.timestamp };
  const c = state.config;
  const p = state.position;
  if (p) {
    const equity = equityBRL(state, snap)!;
    const lossLimit = equity <= c.initialBRL * (1 - c.maxLossPct / 100);
    const targetLimit = c.targetBRL > 0 && equity - c.initialBRL >= c.targetBRL;
    if (
      forceClose ||
      snap.bid <= p.stop ||
      snap.bid >= p.target ||
      now - p.openedAt >= c.maxHoldingMs ||
      lossLimit ||
      targetLimit
    ) {
      return close(
        state,
        snap,
        now,
        forceClose
          ? "Fechamento manual"
          : lossLimit
            ? "Limite de perda da sessão"
            : targetLimit
              ? "Meta da sessão"
              : snap.bid <= p.stop
                ? "Stop observado"
                : snap.bid >= p.target
                  ? "Alvo observado"
                  : "Tempo máximo",
      );
    }
    return hold(
      `Posição virtual aberta. Resultado líquido em aberto R$ ${(equity - c.initialBRL - state.realizedBRL).toFixed(4)}.`,
    );
  }
  if (state.locked) return hold(state.lockReason);
  if (!allowEntry)
    return hold("Entradas pausadas. Nenhuma ordem real será enviada.");
  if (state.cashBRL <= c.initialBRL * (1 - c.maxLossPct / 100))
    return {
      state: {
        ...state,
        locked: true,
        lockReason: "Limite de perda virtual atingido.",
      },
      action: "HOLD",
      message: "Limite de perda virtual atingido.",
    };
  if (state.lastClosedAt && now - state.lastClosedAt < c.cooldownMs)
    return hold("Cooldown ativo: aguardar antes de nova entrada.");
  if ((snap.ask - snap.bid) / snap.bid > 0.001)
    return hold("Spread acima de 0,10%. Entrada vetada.");
  const i = snap.indicators;
  const midpoint = (snap.bid + snap.ask) / 2;
  if (!(
    snap.orderBook.buyerDominance >= 60 &&
    i.rsi >= 50 &&
    i.rsi <= 65 &&
    midpoint > i.vwap
  ))
    return hold(
      "Sem confluência: exige livro comprador ≥60%, RSI 50–65 e preço médio do livro acima da VWAP.",
    );
  const slip = c.slippageBps / 10000;
  const fee = c.feeBps / 10000;
  const entry = snap.ask * (1 + slip);
  const stop = entry - 1.5 * i.atr;
  const target = entry + 3 * i.atr;
  if (stop <= 0) return hold("Stop inválido. Entrada vetada.");
  const stopFill = stop * (1 - slip);
  const targetFill = target * (1 - slip);
  const lossPerUnit = (entry * (1 + fee) - stopFill * (1 - fee)) * c.usdBRL;
  const rewardPerUnit = (targetFill * (1 - fee) - entry * (1 + fee)) * c.usdBRL;
  if (rewardPerUnit <= 0 || rewardPerUnit / lossPerUnit < 1.5)
    return hold(
      "Custos consomem a vantagem: retorno/risco líquido inferior a 1,5.",
    );
  const remainingLoss = state.cashBRL - c.initialBRL * (1 - c.maxLossPct / 100);
  const riskBudget = Math.min((state.cashBRL * c.riskPct) / 100, remainingLoss);
  const quantity = Math.min(
    riskBudget / lossPerUnit,
    (state.cashBRL * c.maxAllocationPct) / 100 / (entry * c.usdBRL * (1 + fee)),
  );
  if (!Number.isFinite(quantity) || quantity <= 0)
    return hold("Capital virtual insuficiente.");
  const entryFeeBRL = quantity * entry * c.usdBRL * fee;
  return {
    state: {
      ...state,
      cashBRL: state.cashBRL - quantity * entry * c.usdBRL - entryFeeBRL,
      feesBRL: state.feesBRL + entryFeeBRL,
      position: {
        symbol: snap.symbol,
        quantity,
        entry,
        stop,
        target,
        entryFeeBRL,
        openedAt: now,
      },
    },
    action: "OPEN",
    message: `COMPRA SIMULADA: ${quantity.toFixed(8)} ${snap.symbol.split("-")[0]}; risco planejado até R$ ${riskBudget.toFixed(4)}. Stops não garantem perda máxima.`,
  };
}
