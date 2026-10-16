import { NextResponse } from "next/server";
import { calculateIndicators, type Candle } from "@/lib/market-indicators";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol") || "BTC-USD";
  const granularity = Number(new URL(req.url).searchParams.get('granularity') || '60');
  if (![60,3600].includes(granularity)) return NextResponse.json({success:false,error:'Timeframe inválido.'},{status:400});
  if (!/^[A-Z0-9]{2,12}-USD$/.test(symbol))
    return NextResponse.json(
      { success: false, error: "Produto USD inválido." },
      { status: 400 },
    );
  try {
    const get = async (path: string) => {
      const res = await fetch(
        `https://api.exchange.coinbase.com/products/${symbol}/${path}`,
        {
          cache: "no-store",
          signal: AbortSignal.timeout(7000),
          headers: { "User-Agent": "AstraPaperResearch/2.0" },
        },
      );
      if (!res.ok) throw new Error("Provedor de mercado indisponível.");
      return res.json();
    };
    const requestedAt = Date.now();
    const start = encodeURIComponent(
      new Date(requestedAt - 125 * granularity * 1000).toISOString(),
    );
    const end = encodeURIComponent(new Date(requestedAt).toISOString());
    const [ticker, book, raw] = await Promise.all([
      get("ticker"),
      get("book?level=2"),
      get(`candles?granularity=${granularity}&start=${start}&end=${end}`),
    ]);
    const now = Date.now();
    const levels = (rows: unknown) => {
      if (!Array.isArray(rows) || rows.length === 0)
        throw new Error("Livro de ofertas vazio.");
      return rows.slice(0, 6).map((row) => {
        const price = Number(row[0]);
        const size = Number(row[1]);
        if (
          !Number.isFinite(price) ||
          !Number.isFinite(size) ||
          price <= 0 ||
          size <= 0
        )
          throw new Error("Livro inválido.");
        return { price, size, total: price * size };
      });
    };
    const bids = levels(book.bids);
    const asks = levels(book.asks);
    const bid = bids[0].price;
    const ask = asks[0].price;
    const price = Number(ticker.price);
    const tickerTimestamp = Date.parse(ticker.time);
    const bookTimestamp = Date.parse(book.time);
    const marketTimestamp = Math.min(tickerTimestamp, bookTimestamp);
    if (tickerTimestamp > now + 2000 || bookTimestamp > now + 2000)
      throw new Error("Relógio do provedor inconsistente.");
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      ask < bid ||
      !Number.isFinite(marketTimestamp) ||
      now - marketTimestamp > 60000 ||
      marketTimestamp > now + 2000
    )
      throw new Error("Cotação antiga ou inconsistente.");
    const midpoint = (bid + ask) / 2;
    if (Math.abs(price - midpoint) / midpoint > 0.01)
      throw new Error("Ticker incoerente com o livro.");
    if (!Array.isArray(raw)) throw new Error("Candles indisponíveis.");
    const candles: Candle[] = raw
      .map((c: number[]) => ({
        time: Number(c[0]),
        low: Number(c[1]),
        high: Number(c[2]),
        open: Number(c[3]),
        close: Number(c[4]),
        volume: Number(c[5]),
      }))
      .filter((c) => (c.time + granularity) * 1000 <= now)
      .sort((a, b) => a.time - b.time)
      .slice(-120);
    if (
      candles.length < 15 ||
      now - (candles.at(-1)!.time + granularity) * 1000 > Math.max(120000,granularity*1000)
    )
      throw new Error("Histórico recente insuficiente.");
    calculateIndicators(candles,granularity);
    const indicators = calculateIndicators(candles.slice(-30),granularity);
    const bidLiquidity = bids.reduce((n, b) => n + b.total, 0);
    const askLiquidity = asks.reduce((n, a) => n + a.total, 0);
    return NextResponse.json(
      {
        success: true,
        source: "Coinbase Exchange REST · spot USD",
        timestamp: now,
        marketTimestamp,
        symbol,
        price,
        bid,
        ask,
        spread: ask - bid,
        volume24h: Number(ticker.volume),
        orderBook: {
          bids,
          asks,
          bidLiquidity,
          askLiquidity,
          buyerDominance: (bidLiquidity / (bidLiquidity + askLiquidity)) * 100,
        },
        indicators,
        candles,
        timeframeSeconds: granularity,
        candleCount: candles.length,
        closedCandlesOnly: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Feed indisponível ou inválido. A simulação não abrirá entradas sem dados recentes.",
      },
      { status: 502 },
    );
  }
}
