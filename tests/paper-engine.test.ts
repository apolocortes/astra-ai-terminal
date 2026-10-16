import test from "node:test";
import assert from "node:assert/strict";
import {
  createPaperState,
  DEFAULT_CONFIG,
  equityBRL,
  paperStep,
  snapshotError,
  validateConfig,
  type Snapshot,
} from "../src/lib/paper-engine";
const T = 1802720000000;
function snap(patch: Partial<Snapshot> = {}): Snapshot {
  const bid = patch.bid ?? 100;
  const ask = patch.ask ?? 100.01;
  return {
    success: true,
    timestamp: T,
    marketTimestamp: T,
    source: "fixture",
    symbol: "BTC-USD",
    price: 100,
    bid,
    ask,
    orderBook: {
      buyerDominance: 65,
      bids: [{ price: bid, size: ((65 / 35) * ask) / bid }],
      asks: [{ price: ask, size: 1 }],
    },
    indicators: { rsi: 55, vwap: 99, atr: 10 },
    ...patch,
  };
}
function fresh(patch: Partial<Snapshot> = {}, elapsed = 5000) {
  return snap({
    timestamp: T + elapsed,
    marketTimestamp: T + elapsed,
    ...patch,
  });
}
const open = () => paperStep(createPaperState(), snap(), T).state;
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("carteira começa exatamente com capital virtual informado", () => {
  const s = createPaperState();
  assert.equal(s.cashBRL, 30);
  assert.equal(s.realizedBRL, 0);
  assert.equal(s.position, null);
});
test("feed ausente nunca gera operação ou lucro", () => {
  const s = createPaperState();
  const result = paperStep(s, null, T);
  assert.equal(result.action, "HOLD");
  assert.deepEqual(result.state, s);
});
test("dados vencidos e futuros bloqueiam entradas", () => {
  assert.ok(snapshotError(snap(), T + 16000));
  assert.ok(snapshotError(snap({ timestamp: T + 3000 }), T));
  assert.ok(snapshotError(snap({ marketTimestamp: T - 61000 }), T));
});
test("timestamps e números não finitos são rejeitados", () => {
  for (const s of [
    snap({ timestamp: NaN }),
    snap({ marketTimestamp: NaN }),
    snap({ bid: NaN }),
    snap({ ask: Infinity }),
    snap({ price: 0 }),
  ])
    assert.ok(snapshotError(s, T));
});
test("livro cruzado e indicadores inválidos são rejeitados", () => {
  assert.ok(snapshotError(snap({ ask: 99 }), T));
  assert.ok(
    snapshotError(snap({ indicators: { rsi: 101, atr: 10, vwap: 99 } }), T),
  );
  assert.ok(
    snapshotError(snap({ indicators: { rsi: 55, atr: 0, vwap: 99 } }), T),
  );
});
test("mercado sem confluência preserva carteira", () => {
  const result = paperStep(
    createPaperState(),
    snap({ orderBook: { buyerDominance: 45, bids: [], asks: [] } }),
    T,
  );
  assert.equal(result.action, "HOLD");
  assert.equal(result.state.cashBRL, 30);
});
test("spread excessivo bloqueia entrada", () => {
  assert.match(
    paperStep(createPaperState(), snap({ ask: 101 }), T).message,
    /Spread/,
  );
});
test("custos vetam scalp com volatilidade insuficiente", () => {
  assert.match(
    paperStep(
      createPaperState(),
      snap({ indicators: { rsi: 55, vwap: 99, atr: 0.1 } }),
      T,
    ).message,
    /Custos/,
  );
});
test("entrada não produz lucro realizado e debita taxa", () => {
  const s = open();
  assert.ok(s.position);
  assert.equal(s.realizedBRL, 0);
  assert.ok(s.feesBRL > 0);
  assert.ok(s.cashBRL < 30);
  assert.ok(equityBRL(s, snap())! < 30);
});
test("exposição sem alavancagem e risco planejado respeitam limites", () => {
  const s = open();
  const p = s.position!;
  const c = s.config;
  assert.ok(
    p.quantity * p.entry * c.usdBRL + p.entryFeeBRL <= 30 * 0.25 + 1e-8,
  );
  const stopFill = p.stop * (1 - c.slippageBps / 10000);
  const loss =
    p.quantity *
    (p.entry * (1 + c.feeBps / 10000) - stopFill * (1 - c.feeBps / 10000)) *
    c.usdBRL;
  assert.ok(loss <= 30 * 0.01 + 1e-8);
});
test("motor é determinístico para mesma entrada", () => {
  assert.deepEqual(
    paperStep(createPaperState(), snap(), T),
    paperStep(createPaperState(), snap(), T),
  );
});
test("snapshot duplicado não abre segunda posição", () => {
  const s = open();
  assert.deepEqual(paperStep(s, snap(), T).state, s);
});
test("posição aberta não permite empilhamento", () => {
  const s = open();
  const result = paperStep(s, fresh(), T + 5000);
  assert.equal(result.action, "HOLD");
  assert.equal(result.state.position?.openedAt, T);
});
test("fechamento com preço parado realiza perda pelos custos", () => {
  const s = open();
  const result = paperStep(s, fresh(), T + 5000, false, true);
  assert.equal(result.action, "CLOSE");
  assert.ok(result.state.realizedBRL < 0);
  near(result.state.cashBRL, 30 + result.state.realizedBRL);
  near(result.state.feesBRL, result.state.trades[0].feesBRL);
});
test("stop observado registra prejuízo", () => {
  const s = open();
  const bid = s.position!.stop - 0.01;
  const r = paperStep(s, fresh({ bid, ask: bid + 0.01, price: bid }), T + 5000);
  assert.equal(r.action, "CLOSE");
  assert.ok(r.state.realizedBRL < 0);
  assert.equal(r.state.position, null);
  assert.equal(r.state.trades[0].reason, "Stop observado");
});
test("alvo observado registra lucro líquido com duas taxas", () => {
  const s = open();
  const bid = s.position!.target;
  const r = paperStep(s, fresh({ bid, ask: bid + 0.01, price: bid }), T + 5000);
  assert.equal(r.action, "CLOSE");
  assert.ok(r.state.realizedBRL > 0);
  assert.ok(r.state.trades[0].feesBRL > s.position!.entryFeeBRL);
  near(r.state.cashBRL - 30, r.state.realizedBRL);
});
test("gap pode exceder risco planejado e aciona bloqueio da sessão", () => {
  const s = open();
  const r = paperStep(s, fresh({ bid: 10, ask: 10.01, price: 10 }), T + 5000);
  assert.ok(r.state.realizedBRL < -0.9);
  assert.equal(r.state.locked, true);
  assert.equal(
    paperStep(r.state, fresh({}, 100000), T + 100000).action,
    "HOLD",
  );
});
test("pausar bloqueia entrada, mas ainda executa saída simulada no stop", () => {
  assert.equal(paperStep(createPaperState(), snap(), T, false).action, "HOLD");
  const s = open();
  const bid = s.position!.stop;
  assert.equal(
    paperStep(s, fresh({ bid, ask: bid + 0.01, price: bid }), T + 5000, false)
      .action,
    "CLOSE",
  );
});
test("feed inválido não fabrica saída de posição", () => {
  const s = open();
  const r = paperStep(s, null, T + 5000, false, true);
  assert.equal(r.action, "HOLD");
  assert.deepEqual(r.state.position, s.position);
});
test("ativo diferente não pode precificar posição aberta", () => {
  const s = open();
  const wrong = fresh({ symbol: "ETH-USD" });
  assert.equal(equityBRL(s, wrong), null);
  assert.equal(paperStep(s, wrong, T + 5000).action, "HOLD");
});
test("cooldown impede reentrada imediatamente após saída", () => {
  const r = paperStep(open(), fresh(), T + 5000, false, true);
  assert.match(
    paperStep(r.state, fresh({}, 10000), T + 10000).message,
    /Cooldown/,
  );
});
test("tempo máximo fecha posição com preço observado, sem lucro obrigatório", () => {
  const result = paperStep(open(), fresh({}, 900001), T + 900001, false);
  assert.equal(result.action, "CLOSE");
  assert.equal(result.state.trades[0].reason, "Tempo máximo");
  assert.ok(result.state.realizedBRL < 0);
});
test("meta opcional não altera o lucro calculado", () => {
  const s = paperStep(
    createPaperState({ ...DEFAULT_CONFIG, targetBRL: 0.01 }),
    snap(),
    T,
  ).state;
  const bid = s.position!.target;
  const result = paperStep(
    s,
    fresh({ bid, ask: bid + 0.01, price: bid }),
    T + 5000,
  );
  assert.equal(result.state.locked, true);
  assert.ok(result.state.realizedBRL > 0.01);
});
test("parâmetros perigosos ou não finitos são rejeitados", () => {
  for (const c of [
    { initialBRL: -1 },
    { usdBRL: 0 },
    { feeBps: -1 },
    { riskPct: 15 },
    { maxLossPct: 15 },
    { maxAllocationPct: 26 },
    { maxAllocationPct: 100 },
    { maxAllocationPct: 101 },
    { slippageBps: NaN },
    { cooldownMs: 0 },
  ])
    assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, ...c }));
});
test("ticker divergente não pode gerar sinal", () => {
  assert.equal(
    paperStep(createPaperState(), snap({ price: 1000 }), T).action,
    "HOLD",
  );
});
test("livro vazio e dominância adulterada não autorizam entrada", () => {
  assert.ok(
    snapshotError(
      snap({ orderBook: { buyerDominance: 65, bids: [], asks: [] } }),
      T,
    ),
  );
  const s = snap();
  s.orderBook.buyerDominance = 99;
  assert.ok(snapshotError(s, T));
});
