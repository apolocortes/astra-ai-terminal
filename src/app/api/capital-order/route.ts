import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      apiKey = "sM7ZGP4ElOFbXMs7",
      cst,
      securityToken,
      epic = "BTCUSD",
      direction = "BUY",
      size = 0.01,
      stopLevel,
      profitLevel,
      isDemo = true,
    } = body;

    if (!cst || !securityToken) {
      return NextResponse.json({
        success: false,
        error: "SessÃ£o nÃ£o autenticada. Tokens CST e X-SECURITY-TOKEN sÃ£o obrigatÃ³rios.",
      }, { status: 401 });
    }

    const baseUrl = isDemo
      ? "https://demo-api-capital.backend-capital.com/api/v1"
      : "https://api-capital.backend-capital.com/api/v1";

    const orderPayload: any = {
      epic,
      direction,
      size,
      guaranteedStop: false,
    };

    if (stopLevel) orderPayload.stopLevel = stopLevel;
    if (profitLevel) orderPayload.profitLevel = profitLevel;

    // Dispara a Ordem a Mercado na Capital.com
    const orderRes = await fetch(`${baseUrl}/positions`, {
      method: "POST",
      headers: {
        "X-CAP-API-KEY": apiKey,
        "CST": cst,
        "X-SECURITY-TOKEN": securityToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
      signal: AbortSignal.timeout(10000),
    });

    const resJson = await orderRes.json();

    if (!orderRes.ok) {
      return NextResponse.json({
        success: false,
        error: resJson.errorCode || "Ordem recusada pela Capital.com",
        details: resJson,
      }, { status: orderRes.status });
    }

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      mode: isDemo ? "CAPITAL_DEMO" : "CAPITAL_REAL",
      dealReference: resJson.dealReference,
      details: resJson,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || "Falha ao enviar ordem para a Capital.com",
    }, { status: 500 });
  }
}
