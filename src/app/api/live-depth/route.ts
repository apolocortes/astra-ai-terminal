import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol") || "BTC-USD";

    // Puxa ticker real e livro de ofertas real (Level 2)
    const [tickerRes, bookRes, candlesRes] = await Promise.all([
      fetch(`https://api.exchange.coinbase.com/products/${symbol}/ticker`, {
        headers: { "User-Agent": "AntigravityHFT/3.0" },
        next: { revalidate: 2 },
      }),
      fetch(`https://api.exchange.coinbase.com/products/${symbol}/book?level=2`, {
        headers: { "User-Agent": "AntigravityHFT/3.0" },
        next: { revalidate: 2 },
      }),
      fetch(`https://api.exchange.coinbase.com/products/${symbol}/candles?granularity=60`, {
        headers: { "User-Agent": "AntigravityHFT/3.0" },
        next: { revalidate: 2 },
      }),
    ]);

    if (!tickerRes.ok || !bookRes.ok || !candlesRes.ok) {
      throw new Error("Falha ao comunicar com provedor institucional");
    }

    const ticker = await tickerRes.json();
    const book = await bookRes.json();
    const candlesRaw = await candlesRes.json();

    const currentPrice = parseFloat(ticker.price);
    const bidPrice = parseFloat(ticker.bid);
    const askPrice = parseFloat(ticker.ask);
    const spread = parseFloat((askPrice - bidPrice).toFixed(2));
    const volume24h = parseFloat(ticker.volume);

    // Formata os 6 melhores bids e asks reais do Order Book
    const topBids = (book.bids || []).slice(0, 6).map((b: any) => ({
      price: parseFloat(b[0]),
      size: parseFloat(b[1]),
      total: parseFloat((parseFloat(b[0]) * parseFloat(b[1])).toFixed(2)),
    }));

    const topAsks = (book.asks || []).slice(0, 6).map((a: any) => ({
      price: parseFloat(a[0]),
      size: parseFloat(a[1]),
      total: parseFloat((parseFloat(a[0]) * parseFloat(a[1])).toFixed(2)),
    }));

    // PressÃ£o Compradora vs Vendedora no Book (% Order Book Imbalance)
    const bidLiquidity = topBids.reduce((acc: number, b: any) => acc + b.total, 0);
    const askLiquidity = topAsks.reduce((acc: number, a: any) => acc + a.total, 0);
    const totalLiquidity = bidLiquidity + askLiquidity || 1;
    const buyerDominance = Math.round((bidLiquidity / totalLiquidity) * 100);

    // CÃ¡lculos de Indicadores em candles de 1 minuto
    const candles = candlesRaw.slice(0, 30).reverse();
    const closes: number[] = candles.map((c: any) => parseFloat(c[4]));
    
    // RSI 14
    let gains = 0, losses = 0;
    for (let i = 1; i <= Math.min(14, closes.length - 1); i++) {
      const d = closes[i] - closes[i - 1];
      if (d >= 0) gains += d; else losses -= d;
    }
    const rs = (gains / 14) / ((losses / 14) || 0.001);
    const rsi = parseFloat((100 - (100 / (1 + rs))).toFixed(1));

    // VWAP
    let tv = 0, v = 0;
    candles.forEach((c: any) => {
      tv += ((parseFloat(c[1]) + parseFloat(c[2]) + parseFloat(c[4])) / 3) * parseFloat(c[5]);
      v += parseFloat(c[5]);
    });
    const vwap = v > 0 ? parseFloat((tv / v).toFixed(2)) : currentPrice;

    // ATR
    let trSum = 0;
    for (let i = 1; i < candles.length; i++) {
      const tr = Math.max(
        parseFloat(candles[i][2]) - parseFloat(candles[i][1]),
        Math.abs(parseFloat(candles[i][2]) - parseFloat(candles[i - 1][4]))
      );
      trSum += tr;
    }
    const atr = parseFloat((trSum / (candles.length - 1 || 1)).toFixed(2));

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      symbol,
      price: currentPrice,
      bid: bidPrice,
      ask: askPrice,
      spread,
      volume24h,
      orderBook: {
        bids: topBids,
        asks: topAsks,
        bidLiquidity: Math.round(bidLiquidity),
        askLiquidity: Math.round(askLiquidity),
        buyerDominance,
      },
      indicators: {
        rsi,
        vwap,
        atr,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
