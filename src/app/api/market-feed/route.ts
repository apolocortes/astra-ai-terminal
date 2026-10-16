import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "BTC-USD";

  try {
    const res = await fetch(`https://api.exchange.coinbase.com/products/${symbol}/candles?granularity=300`, {
      headers: { "User-Agent": "AstraTerminal/1.0" },
      next: { revalidate: 3 },
    });

    if (!res.ok) throw new Error("Coinbase feed offline");
    const data = await res.json();
    
    const candles = data.slice(0, 50).reverse().map((d: any) => ({
      time: d[0],
      low: parseFloat(d[1]),
      high: parseFloat(d[2]),
      open: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const closes = candles.map((c: any) => c.close);

    // Math Engine
    const ema = (period: number) => {
      const k = 2 / (period + 1);
      let val = closes.slice(0, period).reduce((a: number, b: number) => a + b, 0) / period;
      for (let i = period; i < closes.length; i++) val = closes[i] * k + val * (1 - k);
      return val;
    };

    let tv = 0, v = 0;
    candles.forEach((c: any) => {
      tv += ((c.high + c.low + c.close) / 3) * c.volume;
      v += c.volume;
    });
    const vwap = v > 0 ? tv / v : last.close;

    // RSI
    let gains = 0, losses = 0;
    for (let i = 1; i <= 14; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    const rs = (gains / 14) / ((losses / 14) || 0.001);
    const rsi = 100 - (100 / (1 + rs));

    return NextResponse.json({
      success: true,
      symbol,
      price: last.close,
      change24h: ((last.close - prev.close) / prev.close) * 100,
      high24h: Math.max(...candles.map((c: any) => c.high)),
      low24h: Math.min(...candles.map((c: any) => c.low)),
      volume: v,
      metrics: {
        vwap: parseFloat(vwap.toFixed(2)),
        ema9: parseFloat(ema(9).toFixed(2)),
        ema21: parseFloat(ema(21).toFixed(2)),
        rsi14: parseFloat(rsi.toFixed(2)),
      },
      candles,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}