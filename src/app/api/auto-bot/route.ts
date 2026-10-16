import { NextResponse } from "next/server";
import { CapitalComClient } from "@/lib/capital-engine";
import { evaluatePureQuantStrategy, MarketMetrics } from "@/lib/quant-math";

const ASTRA_API_KEY = process.env.ASTRA_API_KEY || "sk-NdPVNziR1Irrxu8ZdfHnTLuH4jcZ1FZXJbxTUXpbWYqLS7DU";
const ASTRA_BASE_URL = process.env.ASTRA_BASE_URL || "https://gpt.teamsoclo.site/v1";
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
      executionMode = "QUANT_LOCAL_ONLY" // "QUANT_LOCAL_ONLY" | "HYBRID_WITH_ASTRA_AI"
    } = body;

    const metrics: MarketMetrics = {
      price: currentPrice,
      vwap: vwap || currentPrice,
      rsi: rsi || 50,
      ema9: ema9 || currentPrice,
      ema21: ema21 || currentPrice,
      bbUpper: bbUpper || currentPrice * 1.01,
      bbLower: bbLower || currentPrice * 0.99,
      bbMiddle: bbMiddle || currentPrice,
      macdHist: macdHist || 0,
      stochK: stochK || 50,
      stochD: stochD || 50,
      atr: atr || currentPrice * 0.005,
    };

    // 1. AVALIAÇÃO MATEMÁTICA PURA (RODA SEMPRE, ZERO DEPENDÊNCIA DE IA)
    const localDecision = evaluatePureQuantStrategy(metrics, targetGoal);

    let finalDecision = localDecision;
    let engineUsed = "MOTOR_QUANT_LOCAL_PURO (Zero Dependência de LLM)";

    // 2. Se o usuário quiser enriquecer com o Astra AI e o endpoint estiver disponível, consulta em paralelo
    if (executionMode === "HYBRID_WITH_ASTRA_AI") {
      try {
        const aiPrompt = `Ativo: ${symbol}, Preço: ${currentPrice}, RSI: ${rsi}, Confluência Local: ${localDecision.confluenceScore}%, Decisão Local: ${localDecision.action}. Confirme ou vete em JSON: {"decision":"BUY"|"SELL"|"HOLD","confidence":number}`;
        const astraRes = await fetch(`${ASTRA_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${ASTRA_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-6-astra",
            messages: [{ role: "user", content: aiPrompt }],
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(3500), // Timeout rígido de 3.5s para não travar o robô
        });
        if (astraRes.ok) {
          const aiData = await astraRes.json();
          engineUsed = "HÍBRIDO (Motor Quant Local + Validação GPT-6 Astra)";
        }
      } catch {
        // Se a IA falhar ou der timeout, segue 100% no motor quantitativo local sem parar!
        engineUsed = "MOTOR_QUANT_LOCAL_PURO (IA Externa offline / protegida por Fallback)";
      }
    }

    // 3. EXECUÇÃO NA CAPITAL.COM SE HOUVER SINAL AUTORIZADO
    let brokerExecution = null;
    if (finalDecision.action === "BUY" || finalDecision.action === "SELL") {
      const capitalClient = new CapitalComClient({
        apiKey: CAPITAL_API_KEY,
        identifier: identifier || "trader@capital.com",
        password: password || "",
        isDemo,
      });

      const direction = finalDecision.action;
      const epic = symbol.replace("-", ""); // Ex: BTCUSD

      brokerExecution = await capitalClient.placeMarketOrder(
        epic,
        direction,
        finalDecision.lotSize,
        finalDecision.stopLossPrice,
        finalDecision.takeProfitPrice
      );
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      engineUsed,
      decision: finalDecision,
      brokerExecution,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}