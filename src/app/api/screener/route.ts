import { NextResponse } from "next/server";

const WATCHLIST = [
  { symbol: "BTC-USD", name: "Bitcoin", b3Ticker: "BITI11", tag: "Cripto Primário" },
  { symbol: "ETH-USD", name: "Ethereum", b3Ticker: "ETHE11", tag: "Smart Contracts" },
  { symbol: "SOL-USD", name: "Solana", b3Ticker: "SOLB11", tag: "Ultra Scalp" },
  { symbol: "AVAX-USD", name: "Avalanche", b3Ticker: "AVAX", tag: "Volatilidade Alta" },
  { symbol: "LINK-USD", name: "Chainlink", b3Ticker: "LINK", tag: "DeFi Core" },
  { symbol: "DOGE-USD", name: "Dogecoin", b3Ticker: "DOGE", tag: "Volume Massivo" },
  { symbol: "ADA-USD", name: "Cardano", b3Ticker: "ADA", tag: "Layer 1" },
  { symbol: "XRP-USD", name: "Ripple", b3Ticker: "XRP", tag: "Liquidez Bancária" },
];

export async function GET() {
  try {
    const results = await Promise.all(
      WATCHLIST.map(async (coin) => {
        try {
          const res = await fetch(`https://api.exchange.coinbase.com/products/${coin.symbol}/candles?granularity=300`, {
            headers: { "User-Agent": "AstraTerminal/2.0" },
            next: { revalidate: 4 },
          });

          if (!res.ok) throw new Error("Offline");
          const data = await res.json();
          const candles = data.slice(0, 30).reverse();
          const closes = candles.map((c: any) => parseFloat(c[4]));
          const lastPrice = closes[closes.length - 1];
          const prevPrice = closes[closes.length - 2] || lastPrice;
          const change = ((lastPrice - prevPrice) / prevPrice) * 100;

          // RSI 14
          let gains = 0, losses = 0;
          for (let i = 1; i <= Math.min(14, closes.length - 1); i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) gains += diff; else losses -= diff;
          }
          const rs = (gains / 14) / ((losses / 14) || 0.001);
          const rsi = 100 - (100 / (1 + rs));

          // VWAP
          let tv = 0, v = 0;
          candles.forEach((c: any) => {
            tv += ((parseFloat(c[1]) + parseFloat(c[2]) + parseFloat(c[4])) / 3) * parseFloat(c[5]);
            v += parseFloat(c[5]);
          });
          const vwap = v > 0 ? tv / v : lastPrice;

          // Determina Sinal Preliminar de Algoritmo
          let signal = "NEUTRO";
          let score = 50;
          if (rsi < 35 && lastPrice > vwap * 0.998) {
            signal = "COMPRA FORTE";
            score = 92;
          } else if (rsi > 68 && lastPrice < vwap * 1.002) {
            signal = "VENDA FORTE";
            score = 89;
          } else if (rsi < 45) {
            signal = "COMPRA SCALP";
            score = 75;
          } else if (rsi > 55) {
            signal = "VENDA SCALP";
            score = 72;
          }

          return {
            ...coin,
            price: lastPrice,
            change24h: parseFloat(change.toFixed(2)),
            rsi: parseFloat(rsi.toFixed(1)),
            vwap: parseFloat(vwap.toFixed(2)),
            signal,
            score,
            status: "LIVE_DATA",
          };
        } catch {
          return {
            ...coin,
            price: 0,
            change24h: 0,
            rsi: 50,
            vwap: 0,
            signal: "AGUARDAR",
            score: 50,
            status: "CONNECTING",
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      assets: results,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}