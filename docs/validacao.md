# Validação executada em 16/10/2026

`npm test`: **53 testes aprovados, zero falhas**. Cobertura inclui custos, prejuízo no stop, lucro líquido no alvo, gap, feed ausente/antigo/inválido, posição única, cooldown, teto de exposição, ticker divergente, dominância inconsistente, integridade de sessão restaurada, taxas negativas, ledger reconciliado e persistência de evidências. Fixtures não usam dinheiro real.

`npm run typecheck`: concluído sem erros. `npm run build`: compilação de produção Next.js 16.4.2 concluída após a última alteração funcional. `npm audit --audit-level=low`: nenhuma vulnerabilidade reportada no momento da verificação. `git diff --check`: sem erros de whitespace.

No teste HTTP, a página e o manifesto de rotas responderam 200. O feed Coinbase respondeu 200 com preço, livro e 30 candles fechados reais. Produto inválido respondeu 400; a rota legada `capital-trade` respondeu 410 sem execução. A prévia pública e seu endpoint de mercado também responderam 200.

No navegador isolado, o gráfico Coinbase carregou, o botão de iniciar passou para pausa e o ciclo emitiu HOLD por falta de confluência, mantendo R$ 30 virtuais, sem somar lucros artificiais. A prévia final salvou carteira e evidências no envelope versão 2, com entradas pausadas. Esses testes não comprovam rentabilidade ou comportamento completo em todos os navegadores.

Os quatro achados materiais da revisão independente foram corrigidos: teto configurável acima de 25%, ausência de validação de coerência do livro/ticker, restauração sem reconciliação e eventos perdidos após reload. Os caminhos afetados receberam testes específicos. Ainda não há coordenação entre abas, execução server-side persistente ou auditoria independente dos dados locais.

Não foram utilizadas credenciais expostas, autenticadas contas de corretora, enviados pedidos de negociação, depositados recursos ou publicado o código no endereço Vercel original. Esta entrega é uma branch/pull request e uma prévia temporária, não um robô autorizado para dinheiro real.
