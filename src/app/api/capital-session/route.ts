import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey = "sM7ZGP4ElOFbXMs7", identifier, password, isDemo = true } = body;

    if (!identifier || !password) {
      return NextResponse.json({
        success: false,
        error: "Informe o e-mail e a senha cadastrados na Capital.com.",
      }, { status: 400 });
    }

    const baseUrl = isDemo
      ? "https://demo-api-capital.backend-capital.com/api/v1"
      : "https://api-capital.backend-capital.com/api/v1";

    // 1. Cria SessÃ£o OpenAPI na Capital.com
    const sessionRes = await fetch(`${baseUrl}/session`, {
      method: "POST",
      headers: {
        "X-CAP-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier,
        password,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      return NextResponse.json({
        success: false,
        error: `Falha na autenticaÃ§Ã£o Capital.com (${sessionRes.status}): ${errText}`,
      }, { status: 401 });
    }

    const cst = sessionRes.headers.get("CST");
    const securityToken = sessionRes.headers.get("X-SECURITY-TOKEN");

    if (!cst || !securityToken) {
      return NextResponse.json({
        success: false,
        error: "Tokens de seguranÃ§a (CST / X-SECURITY-TOKEN) nÃ£o foram retornados pela corretora.",
      }, { status: 502 });
    }

    // 2. Consulta Saldo Real e Contas Ativas
    const accountsRes = await fetch(`${baseUrl}/accounts`, {
      headers: {
        "X-CAP-API-KEY": apiKey,
        "CST": cst,
        "X-SECURITY-TOKEN": securityToken,
      },
      signal: AbortSignal.timeout(10000),
    });

    const accountsData = await accountsRes.json();
    const primaryAccount = accountsData.accounts?.[0] || null;

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      mode: isDemo ? "CAPITAL_DEMO" : "CAPITAL_REAL",
      connected: true,
      account: {
        accountId: primaryAccount?.accountId,
        accountName: primaryAccount?.accountName,
        currency: primaryAccount?.currency || "USD",
        balance: primaryAccount?.balance?.balance || 0,
        available: primaryAccount?.balance?.available || 0,
        deposit: primaryAccount?.balance?.deposit || 0,
        profitLoss: primaryAccount?.balance?.profitLoss || 0,
      },
      tokens: {
        cst,
        securityToken,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || "Erro interno de comunicaÃ§Ã£o com a Capital.com",
    }, { status: 500 });
  }
}
