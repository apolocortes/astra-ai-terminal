import { NextResponse } from "next/server";
import { CapitalComClient } from "@/lib/capital-engine";

const DEFAULT_API_KEY = "sM7ZGP4ElOFbXMs7";

export async function POST(req: Request) {
  try {
    const { action, epic = "BTCUSD", size = 0.01, identifier, password, isDemo = true } = await req.json();

    const client = new CapitalComClient({
      apiKey: DEFAULT_API_KEY,
      identifier: identifier || "trader@capital.com",
      password: password || "",
      isDemo,
    });

    const result = await client.placeMarketOrder(
      epic,
      action?.includes("COMPRA") ? "BUY" : "SELL",
      size
    );

    return NextResponse.json({
      success: true,
      broker: "Capital.com Global CFD Broker",
      apiKeyUsed: DEFAULT_API_KEY,
      order: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}