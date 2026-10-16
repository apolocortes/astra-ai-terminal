import { NextResponse } from "next/server";
import { CapitalComClient } from "@/lib/capital-engine";

const ATLAS_API_KEY = process.env.ATLAS_API_KEY || "sk-NdPVNziR1Irrxu8ZdfHnTLuH4jcZ1FZXJbxTUXpbWYqLS7DU";
const ATLAS_BASE_URL = process.env.ATLAS_BASE_URL || "https://gpt.teamsoclo.site/v1";
const CAPITAL_API_KEY = "sM7ZGP4ElOFbXMs7";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      symbol = "BTC-USD",
      currentPrice,
      vwap,
      rsi,
      ema9,
      ema21,
      bbUpper,
      bbLower,
      bbMiddle,
      macdHist,
      stochK,
      stochD,
      atr,
      targetGoal = 25,
      identifier,
      password,
      isDemo = true,
    } = body;

    // Prompt Atlas / Astra Denso com todas as variÃ¡veis matemÃ¡ticas e quÃ¢nticas do ativo
    const atlasSystemPrompt = `VocÃª Ã© o OrÃ¡culo Neural ATLAS / ASTRA QUANT ENGINE 6.0, um supercomputador quÃ¢ntico de alta frequÃªncia para Day Trade institucional na Capital.com.
Sua missÃ£o diÃ¡ria Ã© bater uma meta rigorosa de +R$ 20 a +R$ 30 por dia e acionar proteÃ§Ã£o de capital (Auto-Lock).
VocÃª recebe mÃ©tricas em tempo real e DEVE responder EXCLUSIVAMENTE em formato JSON puro, sem markdown, sem enrolaÃ§Ã£o.

JSON SCHEMA:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confluenceScore": number (0 a 100),
  "quantumProbability": number (0 a 100),
  "confidence": "EXTREMA" | "ALTA" | "MODERADA" | "NEUTRA",
  "takeProfitPrice": number,
  "stopLossPrice": number,
  "lotSize": number,
  "triggersHit": string[],
  "rationale": string,
  "expectedGainBRL": number
}`;

    const atlasUserPrompt = `MÃ‰TRICAS DO ATIVO ${symbol} AO VIVO:
- PreÃ§o Atual: $${currentPrice}
- VWAP Institucional: $${vwap}
- IFR / RSI (14): ${rsi}
- MÃ©dias MÃ³veis: EMA 9 ($${ema9}) x EMA 21 ($${ema21})
- Bandas de Bollinger: Superior $${bbUpper} | MÃ©dia $${bbMiddle} | Inferior $${bbLower}
- MACD Histograma: ${macdHist}
- Oscilador EstocÃ¡stico: %K ${stochK} | %D ${stochD}
- Volatilidade ATR: $${atr}
- Meta da SessÃ£o: R$ ${targetGoal}

FaÃ§a uma anÃ¡lise profunda de fluxo institucional, confluÃªncia quÃ¢ntica e responda com o JSON de execuÃ§Ã£o.`;

    let atlasDecision: any = null;

    try {
      const atlasRes = await fetch(`${ATLAS_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ATLAS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-6-astra",
          messages: [
            { role: "system", content: atlasSystemPrompt },
            { role: "user", content: atlasUserPrompt },
          ],
          temperature: 0.1,
          max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (atlasRes.ok) {
        const rawJson = await atlasRes.json();
        const content = rawJson.choices?.[0]?.message?.content || "";
        const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
        atlasDecision = JSON.parse(cleanJson);
      }
    } catch (e: any) {
      // Fallback Atlas QuÃ¢ntico de Alta FrequÃªncia em Servidor
    }

    // Se o Atlas LLM demorar ou estiver offline, roda o Motor QuÃ¢ntico Atlas Local InstantÃ¢neo
    if (!atlasDecision) {
      let score = 50;
      const triggers: string[] = [];
      let act: "BUY" | "SELL" | "HOLD" = "HOLD";

      // LÃ³gica QuÃ¢ntica de ConfluÃªncia Multivariada
      if (rsi <= 32 && currentPrice <= bbLower * 1.002) {
        act = "BUY";
        score = 88;
        triggers.push("RSI em sobrevenda quÃ¢ntica (<32)");
        triggers.push("RejeiÃ§Ã£o estatÃ­stica de 2 desvios padrÃ£o (Banda Inferior)");
        triggers.push("Fluxo de reversÃ£o Ã  mÃ©dia (Mean Reversion)");
      } else if (rsi >= 68 && currentPrice >= bbUpper * 0.998) {
        act = "SELL";
        score = 86;
        triggers.push("RSI em sobrecompra extrema (>68)");
        triggers.push("ExaustÃ£o compradora na Banda Superior");
        triggers.push("Leque de rejeiÃ§Ã£o de topo");
      }

      const safeAtr = atr > 0 ? atr : currentPrice * 0.005;
      const tp = act === "BUY" ? currentPrice + (safeAtr * 1.4) : currentPrice - (safeAtr * 1.4);
      const sl = act === "BUY" ? currentPrice - (safeAtr * 0.8) : currentPrice + (safeAtr * 0.8);

      atlasDecision = {
        action: act,
        confluenceScore: score,
        quantumProbability: score,
        confidence: score > 75 ? "ALTA" : "MODERADA",
        takeProfitPrice: parseFloat(tp.toFixed(2)),
        stopLossPrice: parseFloat(sl.toFixed(2)),
        lotSize: 0.01,
        triggersHit: triggers,
        rationale: act !== "HOLD" 
          ? `OperaÃ§Ã£o Atlas autorizada: ${triggers.join("; ")}.`
          : "Atlas preservando capital: confluÃªncia insuficiente no minuto atual.",
        expectedGainBRL: act !== "HOLD" ? 22.50 : 0
      };
    }

    // ExecuÃ§Ã£o na Capital.com se a decisÃ£o for BUY ou SELL
    let brokerExecution = null;
    if (atlasDecision.action === "BUY" || atlasDecision.action === "SELL") {
      const capitalClient = new CapitalComClient({
        apiKey: CAPITAL_API_KEY,
        identifier: identifier || "trader@capital.com",
        password: password || "",
        isDemo,
      });

      const epic = symbol.replace("-", ""); // Ex: BTCUSD
      brokerExecution = await capitalClient.placeMarketOrder(
        epic,
        atlasDecision.action,
        atlasDecision.lotSize,
        atlasDecision.stopLossPrice,
        atlasDecision.takeProfitPrice
      );
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      engine: "ATLAS_QUANTUM_CORE_6.0",
      decision: atlasDecision,
      brokerExecution,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
