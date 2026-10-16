/**
 * ASTRA QUANT LOCAL ENGINE — 100% INDEPENDENTE DE LLM / CHATGPT
 * Motor estatístico puro de confluência institucional.
 * Roda direto no servidor em microsegundos sem gastar 1 token e sem risco de timeout de API.
 */

export interface MarketMetrics {
  price: number;
  vwap: number;
  rsi: number;
  ema9: number;
  ema21: number;
  bbUpper: number;
  bbLower: number;
  bbMiddle: number;
  macdHist: number;
  stochK: number;
  stochD: number;
  atr: number;
}

export interface QuantDecision {
  action: "BUY" | "SELL" | "HOLD";
  confluenceScore: number; // 0 a 100%
  triggersHit: string[];
  takeProfitPrice: number;
  stopLossPrice: number;
  lotSize: number;
  riskReward: string;
  rationale: string;
}

export function evaluatePureQuantStrategy(m: MarketMetrics, targetGoalBRL = 25): QuantDecision {
  const triggersHit: string[] = [];
  let buyPoints = 0;
  let sellPoints = 0;

  // 1. VWAP (Peso 20): Posição Institucional
  if (m.price > m.vwap) {
    buyPoints += 20;
    triggersHit.push("Preço acima da VWAP diária (Fluxo comprador dominante)");
  } else {
    sellPoints += 20;
    triggersHit.push("Preço abaixo da VWAP diária (Fluxo vendedor dominante)");
  }

  // 2. IFR / RSI 14 (Peso 25): Exaustão Estatística
  if (m.rsi <= 32) {
    buyPoints += 25;
    triggersHit.push(`RSI em ${m.rsi.toFixed(1)} (Sobrevendido extremo - repique iminente)`);
  } else if (m.rsi >= 68) {
    sellPoints += 25;
    triggersHit.push(`RSI em ${m.rsi.toFixed(1)} (Sobrecomprado extremo - exaustão de topo)`);
  } else if (m.rsi < 45) {
    buyPoints += 10;
  } else if (m.rsi > 55) {
    sellPoints += 10;
  }

  // 3. Bandas de Bollinger (Peso 20): Rejeição de Desvio Padrão
  if (m.price <= m.bbLower) {
    buyPoints += 20;
    triggersHit.push("Toque na Banda Inferior de Bollinger (Mínima de 2 Desvios Padrão)");
  } else if (m.price >= m.bbUpper) {
    sellPoints += 20;
    triggersHit.push("Toque na Banda Superior de Bollinger (Máxima de 2 Desvios Padrão)");
  }

  // 4. MACD Histograma (Peso 15): Momentum
  if (m.macdHist > 0) {
    buyPoints += 15;
    triggersHit.push("MACD com aceleração positiva no histograma");
  } else {
    sellPoints += 15;
    triggersHit.push("MACD com aceleração negativa no histograma");
  }

  // 5. Estocástico (Peso 10): Timing de Gatilho
  if (m.stochK < 20) {
    buyPoints += 10;
    triggersHit.push("Estocástico em zona de sobrevenda");
  } else if (m.stochK > 80) {
    sellPoints += 10;
    triggersHit.push("Estocástico em zona de sobrecompra");
  }

  // 6. Alinhamento de Médias Móveis EMA 9 x 21 (Peso 10)
  if (m.ema9 > m.ema21) {
    buyPoints += 10;
    triggersHit.push("Leque altista confirmado (EMA 9 > EMA 21)");
  } else {
    sellPoints += 10;
    triggersHit.push("Leque baixista confirmado (EMA 9 < EMA 21)");
  }

  // Decisão com Threshold estrito de 70% de confluência
  const atrSafe = m.atr > 0 ? m.atr : m.price * 0.005;
  const takeProfitTicks = atrSafe * 1.5;
  const stopLossTicks = atrSafe * 0.8;

  if (buyPoints >= 65 && buyPoints > sellPoints) {
    return {
      action: "BUY",
      confluenceScore: buyPoints,
      triggersHit,
      takeProfitPrice: parseFloat((m.price + takeProfitTicks).toFixed(2)),
      stopLossPrice: parseFloat((m.price - stopLossTicks).toFixed(2)),
      lotSize: 0.01,
      riskReward: "1 : 1.87",
      rationale: `Compra matemática autorizada: ${triggersHit.slice(0, 3).join("; ")}.`,
    };
  }

  if (sellPoints >= 65 && sellPoints > buyPoints) {
    return {
      action: "SELL",
      confluenceScore: sellPoints,
      triggersHit,
      takeProfitPrice: parseFloat((m.price - takeProfitTicks).toFixed(2)),
      stopLossPrice: parseFloat((m.price + stopLossTicks).toFixed(2)),
      lotSize: 0.01,
      riskReward: "1 : 1.87",
      rationale: `Venda matemática autorizada: ${triggersHit.slice(0, 3).join("; ")}.`,
    };
  }

  return {
    action: "HOLD",
    confluenceScore: Math.max(buyPoints, sellPoints),
    triggersHit,
    takeProfitPrice: 0,
    stopLossPrice: 0,
    lotSize: 0,
    riskReward: "---",
    rationale: "Mercado sem confluência suficiente (mínimo 65% exigido). Preservando capital.",
  };
}