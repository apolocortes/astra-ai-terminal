import type { Candle } from "./market-indicators";

export type StrategyId = "trend_pullback" | "range_reversion" | "breakout";
export type StrategyMode = StrategyId | "auto";

export const STRATEGIES: { id: StrategyId; name: string; description: string }[] = [
  {
    id: "trend_pullback",
    name: "Trend Pullback",
    description:
      "Procura recuo e recuperação em tendência de alta, com alinhamento de EMAs, RSI e distância em ATR.",
  },
  {
    id: "range_reversion",
    name: "Range Reversion",
    description:
      "Procura recuperação da banda inferior em mercado lateral sem comprar uma queda ainda ativa.",
  },
  {
    id: "breakout",
    name: "Breakout",
    description:
      "Procura fechamento acima da máxima dos 20 candles anteriores com confirmação de volume.",
  },
];

export interface StrategyDecision {
  action: "BUY" | "HOLD";
  strategyId: StrategyId | null;
  regime: "ALTA" | "BAIXA" | "LATERAL" | "VOLATIL" | "INSUFICIENTE";
  score: number;
  reason: string;
  checks: { label: string; passed: boolean; value: string }[];
  stopAtr: number;
  targetAtr: number;
  features: {
    rsi: number;
    atr: number;
    ema9: number;
    ema21: number;
    ema50: number;
    bbLower: number;
    bbUpper: number;
    efficiency: number;
    volumeRatio: number;
  } | null;
}

type Regime = StrategyDecision["regime"];
type Features = NonNullable<StrategyDecision["features"]> & {
  close: number;
  open: number;
};
type Candidate = {
  id: StrategyId;
  score: number;
  checks: { label: string; passed: boolean; value: string }[];
  stopAtr: number;
  targetAtr: number;
  eligible: boolean;
  reason: string;
};

const VALID_TIMEFRAMES = new Set([60, 300, 900, 3600]);
const EPSILON = 1e-12;
const FEATURE_WINDOW = 120;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateCandles(candles: Candle[]): void {
  if (!Array.isArray(candles)) throw new Error("Candles devem ser uma lista.");
  for (let index = 0; index < candles.length; index += 1) {
    const c = candles[index];
    if (
      !c ||
      !finite(c.time) ||
      !finite(c.low) ||
      !finite(c.high) ||
      !finite(c.open) ||
      !finite(c.close) ||
      !finite(c.volume) ||
      c.time < 0 ||
      c.low <= 0 ||
      c.high < c.low ||
      c.open < c.low ||
      c.open > c.high ||
      c.close < c.low ||
      c.close > c.high ||
      c.volume < 0
    ) {
      throw new Error("Candles inválidos: OHLC, tempo ou volume não finitos.");
    }
    if (index > 0 && c.time <= candles[index - 1].time) {
      throw new Error("Candles inválidos, duplicados ou fora de ordem.");
    }
  }

  if (candles.length >= 2) {
    const timeframe = candles[1].time - candles[0].time;
    if (!VALID_TIMEFRAMES.has(timeframe)) {
      throw new Error("Timeframe inválido: use 60, 300, 900 ou 3600 segundos.");
    }
    for (let index = 2; index < candles.length; index += 1) {
      if (candles[index].time - candles[index - 1].time !== timeframe) {
        throw new Error("Candles não são contíguos em um timeframe uniforme.");
      }
    }
  }
  if (candles.length >= 60 && candles.every((c) => c.volume === 0)) {
    throw new Error("Volume insuficiente: não há volume positivo para confirmação.");
  }
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ema(values: number[], period: number): number {
  if (values.length < period) return mean(values);
  let result = mean(values.slice(0, period));
  const alpha = 2 / (period + 1);
  for (let index = period; index < values.length; index += 1) {
    result = alpha * values[index] + (1 - alpha) * result;
  }
  return result;
}

/** RSI e ATR usam suavização de Wilder; Bollinger usa desvio-padrão populacional. */
function calculateFeatures(candles: Candle[]): Features {
  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  const periodRsi = 14;
  let averageGain = 0;
  let averageLoss = 0;
  for (let index = 1; index <= periodRsi; index += 1) {
    const delta = closes[index] - closes[index - 1];
    averageGain += Math.max(delta, 0);
    averageLoss += Math.max(-delta, 0);
  }
  averageGain /= periodRsi;
  averageLoss /= periodRsi;
  for (let index = periodRsi + 1; index < closes.length; index += 1) {
    const delta = closes[index] - closes[index - 1];
    averageGain = (averageGain * (periodRsi - 1) + Math.max(delta, 0)) / periodRsi;
    averageLoss =
      (averageLoss * (periodRsi - 1) + Math.max(-delta, 0)) / periodRsi;
  }
  const rsi =
    averageLoss <= EPSILON
      ? averageGain <= EPSILON
        ? 50
        : 100
      : 100 - 100 / (1 + averageGain / averageLoss);

  const trueRanges: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const c = candles[index];
    const previousClose = closes[index - 1];
    trueRanges.push(
      Math.max(
        c.high - c.low,
        Math.abs(c.high - previousClose),
        Math.abs(c.low - previousClose),
      ),
    );
  }
  let atr = mean(trueRanges.slice(0, periodRsi));
  for (let index = periodRsi; index < trueRanges.length; index += 1) {
    atr = (atr * (periodRsi - 1) + trueRanges[index]) / periodRsi;
  }

  const bollinger = closes.slice(-20);
  const bbMiddle = mean(bollinger);
  const variance = mean(bollinger.map((value) => (value - bbMiddle) ** 2));
  const deviation = Math.sqrt(Math.max(variance, 0));
  const volumeWindow = candles.slice(-21, -1).map((c) => c.volume);
  const averagePreviousVolume = mean(volumeWindow);
  const volumeRatio =
    averagePreviousVolume > EPSILON ? last.volume / averagePreviousVolume : 0;
  const changes = closes.slice(-21).slice(1).map((value, index) =>
    Math.abs(value - closes[closes.length - 21 + index]),
  );
  const efficiencyDenominator = changes.reduce((sum, value) => sum + value, 0);
  const efficiency =
    efficiencyDenominator > EPSILON
      ? Math.abs(last.close - closes[closes.length - 21]) / efficiencyDenominator
      : 0;

  return {
    close: last.close,
    open: last.open,
    rsi,
    atr,
    ema9: ema(closes, 9),
    ema21: ema(closes, 21),
    ema50: ema(closes, 50),
    bbLower: bbMiddle - 2 * deviation,
    bbUpper: bbMiddle + 2 * deviation,
    efficiency,
    volumeRatio,
  };
}

