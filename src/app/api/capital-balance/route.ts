import { NextResponse } from "next/server";
import { CapitalComClient } from "@/lib/capital-engine";

const CAPITAL_API_KEY = "sM7ZGP4ElOFbXMs7";

export async function POST(req: Request) {
  try {
    const { identifier, password, isDemo = true } = await req.json();

    const client = new CapitalComClient({
      apiKey: CAPITAL_API_KEY,
      identifier: identifier || "trader@capital.com",
      password: password || "",
      isDemo,
    });

    const accountData = await client.getAccountBalance();

    return NextResponse.json({
      success: true,
      apiKeyUsed: CAPITAL_API_KEY,
      isDemo,
      accountData,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}