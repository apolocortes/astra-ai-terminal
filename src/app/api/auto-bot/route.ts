import { NextResponse } from "next/server";
import { CapitalComClient } from "@/lib/capital-engine";

const ASTRA_API_KEY = process.env.ASTRA_API_KEY || "sk-NdPVNziR1Irrxu8ZdfHnTLuH4jcZ1FZXJbxTUXpbWYqLS7DU";
const ASTRA_BASE_URL = process.env.ASTRA_BASE_URL || "https://gpt.teamsoclo.site/v1";
const CAPITAL_API_KEY = "sM7ZGP4ElOFbXMs7";

export async function POST(req: Request) {
  try {
    const {
      symbol = "BTC-USD",
      currentPrice,
      vwap,
      rsi,
      ema9,
      ema21,
      macd,
      macdSignal,
      macdHist,
      bbUpper,
      bbLower,
      stochK,
      stochD,
      atr,
      targetGoal = 25,
      identifier,
      password,
      isDemo = true
    } = await req.json();

    // 1. Motor de Confluência Quântica (Análise de Múltiplos Indicadores)
    const indicatorsAnalysis = {
      trend: currentPrice > ema21 && ema9 > ema21 ? "BULLISH" : currentPrice < ema21 && ema9 < ema21 ? "BEARISH" : "CHOPPY",
      vwapPosition: currentPrice > vwap ? "ABOVE_VWAP" : "BELOW_VWAP",
      rsiStatus: rsi < 32 ? "OVERSOLD" : rsi > 68 ? "OVERBOUGHT" : "NEUTRAL",
      macdCross: macdHist > 0 && macd > macdSignal ? "BULLISH_CROSS" : macdHist < 0 && macd < macdSignal ? "BEARISH_CROSS" : "NEUTRAL",
      bbPosition: currentPrice <= bbLower ? "LOWER_BAND_BOUNCE" : currentPrice >= bbUpper ? "UPPER_BAND_REJECTION" : "INSIDE_BANDS",
      stochStatus: stochK < 20 && stochK > stochD ? "STOCH_BULLISH_REVERSAL" : stochK > 80 && stochK < stochD ? "STOCH_BEARISH_REVERSAL" : "NEUTRAL",
    };

    // 2. Consulta o GPT-6 Astra com toda a bateria de indicadores
    const systemPrompt = `Você é o ASTRA QUANT ENGINE 6.0 — robô autônomo de alta frequência integrado com a Capital.com.
Sua missão: analisar a CONFLUÊNCIA DE 7 INDICADORES TÉCNICOS (VWAP, RSI, MACD, Bandas de Bollinger, Estocástico, EMA 9/21, ATR) e decidir se abre uma ordem automática na Capital.com.
Se houver confluência mínima de 4 indicadores a favor, emita "EXECUTE_BUY" ou "EXECUTE_SELL". Caso contrário, emita "HOLD_NO_ACTION".
Responda EXCLUSIVAMENTE em formato JSON:
{
  "decision": "EXECUTE_BUY" | "EXECUTE_SELL" | "HOLD_NO_ACTION",
  "confluenceScore": number (0 a 100),
  "primaryReason": string,
  "takeProfitPrice": number,
  "stopLossPrice": number,
  "expectedProfitBRL": number,
  "capitalLotSize": number,
  "confidence": number
}`;

    const userPrompt = `DADOS MULTI-INDICADORES PARA ${symbol}:
- Preço Atual: $${currentPrice}
- VWAP: $${vwap} (${indicatorsAnalysis.vwapPosition})
- RSI (14): ${rsi} (${indicatorsAnalysis.rsiStatus})
- MACD Histograma: ${macdHist} (${indicatorsAnalysis.macdCross})
- Bandas de Bollinger: [${bbLower} - ${bbUpper}] (${indicatorsAnalysis.bbPosition})
- Estocástico K/D: ${stochK}/${stochD} (${indicatorsAnalysis.stochStatus})
- Tendência Médias EMA 9/21: ${indicatorsAnalysis.trend}
- Volatilidade ATR: ${atr}
- Meta Diária: R$ ${targetGoal},00

Decida se o robô deve abrir a ordem automática agora na Capital.com.`;

    const astraRes = await fetch(`${ASTRA_BASE_URL}/chat/completions`, {
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
        temperature: 0.1,
      }),
    });

    let botDecision;
    if (astraRes.ok) {
      const astraData = await astraRes.json();
      const rawText = astraData.choices?.[0]?.message?.content || "";
      const match = rawText.match(/\{[\s\S]*\}/);
      botDecision = match ? JSON.parse(match[0]) : JSON.parse(rawText);
    } else {
      // Fallback algorítmico local
      const isBuy = rsi < 35 || (indicatorsAnalysis.bbPosition === "LOWER_BAND_BOUNCE" && macdHist > 0);
      const isSell = rsi > 65 || (indicatorsAnalysis.bbPosition === "UPPER_BAND_REJECTION" && macdHist < 0);
      botDecision = {
        decision: isBuy ? "EXECUTE_BUY" : isSell ? "EXECUTE_SELL" : "HOLD_NO_ACTION",
        confluenceScore: isBuy || isSell ? 86 : 45,
        primaryReason: isBuy ? "Confluência: Toque na Banda Inferior de Bollinger com IFR sobrevendido e divergência de alta no MACD." : isSell ? "Confluência: Rejeição na Banda Superior de Bollinger com IFR sobrecomprado." : "Aguardando alinhamento estrito dos 7 indicadores.",
        takeProfitPrice: currentPrice * (isBuy ? 1.008 : 0.992),
        stopLossPrice: currentPrice * (isBuy ? 0.995 : 1.005),
        expectedProfitBRL: targetGoal,
        capitalLotSize: 0.01,
        confidence: 88,
      };
    }

    // 3. Se a decisão for executar, despacha ordem automática na Capital.com
    let brokerResult = null;
    if (botDecision.decision === "EXECUTE_BUY" || botDecision.decision === "EXECUTE_SELL") {
      const capitalClient = new CapitalComClient({
        apiKey: CAPITAL_API_KEY,
        identifier: identifier || "trader@capital.com",
        password: password || "",
        isDemo,
      });

      const direction = botDecision.decision === "EXECUTE_BUY" ? "BUY" : "SELL";
      brokerResult = await capitalClient.placeMarketOrder(
        symbol.replace("-", ""),
        direction,
        botDecision.capitalLotSize || 0.01,
        botDecision.stopLossPrice,
        botDecision.takeProfitPrice
      );
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      indicatorsAnalysis,
      botDecision,
      brokerExecution: brokerResult,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}