import { createHash } from 'node:crypto';
import type { Candle } from './market-indicators';
export const PRODUCTS = ['BTC-USD','ETH-USD','SOL-USD','AVAX-USD','LINK-USD','DOGE-USD','XRP-USD'] as const;
export interface HistoricalData { candles: Candle[]; source: string; fetchedAt: number; sha256: string; timeframeSeconds: number; requestedDays: number }
export function validateHistorical(candles: Candle[], granularity: number) {
  if (candles.length < 120 || candles.some((c,n) => !Object.values(c).every(Number.isFinite) || c.low <= 0 || c.high < c.low || c.open < c.low || c.open > c.high || c.close < c.low || c.close > c.high || c.volume < 0 || (n > 0 && c.time - candles[n-1].time !== granularity))) throw new Error('Histórico incompleto, inválido ou com lacunas. Não preencher preços fictícios.');
}
export async function loadHistory(symbol: string, days = 30, granularity = 3600): Promise<HistoricalData> {
  if (!(PRODUCTS as readonly string[]).includes(symbol) || ![7,14,30].includes(days) || granularity !== 3600) throw new Error('Escolha um produto suportado e 7, 14 ou 30 dias em candles de 1h.');
  const now = Date.now(); const end = Math.floor(now / (granularity * 1000)) * granularity;
  const start = end - days * 86400;
  const output = new Map<number,Candle>();
  for (let cursor = start; cursor < end; cursor += 250 * granularity) {
    const stop = Math.min(end, cursor + 250 * granularity);
    const query = new URLSearchParams({ granularity: String(granularity), start: new Date(cursor*1000).toISOString(), end: new Date(stop*1000).toISOString() });
    const response = await fetch(`https://api.exchange.coinbase.com/products/${symbol}/candles?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { 'User-Agent':'AstraResearch/3.0' } });
    if (!response.ok) throw new Error('Provedor histórico indisponível. Tente novamente mais tarde.');
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) throw new Error('Resposta de candles inválida.');
    for (const row of raw) {
      if (!Array.isArray(row) || row.length < 6) throw new Error('Candle inválido.');
      const [time,low,high,open,close,volume] = row.map(Number);
      if (time >= start && time < end) output.set(time,{time,low,high,open,close,volume});
    }
  }
  const candles = [...output.values()].sort((a,b)=>a.time-b.time);
  validateHistorical(candles,granularity);
  if (candles[0].time !== start || candles.at(-1)!.time !== end-granularity || candles.length !== (end-start)/granularity) throw new Error('A janela solicitada não foi entregue integralmente.');
  return { candles, source:'Coinbase Exchange REST · OHLCV spot USD', fetchedAt:now, sha256:createHash('sha256').update(JSON.stringify(candles)).digest('hex'), timeframeSeconds:granularity, requestedDays:days };
}
