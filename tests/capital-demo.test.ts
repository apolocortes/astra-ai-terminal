import test from "node:test";
import assert from "node:assert/strict";
import {
  CAPITAL_DEMO_BASE_URL,
  CapitalDemoClient,
  type Account,
  type DemoOrder,
  type Market,
  planDemoBuy,
} from "../src/lib/capital-demo";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const credentials = {
  apiKey: "fake-demo-api-key",
  identifier: "fake-demo-identifier",
  password: "fake-custom-api-password",
};

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? undefined : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

class MockTransport {
  readonly calls: { url: string; init: RequestInit; key: string }[] = [];
  private readonly routes = new Map<
    string,
    Response | ((url: string, init: RequestInit) => Response | Promise<Response>)
  >();

  on(
    method: string,
    path: string,
    result: Response | ((url: string, init: RequestInit) => Response | Promise<Response>),
  ) {
    this.routes.set(`${method.toUpperCase()} ${path}`, result);
    return this;
  }

  fetch = async (url: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const text = String(url);
    assert.ok(
      text.startsWith(CAPITAL_DEMO_BASE_URL),
      `nenhum endpoint live pode ser usado: ${text}`,
    );
    const parsed = new URL(text);
    const method = String(init.method ?? "GET").toUpperCase();
    const relativePath = parsed.pathname.replace(/^\/api\/v1/, "") || "/";
    const key = `${method} ${relativePath}${parsed.search}`;
    this.calls.push({ url: text, init, key });
    const route = this.routes.get(key);
    if (!route) throw new Error(`rota mock não registrada: ${key}`);
    return typeof route === "function" ? route(text, init) : route;
  };
}

function noSleep() {
  const waits: number[] = [];
  const waiter = async (milliseconds: number) => {
    waits.push(milliseconds);
  };
  return { waits, waiter };
}

function addSessionRoutes(mock: MockTransport, account: Account = accountFixture()) {
  mock.on(
    "POST",
    "/session",
    response({}, 200, { CST: "mock-cst", "X-SECURITY-TOKEN": "mock-security" }),
  );
  mock.on("GET", "/session", response({ accountId: account.accountId, currency: account.currency }));
  mock.on("GET", "/accounts", response({ accounts: [account] }));
}

function accountFixture(): Account {
  return {
    accountId: "ACC-DEMO",
    currency: "USD",
    balance: { balance: 1_000, profitLoss: 0, available: 1_000 },
  };
}

function marketFixture(patch: Partial<Market> = {}): Market {
  const market: Market = {
    epic: "BTCUSD",
    instrument: {
      epic: "BTCUSD",
      currency: "USD",
      lotSize: 1,
      type: "CRYPTOCURRENCIES",
      marginFactor: 50,
      marginFactorUnit: "PERCENTAGE",
      overnightFee: {
        longRate: 0.1,
        shortRate: -0.1,
        swapChargeTimestamp: 23,
        swapChargeInterval: 8,
      },
    },
    dealingRules: {
      minDealSize: { unit: "POINTS", value: 0.1 },
      maxDealSize: { unit: "POINTS", value: 100 },
      minSizeIncrement: { unit: "POINTS", value: 0.1 },
      minStopOrProfitDistance: { unit: "POINTS", value: 1 },
      maxStopOrProfitDistance: { unit: "POINTS", value: 20 },
    },
    snapshot: {
      marketStatus: "TRADEABLE",
      delayTime: 0,
      bid: 100,
      offer: 100.05,
      updateTimeUTC: new Date(NOW - 10_000).toISOString(),
      decimalPlacesFactor: 2,
      scalingFactor: 1,
    },
  };
  return {
    ...market,
    ...patch,
    instrument: { ...market.instrument, ...(patch.instrument ?? {}) },
    dealingRules: { ...market.dealingRules, ...(patch.dealingRules ?? {}) },
    snapshot: { ...market.snapshot, ...(patch.snapshot ?? {}) },
  };
}