function format(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : "inválido";
}

function check(
  label: string,
  passed: boolean,
  value: string,
): { label: string; passed: boolean; value: string } {
  return { label, passed, value };
}

function determineRegime(features: Features): Regime {
  const volatilityPct = features.atr / features.close;
  const bandWidthPct =
    (features.bbUpper - features.bbLower) /
    Math.max((features.bbUpper + features.bbLower) / 2, EPSILON);
  if (
    features.ema9 < features.ema21 &&
    features.ema21 < features.ema50 &&
    features.close < features.ema21
  )
    return "BAIXA";
  if (volatilityPct >= 0.04 || bandWidthPct >= 0.16) return "VOLATIL";
  if (
    features.ema9 > features.ema21 &&
    features.ema21 > features.ema50 &&
    features.close >= features.ema50 &&
    features.efficiency >= 0.2
  )
    return "ALTA";
  return "LATERAL";
}

function regimeChecks(regime: Regime, allowed: Regime[]):
  { label: string; passed: boolean; value: string }[] {
  return [
    check("Regime permitido", allowed.includes(regime), regime),
    check("Sem queda ativa", regime !== "BAIXA", regime),
    check("Sem volatilidade extrema", regime !== "VOLATIL", regime),
  ];
}

function trendPullback(features: Features, candles: Candle[], regime: Regime): Candidate {
  const previous = candles[candles.length - 2];
  const distanceAtr = Math.abs(features.close - features.ema21) / Math.max(features.atr, EPSILON);
  const checks = [
    ...regimeChecks(regime, ["ALTA"]),
    check(
      "EMAs alinhadas para alta",
      features.ema9 > features.ema21 && features.ema21 > features.ema50,
      `${format(features.ema9)} > ${format(features.ema21)} > ${format(features.ema50)}`,
    ),
    check("Preço acima da EMA50", features.close > features.ema50, `${format(features.close)} > ${format(features.ema50)}`),
    check("RSI em zona de pullback", features.rsi >= 40 && features.rsi <= 65, format(features.rsi)),
    check("Distância da EMA21 em ATR", distanceAtr <= 1.0, `${format(distanceAtr)} ATR`),
    check(
      "Candle recuperando",
      features.close >= features.open && features.close >= previous.close,
      `fechamento ${format(features.close)}; anterior ${format(previous.close)}`,
    ),
  ];
  const passed = checks.filter((item) => item.passed).length;
  const eligible = checks.every((item) => item.passed);
  return {
    id: "trend_pullback",
    score: Math.round((passed / checks.length) * 100),
    checks,
    stopAtr: 1.5,
    targetAtr: 3,
    eligible,
    reason: eligible
      ? "Pullback altista recuperado com confluência de EMAs, RSI e ATR."
      : "Pullback altista sem todos os vetos factuais; nenhuma entrada forçada.",
  };
}

