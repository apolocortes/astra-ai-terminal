# Resultados

- [x] Retirar lucro aleatório, saldo falso, credenciais embutidas e sucesso de ordem após falha de autenticação. Conta real não pode ser acionada nesta versão.
- [x] Simulação spot determinística, sem alavancagem, com bid/ask, taxas, slippage, perdas, limite de risco e exposição, cooldown, feed validado e uma posição por vez.
- [x] Interface distingue dados de mercado e dinheiro virtual; apresenta PnL realizado e aberto, custos, origem/idade do feed, motivos de HOLD, exportação JSON e persistência local sem credenciais.
- [x] Corrigir RSI/ATR e uso de candles fechados; produto inválido ou feed indisponível não gera preços inventados nem entradas.
- [x] Testes automatizados e build; entregar PR com limitações e próximos passos documentados, sem publicar em produção ou enviar ordens reais.
