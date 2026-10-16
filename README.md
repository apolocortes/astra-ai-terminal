# Astra — robô pessoal de estratégias

Entrega no estado atual solicitado pelo usuário. **Não há lucro comprovado, conta demo conectada ou ordens reais habilitadas.** Comercialização e cobrança foram retiradas do escopo inicial.

## Funcionalidades entregues

O terminal `/` consulta livro e candles reais Coinbase, mantém carteira virtual com perdas/custos e exibe lógica explicável. Três hipóteses: Trend Pullback, Range Reversion e Breakout. Auto adapta a regra ao regime de alta, baixa, lateralidade ou volatilidade extrema. Indicadores em até120candles: EMA9/21/50, RSI/ATR de Wilder, Bollinger20, eficiência20 e volume. Score0–100 é confluência, não chance de ganhar.

O laboratório `/laboratorio` obtém7/14/30dias de candles fechados de1h, divide treino/validação70/30, seleciona apenas pelo treino e testa custos1,5×. Exportação inclui dados reais, parâmetros, métricas e SHA256. O modo automático é uma política distinta: o laboratório avalia as hipóteses individuais, não seu resultado agregado. A metodologia está em `/metodologia`.

Dois workers independentes do navegador: paper e Capital.com demo. Ambos usam lock de processo e estado em arquivo. O demo observa por padrão, exige orçamento USD e custos explícitos para permitir ordens fictícias, persiste intenção antes de enviar e reconcilia confirmação, IDs exatos, tamanho e proteções. **Nenhum worker demo foi iniciado com conta externa.**

## Executar

Node.js22 e lockfile do projeto:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run start -- --hostname 0.0.0.0 --port 3000
```

Uma leitura paper, sem permitir entradas:

```bash
npm run bot:paper -- --once
```

Paper contínuo com entradas condicionais; não envia ordens à corretora:

```bash
npm run bot:paper -- --start --symbol BTC-USD --strategy auto --timeframe 3600 --state-dir .astra-paper
```

Pesquisa reproduzível:

```bash
npm run research -- --symbol BTC-USD --days 30 --output .astra-research/report.json
```

`research --config arquivo.json` permite hipóteses de custos/capital. Default spot:60bps por lado, slippage5bps por lado, spread assumido2bps e USD/BRL manual5. Esses parâmetros **não** são tarifas/câmbio verificados da sua conta Capital.com. Não reduzi-los apenas para apresentar um resultado positivo.

## Demo — conexão pendente

O adaptador tem endpoint fixo `https://demo-api-capital.backend-capital.com/api/v1`. Não existe destino real configurável nele. Variáveis server-side necessárias: `CAPITAL_DEMO_API_KEY`, `CAPITAL_DEMO_IDENTIFIER`, `CAPITAL_DEMO_PASSWORD` (custom password da chave API). As credenciais não foram conectadas nesta tarefa: a configuração protegida foi recusada. Sem elas, o worker falha antes da rede. Não colocar valores no chat, Git ou navegador, nem reutilizar a chave exposta anteriormente.

Após configuração autorizada, observar a conta/instrumento:

```bash
npm run bot:demo -- --epic EPIC_DA_CORRETORA --once
```

O epic precisa ser confirmado na Capital.com, nunca deduzido de `BTC-USD`. A versão aceita apenas CFD cripto USD, lotSize1 e scalingFactor1; outras moedas/tipos/regras são recusados. Ordens demo são desativadas por padrão. `--enable-demo-orders` exige `--budget-usd`, `--fee-bps` e `--slippage-bps` explícitos. `--strategy` aceita `auto`, `trend_pullback`, `range_reversion`, `breakout`; `--state-dir` separa experimentos.

Referência de envio não é execução. Estados `SUBMITTING`/`UNKNOWN`/`PENDING` não permitem reenvio automático. Posições desconhecidas, intenção incerta, proteções ausentes e mudança de conta bloqueiam novas entradas. O journal registra saldo de conta e fechamento observado, sem inventar PnL por trade.

**Integração externa ainda não validada end-to-end.** Testes de corretora são mocks. Epics atuais, lotes, ordens aceitas, tarifas/financiamento e a interpretação do proxy contábil `balance + profitLoss` ainda precisam ser verificados na conta. O proxy serve apenas como guarda de variação da sessão, não relatório auditado de patrimônio. O controle de perda demo bloqueia novas entradas; não é liquidação garantida de posição aberta.

## Risco, persistência e limites

Risco planejado≤1%, exposição≤25%, uma posição, bloqueio de perda de sessão3%, retorno/risco líquido mínimo1,5 e uma entrada por candle no primeiro minuto após fechar. Dados antigos/inconsistentes e custos podem vetar entradas. Lote demo é arredondado para baixo; não é elevado ao mínimo quando o orçamento não comporta. Stops e limites planejados não garantem perda máxima.

CFD não é spot. Margem, financiamento, contratos e execução da Capital.com não são reproduzidos pelo histórico Coinbase. Paper usa quotes observadas com polling; backtest usa OHLC e abertura seguinte hipotética, stop prioritário na ambiguidade e gaps adversos. Um rótulo promissor ainda não autoriza dinheiro real.

Carteira do terminal: `localStorage`, ledger validado, últimos300eventos e lock exclusivo entre abas. Restauração não liga entradas. Fechar a aba interrompe monitoramento; dados locais são editáveis, não auditoria independente. Workers usam checkpoint/journal em diretórios ignorados no Git. Não compartilhar diretórios entre processos nem descartar intenção incerta para reenviar. Após queda, verificar processo e conta antes de lidar com lock antigo. `Ctrl+C` salva estado e não afirma fechamento que não observou; proteções demo confirmadas permanecem no broker.

Sandbox é uma prévia temporária e pode hibernar. Workers precisam de processo e armazenamento duráveis em ambiente ligado; Vercel serverless não é worker residente. Não foi implantado serviço24h.

## Resultado observado nesta entrega

Histórico real BTC-USD:30dias,720candles de1h. Com custos padrão, nenhuma hipótese gerou operação elegível; seleção nula, veredito **INSUFICIENTE**. Isso é ausência de operações no modelo, não prova de uma estratégia lucrativa. Não há base para afirmar que o robô já ganha dinheiro.

Validação:88testes passaram, TypeScript e build passaram, auditoria npm sem vulnerabilidades reportadas. Mais detalhes em `docs/auditoria.md` e `docs/validacao.md`. Produção não foi alterada; não foram enviados depósitos, ordens reais ou ordens demo externas.

[API Capital.com](https://open-api.capital.com/) · [Candles Coinbase](https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles)