function clientWithSession(mock: MockTransport, waiter = noSleep().waiter) {
  addSessionRoutes(mock);
  return new CapitalDemoClient(credentials, mock.fetch, waiter);
}

function order(size = 1): DemoOrder {
  return {
    epic: "BTCUSD",
    direction: "BUY",
    size,
    stopLevel: 95,
    profitLevel: 110,
    guaranteedStop: false,
    trailingStop: false,
  };
}

function planInput(overrides: Partial<Parameters<typeof planDemoBuy>[0]> = {}) {
  return {
    market: marketFixture(),
    account: accountFixture(),
    budgetUSD: 1_000,
    riskPct: 1,
    maxAllocationPct: 25,
    feeBps: 10,
    slippageBps: 5,
    stop: 95,
    target: 110,
    now: NOW,
    ...overrides,
  };
}

test("usa exclusivamente a base DEMO fixa e envia encryptedPassword:false", async () => {
  const mock = new MockTransport();
  addSessionRoutes(mock);
  const { waiter } = noSleep();
  await new CapitalDemoClient(credentials, mock.fetch, waiter).login();
  assert.equal(mock.calls[0].url, `${CAPITAL_DEMO_BASE_URL}/session`);
  assert.equal(mock.calls.some((call) => call.url.includes("/live")), false);
  const body = JSON.parse(String(mock.calls[0].init.body));
  assert.deepEqual(body, {
    identifier: credentials.identifier,
    password: credentials.password,
    encryptedPassword: false,
  });
});

test("sessão sem CST ou X-SECURITY-TOKEN rejeita e não autoriza GET", async () => {
  const mock = new MockTransport().on("POST", "/session", response({}));
  const client = new CapitalDemoClient(credentials, mock.fetch, noSleep().waiter);
  await assert.rejects(() => client.login(), /sem CST\/X-SECURITY-TOKEN/i);
  assert.equal(mock.calls.length, 1);
});

test("positions abre a sessão DEMO antes de encaminhar qualquer credencial autenticada", async () => {
  const mock = new MockTransport();
  addSessionRoutes(mock);
  mock.on("GET", "/positions", response({ positions: [] }));
  const positions = await new CapitalDemoClient(
    credentials,
    mock.fetch,
    noSleep().waiter,
  ).positions();
  assert.deepEqual(positions, []);
  assert.equal(mock.calls[0].key, "POST /session");
  const authenticated = mock.calls.find((call) => call.key === "GET /positions")!;
  const headers = new Headers(authenticated.init.headers);
  assert.equal(headers.get("CST"), "mock-cst");
  assert.equal(headers.get("X-SECURITY-TOKEN"), "mock-security");
});

test("credenciais ausentes são rejeitadas antes de qualquer fetch", () => {
  let networkCalls = 0;
  const fetcher = (async () => {
    networkCalls += 1;
    return response({});
  }) as typeof fetch;
  assert.throws(
    () => new CapitalDemoClient({ apiKey: "", identifier: "id", password: "pw" }, fetcher),
    /ausentes/i,
  );
  assert.equal(networkCalls, 0);
});

test("market preserva instrument/rules e busca lista exata para updateTimeUTC UTC", async () => {
  const mock = new MockTransport();
  addSessionRoutes(mock);
  const detail = marketFixture();
  delete detail.snapshot.updateTimeUTC;
  mock.on("GET", "/markets/BTCUSD", response(detail));
  mock.on(
    "GET",
    "/markets?searchTerm=BTCUSD",
    response({
      markets: [
        { epic: "OTHER", bid: 1, offer: 1.01, updateTimeUTC: "2026-10-16T11:59:59" },
        {
          epic: "BTCUSD",
          bid: 100,
          offer: 100.05,
          marketStatus: "TRADEABLE",
          delayTime: 0,
          scalingFactor: 1,
          decimalPlacesFactor: 2,
          updateTimeUTC: "2026-10-16T11:59:50",
        },
      ],
    }),
  );
  const market = await new CapitalDemoClient(
    credentials,
    mock.fetch,
    noSleep().waiter,
  ).market("BTCUSD");
  assert.equal(market.instrument.type, "CRYPTOCURRENCIES");
  assert.equal(market.dealingRules.minSizeIncrement.value, 0.1);
  assert.equal(market.snapshot.updateTimeUTC, "2026-10-16T11:59:50Z");
});

