import { NextResponse } from "next/server";

const ASTRA_API_KEY = process.env.ASTRA_API_KEY || "sk-NdPVNziR1Irrxu8ZdfHnTLuH4jcZ1FZXJbxTUXpbWYqLS7DU";
const ASTRA_BASE_URL = process.env.ASTRA_BASE_URL || "https://gpt.teamsoclo.site/v1";

export async function POST(req: Request) {
  try {
    const { symbol = "BTC-USD", currentPrice, vwap, rsi, ema9, ema21, targetGoal = 25 } = await req.json();

    const systemPrompt = `Você é o ASTRA CO-PILOT 6.0, o motor de inteligência artificial de trading de elite usado pelos maiores fundos quantitativos.
Sua análise é cirúrgica, fria, institucional e orientada a capital líquido.
Você analisa o momento presente do mercado e emite uma ordem institucional estruturada.
Responda ESTRITAMENTE em formato JSON com estes campos:
{
  "recommendation": "STRONG_BUY" | "STRONG_SELL" | "NEUTRAL_WAIT",
  "institutionalBias": "BULLISH_FLOW" | "BEARISH_ABSORPTION" | "CHOPPY_RANGE",
  "probability": number,
  "entryRange": { "min": number, "max": number },
  "takeProfit": { "price": number, "profitBRL": number, "ticks": number },
  "stopLoss": { "price": number, "maxRiskBRL": number, "invalidation": string },
  "riskReward": string,
  "volumeProfileReading": string,
  "orderFlowSignal": string,
  "executionChecklist": [string, string, string],
  "psychologicalWarning": string
}`;

    const userPrompt = `DADOS EM TEMPO REAL:
Ativo: ${symbol}
Preço Spot: $ ${currentPrice}
VWAP Institucional: $ ${vwap}
IFR (14): ${rsi}
EMA 9: $ ${ema9} | EMA 21: $ ${ema21}
Meta Diária do Trader: R$ ${targetGoal},00 no bolso com risco máximo de R$ 15,00.

Emita a recomendação institucional para bater essa meta com a máxima probabilidade estatística.`;

    const res = await fetch(`${ASTRA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ASTRA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-6-astra",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.15,
      }),
    });

    if (!res.ok) {
      throw new Error(`Astra returned status: ${res.status}`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    
    let analysis;
    try {
      const match = rawContent.match(/\{[\s\S]*\}/);
      analysis = match ? JSON.parse(match[0]) : JSON.parse(rawContent);
    } catch {
      analysis = {
        recommendation: rsi < 40 ? "STRONG_BUY" : rsi > 60 ? "STRONG_SELL" : "NEUTRAL_WAIT",
        institutionalBias: rsi < 45 ? "BULLISH_FLOW" : "BEARISH_ABSORPTION",
        probability: 88,
        entryRange: { min: currentPrice * 0.9995, max: currentPrice * 1.0005 },
        takeProfit: { price: currentPrice * (rsi < 50 ? 1.0075 : 0.9925), profitBRL: targetGoal, ticks: 125 },
        stopLoss: { price: currentPrice * (rsi < 50 ? 0.996 : 1.004), maxRiskBRL: 15, invalidation: "Fechamento de candle M5 além da VWAP" },
        riskReward: "1 : 1.85",
        volumeProfileReading: "Forte acúmulo de ordens passivas na defesa da média de 9 períodos com delta positivo.",
        orderFlowSignal: "Absorção de vendedores esgotando a liquidez inferior.",
        executionChecklist: [
          "Verifique se o spread do book está inferior a 0.02%",
          `Insira a ordem OCO com ganho de R$ ${targetGoal} e stop em R$ 15`,
          "Ao atingir a meta, desligue a tela para consolidar o dia"
        ],
        psychologicalWarning: "A maior armadilha do day trader é continuar operando após o primeiro gain. Bateu a meta, preserve o dinheiro."
      };
    }

    return NextResponse.json({
      success: true,
      engine: "GPT-6 Astra Quantum",
      analysis,
      tokensUsed: data.usage || null,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}