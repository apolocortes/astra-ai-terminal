"use client";

import { useEffect, useRef } from "react";

interface TradingViewWidgetProps {
  symbol: string;
}

export default function TradingViewWidget({ symbol }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    // Converte simbolo para formato TradingView
    const tvSymbol = symbol.includes("BTC")
      ? "BINANCE:BTCUSDT"
      : symbol.includes("ETH")
      ? "BINANCE:ETHUSDT"
      : symbol.includes("SOL")
      ? "BINANCE:SOLUSDT"
      : symbol.includes("AVAX")
      ? "BINANCE:AVAXUSDT"
      : symbol.includes("LINK")
      ? "BINANCE:LINKUSDT"
      : symbol.includes("DOGE")
      ? "BINANCE:DOGEUSDT"
      : symbol.includes("XRP")
      ? "BINANCE:XRPUSDT"
      : "BINANCE:BTCUSDT";

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: "5",
      timezone: "America/Sao_Paulo",
      theme: "dark",
      style: "1",
      locale: "br",
      enable_publishing: false,
      backgroundColor: "#070a12",
      gridColor: "#111827",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      studies: ["STD;VWAP", "STD;RSI", "STD;EMA@tv-basicstudies"],
      support_host: "https://www.tradingview.com",
    });

    container.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="w-full h-full min-h-[440px] flex-1 rounded-xl overflow-hidden border border-[#162032] bg-[#070a12]">
      <div className="tradingview-widget-container h-full w-full" ref={container} />
    </div>
  );
}