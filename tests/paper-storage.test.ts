import test from "node:test";
import assert from "node:assert/strict";
import {
  createPaperState,
  paperStep,
  type Snapshot,
} from "../src/lib/paper-engine";
import {
  decodePaper,
  encodePaper,
  validatePaperState,
} from "../src/lib/paper-storage";
const T = 1802720000000;
const s: Snapshot = {
  success: true,
  source: "fixture",
  symbol: "BTC-USD",
  timestamp: T,
  marketTimestamp: T,
  price: 100,
  bid: 100,
  ask: 100.01,
  orderBook: {
    buyerDominance: 65,
    bids: [{ price: 100, size: ((65 / 35) * 100.01) / 100 }],
    asks: [{ price: 100.01, size: 1 }],
  },
  indicators: { rsi: 55, vwap: 99, atr: 10 },
};
function opened() {
  return paperStep(createPaperState(), s, T).state;
}
function closed() {
  return paperStep(
    opened(),
    { ...s, timestamp: T + 5000, marketTimestamp: T + 5000 },
    T + 5000,
    false,
    true,
  ).state;
}
test("ledger íntegro com posição e sem posição reconcilia", () => {
  for (const state of [createPaperState(), opened(), closed()])
    assert.deepEqual(validatePaperState(state, T + 5000), state);
});
test("posição com taxa negativa é recusada antes de calcular PnL", () => {
  const state = opened();
  state.position!.entryFeeBRL = -100;
  assert.throws(() => validatePaperState(state, T + 5000), /Posição/);
});
test("trades malformados são recusados na restauração", () => {
  const state = closed();
  (state.trades as unknown[]).push({});
  assert.throws(() => validatePaperState(state, T + 5000));
});
test("saldo e lucro sem correspondência no ledger são recusados", () => {
  const state = closed();
  state.cashBRL += 1;
  assert.throws(() => validatePaperState(state, T + 5000), /reconcilia/);
  const other = closed();
  other.trades[0].pnlBRL += 1;
  assert.throws(() => validatePaperState(other, T + 5000), /inconsistente/);
});
test("configuração com campo ausente ou exposição 100% não restaura", () => {
  const state = createPaperState();
  delete (state.config as Partial<typeof state.config>).feeBps;
  assert.throws(() => validatePaperState(state, T));
  const other = createPaperState();
  other.config.maxAllocationPct = 100;
  assert.throws(() => validatePaperState(other, T));
});
test("evidências sobrevivem a serialização e restauração", () => {
  const events = [
    { at: T, action: "OPEN", message: "Compra simulada", snapshot: s },
  ];
  const restored = decodePaper(encodePaper(opened(), events), T + 5000);
  assert.deepEqual(restored.evidence, events);
  assert.deepEqual(restored.session, opened());
});
test("persistência limita eventos a 300 e não trunca os trades", () => {
  const events = Array.from({ length: 350 }, (_, n) => ({
    at: T,
    action: "HOLD",
    message: String(n),
    snapshot: null,
  }));
  const restored = decodePaper(encodePaper(closed(), events), T + 5000);
  assert.equal(restored.evidence.length, 300);
  assert.equal(restored.evidence[0].message, "50");
  assert.equal(restored.session.trades.length, 1);
});
test("compatibilidade legada não inventa eventos ausentes", () => {
  assert.deepEqual(
    decodePaper(JSON.stringify(createPaperState()), T).evidence,
    [],
  );
});
test("eventos estruturalmente inválidos não são restaurados", () => {
  const encoded = JSON.stringify({
    version: 2,
    session: createPaperState(),
    evidence: [{ at: T, action: 123, message: "invalido", snapshot: null }],
  });
  assert.throws(() => decodePaper(encoded, T));
});
