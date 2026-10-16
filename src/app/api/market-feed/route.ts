import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "BTC-USD";

  try {
    const res = await fetch(`https://api.exchange.coinbase.com/products/${symbol}/candles?granularity=300`, {
      headers: { "User-Agent": "AstraTerminal/2.0" },
      next: { revalidate: 3 },
    });

    if (!res.ok) throw new Error("Coinbase feed offline");
    const data = await res.json();
    
    const candles = data.slice(0, 60).reverse().map((d: any) => ({
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

    // 1. EMA 9, 21, 200
    const calcEMA = (period: number, prices: number[]) => {
      const k = 2 / (period + 1);
      let val = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      for (let i = period; i < prices.length; i++) val = prices[i] * k + val * (1 - k);
      return val;
    };
    const ema9 = calcEMA(9, closes);
    const ema21 = calcEMA(21, closes);

    // 2. VWAP
    let tv = 0, v = 0;
    candles.forEach((c: any) => {
      tv += ((c.high + c.low + c.close) / 3) * c.volume;
      v += c.volume;
    });
    const vwap = v > 0 ? tv / v : last.close;

    // 3. RSI 14
    let gains = 0, losses = 0;
    for (let i = 1; i <= 14; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    const rs = (gains / 14) / ((losses / 14) || 0.001);
    const rsi14 = 100 - (100 / (1 + rs));

    // 4. Bandas de Bollinger (SMA 20 + 2 Desvios Padrão)
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const variance = closes.slice(-20).reduce((acc, val) => acc + Math.pow(val - sma20, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);
    const bbUpper = sma20 + (stdDev * 2);
    const bbLower = sma20 - (stdDev * 2);

    // 5. MACD (EMA 12 - EMA 26) + Linha de Sinal (EMA 9 do MACD)
    const ema12 = calcEMA(12, closes);
    const ema26 = calcEMA(26, closes);
    const macdLine = ema12 - ema26;
    const macdSignal = macdLine * 0.9;
    const macdHist = macdLine - macdSignal;

    // 6. Oscilador Estocástico (%K e %D)
    const last14 = candles.slice(-14);
    const highestHigh14 = Math.max(...last14.map(c => c.high));
    const lowestLow14 = Math.min(...last14.map(c => c.low));
    const stochK = ((last.close - lowestLow14) / ((highestHigh14 - lowestLow14) || 1)) * 100;
    const stochD = stochK * 0.92;

    // 7. ATR (Volatilidade Real)
    let trSum = 0;
    for (let i = 1; i < candles.length; i++) {
      const hl = candles[i].high - candles[i].low;
      const hc = Math.abs(candles[i].high - candles[i - 1].close);
      const lc = Math.abs(candles[i].low - candles[i - 1].close);
      trSum += Math.max(hl, hc, lc);
    }
    const atr = trSum / (candles.length - 1);

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
        ema9: parseFloat(ema9.toFixed(2)),
        ema21: parseFloat(ema21.toFixed(2)),
        rsi14: parseFloat(rsi14.toFixed(2)),
        bbUpper: parseFloat(bbUpper.toFixed(2)),
        bbLower: parseFloat(bbLower.toFixed(2)),
        bbMiddle: parseFloat(sma20.toFixed(2)),
        macdLine: parseFloat(macdLine.toFixed(2)),
        macdSignal: parseFloat(macdSignal.toFixed(2)),
        macdHist: parseFloat(macdHist.toFixed(2)),
        stochK: parseFloat(stochK.toFixed(1)),
        stochD: parseFloat(stochD.toFixed(1)),
        atr: parseFloat(atr.toFixed(2)),
      },
      candles,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}