import test from "node:test";
import assert from "node:assert/strict";
import { evaluateStrategies, STRATEGIES, type StrategyId } from "../src/lib/strategy-engine";
import type { Candle } from "../src/lib/market-indicators";

function candle(
  index: number,
  close: number,
  patch: Partial<Candle> = {},
): Candle {
  const open = patch.open ?? close;
  const low = patch.low ?? Math.min(open, close) - 0.5;
  const high = patch.high ?? Math.max(open, close) + 0.5;
  return {
    time: 100000 + index * 60,
    open,
    close,
    low,
    high,
    volume: patch.volume ?? 100,
    ...patch,
  };
}

function flatSeries(length = 60, timeframe = 60): Candle[] {
  return Array.from({ length }, (_, index) => ({
    time: 100000 + index * timeframe,
    open: 100,
    close: 100,
    low: 99,
    high: 101,
    volume: 100,
  }));
}

test("expõe exatamente as três hipóteses sem alegar rentabilidade", () => {
  assert.deepEqual(
    STRATEGIES.map((strategy) => strategy.id),
    ["trend_pullback", "range_reversion", "breakout"],
  );
  assert.ok(STRATEGIES.every((strategy) => strategy.description.length > 20));
});

test("mantém HOLD e regime insuficiente abaixo do warmup de 60 candles", () => {
  const result = evaluateStrategies(flatSeries(59));
  assert.equal(result.action, "HOLD");
  assert.equal(result.regime, "INSUFICIENTE");
  assert.equal(result.strategyId, null);
  assert.equal(result.features, null);
  assert.equal(result.stopAtr, 0);
});

test("valida OHLC, volume, timeframe permitido e contiguidade uniforme", () => {
  assert.equal(evaluateStrategies(flatSeries(60, 300)).features?.atr, 2);
  assert.throws(() => evaluateStrategies(flatSeries(60, 120)), /Timeframe/);
  const gap = flatSeries(60);
  gap[30].time += 60;
  assert.throws(() => evaluateStrategies(gap), /fora de ordem|contíguos/);
  const invalid = flatSeries(60);
  invalid[20] = { ...invalid[20], low: -1 };
  assert.throws(() => evaluateStrategies(invalid), /inválidos/);
  const negativeVolume = flatSeries(60);
  negativeVolume[20] = { ...negativeVolume[20], volume: -1 };
  assert.throws(() => evaluateStrategies(negativeVolume), /inválidos/);
});

test("detecta rompimento acima da máxima20 prévia com volume, no fechamento", () => {
  const candles = flatSeries(60);
  candles[59] = candle(59, 110, {
    open: 100,
    low: 99,
    high: 111,
    volume: 1000,
  });
  const result = evaluateStrategies(candles, "breakout");
  assert.equal(result.action, "BUY");
  assert.equal(result.strategyId, "breakout");
  assert.equal(result.regime, "ALTA");
  assert.ok(result.features);
  assert.ok(result.features.volumeRatio >= 1.2);
  assert.ok(result.checks.every((item) => item.passed));
  assert.match(result.reason, /confluência determinística/i);
});

test("pausa compra em queda e não transforma score em probabilidade", () => {
  const candles = Array.from({ length: 60 }, (_, index) => {
    const close = 160 - index;
    return candle(index, close, { open: close + 0.2, volume: 100 });
  });
  const result = evaluateStrategies(candles, "auto");
  assert.equal(result.action, "HOLD");
  assert.equal(result.regime, "BAIXA");
  assert.equal(result.strategyId, null);
  assert.match(result.reason, /pausada|veto/i);
  assert.match(result.reason, /não.*probabilidade/i);
});

test("decisão é pura e determinística para os mesmos prefixos", () => {
  const candles = flatSeries(60);
  candles[59] = candle(59, 110, { open: 100, high: 111, volume: 1000 });
  const first = evaluateStrategies(candles, "auto");
  const second = evaluateStrategies(candles.map((item) => ({ ...item })), "auto");
  assert.deepEqual(first, second);
  for (const strategy of ["trend_pullback", "range_reversion", "breakout"] as StrategyId[]) {
    assert.deepEqual(
      evaluateStrategies(candles, strategy),
      evaluateStrategies(candles, strategy),
    );
  }
});

test("não usa a vela futura para o sinal do prefixo", () => {
  const prefix = flatSeries(60);
  prefix[59] = candle(59, 110, { open: 100, high: 111, volume: 1000 });
  const futureA = [...prefix, candle(60, 100, { high: 101, volume: 100 })];
  const futureB = [...prefix, candle(60, 1000, { high: 1001, volume: 100000 })];
  assert.deepEqual(evaluateStrategies(futureA.slice(0, 60)), evaluateStrategies(futureB.slice(0, 60)));
});
