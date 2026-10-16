import { validateConfig, type Config } from "./paper-engine";
import type { Candle } from "./market-indicators";
import {
  evaluateStrategies,
  STRATEGIES,
  type StrategyDecision,
  type StrategyId,
} from "./strategy-engine";

export interface BacktestConfig extends Config {
  spreadBps: number;
}

export interface StrategyResult {
  strategyId: StrategyId;
  name: string;
  trades: number;
  wins: number;
  winRate: number | null;
  netBRL: number;
  returnPct: number;
  profitFactor: number | null;
  expectancyBRL: number | null;
  maxDrawdownPct: number;
  feesBRL: number;
  equity: { time: number; value: number }[];
  ledger: {
    entryTime: number;
    exitTime: number;
    entry: number;
    exit: number;
    quantity: number;
    pnlBRL: number;
    feesBRL: number;
    reason: string;
  }[];
}

export interface ResearchReport {
  sample: {
    bars: number;
    from: number;
    to: number;
    splitTime: number;
    timeframeSeconds: number;
  };
  selectedStrategy: StrategyId | null;
  selectionReason: string;
  training: StrategyResult[];
  validation: StrategyResult[];
  stress: StrategyResult | null;
  verdict: "INSUFICIENTE" | "REPROVADO" | "PROMISSOR";
  warnings: string[];
}

type SimulationPosition = {
  entryIndex: number;
  entryTime: number;
  entry: number;
  quantity: number;
  entryGrossBRL: number;
  entryFeeBRL: number;
  stop: number;
  target: number;
};

type PendingOrder = { entryIndex: number; decision: StrategyDecision };

type SimulationOutput = {
  cashBRL: number;
  realizedBRL: number;
  feesBRL: number;
  ledger: StrategyResult["ledger"];
  equity: StrategyResult["equity"];
};

const VALID_TIMEFRAMES = new Set([60, 300, 900, 3600]);
const EPSILON = 1e-12;
const FEATURE_WARMUP = 120;

function readMutable<T>(value: T): T {
  return value;
}

