# Astra — robô de operações próprias

O usuário esclareceu que **não pretende vender inicialmente**: quer um robô inteligente para operar para si. Descartar o trabalho comercial ainda não entregue. O objetivo de engenharia é tomar decisões verificáveis, medir expectativa líquida e permitir integração controlada com corretora; não prometer transformar R$ 30 em renda.

## Inteligência verificável

Três hipóteses de candles: pullback de tendência, reversão em lateralidade e rompimento com volume. O motor classifica regime, usa somente dados passados, seleciona regras compatíveis e mostra checklist de condições e vetos. Confluência é uma pontuação lógica, não probabilidade de acerto. Sem LLM inventando preços ou confirmação de ordens. Auto adapta regra ao regime, não reescreve parâmetros para fabricar um backtest positivo.

A simulação usa o mesmo avaliador de estratégias do laboratório. Preservar risco planejado de até 1%, exposição até 25%, uma posição, perda de sessão de 3%, custos e gaps. Dados insuficientes, spread e custos podem vetar entradas. Risco planejado não é perda máxima garantida.

## Laboratório histórico

Histórico real Coinbase de 7/14/30 dias em candles de1h com paginação, deduplicação, integridade, contiguidade e hash. Treino/validação70/30 cronológico. Entradas somente na abertura seguinte; stops/alvos ATR derivados dos dados anteriores, stop antes de alvo em ambiguidade, gaps adversos e duas pontas de custos. A estratégia escolhida vem somente do treino, depois passa pelo período fora da amostra e stress de custos. Mostrar resultados negativos e amostra insuficiente. Exportação inclui dados, parâmetros e métricas. Não reconstruir livro histórico inexistente.

## Terminal e execução

Preservar `/` como terminal, mesma paleta escura/ciano, hierarquia e contrato de carteira local. Acrescentar `/laboratorio` e `/metodologia`. Terminal apresenta seletor auto/estratégia, regime, checklist e evidências. Tratar concorrência entre abas. Uma posição guarda estratégia e timeframe; trocar regra com posição aberta não pode mudar seu risco original.

Criar worker de paper trading próprio, com checkpoint em arquivo e log em JSONL, lock de processo, tratamento de sinais e nenhuma ordem real. Ele pode executar fora do navegador quando hospedado num ambiente apropriado. A prévia em sandbox não é serviço24h, e Vercel serverless não deve ser anunciado como processo residente.

A corretora e o ambiente demo estão sendo confirmados com o usuário. Capital.com era citada no material anterior. Integração exige credenciais novas fornecidas de forma protegida, não as expostas. Não executar ordens reais sem autorização dos parâmetros e validação de corretora, margem, moeda, lote mínimo, stop, confirmação e reconciliação.

## Estrutura

- `src/lib/strategy-engine.ts` e `backtest.ts`: regras e avaliação histórica pura.
- `src/lib/historical-data.ts`: dados reais paginados, contiguidade e hash.
- `src/lib/paper-engine.ts` e `paper-storage.ts`: carteira, risco e integridade.
- `src/app/api`: mercado e pesquisa, com limites de requisição.
- `src/app/laboratorio` e `metodologia`: investigação e transparência.
- `scripts`: execução própria em paper com checkpoint.
- `tests` e `docs`: regressões, resultados reais e condições para evolução.

Não incluir assinaturas, preços, contas comerciais ou cobrar usuário nesta etapa. Não publicar alterações na Vercel sem autorização de publicação. Entregar código pelo PR existente e prévia temporária, com limites explícitos.
