import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/lib/paper-engine";
import { runResearch, type BacktestConfig } from "../src/lib/backtest";
import type { Candle } from "../src/lib/market-indicators";

function config(patch: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    ...DEFAULT_CONFIG,
    initialBRL: 100,
    usdBRL: 1,
    feeBps: 10,
    slippageBps: 0,
    spreadBps: 0,
    ...patch,
  };
}

function breakoutSeries(length = 150, mode: "gap" | "ambiguous" | "flat" = "flat"): Candle[] {
  return Array.from({ length }, (_, index) => {
    let result: Candle = {
      time: 200000 + index * 60,
      open: 100,
      close: 100,
      low: 99,
      high: 101,
      volume: 100,
    };
    if (index === 59) {
      result = { ...result, open: 100, close: 110, low: 99, high: 111, volume: 1000 };
    } else if (index === 60) {
      result = { ...result, open: 100, close: 100, low: 99, high: 101 };
    } else if (index === 61 && mode === "gap") {
      result = { ...result, open: 90, close: 90, low: 85, high: 120 };
    } else if (index === 61 && mode === "ambiguous") {
      result = { ...result, open: 100, close: 100, low: 90, high: 120 };
    }
    return result;
  });
}

test("retorna amostra, split cronológico e três resultados mesmo sem evidência suficiente", () => {
  const candles = breakoutSeries(50);
  const report = runResearch(candles, config());
  assert.equal(report.sample.bars, 50);
  assert.equal(report.sample.timeframeSeconds, 60);
  assert.equal(report.sample.splitTime, candles[Math.floor(candles.length * 0.7)].time);
  assert.equal(report.training.length, 3);
  assert.equal(report.validation.length, 3);
  assert.equal(report.selectedStrategy, null);
  assert.equal(report.verdict, "INSUFICIENTE");
  assert.ok(report.warnings.some((warning) => /OHLC|livro/i.test(warning)));
  assert.ok(report.warnings.some((warning) => /spread|slippage|taxas/i.test(warning)));
});

test("aplica taxa nas duas pontas sem duplicar taxa de entrada no relatório", () => {
  const candles = breakoutSeries();
  const withFee = runResearch(candles, config({ feeBps: 10 }));
  const withoutFee = runResearch(candles, config({ feeBps: 0 }));
  const feeResult = withFee.training.find((result) => result.strategyId === "breakout")!;
  const freeResult = withoutFee.training.find((result) => result.strategyId === "breakout")!;
  assert.equal(feeResult.trades, 1);
  assert.ok(feeResult.feesBRL > 0);
  assert.equal(
    feeResult.feesBRL,
    feeResult.ledger.reduce((sum, trade) => sum + trade.feesBRL, 0),
  );
  assert.ok(feeResult.netBRL < freeResult.netBRL);
});

test("sinal no fechamento só entra no open seguinte e gap adverso usa a abertura", () => {
  const result = runResearch(breakoutSeries(150, "gap"), config()).training.find(
    (item) => item.strategyId === "breakout",
  )!;
  assert.equal(result.trades, 1);
  assert.equal(result.ledger[0].entryTime, 200000 + 60 * 60);
  assert.equal(result.ledger[0].entry, 100);
  assert.equal(result.ledger[0].exit, 90);
  assert.match(result.ledger[0].reason, /gap/i);
  assert.ok(result.ledger[0].pnlBRL < 0);
});

test("quando stop e alvo aparecem na mesma vela, stop tem prioridade e drawdown não usa low posterior", () => {
  const result = runResearch(breakoutSeries(150, "ambiguous"), config()).training.find(
    (item) => item.strategyId === "breakout",
  )!;
  assert.equal(result.trades, 1);
  assert.equal(result.ledger[0].reason, "stop");
  assert.ok(result.ledger[0].exit < result.ledger[0].entry);
  assert.ok(result.maxDrawdownPct < 2);
});

test("spread acima de 10 bps veta entradas e risco/alocação permanecem finitos", () => {
  const report = runResearch(breakoutSeries(), config({ spreadBps: 11 }));
  for (const result of report.training) {
    assert.equal(result.trades, 0);
    assert.ok(Number.isFinite(result.netBRL));
    assert.ok(Number.isFinite(result.maxDrawdownPct));
  }
});

test("alterar apenas o futuro não modifica o treino nem permite lookahead", () => {
  const first = breakoutSeries(240);
  const future = first.map((candle) => ({ ...candle }));
  for (let index = 190; index < future.length; index += 1) {
    future[index] = { ...future[index], open: 300, close: 300, low: 299, high: 301, volume: 100000 };
  }
  const a = runResearch(first, config());
  const b = runResearch(future, config());
  assert.deepEqual(a.training, b.training);
  assert.equal(a.selectedStrategy,b.selectedStrategy);
  assert.equal(a.selectionReason,b.selectionReason);
  for(const result of a.validation){
    const same=b.validation.find(item=>item.strategyId===result.strategyId)!;
    assert.deepEqual(result.equity.filter(p=>p.time<first[190].time),same.equity.filter(p=>p.time<first[190].time));
  }
});

test("seleção, quando existe, é justificada pelo treino e não pela validação", () => {
  const report = runResearch(breakoutSeries(500), config({ feeBps: 0 }));
  assert.equal(report.validation.length, 3);
  assert.match(report.selectionReason, /treino|Nenhuma estratégia/i);
  if (report.selectedStrategy !== null) {
    assert.ok(report.stress);
    assert.match(report.selectionReason, /validação não participou/i);
  }
});
