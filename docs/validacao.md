# Validação da entrega atual —16/10/2026

`npm test`: **88testes aprovados, zero falhas**. Incluem integridade do feed/ledger, taxas/perdas/gaps, três estratégias determinísticas, causalidade de prefixos, split treino/OOS, entrada na abertura seguinte, taxa não duplicada, prioridade do stop, filtro de spread/retorno-risco, proteção por candle, prazo da posição, restauração e adaptador Capital.com demo com transporte mockado.

`npm run typecheck`: passou. `npm run build`: produção Next.js16.4.2 compilada com sucesso, incluindo `/`, `/laboratorio`, `/metodologia` e `/api/laboratorio`. `npm audit --audit-level=low`: zero vulnerabilidades reportadas no momento. Esses comandos não equivalem a auditoria completa de segurança ou prova de rentabilidade.

Pesquisa real via `scripts/research.ts`: BTC-USD,30dias,720candles fechados de1h. Dados paginados, contíguos e hash registrado. Com custos padrão, zero operações elegíveis nas três hipóteses no treino e OOS; seleção nula e **INSUFICIENTE**. O JSON preserva dados/hipóteses/relatório para reprodução. Não houve lucro demonstrado.

O adaptador demo recebeu correções na revisão de integração: precisão decimal tratada como número de casas, `time` em segundos Unix, candles fechados e contíguos, bid/ask não cruzados, IDs reconciliados por igualdade exata e stop/alvo obrigatórios nas posições confirmadas. Testes de transporte são controlados e não acessam conta de corretora.

**Não executado/pendente:** autenticação externa Capital.com, preflight em instrumento atual, ordem demo aceita e reconciliada na conta, validação contábil do proxy de saldo, custos/financiamento efetivos, serviço durável24h e auditoria independente. A configuração protegida de credenciais foi recusada; nenhum worker demo foi iniciado. Não foram usados segredos antigos, enviados depósitos ou ordens reais, ativadas cobranças ou modificada a produção Vercel.

A interface preserva o terminal e adiciona navegação/estado/checagem lógica. O browser acceptance cross-viewport não foi solicitado nem executado nesta entrega. Build/testes e verificações HTTP locais da prévia cobrem disponibilidade básica, não todos os comportamentos de navegador. A coordenação entre abas depende de Web Locks; sem suporte, a carteira fica em consulta.
