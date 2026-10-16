import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/live-depth/route";
function fixture() {
  const now = Date.now();
  const minute = Math.floor(now / 60000) * 60;
  return {
    ticker: { price: "100", volume: "200", time: new Date(now).toISOString() },
    book: {
      time: new Date(now).toISOString(),
      bids: [["100", "2"]],
      asks: [["100.01", "1"]],
    },
    candles: Array.from({ length: 31 }, (_, n) => [
      minute - n * 60,
      99,
      101,
      100,
      100,
      10,
    ]),
  };
}
async function mockRun(
  change: (f: ReturnType<typeof fixture>) => void = () => {},
  status = 200,
) {
  const f = fixture();
  change(f);
  const original = global.fetch;
  const urls: string[] = [];
  global.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    return new Response(
      JSON.stringify(
        url.includes("/ticker")
          ? f.ticker
          : url.includes("/book?")
            ? f.book
            : f.candles,
      ),
      { status },
    );
  };
  try {
    const res = await GET(
      new Request("http://localhost/api/live-depth?symbol=BTC-USD"),
    );
    return { res, data: await res.json(), urls };
  } finally {
    global.fetch = original;
  }
}
test("produto inválido retorna 400 antes de buscar dados", async () => {
  const res = await GET(
    new Request("http://localhost/api/live-depth?symbol=bad"),
  );
  assert.equal(res.status, 400);
});
test("feed íntegro usa janela explícita, candles fechados e livro real", async () => {
  const { res, data, urls } = await mockRun();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.closedCandlesOnly, true);
  assert.equal(data.candleCount, 30);
  assert.equal(data.bid, 100);
  assert.ok(
    Math.abs(data.orderBook.buyerDominance - (200 / 300.01) * 100) < 1e-8,
  );
  assert.ok(urls.some((u) => u.includes("start=") && u.includes("end=")));
});
test("livro com horário antigo retorna 502 sem preço fictício", async () => {
  const { res, data } = await mockRun((f) => {
    f.book.time = new Date(Date.now() - 61000).toISOString();
  });
  assert.equal(res.status, 502);
  assert.equal(data.success, false);
  assert.equal(data.price, undefined);
});
test("falha do provedor retorna 502 sem inventar resultado", async () => {
  const { res, data } = await mockRun(() => {}, 503);
  assert.equal(res.status, 502);
  assert.equal(data.success, false);
});
test("histórico com gap não produz indicadores", async () => {
  const { res } = await mockRun((f) => {
    f.candles[5][0] -= 60;
  });
  assert.equal(res.status, 502);
});
test("ticker incoerente com o livro não declara feed válido", async () => {
  const { res } = await mockRun((f) => {
    f.ticker.price = "1000";
  });
  assert.equal(res.status, 502);
});
