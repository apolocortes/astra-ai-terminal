# Auditoria e estado atual — Astra

## Achado original

A versão anterior contabilizava ganhos aleatórios sem preço de saída, custos ou perdas. Também havia fallback de autenticação/saldo fictício e segredos literais. Esses comportamentos foram removidos na branch de correção; as rotas legadas permanecem HTTP410. Remover o código não revoga chaves expostas nem elimina segredos dos commits antigos/deployments. O titular deve substituí-las nos provedores.

## Evolução entregue

Foram acrescentadas três estratégias causais de candles, regime de mercado, seleção automática por regras e checklist de decisão. RSI/ATR do núcleo adaptativo usam Wilder; EMAs, Bollinger, eficiência e volume usam janela móvel de até120candles. A pontuação de confluência não é probabilidade de acerto. O terminal preserva a carteira virtual e agora usa essas hipóteses, com padrão de1h alinhado ao laboratório e opção de1min explicitamente não avaliada pelo laboratório.

O laboratório obtém candles reais paginados, valida contiguidade e registra SHA256. Treino/validação70/30 são cronológicos e independentes. A entrada usa a abertura seguinte ao sinal; o cálculo inclui duas pontas de custos e favorece stop em vela ambígua. A escolha considera somente o treino e a estratégia selecionada passa por stress fora da amostra. O modo automático adaptativo não possui resultado agregado neste relatório.

A restauração valida ledger, taxas e metadados de estratégia. Uma entrada por candle, risco≤1%, exposição≤25%, perda de sessão3%, retorno/risco líquido≥1,5 e veto por dados/spread preservam a disciplina. O prazo de posição paper inteligente é48candles, salvo na posição; a regra legada preserva seu prazo anterior. Web Locks coordenam o controle da carteira entre abas; sem suporte ou enquanto aguarda lock, a aba é apenas consulta.

## Capital.com demo

O usuário escolheu começar em demo, mas recusou a conexão protegida das credenciais. Logo, **a conta demo não está conectada**. O adaptador e executor foram preparados, sem realizar autenticação externa ou enviar ordens à corretora. Testes utilizam respostas controladas.

O endpoint é demo fixo, sem configuração de conta real. Regras verificadas no código incluem moeda USD, CFD cripto, contrato/scaling1, lote/incremento, margem, precisão decimal, cotação UTC, distâncias de stop e retorno/risco. Quantidade é arredondada para baixo; não é aumentada ao mínimo quando o orçamento não comporta. Uma referência não é execução: confirmação precisa de IDs exatos, tamanho e stop/alvo consistentes em posições. Intenções incertas bloqueiam reenvio automático.

O worker demo observa por padrão; ordens fictícias exigem flag e orçamento/custos explícitos. Journal e lock são locais. Ele não gerencia operações manuais desconhecidas. Variação de conta utiliza proxy `balance + profitLoss`, ainda não validado end-to-end na conta; não é PnL certificado por trade. O bloqueio de sessão impede novas entradas, não garante liquidação de posição existente. Financiamento overnight, tarifas da conta, epics e execução precisam ser verificados externamente antes de atribuir confiança operacional.

## Primeiro experimento com dados reais

Foi executada pesquisa BTC-USD de30dias em1h:720candles. Parâmetros padrão: capital virtual R$30, USD/BRL manual5, fee60bps por lado, slippage5bps por lado, spread assumido2bps. Treino e validação não apresentaram operação elegível em nenhuma das três hipóteses; seleção nula, veredito **INSUFICIENTE**. O modelo não demonstrou lucro. Não foram reduzidos custos nem ajustados critérios para fabricar um resultado positivo.

SHA256 dos candles: `3b2ed5a8d609836b69c75d09fa7a91623c622080dcbac2365c49fb037ea8e161`. Arquivo de evidência gerado: `astra-btc-research.json`, contendo dados, parâmetros e relatório. Nenhum resultado deste arquivo equivale a operações CFD ou desempenho da conta demo.

## Limites da entrega

Paper não é execução real. Coinbase spot não reproduz contratos CFD, margem, spread, financiamento, filas, rejeições ou slippage da Capital.com. Resultados do navegador são editáveis, não auditoria independente. Workers precisam de armazenamento/processo duráveis em um ambiente ligado; sandbox temporário pode hibernar e função Vercel serverless não é processo residente. Não foi implantado serviço24h.

Entrega solicitada no estado atual: código, testes, workers e documentação via Git/PR, sem modificar produção. Não houve conta externa autenticada, depósito, ordem real, ordem demo externa ou cobrança. Há base de engenharia para investigar e validar; não há fundamento para afirmar que este robô já gera renda.

## Fontes oficiais

[Capital.com Public API](https://open-api.capital.com/) · [Coinbase Exchange candles](https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles)
