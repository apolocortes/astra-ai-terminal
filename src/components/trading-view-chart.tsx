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
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    // Mesma bolsa e moeda do feed; não confundir Binance USDT com Coinbase USD.
    const tvSymbol = `COINBASE:${symbol.replace("-", "")}`;

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: "1",
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
    <div className="w-full h-full min-h-[320px] flex-1 overflow-hidden bg-[#070a12]">
      <div
        className="tradingview-widget-container h-full w-full"
        ref={container}
      />
    </div>
  );
}
