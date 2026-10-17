import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      apiKey = process.env.CAPITAL_API_KEY || "sM7ZGP4ElOFbXMs7",
      cstToken,
      securityToken,
      identifier = process.env.CAPITAL_EMAIL || "",
      password = process.env.CAPITAL_PASSWORD || "",
      isDemo = false,
    } = body;

    const baseUrl = isDemo
      ? "https://demo-api-capital.backend-capital.com/api/v1"
      : "https://api-capital.backend-capital.com/api/v1";

    let activeCst = cstToken;
    let activeSec = securityToken;

    // Se nÃ£o hÃ¡ credenciais de sessÃ£o ativas na corretora
    if (!activeCst || !activeSec) {
      if (!identifier || !password) {
        // Retorna status honesto de conta vazia / nÃ£o autenticada com dinheiro real
        return NextResponse.json({
          success: true,
          mode: isDemo ? "CAPITAL_DEMO" : "CAPITAL_REAL",
          authenticated: false,
          account: {
            accountId: null,
            accountName: isDemo ? "Conta DemonstraÃ§Ã£o (Sem VÃ­nculo)" : "Conta Real NÃ£o Autenticada",
            currency: "BRL",
            balance: 0.00,
            available: 0.00,
            deposit: 0.00,
            profitLoss: 0.00,
          },
          message: "Nenhum saldo real detectado na Capital.com. Para carregar seu saldo exato, autentique a sessÃ£o.",
        });
      }

      // AutenticaÃ§Ã£o na Capital.com
      const sessionRes = await fetch(`${baseUrl}/session`, {
        method: "POST",
        headers: {
          "X-CAP-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier, password }),
        signal: AbortSignal.timeout(8000),
      });

      if (!sessionRes.ok) {
        return NextResponse.json({
          success: false,
          mode: isDemo ? "CAPITAL_DEMO" : "CAPITAL_REAL",
          authenticated: false,
          error: "Falha ao autenticar com a Capital.com. Credenciais incorretas ou conta vazia.",
          account: {
            balance: 0.00,
            available: 0.00,
            currency: "BRL",
          },
        }, { status: 401 });
      }

      activeCst = sessionRes.headers.get("CST");
      activeSec = sessionRes.headers.get("X-SECURITY-TOKEN");
    }

    // Consulta de Contas na Corretora com Saldo Real
    if (activeCst && activeSec) {
      const accountsRes = await fetch(`${baseUrl}/accounts`, {
        headers: {
          "X-CAP-API-KEY": apiKey,
          "CST": activeCst,
          "X-SECURITY-TOKEN": activeSec,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const primaryAccount = accountsData.accounts?.[0] || null;
        return NextResponse.json({
          success: true,
          mode: isDemo ? "CAPITAL_DEMO" : "CAPITAL_REAL",
          authenticated: true,
          account: {
            accountId: primaryAccount?.accountId,
            accountName: primaryAccount?.accountName || "Conta Capital.com",
            currency: primaryAccount?.currency || "BRL",
            balance: primaryAccount?.balance?.balance || 0.00,
            available: primaryAccount?.balance?.available || 0.00,
            deposit: primaryAccount?.balance?.deposit || 0.00,
            profitLoss: primaryAccount?.balance?.profitLoss || 0.00,
          },
          tokens: {
            cst: activeCst,
            securityToken: activeSec,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      mode: isDemo ? "CAPITAL_DEMO" : "CAPITAL_REAL",
      authenticated: false,
      account: {
        accountId: null,
        accountName: "Conta Real",
        currency: "BRL",
        balance: 0.00,
        available: 0.00,
        deposit: 0.00,
        profitLoss: 0.00,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
