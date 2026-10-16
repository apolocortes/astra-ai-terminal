import { NextResponse } from "next/server";

// A versão anterior podia fabricar sucesso e enviar ordens sem controle de acesso.
// Esta rota não usa credenciais nem faz chamadas à corretora.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      mode: "PAPER_ONLY",
      error:
        "Integração legada desativada. Use a simulação identificada na interface. Execução em corretora exige autenticação, preços próprios, limites e reconciliação de ordens.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
