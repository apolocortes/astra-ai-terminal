export interface Candle {
  time: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
}
export function calculateIndicators(candles: Candle[]) {
  if (
    candles.length < 15 ||
    candles.some(
      (c, index) =>
        !Object.values(c).every(Number.isFinite) ||
        c.low <= 0 ||
        c.high < c.low ||
        c.open < c.low ||
        c.open > c.high ||
        c.close < c.low ||
        c.close > c.high ||
        c.volume < 0 ||
        (index > 0 && c.time - candles[index - 1].time !== 60),
    )
  )
    throw new Error("Candles inválidos, duplicados ou não contíguos.");
  const recent = candles.slice(-15);
  let gains = 0;
  let losses = 0;
  let trueRanges = 0;
  for (let n = 1; n < recent.length; n++) {
    const c = recent[n];
    const prev = recent[n - 1].close;
    const delta = c.close - prev;
    gains += Math.max(delta, 0);
    losses += Math.max(-delta, 0);
    trueRanges += Math.max(
      c.high - c.low,
      Math.abs(c.high - prev),
      Math.abs(c.low - prev),
    );
  }
  // RSI por média simples dos últimos 14 deltas, não suavização de Wilder.
  const rsi =
    losses === 0 ? (gains === 0 ? 50 : 100) : 100 - 100 / (1 + gains / losses);
  const volume = candles.reduce((sum, c) => sum + c.volume, 0);
  if (volume <= 0) throw new Error("Volume insuficiente.");
  const vwap =
    candles.reduce(
      (sum, c) => sum + ((c.high + c.low + c.close) / 3) * c.volume,
      0,
    ) / volume;
  return { rsi, vwap, atr: trueRanges / 14 };
}