test("preflight rejeita tipo de CFD não suportado", async () => {
  const mock = new MockTransport();
  addSessionRoutes(mock);
  const unsupported = marketFixture({
    instrument: { ...marketFixture().instrument, type: "SHARES" },
  });
  mock.on("GET", "/markets/BTCUSD", response(unsupported));
  const client = new CapitalDemoClient(credentials, mock.fetch, noSleep().waiter);
  await assert.rejects(() => client.preflight("BTCUSD"), /tipo CFD não suportado/i);
});

test("candles converte texto UTC sem Z e usa mediana bid/ask real do broker", async () => {
  const mock = new MockTransport();
  addSessionRoutes(mock);
  mock.on(
    "GET",
    "/prices/BTCUSD?resolution=HOUR&max=120&from=2026-10-11T12%3A00%3A00&to=2026-10-16T12%3A00%3A00",
    response({
      prices: [
        {
          snapshotTimeUTC: "2026-10-16T11:00:00",
          openPrice: { bid: 10, ask: 11 },
          closePrice: { bid: 12, ask: 14 },
          highPrice: { bid: 15, ask: 17 },
          lowPrice: { bid: 8, ask: 9 },
          lastTradedVolume: 7,
        },
      ],
    }),
  );
  const candles = await new CapitalDemoClient(
    credentials,
    mock.fetch,
    noSleep().waiter,
  ).candles("BTCUSD", NOW);
  assert.equal(candles[0].snapshotTimeUTC, "2026-10-16T11:00:00Z");
  assert.equal(candles[0].timestamp, Date.parse("2026-10-16T11:00:00Z"));
  assert.equal(candles[0].time, Date.parse("2026-10-16T11:00:00Z")/1000);
  assert.equal(candles[0].open, 10.5);
  assert.equal(candles[0].close, 13);
  assert.equal(candles[0].high, 16);
  assert.equal(candles[0].low, 8.5);
  assert.equal(new URL(mock.calls.at(-1)!.url).searchParams.get("max"), "120");
});

test("planDemoBuy recusa invariantes de CFD, margem, incremento, risco, RR e spread", () => {
  assert.throws(
    () => planDemoBuy(planInput({ market: marketFixture({ instrument: { ...marketFixture().instrument, lotSize: 2 } }) })),
    /lotSize/i,
  );
  assert.throws(
    () => planDemoBuy(planInput({ market: marketFixture({ snapshot: { ...marketFixture().snapshot, scalingFactor: 2 } }) })),
    /scalingFactor/i,
  );
  assert.throws(
    () => planDemoBuy(planInput({ market: marketFixture({ instrument: { ...marketFixture().instrument, marginFactorUnit: "RATIO" } }) })),
    /marginFactorUnit/i,
  );
  assert.throws(
    () => planDemoBuy(planInput({ market: marketFixture({ dealingRules: { ...marketFixture().dealingRules, minSizeIncrement: { unit: "POINTS", value: 0 } } }) })),
    /minSizeIncrement/i,
  );
  assert.throws(() => planDemoBuy(planInput({ riskPct: 1.01 })), /riskPct/i);
  assert.throws(() => planDemoBuy(planInput({ target: 101.1 })), /RR líquido/i);
  assert.throws(
    () => planDemoBuy(planInput({ market: marketFixture({ snapshot: { ...marketFixture().snapshot, offer: 101 } }) })),
    /spread/i,
  );
});

test("ordem abaixo do minDealSize é rejeitada sem elevar o lote mínimo", () => {
  const market = marketFixture({
    dealingRules: { ...marketFixture().dealingRules, minDealSize: { unit: "POINTS", value: 10 } },
  });
  assert.throws(
    () => planDemoBuy(planInput({ market })),
    /Capital insuficiente|minDealSize/i,
  );
});

