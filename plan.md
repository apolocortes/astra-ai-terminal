# Correção do Astra Terminal

Melhorar o robô significa substituir ganhos inventados por evidência reproduzível, não garantir rentabilidade. Manter Next.js e a hospedagem Vercel existentes; entregar alterações em branch e PR, sem ativar negociação real nem publicar em produção.

## Implementação

`src/lib/paper-engine.ts` terá um motor puro de simulação spot, comprado, sem alavancagem. Entradas e saídas usam ask/bid reais do feed Coinbase, taxas e slippage configuráveis, conversão USD/BRL explicitamente manual, risco planejado por operação de 1%, limite de perda de sessão de 3%, limite de exposição de 25%, cooldown e no máximo uma posição. Limites não garantem perda máxima em gaps. Não operar com feed antigo ou inválido. Não inferir preços faltantes. Simulação não representa execução na Capital.com.

`src/app/api/live-depth/route.ts` validará produto, integridade do livro e candles fechados; calculará RSI recente e ATR com as três componentes do true range. Rotas legadas que permitiam execução sem autenticação ou inventavam análises retornarão indisponibilidade explícita. O cliente Capital.com falhará sem credenciais ou sessão, não retornará sucesso simulado e ficará sem envio de ordens nesta versão.

A interface preservará a identidade escura do terminal, com ciano para mercado, âmbar para simulação e vermelho para perdas. Separará saldo virtual, lucro realizado, resultado em aberto e custos, mostrará procedência e idade do feed, registrará decisões factuais e exportará evidências JSON. Sessão virtual persistida localmente, sem credenciais, monitorada apenas enquanto a página estiver aberta. Pausa bloqueia novas entradas; posição existente segue sendo monitorada. Fechamento manual também é simulado.

## Estrutura

- `src/app`: interface e rotas Next.js.
- `src/lib`: motor puro e cliente legado corrigido.
- `tests`: testes determinísticos do motor e regressões de segurança.
- `docs`: achados, limitações e critérios para evolução.

Não criar um serviço contínuo ou integração nova. Execução real exige projeto separado de autenticação, gestão de segredos, metadados e preços da corretora, confirmação e reconciliação de ordens e autorização específica. A rentabilidade precisará ser medida fora da amostra; esta entrega não fabrica backtest de livro histórico inexistente.