function rangeReversion(features: Features, candles: Candle[], regime: Regime): Candidate {
  const previous = candles[candles.length - 2];
  const touchedLowerBand =
    previous.low <= features.bbLower || features.close <= features.bbLower * 1.01;
  const recovery =
    features.close > features.open && features.close > previous.close && features.close > features.bbLower;
  const checks = [
    ...regimeChecks(regime, ["LATERAL"]),
    check("Banda inferior foi tocada", touchedLowerBand, `BB lower ${format(features.bbLower)}`),
    check("Recuperação acima da banda", recovery, `close ${format(features.close)}`),
    check("RSI não está em queda extrema", features.rsi >= 25 && features.rsi <= 50, format(features.rsi)),
    check("Preço não segue fazendo mínima", features.close >= previous.close, `atual ${format(features.close)}; anterior ${format(previous.close)}`),
    check("Eficiência compatível com range", features.efficiency <= 0.55, format(features.efficiency)),
  ];
  const passed = checks.filter((item) => item.passed).length;
  const eligible = checks.every((item) => item.passed);
  return {
    id: "range_reversion",
    score: Math.round((passed / checks.length) * 100),
    checks,
    stopAtr: 1.25,
    targetAtr: 3,
    eligible,
    reason: eligible
      ? "Reversão lateral confirmada por recuperação da banda inferior."
      : "A banda não foi recuperada com segurança; nenhuma entrada forçada.",
  };
}

function breakout(features: Features, candles: Candle[], regime: Regime): Candidate {
  const previousHigh = Math.max(...candles.slice(-21, -1).map((c) => c.high));
  const checks = [
    ...regimeChecks(regime, ["ALTA", "LATERAL"]),
    check("Fechamento acima da máxima20 prévia", features.close > previousHigh, `${format(features.close)} > ${format(previousHigh)}`),
    check("Volume confirma rompimento", features.volumeRatio >= 1.2, `${format(features.volumeRatio)}x`),
    check("Candle de rompimento comprador", features.close > features.open, `close ${format(features.close)}; open ${format(features.open)}`),
    check("Preço acima da EMA21", features.close > features.ema21, `${format(features.close)} > ${format(features.ema21)}`),
  ];
  const passed = checks.filter((item) => item.passed).length;
  const eligible = checks.every((item) => item.passed);
  return {
    id: "breakout",
    score: Math.round((passed / checks.length) * 100),
    checks,
    stopAtr: 1.5,
    targetAtr: 3,
    eligible,
    reason: eligible
      ? "Rompimento acima da máxima20 prévia com volume confirmatório."
      : "Rompimento sem confirmação suficiente; nenhuma entrada forçada.",
  };
}

function insufficientDecision(reason: string): StrategyDecision {
  return {
    action: "HOLD",
    strategyId: null,
    regime: "INSUFICIENTE",
    score: 0,
    reason,
    checks: [{ label: "Warmup mínimo de 60 candles", passed: false, value: "insuficiente" }],
    stopAtr: 0,
    targetAtr: 0,
    features: null,
  };
}

export function evaluateStrategies(
  candles: Candle[],
  mode: StrategyMode = "auto",
): StrategyDecision {
  validateCandles(candles);
  if (
    mode !== "auto" &&
    !STRATEGIES.some((strategy) => strategy.id === mode)
  ) {
    throw new Error("Estratégia desconhecida.");
  }
  if (candles.length < 60) {
    return insufficientDecision(
      `Warmup mínimo de 60 candles não atingido (${candles.length}).`,
    );
  }

  // O caller entrega candles fechados; usar somente uma janela fixa torna o
  // cálculo idêntico no live e no laboratório, sem recalibragem online.
  const featureCandles = candles.slice(-FEATURE_WINDOW);
  const features = calculateFeatures(featureCandles);
  const regime = determineRegime(features);
  const candidates = [
    trendPullback(features, featureCandles, regime),
    rangeReversion(features, featureCandles, regime),
    breakout(features, featureCandles, regime),
  ];
  const requested =
    mode === "auto"
      ? candidates.filter((candidate) =>
          regime === "ALTA"
            ? candidate.id === "trend_pullback" || candidate.id === "breakout"
            : regime === "LATERAL"
              ? candidate.id === "range_reversion" || candidate.id === "breakout"
              : false,
        )
      : candidates.filter((candidate) => candidate.id === mode);
  const ordered = [...requested].sort(
    (a, b) => b.score - a.score || a.id.localeCompare(b.id),
  );
  const selected = ordered[0];
  const winner = ordered.find((candidate) => candidate.eligible);
  const plan = selected ?? candidates[0];
  if (winner) {
    return {
      action: "BUY",
      strategyId: winner.id,
      regime,
      score: winner.score,
      reason: `${winner.reason} Score ${winner.score}/100 é confluência determinística, não probabilidade nem promessa de retorno.`,
      checks: winner.checks,
      stopAtr: winner.stopAtr,
      targetAtr: winner.targetAtr,
      features,
    };
  }

  const reason =
    regime === "BAIXA" || regime === "VOLATIL"
      ? `Entrada pausada no regime ${regime}: não há short nem compra contra o veto.`
      : selected?.reason ?? "Nenhuma hipótese aplicável ao regime atual.";
  return {
    action: "HOLD",
    strategyId: null,
    regime,
    score: selected?.score ?? 0,
    reason: `${reason} Score é confluência determinística, não probabilidade.`,
    checks: selected?.checks ?? [],
    stopAtr: plan?.stopAtr ?? 0,
    targetAtr: plan?.targetAtr ?? 0,
    features,
  };
}
