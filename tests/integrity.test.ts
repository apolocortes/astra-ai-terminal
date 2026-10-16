import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateIndicators, type Candle } from "../src/lib/market-indicators";
import { CapitalComClient } from "../src/lib/capital-engine";
const candles = (f: (n: number) => number): Candle[] =>
  Array.from({ length: 30 }, (_, n) => ({
    time: 100000 + n * 60,
    low: f(n) - 0.5,
    high: f(n) + 0.5,
    open: f(n),
    close: f(n),
    volume: 10,
  }));

test("RSI usa os últimos 14 deltas e não o início da janela", () => {
  const result = calculateIndicators(
    candles((n) => (n < 15 ? 150 + n : 200 - n)),
  );
  assert.equal(result.rsi, 0);
});
test("mercado constante produz RSI neutro", () => {
  assert.equal(calculateIndicators(candles(() => 100)).rsi, 50);
});
test("mercado crescente produz RSI 100", () => {
  assert.equal(calculateIndicators(candles((n) => 100 + n)).rsi, 100);
});
test("ATR considera distância do low ao fechamento anterior", () => {
  const c = candles(() => 100);
  c[29] = { ...c[29], low: 80, high: 90, open: 85, close: 85 };
  const result = calculateIndicators(c);
  assert.ok(Math.abs(result.atr - (13 + 20) / 14) < 1e-8);
});
test("histórico com menos de 15 candles é recusado", () => {
  assert.throws(() => calculateIndicators(candles(() => 100).slice(0, 14)));
});
test("candles duplicados, lacunas e volume zero são recusados", () => {
  const c = candles(() => 100);
  c[20].time += 60;
  assert.throws(() => calculateIndicators(c));
  assert.throws(() =>
    calculateIndicators(candles(() => 100).map((x) => ({ ...x, volume: 0 }))),
  );
});
test("credenciais ausentes e conta real não inicializam cliente", () => {
  assert.throws(
    () => new CapitalComClient({ apiKey: "", identifier: "", isDemo: true }),
  );
  assert.throws(
    () =>
      new CapitalComClient({
        apiKey: "fixture",
        identifier: "fixture",
        password: "fixture",
        isDemo: false,
      }),
  );
});
test("falha de autenticação não retorna sucesso simulado nem saldo fictício", async () => {
  const original = global.fetch;
  global.fetch = async () => new Response("", { status: 401 });
  try {
    const client = new CapitalComClient({
      apiKey: "fixture",
      identifier: "fixture",
      password: "fixture",
      isDemo: true,
    });
    await assert.rejects(client.createSession(), /recusada/);
    await assert.rejects(client.getAccountBalance(), /recusada/);
  } finally {
    global.fetch = original;
  }
});
test("sessão sem tokens não autentica", async () => {
  const original = global.fetch;
  global.fetch = async () => new Response("{}", { status: 200 });
  try {
    await assert.rejects(
      new CapitalComClient({
        apiKey: "fixture",
        identifier: "fixture",
        password: "fixture",
        isDemo: true,
      }).createSession(),
      /tokens/,
    );
  } finally {
    global.fetch = original;
  }
});
test("envio de ordem é recusado antes de qualquer chamada de rede", async () => {
  const original = global.fetch;
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error("Não deve chegar aqui");
  };
  try {
    await assert.rejects(
      new CapitalComClient({
        apiKey: "fixture",
        identifier: "fixture",
        password: "fixture",
        isDemo: true,
      }).placeMarketOrder("BTCUSD", "BUY", 1),
      /desativado/,
    );
    assert.equal(called, false);
  } finally {
    global.fetch = original;
  }
});
test("interface não utiliza Math.random, credenciais ou rotas de execução real", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  assert.doesNotMatch(
    page,
    /Math\.random|capitalPassword|capitalApiKey|\/api\/capital-trade/,
  );
});
test("rotas legadas estão indisponíveis e não chamam corretora", () => {
  for (const route of [
    "auto-bot",
    "atlas-engine",
    "astra-live",
    "capital-trade",
    "capital-balance",
  ]) {
    const content = readFileSync(`src/app/api/${route}/route.ts`, "utf8");
    assert.match(content, /status: 410/);
    assert.doesNotMatch(
      content,
      /fetch\(|CapitalComClient|apiKeyUsed|sk-[A-Za-z0-9]/,
    );
  }
});
