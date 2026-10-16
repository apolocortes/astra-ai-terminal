# O terminal anterior não demonstrava lucro real

A revisão de 16/10/2026 encontrou geração de lucro por `Math.random()` em `src/app/page.tsx`. O botão de iniciar somava entre R$ 4,20 e R$ 7,00 a cada ciclo, sem chamada a uma rota de execução, sem preço de saída, sem taxas e sem perdas. A conexão do livro Coinbase não transformava esse saldo em dinheiro na corretora. O relato de “ordem disparada” não correspondia a envio de ordem.

O cliente `src/lib/capital-engine.ts` retornava saldo fictício de R$ 500 em falha de login e `success: true` em uma ordem simulada após autenticação recusada. Isso poderia mascarar indisponibilidade como sucesso. Havia chaves literais no frontend e backend, e algumas respostas devolviam a chave. Não foram utilizadas ou reproduzidas nesta revisão.

## Problemas prioritários corrigidos

A nova interface deixa explícito que carteira, posições e resultados são virtuais. A restauração exige ledger reconciliado, trades íntegros e taxas não negativas; rejeita exposição configurada acima de 25%. O motor calcula posição, entrada pelo ask, saída pelo bid, taxas em duas pontas e slippage. Lucro ou prejuízo realizado só aparece após a saída simulada. O resultado em aberto usa valor líquido de liquidação estimado, e não contabiliza novamente o lucro realizado.

Foi removido o fallback que inventava preços para operar sem feed. Snapshot recebido há mais de 15 segundos e dados de mercado há mais de 60 segundos não autorizam entradas. O feed valida o horário do ticker e do livro, produtos USD, integridade de preços e candles fechados contíguos. Divergência maior que 1% entre ticker e preço médio do livro é rejeitada. O motor também valida níveis e recomputa a dominância informada. O endpoint de candles recebeu início e fim explícitos após o teste ao vivo detectar histórico antigo na consulta sem janela. Não foi “corrigido” relaxando o limite ou inventando candles.

O RSI anterior usava deltas do começo da janela, não os 14 mais recentes. O ATR omitiria a distância entre low e fechamento anterior. Agora ambos têm testes: RSI por média simples de 14 deltas, ATR por média simples dos últimos 14 true ranges e VWAP móvel de até 30 candles fechados. Isso não equivale ao RSI suavizado de Wilder ou à VWAP de sessão do widget.

O gráfico anterior era Binance/USDT em cinco minutos, enquanto a interface dizia Coinbase/USD em um minuto. A versão nova usa TradingView Coinbase/USD em um minuto; o cálculo continua independente do gráfico.

As cinco rotas legadas de corretora/IA retornam HTTP 410. Não enviam ordens, não carregam chaves e não atribuem probabilidades a uma análise fabricada. O cliente legado deixou de oferecer envio de ordens e só permite leitura demo com credenciais completas. Próxima integração deve substituir, não reativar sem revisão, o fluxo antigo.

O projeto recebeu lockfile, testes e atualização de Next.js, React, Tailwind e PostCSS. A auditoria de dependências da versão corrigida não apontou vulnerabilidades no momento da execução; isso não substitui monitoramento futuro ou uma auditoria de segurança completa.

## Por que R$ 30 não sustentam a promessa anterior

Ganhar R$ 20 sobre R$ 30 significa retornar 66,67% do capital; ganhar R$ 30 significa 100%. Essas metas eram exibidas sem evidência que as sustentasse. A taxa de acerto de 63,2% e o fator de lucro 2,51 do texto enviado não foram acompanhados de histórico reproduzível de operações ou rotina de backtest no material inspecionado. Não se deve tratá-los como resultados auditados.

O risco de 15% por entrada corresponde a R$ 4,50 num saldo de R$ 30. Dez perdas consecutivas desse tamanho proporcional deixam aproximadamente R$ 5,91, mesmo antes de custos adicionais. Isso não é preservação prudente de capital.

Nesta versão, 1% de risco planejado equivale inicialmente a R$ 0,30 e o bloqueio de 3% a R$ 0,90. A exposição máxima de 25% limita ainda mais o tamanho. Esses valores são parâmetros da simulação, **não perda máxima garantida**. Em um mercado de baixa volatilidade, custos de ida e volta podem vetar todas as entradas. O produto mostra a razão do veto em vez de obrigar uma operação para parecer ativo.

## O que permanece não comprovado

Nenhum backtest fora da amostra foi produzido ou alegado nesta entrega. A estratégia nova é uma hipótese simples de livro e tendência, não uma estratégia aprovada. Sem livro histórico, candles sozinhos não permitem reconstruir as entradas desse motor. A documentação Coinbase descreve limites por requisição; obter histórico longo requer paginação, validação de contiguidade e registro da proveniência. [1]

O passo seguinte é coletar dados e decisões de forma persistente, separar período de desenvolvimento e validação, medir lucro líquido, expectativa por operação, drawdown, dispersão de resultados e cenários com custos maiores. Excluir sessões negativas ou ajustar a regra depois de olhar o período de teste invalida a conclusão. Paper trading não mede filas, liquidez executável completa, rejeições reais ou execução de stops em gaps.

Não foi determinada a viabilidade de R$ 30 na Capital.com: moeda da conta, produtos permitidos, lote mínimo, margem, spread e distância mínima do stop dependem dos metadados e da conta. O `epic` não deve ser inferido apenas removendo um hífen do símbolo Coinbase. O envio a `POST /positions` retorna uma referência; confirmação e reconciliação são etapas distintas, conforme a documentação oficial. [2]

## Limites operacionais desta entrega

O robô novo só simula compras spot. Não oferece venda a descoberto nem alavancagem. Ele roda no navegador enquanto a página estiver aberta. A pausa impede entradas e preserva o monitoramento da posição; fechar a página interrompe esse monitoramento. Saldo e trades persistem no navegador; o registro detalhado de decisões contém no máximo 300 eventos e persiste junto com o ledger após recarregamento. Exporte-o para análise.

USD/BRL, taxas e slippage são hipóteses manuais fixas. A carteira não tem vínculo com depósitos bancários. Os dados locais são editáveis e não constituem histórico certificado. Ainda não há coordenação entre abas; use apenas uma aba por sessão. O limite de perda é por sessão, não uma trava diária global compartilhada entre dispositivos.

**As credenciais expostas precisam ser revogadas e substituídas pelo titular nos provedores.** Remover literais nesta branch não remove segredos dos commits antigos, artefatos ou deployments anteriores. Esta entrega não alterou a segurança das contas, não apagou histórico Git e não publicou a nova versão no endereço Vercel original.

## Pontos positivos preservados

O uso de rotas Next.js para obter os dados públicos evita que a interface precise acessar diretamente a API externa. O livro Level 2 pode servir como evidência observável, desde que corretamente identificado como snapshot spot da Coinbase. A interface existente já reunia gráfico e painel operacional; foi reaproveitada a identidade escura, com distinção clara entre mercado, simulação e perdas.

## Decisão de engenharia

A versão anterior precisa de mudanças antes de qualquer uso com dinheiro real. A nova base é apropriada para testar comportamento e coletar evidências, mas não é uma autorização para operar nem prova de rentabilidade. Não foi feita compra, venda, depósito ou alteração em conta de corretora.

## Referências

[1]: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles "Coinbase Exchange: esquema, intervalos e limites de candles"
[2]: https://open-api.capital.com/ "Capital.com Public API: sessões, metadados, posições e confirmações"