test("planDemoBuy arredonda stop para baixo, target para cima e usa somente BUY", () => {
  const planned = planDemoBuy(planInput({ stop: 95.019, target: 110.001 }));
  assert.equal(planned.direction, "BUY");
  assert.equal(planned.stopLevel, 95.01);
  assert.equal(planned.profitLevel, 110.01);
  assert.equal(planned.guaranteedStop, false);
  assert.equal(planned.trailingStop, false);
  assert.ok(planned.size >= 0.1);
});

test("POST accepted retorna PENDING e não confunde dealReference com confirmação", async () => {
  const mock = new MockTransport();
  addSessionRoutes(mock);
  mock.on("POST", "/positions", response({ dealReference: "REF-1" }));
  const statuses: string[] = [];
  const client = new CapitalDemoClient(credentials, mock.fetch, noSleep().waiter);
  const result = await client.submit(order(), async (intent) => {
    statuses.push(intent.status);
  });
  assert.deepEqual(result, { reference: "REF-1", status: "PENDING" });
  assert.deepEqual(statuses, ["SUBMITTING"]);
  assert.equal(mock.calls.some((call) => call.key.startsWith("GET /confirms")), false);
});

test("ACCEPTED sem affectedDeals OPENED não confirma execução", async () => {
  const mock = new MockTransport();
  addSessionRoutes(mock);
  mock.on(
    "GET",
    "/confirms/REF-1",
    response({
      dealStatus: "ACCEPTED",
      epic: "BTCUSD",
      direction: "BUY",
      size: 1,
      affectedDeals: [{ dealId: "PARENT", status: "OPENED" }],
    }),
  );
  mock.on("GET", "/positions", response({ positions: [] }));
  const result = await new CapitalDemoClient(
    credentials,
    mock.fetch,
    noSleep().waiter,
  ).confirm("REF-1", order());
  assert.equal(result.status, "UNCONFIRMED");
  assert.equal(result.confirmed, false);
});

test("ACCEPTED usa ID completo de affectedDeals e posição com stop e alvo consistentes", async () => {
  const mock = new MockTransport();
  addSessionRoutes(mock);
  mock.on(
    "GET",
    "/confirms/REF-2",
    response({
      dealStatus: "ACCEPTED",
      epic: "BTCUSD",
      direction: "BUY",
      size: 1,
      dealId: "PARENT",
      affectedDeals: [{ dealId: "PARENT-REAL-ID", status: "OPENED" }],
    }),
  );
  mock.on(
    "GET",
    "/positions",
    response({
      positions: [
        {
          position: { dealId: "PARENT-REAL-ID", size: 1, direction: "BUY", level: 100, stopLevel:95, profitLevel:110 },
          market: { epic: "BTCUSD", bid: 100, offer: 100.05 },
        },
      ],
    }),
  );
  const result = await new CapitalDemoClient(
    credentials,
    mock.fetch,
    noSleep().waiter,
  ).confirm("REF-2", order());
  assert.equal(result.status, "CONFIRMED");
  assert.equal(result.confirmed, true);
  assert.deepEqual(result.dealIds, ["PARENT-REAL-ID"]);
});

test("timeout persiste UNKNOWN, propaga erro explícito e nunca faz retry do POST", async () => {
  const mock = new MockTransport();
  addSessionRoutes(mock);
  mock.on("POST", "/positions", () => {
    throw new Error("timeout de transporte");
  });
  const statuses: string[] = [];
  const client = new CapitalDemoClient(credentials, mock.fetch, noSleep().waiter);
  await assert.rejects(
    () =>
      client.submit(order(), async (intent) => {
        statuses.push(intent.status);
      }),
    /UNKNOWN.*não reenvie/i,
  );
  assert.deepEqual(statuses, ["SUBMITTING", "UNKNOWN"]);
  assert.equal(mock.calls.filter((call) => call.key === "POST /positions").length, 1);
});
