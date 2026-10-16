# ASTRA LAB

Laboratório de **paper trading spot comprado**, sem alavancagem, com dados públicos da Coinbase Exchange. Não recebe depósitos, não envia ordens e não promete ganhos. A integração legada com a Capital.com está indisponível nesta versão.

## Executar

Use Node.js 22 e o lockfile do projeto:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run start -- --hostname 0.0.0.0 --port 3000
```

## O que a simulação mede

A carteira começa com R$ 30 virtuais. A conversão USD/BRL é **manual e fixa na sessão**, inicialmente 5,00; não é uma cotação validada. A taxa padrão de 60 bps por lado e o slippage de 5 bps são hipóteses de simulação, não tarifas confirmadas de uma conta. Ajuste antes de iniciar e exporte os parâmetros junto aos resultados.

O motor consulta o mercado a cada cinco segundos após a conclusão da resposta. Ele só considera compra se a liquidez nos seis primeiros níveis do livro for pelo menos 60% compradora, o RSI simples de 14 períodos estiver entre 50 e 65 e o preço médio do livro superar a VWAP móvel. Essa regra é uma **hipótese não validada**, não uma probabilidade de acerto nem identificação de fluxo institucional.

A entrada usa o ask com slippage; a saída usa o bid com slippage. O custo de ambas as pontas entra no resultado. Alvo e stop são distâncias de ATR, não valores de lucro inventados. Uma entrada é vetada se a relação retorno/risco projetada, líquida dos custos, ficar abaixo de 1,5. O cálculo é uma condição de entrada, não evidência de expectativa estatística positiva.

O risco planejado é de até 1% do patrimônio por operação, com até 25% de exposição e uma posição por vez. A perda de sessão de 3% aciona fechamento simulado e bloqueia entradas quando observada. Gaps, feed indisponível e intervalo entre consultas podem gerar perdas maiores. Não há stop garantido.

Saldo virtual, resultado realizado, resultado em aberto e taxas são exibidos separadamente. Pausar bloqueia novas entradas; uma posição existente continua sendo monitorada. Sem feed válido não se inventa entrada ou saída. A troca de ativo fica bloqueada durante a execução e enquanto há posição aberta.

## Persistência e evidência

A sessão fica no `localStorage` do navegador, sem credenciais. Reabrir a aba restaura a carteira, mas não reativa entradas. O monitoramento só existe com a página aberta: fechar a aba não executa stops. Uma sessão nova pode apagar o histórico local, com confirmação na interface; exporte antes de reiniciar.

A exportação JSON inclui todos os trades da sessão, configuração e os últimos 300 eventos de decisão com snapshots. Os últimos 300 eventos e o ledger da sessão persistem no navegador. Estados estruturalmente inválidos ou que não reconciliam são descartados. Dados locais podem ser editados e não constituem auditoria independente. O gráfico TradingView é indicativo; o cálculo usa o feed REST Coinbase, não dados do widget.

## Segurança da versão anterior

Havia segredos literais, lucro aleatório e fallback de autenticação que produzia saldo ou sucesso de ordem simulados. Foram removidos do código atual. **Isso não revoga credenciais já expostas nem elimina o histórico do Git ou deployments anteriores.** O titular precisa revogar/substituir as chaves nos provedores. Não reutilize as antigas.

As rotas `capital-trade`, `capital-balance`, `auto-bot`, `atlas-engine` e `astra-live` retornam HTTP 410 sem rede ou uso de credenciais. O cliente legado exige credenciais completas, permite apenas ambiente demo de leitura e rejeita qualquer envio de ordem.

## Antes de dinheiro real

Primeiro medir resultados líquidos em períodos independentes e registrar também sessões negativas ou sem operação. Não há backtest validado nesta entrega; candles OHLC não reconstruem livro histórico e não bastam para testar essa estratégia de livro. O desempenho de paper trading não garante execução real.

Uma futura integração precisa de autenticação e autorização por usuário, armazenamento protegido de segredos, preços e metadados da própria corretora, moeda da conta, lote mínimo, margem e distâncias de stop. Também exige execução server-side persistente, idempotência, confirmação de ordens e reconciliação de posições, além de análise fora da amostra. Preços spot Coinbase não devem ser usados como se fossem preços CFD da Capital.com.

Consulte [a documentação oficial Capital.com](https://open-api.capital.com/) e [os limites do endpoint de candles Coinbase](https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles). O caminho de engenharia e os achados estão em `docs/auditoria.md`.