function readPending(value: PendingOrder | null): PendingOrder | null {
  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertCandleSeries(candles: Candle[]): number {
  if (!Array.isArray(candles) || candles.length < 2) {
    throw new Error("Backtest exige ao menos dois candles contíguos.");
  }
  for (let index = 0; index < candles.length; index += 1) {
    const c = candles[index];
    if (
      !c ||
      !isFiniteNumber(c.time) ||
      !isFiniteNumber(c.low) ||
      !isFiniteNumber(c.high) ||
      !isFiniteNumber(c.open) ||
      !isFiniteNumber(c.close) ||
      !isFiniteNumber(c.volume) ||
      c.time < 0 ||
      c.low <= 0 ||
      c.high < c.low ||
      c.open < c.low ||
      c.open > c.high ||
      c.close < c.low ||
      c.close > c.high ||
      c.volume < 0
    ) {
      throw new Error("Candles inválidos para backtest.");
    }
    if (index > 0 && candles[index].time <= candles[index - 1].time) {
      throw new Error("Candles duplicados ou fora de ordem.");
    }
  }
  const timeframe = candles[1].time - candles[0].time;
  if (!VALID_TIMEFRAMES.has(timeframe)) {
    throw new Error("Timeframe inválido: use 60, 300, 900 ou 3600 segundos.");
  }
  for (let index = 2; index < candles.length; index += 1) {
    if (candles[index].time - candles[index - 1].time !== timeframe) {
      throw new Error("Candles não são contíguos em um único timeframe.");
    }
  }
  return timeframe;
}

function validateBacktestConfig(config: BacktestConfig): void {
  if (!config || !isFiniteNumber(config.spreadBps) || config.spreadBps < 0) {
    throw new Error("spreadBps deve ser um número finito não negativo.");
  }
  // Mantém os mesmos limites prudentes do motor paper e evita resultados não finitos.
  validateConfig(config);
  if (config.spreadBps > 1000) {
    throw new Error("spreadBps excede o limite de 1000 bps.");
  }
}

function emptyResult(strategyId: StrategyId, config: BacktestConfig, times: number[]): StrategyResult {
  const initial = config.initialBRL;
  const equity = times.map((time) => ({ time, value: initial }));
  return {
    strategyId,
    name: STRATEGIES.find((strategy) => strategy.id === strategyId)?.name ?? strategyId,
    trades: 0,
    wins: 0,
    winRate: null,
    netBRL: 0,
    returnPct: 0,
    profitFactor: null,
    expectancyBRL: null,
    maxDrawdownPct: 0,
    feesBRL: 0,
    equity,
    ledger: [],
  };
}

function simulationToResult(
  strategyId: StrategyId,
  config: BacktestConfig,
  output: SimulationOutput,
): StrategyResult {
  const ledger = output.ledger;
  const wins = ledger.filter((trade) => trade.pnlBRL > EPSILON).length;
  const grossProfit = ledger
    .filter((trade) => trade.pnlBRL > 0)
    .reduce((sum, trade) => sum + trade.pnlBRL, 0);
  const grossLoss = ledger
    .filter((trade) => trade.pnlBRL < 0)
    .reduce((sum, trade) => sum + Math.abs(trade.pnlBRL), 0);
  let peak = config.initialBRL;
  let maxDrawdownPct = 0;
  for (const point of output.equity) {
    if (point.value > peak) peak = point.value;
    if (peak > EPSILON) {
      maxDrawdownPct = Math.max(
        maxDrawdownPct,
        ((peak - point.value) / peak) * 100,
      );
    }
  }
  const netBRL = output.cashBRL - config.initialBRL;
  return {
    strategyId,
    name: STRATEGIES.find((strategy) => strategy.id === strategyId)?.name ?? strategyId,
    trades: ledger.length,
    wins,
    winRate: ledger.length ? (wins / ledger.length) * 100 : null,
    netBRL,
    returnPct: (netBRL / config.initialBRL) * 100,
    profitFactor: grossLoss > EPSILON ? grossProfit / grossLoss : null,
    expectancyBRL: ledger.length ? netBRL / ledger.length : null,
    maxDrawdownPct,
    feesBRL: output.feesBRL,
    equity: output.equity,
    ledger,
  };
}

function runSimulation(
  candles: Candle[],
  start: number,
  endExclusive: number,
  strategyId: StrategyId,
  config: BacktestConfig,
): StrategyResult {
  const times = candles.slice(start, endExclusive).map((candle) => candle.time);
  if (endExclusive <= start) return emptyResult(strategyId, config, times);

  const feeRate = config.feeBps / 10000;
  const slippageRate = config.slippageBps / 10000;
  const halfSpreadRate = config.spreadBps / 20000;
  const buyFactor = (1 + halfSpreadRate) * (1 + slippageRate);
  const sellFactor = (1 - halfSpreadRate) * (1 - slippageRate);
  const maxSessionLoss = config.initialBRL * (config.maxLossPct / 100);
  const firstSignal = Math.max(59, start - 1);

  let cashBRL = config.initialBRL;
  let realizedBRL = 0;
  let feesBRL = 0;
  let locked = false;
  let position: SimulationPosition | null = null;
  let pending: PendingOrder | null = null;
  const ledger: StrategyResult["ledger"] = [];
  const equity: StrategyResult["equity"] = [];

  const markAtLow = (low: number): number => {
    if (!position) return cashBRL;
    const exitGross = position.quantity * low * sellFactor * config.usdBRL;
    const exitFee = exitGross * feeRate;
    return cashBRL + exitGross - exitFee;
  };

  const closePosition = (rawExit: number, exitTime: number, reason: string): void => {
    if (!position) return;
    const exit = rawExit * sellFactor;
    const exitGrossBRL = position.quantity * exit * config.usdBRL;
    const exitFeeBRL = exitGrossBRL * feeRate;
    const proceedsBRL = exitGrossBRL - exitFeeBRL;
    const pnlBRL = proceedsBRL - position.entryGrossBRL - position.entryFeeBRL;
    cashBRL += proceedsBRL;
    realizedBRL += pnlBRL;
    feesBRL += exitFeeBRL;
    ledger.push({
      entryTime: position.entryTime,
      exitTime,
      entry: position.entry,
      exit,
      quantity: position.quantity,
      pnlBRL,
      feesBRL: position.entryFeeBRL + exitFeeBRL,
      reason,
    });
    position = null;
    if (cashBRL <= config.initialBRL - maxSessionLoss + EPSILON) locked = true;
  };

  const tryOpen = (candle: Candle, index: number, decision: StrategyDecision): void => {
    if (
      locked ||
      position ||
      decision.action !== "BUY" ||
      !decision.features ||
      decision.features.atr <= 0 ||
      decision.stopAtr <= 0 ||
      decision.targetAtr <= 0
    )
      return;
    if (buyFactor <= 0 || sellFactor <= 0) return;
    if (config.spreadBps > 10) return;

    const entry = candle.open * buyFactor;
    const entryGrossPerUnitBRL = entry * config.usdBRL;
    const entryFeePerUnitBRL = entryGrossPerUnitBRL * feeRate;
    const stop = entry - decision.stopAtr * decision.features.atr;
    const target = entry + decision.targetAtr * decision.features.atr;
    if (stop <= 0 || target <= entry) return;

    const stopExit = stop * sellFactor;
    const stopProceedsPerUnitBRL =
      stopExit * config.usdBRL * (1 - feeRate);
    const lossPerUnitBRL =
      entryGrossPerUnitBRL + entryFeePerUnitBRL - stopProceedsPerUnitBRL;
    if (!Number.isFinite(lossPerUnitBRL) || lossPerUnitBRL <= EPSILON) return;
    const targetProceedsPerUnitBRL =
      target * sellFactor * config.usdBRL * (1 - feeRate);
    const rewardPerUnitBRL =
      targetProceedsPerUnitBRL - entryGrossPerUnitBRL - entryFeePerUnitBRL;
    if (
      !Number.isFinite(rewardPerUnitBRL) ||
      rewardPerUnitBRL <= 0 ||
      rewardPerUnitBRL / lossPerUnitBRL < 1.5
    )
      return;

    const remainingSessionRisk = Math.max(
      0,
      cashBRL - config.initialBRL * (1 - config.maxLossPct / 100),
    );
    const riskBudget = Math.min(
      (cashBRL * config.riskPct) / 100,
      remainingSessionRisk,
    );
    const allocationBudget = (cashBRL * config.maxAllocationPct) / 100;
    const quantity = Math.min(
      riskBudget / lossPerUnitBRL,
      allocationBudget / (entryGrossPerUnitBRL + entryFeePerUnitBRL),
    );
    if (!Number.isFinite(quantity) || quantity <= EPSILON) return;

    const entryGrossBRL = quantity * entryGrossPerUnitBRL;
    const entryFeeBRL = quantity * entryFeePerUnitBRL;
    cashBRL -= entryGrossBRL + entryFeeBRL;
    feesBRL += entryFeeBRL;
    position = {
      entryIndex: index,
      entryTime: candle.time,
      entry,
      quantity,
      entryGrossBRL,
      entryFeeBRL,
      stop,
      target,
    };
  };

  for (let index = firstSignal; index < endExclusive; index += 1) {
    const candle = candles[index];
    const pendingOrder: PendingOrder | null = readPending(pending);
    if (pendingOrder !== null && pendingOrder.entryIndex === index) {
      tryOpen(candle, index, pendingOrder.decision);
      pending = null;
    }

    let conservativePoint = cashBRL;
    const openPosition = readMutable<SimulationPosition | null>(position);
    if (openPosition !== null) {
      const barsHeld = index - openPosition.entryIndex;
      let exitPrice: number | null = null;
      let reason = "";
      let conservativeRawPrice = candle.low;
      // Stop vem antes do alvo quando os dois aparecem na mesma vela.
      // O paper encerra na abertura após 48 intervalos, antes da faixa da vela.
      if (barsHeld >= 48) {
        exitPrice = candle.open;
        conservativeRawPrice = candle.open;
        reason = "máximo de 48 candles";
      } else if (candle.open <= openPosition.stop) {
        exitPrice = candle.open;
        conservativeRawPrice = candle.open;
        reason = "stop por gap na abertura";
      } else if (candle.open >= openPosition.target) {
        exitPrice = openPosition.target;
        conservativeRawPrice = openPosition.target;
        reason = "alvo";
      } else if (candle.low <= openPosition.stop) {
        exitPrice = openPosition.stop;
        conservativeRawPrice = openPosition.stop;
        reason = "stop";
      } else if (candle.high >= openPosition.target) {
        exitPrice = openPosition.target;
        conservativeRawPrice = openPosition.target;
        reason = "alvo";
      }
      conservativePoint = markAtLow(conservativeRawPrice);
      if (exitPrice !== null) {
        closePosition(exitPrice, candle.time, reason);
      }
    }

    if (index >= start) {
      equity.push({
        time: candle.time,
        value: Number.isFinite(conservativePoint) ? conservativePoint : cashBRL,
      });
    }

    if (
      index >= firstSignal &&
      index < endExclusive - 1 &&
      !position &&
      !pending &&
      !locked &&
      index + 1 >= start
    ) {
      const decision = evaluateStrategies(candles.slice(0, index + 1), strategyId);
      if (decision.action === "BUY") {
        pending = { entryIndex: index + 1, decision };
      }
    }
  }

  if (position) {
    closePosition(candles[endExclusive - 1].close, candles[endExclusive - 1].time, "liquidação final");
    equity.push({ time: candles[endExclusive - 1].time, value: cashBRL });
  }

  return simulationToResult(strategyId, config, {
    cashBRL,
    realizedBRL,
    feesBRL,
    ledger,
    equity,
  });
}

function stressConfig(config: BacktestConfig): BacktestConfig {
  return {
    ...config,
    feeBps: Math.min(1000, config.feeBps * 1.5),
    slippageBps: Math.min(1000, config.slippageBps * 1.5),
    spreadBps: Math.min(1000, config.spreadBps * 1.5),
  };
}

export function runResearch(
  candles: Candle[],
  config: BacktestConfig,
): ResearchReport {
  const timeframeSeconds = assertCandleSeries(candles);
  validateBacktestConfig(config);
  // A chamada também garante o mesmo contrato de validação do motor ao vivo.
  if (candles.length >= 60) evaluateStrategies(candles.slice(0, 60), "auto");

  const splitIndex = Math.min(
    Math.max(Math.floor(candles.length * 0.7), 1),
    candles.length - 1,
  );
  const training: StrategyResult[] = STRATEGIES.map((strategy) =>
    runSimulation(candles, 0, splitIndex, strategy.id, config),
  );
  const validationStart = splitIndex;
  const validationWarmupStart = Math.max(0, validationStart - FEATURE_WARMUP);
  const validationCandles = candles.slice(validationWarmupStart);
  const validationPeriodStart = validationStart - validationWarmupStart;
  const validation: StrategyResult[] = STRATEGIES.map((strategy) =>
    runSimulation(
      validationCandles,
      validationPeriodStart,
      validationCandles.length,
      strategy.id,
      config,
    ),
  );
  const qualified = training.filter(
    (result) =>
      result.trades >= 10 &&
      result.netBRL > 0 &&
      (result.expectancyBRL ?? 0) > 0,
  );
  qualified.sort(
    (a, b) =>
      b.netBRL - a.netBRL ||
      (b.expectancyBRL ?? -Infinity) - (a.expectancyBRL ?? -Infinity) ||
      a.strategyId.localeCompare(b.strategyId),
  );
  const selectedStrategy = qualified[0]?.strategyId ?? null;
  const selectedTraining = qualified[0] ?? null;
  const selectedValidation = selectedStrategy
    ? validation.find((result) => result.strategyId === selectedStrategy) ?? null
    : null;
  const stress = selectedStrategy
    ? runSimulation(
        validationCandles,
        validationPeriodStart,
        validationCandles.length,
        selectedStrategy,
        stressConfig(config),
      )
    : null;

  const warnings = [
    "Relatório hipotético de pesquisa: OHLC não é livro de ordens e não comprova rentabilidade real.",
    `Execução assume spread bid/ask de ${config.spreadBps} bps, slippage de ${config.slippageBps} bps e taxas de ${config.feeBps} bps em ambas as pontas; não há margem, short ou LLM.`,
    "Entradas ocorrem somente na abertura do candle seguinte ao sinal no fechamento; gaps contra a posição usam a abertura, não um stop garantido.",
    "As últimas 120 velas anteriores ao split são somente warmup OOS; cada carteira de avaliação começa independente no split.",
    "A seleção usa exclusivamente o treino; a validação/OOS é calculada para todas as estratégias e não escolhe parâmetros.",
  ];
  if (config.feeBps * 1.5 > 1000 || config.slippageBps * 1.5 > 1000 || config.spreadBps * 1.5 > 1000) {
    warnings.push("O stress 1,5x foi limitado a 1000 bps por componente para manter a configuração finita e dentro do limite.");
  }
  if (validationStart < FEATURE_WARMUP) {
    warnings.push("A amostra OOS tem menos de 120 candles de warmup disponível; evidência pode ser insuficiente.");
  }

  let verdict: ResearchReport["verdict"] = "INSUFICIENTE";
  let selectionReason =
    "Nenhuma estratégia atingiu simultaneamente 10 trades no treino, lucro líquido positivo e expectativa positiva; não há seleção.";
  if (selectedTraining && selectedValidation && stress) {
    selectionReason = `Selecionada ${selectedTraining.name} somente pelo melhor resultado elegível no treino (${selectedTraining.trades} trades, líquido R$ ${selectedTraining.netBRL.toFixed(4)}); validação não participou da escolha.`;
    const promising =
      selectedTraining.trades >= 20 &&
      selectedValidation.trades >= 20 &&
      (selectedValidation.expectancyBRL ?? 0) > 0 &&
      selectedValidation.netBRL > 0 &&
      stress.netBRL > 0 &&
      selectedValidation.maxDrawdownPct <= 3 + EPSILON;
    if (promising) verdict = "PROMISSOR";
    else if (selectedValidation.trades >= 20) verdict = "REPROVADO";
    else verdict = "INSUFICIENTE";
  }

  return {
    sample: {
      bars: candles.length,
      from: candles[0].time,
      to: candles[candles.length - 1].time,
      splitTime: candles[splitIndex].time,
      timeframeSeconds,
    },
    selectedStrategy,
    selectionReason,
    training,
    validation,
    stress,
    verdict,
    warnings,
  };
}
