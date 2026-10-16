/**
 * Integração explicitamente limitada à conta DEMO da Capital.com.
 *
 * CFDs não são spot: a posição é um contrato com regras de margem, tamanho e
 * distância do broker. Este módulo não habilita a conta real, não usa credenciais
 * persistidas e não afirma que uma conta externa esteja conectada.
 */

export const CAPITAL_DEMO_BASE_URL =
  "https://demo-api-capital.backend-capital.com/api/v1" as const;
/** Alias explícito para deixar o destino fixo e auditável. */
export const DEMO_BASE_URL = CAPITAL_DEMO_BASE_URL;
export const DEMO_CFD_WARNING =
  "Capital.com DEMO negocia CFDs, não spot; stops não garantem a perda máxima e taxas/slippage são hipóteses do cliente.";
export const SUPPORTED_DEMO_CFD_TYPES = ["CRYPTOCURRENCIES"] as const;

type JsonRecord = Record<string, unknown>;

export interface CapitalDemoCredentials {
  apiKey: string;
  identifier: string;
  password: string;
}

export interface Waiter {
  (milliseconds: number): Promise<void>;
}

export interface SessionAccount {
  accountId: string;
  currency: string;
}

export interface AccountBalance {
  balance: number;
  profitLoss: number;
  available: number;
}

export interface Account {
  accountId: string;
  currency: string;
  balance: AccountBalance;
  [key: string]: unknown;
}

export interface OvernightFee {
  longRate: number;
  shortRate: number;
  swapChargeTimestamp: number;
  swapChargeInterval: number;
}

export interface MarketInstrument {
  epic: string;
  currency: string;
  lotSize: number;
  type: string;
  marginFactor: number;
  marginFactorUnit: string;
  overnightFee?: OvernightFee;
  [key: string]: unknown;
}

export interface DistanceRule {
  unit: string;
  value: number;
}

export interface DealingRules {
  minDealSize: DistanceRule;
  maxDealSize: DistanceRule;
  minSizeIncrement: DistanceRule;
  minStopOrProfitDistance: DistanceRule;
  maxStopOrProfitDistance: DistanceRule;
  [key: string]: unknown;
}

export interface MarketSnapshot {
  marketStatus: string;
  delayTime: number;
  bid: number;
  offer: number;
  updateTimeUTC?: string;
  decimalPlacesFactor?: number;
  scalingFactor?: number;
  [key: string]: unknown;
}

/** Resposta normalizada de GET /markets/{epic}. */
export interface Market {
  epic: string;
  instrument: MarketInstrument;
  dealingRules: DealingRules;
  snapshot: MarketSnapshot;
  /** Mantidos como aliases caso uma resposta de fixture venha achatada. */
  bid?: number;
  offer?: number;
  updateTimeUTC?: string;
  marketStatus?: string;
  delayTime?: number;
  scalingFactor?: number;
  decimalPlacesFactor?: number;
}

export interface PriceLevel {
  bid: number;
  ask: number;
}

export interface DemoCandle {
  snapshotTimeUTC: string;
  timestamp: number;
  /** Tempo em segundos Unix, compatível com o motor de candles. */
  time: number;
  openPrice: PriceLevel;
  closePrice: PriceLevel;
  highPrice: PriceLevel;
  lowPrice: PriceLevel;
  lastTradedVolume: number;
  /** Preços medianos bid/ask; não são preço spot inventado. */
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface DemoOrder {
  epic: string;
  direction: "BUY";
  size: number;
  stopLevel: number;
  profitLevel: number;
  guaranteedStop: false;
  trailingStop: false;
}

export interface SubmitIntent {
  order: DemoOrder;
  status: "SUBMITTING" | "UNKNOWN";
}

export type PersistIntent = (intent: SubmitIntent) => Promise<void>;

export interface SubmitResult {
  reference: string;
  status: "PENDING";
}

export interface PositionDetails {
  dealId: string;
  dealReference?: string;
  size: number;
  direction: string;
  level: number;
  stopLevel?: number;
  profitLevel?: number;
  [key: string]: unknown;
}

export interface PositionMarket {
  epic: string;
  bid?: number;
  offer?: number;
  [key: string]: unknown;
}

export interface PositionRecord {
  position: PositionDetails;
  market: PositionMarket;
  [key: string]: unknown;
}

export interface AffectedDeal {
  dealId: string;
  status: string;
  size?: number;
  [key: string]: unknown;
}

export interface ConfirmResponse {
  dealStatus: string;
  epic?: string;
  direction?: string;
  level?: number;
  size?: number;
  affectedDeals?: AffectedDeal[];
  dealId?: string;
  [key: string]: unknown;
}

export interface ConfirmResult {
  reference: string;
  status: "CONFIRMED" | "UNCONFIRMED";
  confirmed: boolean;
  reason: string;
  dealStatus?: string;
  dealIds?: string[];
}

export class CapitalDemoError extends Error {
  readonly code: string;
  readonly httpStatus?: number;

  constructor(message: string, code = "CAPITAL_DEMO_ERROR", httpStatus?: number) {
    super(message);
    this.name = "CapitalDemoError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

class CapitalHttpError extends CapitalDemoError {
  constructor(message: string, status: number) {
    super(message, "HTTP_ERROR", status);
  }
}

const defaultWaiter: Waiter = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveNumber(value: unknown): value is number {
  return finiteNumber(value) && value > 0;
}

function normalizedText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeUtcText(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
  }
  const text = normalizedText(value);
  if (!text) return undefined;
  // updateTimeUTC and snapshotTimeUTC are UTC fields even when the broker's
  // textual example omits the trailing Z. Never interpret that text as local.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) return text;
  return `${text}Z`;
}

function utcMillis(value: unknown): number | undefined {
  const text = normalizeUtcText(value);
  if (!text) return undefined;
  const milliseconds = Date.parse(text);
  return Number.isFinite(milliseconds) ? milliseconds : undefined;
}

function median(level: PriceLevel): number {
  return (level.bid + level.ask) / 2;
}

function validatePriceLevel(value: unknown, label: string): PriceLevel {
  if (!value || typeof value !== "object")
    throw new CapitalDemoError(`Preço ${label} ausente.`, "INVALID_RESPONSE");
  const level = value as JsonRecord;
  if (!positiveNumber(level.bid) || !positiveNumber(level.ask) || level.ask < level.bid)
    throw new CapitalDemoError(`Preço ${label} bid/ask inválido.`, "INVALID_RESPONSE");
  return { bid: level.bid, ask: level.ask };
}

function isTimeoutLike(error: unknown): boolean {
  if (error instanceof CapitalHttpError)
    return error.httpStatus === 408 || error.httpStatus === 504;
  if (error instanceof CapitalDemoError)
    return error.code === "TIMEOUT";
  if (error instanceof Error)
    return /timeout|timed out|abort|aborted|deadline/i.test(error.message);
  return false;
}

function isNotFound(error: unknown): boolean {
  return error instanceof CapitalHttpError && error.httpStatus === 404;
}

function responseError(response: Response, path: string): CapitalHttpError {
  return new CapitalHttpError(
    `Capital.com DEMO recusou ${path} (HTTP ${response.status}).`,
    response.status,
  );
}

function errorWithUnknownSubmission(error: unknown): CapitalDemoError {
  // The underlying transport text may include an URL or connector detail;
  // never copy it into the public error where a secret could be exposed.
  void error;
  return new CapitalDemoError(
    "Envio DEMO ficou UNKNOWN; reconcilie por referência e não reenvie a ordem.",
    "SUBMISSION_UNKNOWN",
  );
}

function getMarketEnvelope(data: JsonRecord): JsonRecord {
  if (data.market && typeof data.market === "object") return data.market as JsonRecord;
  return data;
}

function asJsonRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CapitalDemoError(`Resposta inválida para ${label}.`, "INVALID_RESPONSE");
  return value as JsonRecord;
}

function accountFrom(value: unknown): Account {
  const object = asJsonRecord(value, "conta");
  const balance = asJsonRecord(object.balance, "saldo");
  const accountId = normalizedText(object.accountId);
  const currency = normalizedText(object.currency);
  if (
    !accountId ||
    !currency ||
    !finiteNumber(balance.balance) ||
    !finiteNumber(balance.profitLoss) ||
    !finiteNumber(balance.available)
  )
    throw new CapitalDemoError("Resposta de conta DEMO incompleta.", "INVALID_RESPONSE");
  return {
    ...object,
    accountId,
    currency,
    balance: {
      balance: balance.balance,
      profitLoss: balance.profitLoss,
      available: balance.available,
    },
  } as Account;
}

function validateOrder(order: DemoOrder): void {
  if (
    !order ||
    typeof order.epic !== "string" ||
    !order.epic ||
    order.direction !== "BUY" ||
    !positiveNumber(order.size) ||
    !positiveNumber(order.stopLevel) ||
    !positiveNumber(order.profitLevel) ||
    order.guaranteedStop !== false ||
    order.trailingStop !== false
  )
    throw new CapitalDemoError(
      "Ordem DEMO inválida: apenas BUY com stops não garantidos é permitido.",
      "INVALID_ORDER",
    );
}

/**
 * Cliente de transporte somente DEMO. O URL não é configurável de propósito:
 * não existe neste módulo qualquer endpoint live.
 */
export class CapitalDemoClient {
  private readonly credentials: CapitalDemoCredentials;
  private readonly fetcher: typeof fetch;
  private readonly waiter: Waiter;
  private cstToken: string | null = null;
  private securityToken: string | null = null;
  private nextRequestAt = 0;
  private nextAuthAt = 0;

  constructor(
    credentials: CapitalDemoCredentials,
    fetcher: typeof fetch = fetch,
    waiter: Waiter = defaultWaiter,
  ) {
    if (
      !credentials ||
      typeof credentials.apiKey !== "string" ||
      !credentials.apiKey.trim() ||
      typeof credentials.identifier !== "string" ||
      !credentials.identifier.trim() ||
      typeof credentials.password !== "string" ||
      !credentials.password.trim()
    )
      throw new CapitalDemoError(
        "Credenciais DEMO ausentes; nenhuma rede foi acessada.",
        "MISSING_CREDENTIALS",
      );
    if (typeof fetcher !== "function" || typeof waiter !== "function")
      throw new CapitalDemoError("Transportes injetados inválidos.", "INVALID_TRANSPORT");
    this.credentials = {
      apiKey: credentials.apiKey,
      identifier: credentials.identifier,
      password: credentials.password,
    };
    this.fetcher = fetcher;
    this.waiter = waiter;
  }

  private async requestSlot(authentication = false): Promise<void> {
    const now = Date.now();
    if (authentication) {
      const authDelay = Math.max(0, this.nextAuthAt - now);
      if (authDelay > 0) await this.waiter(authDelay);
    }
    const delay = Math.max(0, this.nextRequestAt - Date.now());
    if (delay > 0) await this.waiter(delay);
    this.nextRequestAt = Math.max(this.nextRequestAt, Date.now()) + 100;
    if (authentication)
      this.nextAuthAt = Math.max(this.nextAuthAt, Date.now()) + 1000;
  }

  private async requestRaw(
    path: string,
    init: RequestInit = {},
    authentication = false,
  ): Promise<Response> {
    if (!path.startsWith("/"))
      throw new CapitalDemoError("Endpoint DEMO inválido.", "INVALID_ENDPOINT");
    await this.requestSlot(authentication);
    const headers = new Headers(init.headers);
    headers.set("X-CAP-API-KEY", this.credentials.apiKey);
    if (!authentication) {
      if (!this.cstToken || !this.securityToken)
        throw new CapitalDemoError(
          "Sessão DEMO não aberta; autenticação não foi encaminhada.",
          "NO_SESSION",
        );
      headers.set("CST", this.cstToken);
      headers.set("X-SECURITY-TOKEN", this.securityToken);
    }
    const url = `${CAPITAL_DEMO_BASE_URL}${path}`;
    const signal =
      init.signal ??
      (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(8_000)
        : undefined);
    try {
      const response = await this.fetcher(url, {
        ...init,
        headers,
        cache: "no-store",
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) throw responseError(response, path);
      return response;
    } catch (error) {
      // Do not expose the API key or password in an error message.
      if (error instanceof CapitalDemoError) throw error;
      throw error;
    }
  }

  private async json<T>(path: string, init: RequestInit = {}, authentication = false): Promise<T> {
    const response = await this.requestRaw(path, init, authentication);
    try {
      return (await response.json()) as T;
    } catch {
      throw new CapitalDemoError(
        `Resposta JSON inválida em ${path}.`,
        "INVALID_RESPONSE",
      );
    }
  }

  /** Abre uma nova sessão DEMO; tokens permanecem somente nesta instância. */
  async login(): Promise<void> {
    this.cstToken = null;
    this.securityToken = null;
    const data = JSON.stringify({
      identifier: this.credentials.identifier,
      password: this.credentials.password,
      encryptedPassword: false,
    });
    const response = await this.requestRaw(
      "/session",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data,
      },
      true,
    );
    const cst = normalizedText(response.headers.get("CST"));
    const security = normalizedText(response.headers.get("X-SECURITY-TOKEN"));
    if (!cst || !security) {
      this.cstToken = null;
      this.securityToken = null;
      throw new CapitalDemoError(
        "Sessão DEMO sem CST/X-SECURITY-TOKEN; conta não conectada.",
        "MISSING_SESSION_TOKENS",
      );
    }
    this.cstToken = cst;
    this.securityToken = security;
  }

  private async ensureSession(): Promise<void> {
    if (!this.cstToken || !this.securityToken) await this.login();
    if (!this.cstToken || !this.securityToken)
      throw new CapitalDemoError("Sessão DEMO não autenticada.", "NO_SESSION");
  }

  /** Consulta a sessão e o saldo da conta DEMO selecionada. */
  async account(): Promise<Account> {
    await this.ensureSession();
    const session = await this.json<SessionAccount>("/session");
    const sessionAccountId = normalizedText(session?.accountId);
    const sessionCurrency = normalizedText(session?.currency);
    if (!sessionAccountId || !sessionCurrency)
      throw new CapitalDemoError("GET /session sem accountId/currency.", "INVALID_RESPONSE");
    const data = await this.json<JsonRecord>("/accounts");
    if (!Array.isArray(data.accounts))
      throw new CapitalDemoError("GET /accounts sem lista de contas.", "INVALID_RESPONSE");
    const candidates = data.accounts.map(accountFrom);
    const selected = candidates.find((item) => item.accountId === sessionAccountId);
    if (!selected)
      throw new CapitalDemoError(
        "A conta da sessão não aparece em GET /accounts.",
        "INVALID_RESPONSE",
      );
    if (selected.currency !== sessionCurrency)
      throw new CapitalDemoError(
        "Moeda da sessão difere da moeda do saldo.",
        "INVALID_RESPONSE",
      );
    return selected;
  }

  private normalizeMarket(epic: string, detail: JsonRecord, snapshot: JsonRecord): Market {
    const instrument = asJsonRecord(detail.instrument, "instrument");
    const dealingRules = asJsonRecord(detail.dealingRules, "dealingRules");
    const instrumentEpic = normalizedText(instrument.epic) ?? epic;
    if (instrumentEpic !== epic)
      throw new CapitalDemoError(
        "Instrumento retornado não corresponde ao epic solicitado.",
        "INVALID_RESPONSE",
      );
    const normalizedSnapshot: MarketSnapshot = {
      ...(snapshot as MarketSnapshot),
      marketStatus: String(snapshot.marketStatus ?? ""),
      delayTime: Number(snapshot.delayTime),
      bid: Number(snapshot.bid),
      offer: Number(snapshot.offer),
      updateTimeUTC: normalizeUtcText(snapshot.updateTimeUTC),
      ...(finiteNumber(snapshot.decimalPlacesFactor)
        ? { decimalPlacesFactor: snapshot.decimalPlacesFactor }
        : {}),
      ...(finiteNumber(snapshot.scalingFactor)
        ? { scalingFactor: snapshot.scalingFactor }
        : {}),
    };
    const normalizedInstrument = {
      ...instrument,
      epic: instrumentEpic,
    } as MarketInstrument;
    return {
      epic,
      instrument: normalizedInstrument,
      dealingRules: dealingRules as DealingRules,
      snapshot: normalizedSnapshot,
      bid: normalizedSnapshot.bid,
      offer: normalizedSnapshot.offer,
      updateTimeUTC: normalizedSnapshot.updateTimeUTC,
      marketStatus: normalizedSnapshot.marketStatus,
      delayTime: normalizedSnapshot.delayTime,
      ...(normalizedSnapshot.scalingFactor !== undefined
        ? { scalingFactor: normalizedSnapshot.scalingFactor }
        : {}),
      ...(normalizedSnapshot.decimalPlacesFactor !== undefined
        ? { decimalPlacesFactor: normalizedSnapshot.decimalPlacesFactor }
        : {}),
    };
  }

  /**
   * Lê detalhes do CFD e, quando o detalhe não traz uma cotação UTC fresca,
   * consulta a lista por searchTerm e exige correspondência exata de epic.
   */
  async market(epic: string): Promise<Market> {
    if (typeof epic !== "string" || !epic.trim())
      throw new CapitalDemoError("Epic DEMO ausente.", "INVALID_EPIC");
    await this.ensureSession();
    const raw = getMarketEnvelope(
      asJsonRecord(
        await this.json<unknown>(`/markets/${encodeURIComponent(epic)}`),
        "mercado",
      ),
    );
    const detailSnapshot = asJsonRecord(raw.snapshot, "snapshot");
    const detailMarket = this.normalizeMarket(epic, raw, detailSnapshot);
    const detailTime = utcMillis(detailMarket.snapshot.updateTimeUTC);
    const quoteComplete =
      positiveNumber(detailMarket.snapshot.bid) &&
      positiveNumber(detailMarket.snapshot.offer) &&
      detailTime !== undefined;

    if (quoteComplete) return detailMarket;

    const listRaw = asJsonRecord(
      await this.json<unknown>(`/markets?searchTerm=${encodeURIComponent(epic)}`),
      "lista de mercados",
    );
    const markets = Array.isArray(listRaw.markets) ? listRaw.markets : [];
    const exact = markets.find(
      (item) =>
        !!item &&
        typeof item === "object" &&
        normalizedText((item as JsonRecord).epic) === epic,
    );
    if (!exact || typeof exact !== "object")
      throw new CapitalDemoError(
        "A lista DEMO não trouxe correspondência exata nem cotação UTC.",
        "STALE_MARKET",
      );
    const row = exact as JsonRecord;
    const detail = detailMarket.snapshot;
    const fields = ["delayTime", "scalingFactor"] as const;
    for (const field of fields) {
      const fromDetail = detail[field];
      const fromList = row[field];
      if (
        finiteNumber(fromDetail) &&
        finiteNumber(fromList) &&
        fromDetail !== fromList
      )
        throw new CapitalDemoError(
          `Mercado DEMO inconsistente em ${field}.`,
          "INVALID_RESPONSE",
        );
    }
    const mergedSnapshot: JsonRecord = {
      ...detail,
      bid: row.bid ?? detail.bid,
      offer: row.offer ?? detail.offer,
      marketStatus: row.marketStatus ?? detail.marketStatus,
      delayTime: row.delayTime ?? detail.delayTime,
      updateTimeUTC: row.updateTimeUTC ?? detail.updateTimeUTC,
      decimalPlacesFactor: row.decimalPlacesFactor ?? detail.decimalPlacesFactor,
      scalingFactor: row.scalingFactor ?? detail.scalingFactor,
    };
    const merged = this.normalizeMarket(epic, raw, mergedSnapshot);
    if (!utcMillis(merged.snapshot.updateTimeUTC))
      throw new CapitalDemoError(
        "Mercado DEMO sem updateTimeUTC confiável; ordem não autorizada.",
        "STALE_MARKET",
      );
    return merged;
  }

  /** Valida somente as invariantes do CFD antes de montar uma ordem. */
  async preflight(epic: string): Promise<Market> {
    const market = await this.market(epic);
    validateMarketForPlan(market, Date.now(), false);
    return market;
  }

  /** Busca no máximo 120 candles HOUR e preserva bid/ask do broker. */
  async candles(epic: string, now = Date.now()): Promise<DemoCandle[]> {
    if (typeof epic !== "string" || !epic.trim())
      throw new CapitalDemoError("Epic DEMO ausente.", "INVALID_EPIC");
    if (!finiteNumber(now))
      throw new CapitalDemoError("Agora inválido para candles.", "INVALID_TIME");
    await this.ensureSession();
    const end = new Date(now);
    const start = new Date(now - 120 * 60 * 60 * 1000);
    if (!Number.isFinite(end.getTime()) || !Number.isFinite(start.getTime()))
      throw new CapitalDemoError("Janela de candles inválida.", "INVALID_TIME");
    const utcQuery = (date: Date) => date.toISOString().slice(0, 19);
    const query = new URLSearchParams({
      resolution: "HOUR",
      max: "120",
      from: utcQuery(start),
      to: utcQuery(end),
    });
    const data = asJsonRecord(
      await this.json<unknown>(
        `/prices/${encodeURIComponent(epic)}?${query.toString()}`,
      ),
      "preços",
    );
    if (!Array.isArray(data.prices))
      throw new CapitalDemoError("GET /prices sem prices.", "INVALID_RESPONSE");
    const candles = data.prices.map((entry, index) => {
      const raw = asJsonRecord(entry, `candle ${index}`);
      const snapshotTimeUTC = normalizeUtcText(raw.snapshotTimeUTC);
      const timestamp = utcMillis(raw.snapshotTimeUTC);
      if (!snapshotTimeUTC || timestamp === undefined)
        throw new CapitalDemoError(
          `Candle ${index} sem snapshotTimeUTC UTC válido.`,
          "INVALID_RESPONSE",
        );
      const openPrice = validatePriceLevel(raw.openPrice, `open ${index}`);
      const closePrice = validatePriceLevel(raw.closePrice, `close ${index}`);
      const highPrice = validatePriceLevel(raw.highPrice, `high ${index}`);
      const lowPrice = validatePriceLevel(raw.lowPrice, `low ${index}`);
      if (!finiteNumber(raw.lastTradedVolume) || raw.lastTradedVolume < 0)
        throw new CapitalDemoError(
          `Candle ${index} sem volume válido.`,
          "INVALID_RESPONSE",
        );
      return {
        snapshotTimeUTC,
        timestamp,
        time: timestamp / 1000,
        openPrice,
        closePrice,
        highPrice,
        lowPrice,
        lastTradedVolume: raw.lastTradedVolume,
        open: median(openPrice),
        close: median(closePrice),
        high: median(highPrice),
        low: median(lowPrice),
        volume: raw.lastTradedVolume,
      };
    }).filter(c=>c.timestamp+3600000<=now).sort((a,b)=>a.timestamp-b.timestamp);
    if(candles.some((c,n)=>c.low>c.high||c.open<c.low||c.open>c.high||c.close<c.low||c.close>c.high||(n>0&&c.time-candles[n-1].time!==3600))) throw new CapitalDemoError('Candles demo inválidos, duplicados ou com lacunas.','INVALID_RESPONSE');
    return candles;
  }

  async positions(): Promise<PositionRecord[]> {
    await this.ensureSession();
    const data = asJsonRecord(
      await this.json<unknown>("/positions"),
      "posições",
    );
    if (!Array.isArray(data.positions))
      throw new CapitalDemoError("GET /positions sem positions.", "INVALID_RESPONSE");
    return data.positions as PositionRecord[];
  }

  /**
   * Persiste a intenção antes de POST /positions. O POST retorna apenas uma
   * referência; execução só é afirmada por confirm(), após reconciliação.
   */
  async submit(order: DemoOrder, persistIntent: PersistIntent): Promise<SubmitResult> {
    validateOrder(order);
    if (typeof persistIntent !== "function")
      throw new CapitalDemoError("persistIntent é obrigatório.", "MISSING_PERSISTENCE");
    await persistIntent({ order, status: "SUBMITTING" });
    await this.ensureSession();
    let data: JsonRecord;
    try {
      data = asJsonRecord(
        await this.json<unknown>("/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order),
        }),
        "resposta de submit",
      );
    } catch (error) {
      if (isTimeoutLike(error)) {
        // UNKNOWN is a state transition, never a reason to issue a second POST.
        await persistIntent({ order, status: "UNKNOWN" });
        throw errorWithUnknownSubmission(error);
      }
      throw error;
    }
    const reference = normalizedText(data.dealReference);
    if (!reference)
      throw new CapitalDemoError(
        "POST /positions sem dealReference; execução não assumida.",
        "INVALID_RESPONSE",
      );
    return { reference, status: "PENDING" };
  }

  /**
   * Reconciliador: ACCEPTED no confirm não basta. Todos os affectedDeals OPENED
   * precisam aparecer em GET /positions no mesmo epic/direction, com soma size.
   */
  async confirm(reference: string, expectedOrder: DemoOrder): Promise<ConfirmResult> {
    if (!normalizedText(reference))
      throw new CapitalDemoError("dealReference ausente.", "INVALID_REFERENCE");
    validateOrder(expectedOrder);
    await this.ensureSession();
    let confirmation: ConfirmResponse;
    try {
      confirmation = asJsonRecord(
        await this.json<unknown>(`/confirms/${encodeURIComponent(reference)}`),
        "confirmação",
      ) as ConfirmResponse;
    } catch (error) {
      if (isNotFound(error) || isTimeoutLike(error))
        return unconfirmed(reference, "confirm indisponível (404/timeout); nenhuma ordem foi reenviada.");
      throw error;
    }
    const base = {
      reference,
      dealStatus: confirmation.dealStatus,
    };
    if (confirmation.dealStatus !== "ACCEPTED")
      return {
        ...base,
        status: "UNCONFIRMED",
        confirmed: false,
        reason: `dealStatus ${String(confirmation.dealStatus)} não é ACCEPTED.`,
      };
    if (
      confirmation.epic !== expectedOrder.epic ||
      confirmation.direction !== expectedOrder.direction ||
      !finiteNumber(confirmation.size) ||
      !near(confirmation.size, expectedOrder.size)
    )
      return {
        ...base,
        status: "UNCONFIRMED",
        confirmed: false,
        reason: "Confirmação ACCEPTED diverge de epic/direction/size esperados.",
      };
    const affected = confirmation.affectedDeals;
    if (
      !Array.isArray(affected) ||
      affected.length === 0 ||
      affected.some(
        (deal) =>
          !deal ||
          typeof deal.dealId !== "string" ||
          !deal.dealId ||
          deal.status !== "OPENED",
      )
    )
      return {
        ...base,
        status: "UNCONFIRMED",
        confirmed: false,
        reason: "ACCEPTED sem affectedDeals completos e OPENED.",
      };
    let openPositions: PositionRecord[];
    try {
      openPositions = await this.positions();
    } catch (error) {
      if (isNotFound(error) || isTimeoutLike(error))
        return unconfirmed(reference, "positions indisponível (404/timeout); reconciliação pendente.", confirmation.dealStatus);
      throw error;
    }
    const used = new Set<number>();
    const matched: PositionRecord[] = [];
    for (const affectedDeal of affected) {
      const index = openPositions.findIndex((record, candidateIndex) => {
        if (used.has(candidateIndex)) return false;
        const position = record?.position;
        const market = record?.market;
        return (
          !!position &&
          !!market &&
          typeof position.dealId === "string" &&
          position.dealId === affectedDeal.dealId &&
          market.epic === expectedOrder.epic &&
          position.direction === expectedOrder.direction &&
          positiveNumber(position.size) &&
          positiveNumber(position.level) &&
          finiteNumber(position.stopLevel) && near(position.stopLevel,expectedOrder.stopLevel) &&
          finiteNumber(position.profitLevel) && near(position.profitLevel,expectedOrder.profitLevel) &&
          (affectedDeal.size === undefined ||
            (finiteNumber(affectedDeal.size) && near(position.size, affectedDeal.size)))
        );
      });
      if (index < 0)
        return {
          ...base,
          status: "UNCONFIRMED",
          confirmed: false,
          reason: `affectedDeal ${affectedDeal.dealId} não reconciliado como OPENED.`,
        };
      used.add(index);
      matched.push(openPositions[index]);
    }
    const totalSize = matched.reduce((total, record) => total + record.position.size, 0);
    if (!near(totalSize, expectedOrder.size))
      return {
        ...base,
        status: "UNCONFIRMED",
        confirmed: false,
        reason: `Soma reconciliada ${totalSize} difere do size esperado ${expectedOrder.size}.`,
      };
    return {
      ...base,
      status: "CONFIRMED",
      confirmed: true,
      reason: "ACCEPTED e todos affectedDeals OPENED foram encontrados em positions.",
      dealIds: matched.map((record) => record.position.dealId),
    };
  }
}

function unconfirmed(
  reference: string,
  reason: string,
  dealStatus?: string,
): ConfirmResult {
  return {
    reference,
    status: "UNCONFIRMED",
    confirmed: false,
    reason,
    ...(dealStatus ? { dealStatus } : {}),
  };
}

function near(a: number, b: number): boolean {
  const tolerance = Math.max(1e-9, Math.abs(b) * 1e-8);
  return finiteNumber(a) && finiteNumber(b) && Math.abs(a - b) <= tolerance;
}

export interface DemoBuyInput {
  market: Market;
  account: Account;
  budgetUSD: number;
  /** Percentual em pontos percentuais: 1 significa risco planejado de 1%. */
  riskPct: number;
  /** Percentual em pontos percentuais, limitado a 25%. */
  maxAllocationPct: number;
  /** Hipótese do cliente, não taxa confirmada pela corretora. */
  feeBps: number;
  /** Hipótese do cliente para slippage, não execução garantida. */
  slippageBps: number;
  stop: number;
  target: number;
  now: number;
}

function rule(value: unknown, name: string, unit?: string): number {
  if (!value || typeof value !== "object")
    throw new Error(`Regra ${name} ausente.`);
  const object = value as JsonRecord;
  if (unit && object.unit !== unit)
    throw new Error(`Regra ${name} exige unidade ${unit}.`);
  if (!positiveNumber(object.value))
    throw new Error(`Regra ${name} inválida.`);
  return object.value;
}

function validateMarketForPlan(
  market: Market,
  now: number,
  requireFresh = true,
): {
  referencePrice: number;
  minStop: number;
  maxStop: number;
  minIncrement: number;
  minSize: number;
  maxSize: number;
  marginFactor: number;
  decimalFactor: number;
} {
  if (!market || typeof market !== "object") throw new Error("Mercado DEMO ausente.");
  const instrument = market.instrument;
  const snapshot = market.snapshot;
  if (!instrument || !snapshot || !market.dealingRules)
    throw new Error("Mercado DEMO sem instrument/snapshot/dealingRules.");
  if(instrument.epic !== market.epic) throw new Error('Epic não corresponde às regras do instrumento.');
  if (instrument.currency !== "USD")
    throw new Error("Moeda do CFD deve ser USD; conversão não será inventada.");
  if (instrument.type !== SUPPORTED_DEMO_CFD_TYPES[0])
    throw new Error(`Tipo CFD não suportado: ${String(instrument.type)}.`);
  if (instrument.lotSize !== 1)
    throw new Error("Contrato DEMO exige lotSize 1.");
  const scalingFactor = snapshot.scalingFactor ?? market.scalingFactor;
  if (scalingFactor !== 1)
    throw new Error("Contrato DEMO exige scalingFactor 1.");
  if (snapshot.marketStatus !== "TRADEABLE")
    throw new Error("Mercado não está TRADEABLE.");
  if (!finiteNumber(snapshot.delayTime) || snapshot.delayTime !== 0)
    throw new Error("Mercado DEMO com delayTime diferente de zero.");
  if (!positiveNumber(snapshot.bid) || !positiveNumber(snapshot.offer) || snapshot.offer < snapshot.bid)
    throw new Error("Cotação bid/offer atual ausente ou inválida.");
  const quoteTime = utcMillis(snapshot.updateTimeUTC ?? market.updateTimeUTC);
  if (requireFresh && quoteTime === undefined)
    throw new Error("Cotação atual desconhecida: updateTimeUTC é obrigatório.");
  if (
    requireFresh &&
    (!finiteNumber(now) || now < quoteTime! || now - quoteTime! > 60_000)
  )
    throw new Error("Cotação atual está desconhecida ou tem mais de 60 segundos.");
  if ((snapshot.offer - snapshot.bid) / snapshot.bid > 0.001)
    throw new Error("Spread acima de 0,10%; entrada vetada.");
  if (instrument.marginFactorUnit !== "PERCENTAGE")
    throw new Error("marginFactorUnit deve ser PERCENTAGE.");
  if (!positiveNumber(instrument.marginFactor) || instrument.marginFactor > 100)
    throw new Error("marginFactor inválido.");
  const rules = market.dealingRules;
  const minSize = rule(rules.minDealSize, "minDealSize", "POINTS");
  const maxSize = rule(rules.maxDealSize, "maxDealSize", "POINTS");
  const minIncrement = rule(rules.minSizeIncrement, "minSizeIncrement", "POINTS");
  if (minSize > maxSize)
    throw new Error("minDealSize maior que maxDealSize.");
  const minDistanceRule = rules.minStopOrProfitDistance;
  const maxDistanceRule = rules.maxStopOrProfitDistance;
  const allowedDistanceUnits = ["POINTS", "PERCENTAGE"];
  if (
    !minDistanceRule ||
    !maxDistanceRule ||
    !allowedDistanceUnits.includes(minDistanceRule.unit) ||
    !allowedDistanceUnits.includes(maxDistanceRule.unit)
  )
    throw new Error("Unidade de stop/profit distance inválida.");
  const minDistance = rule(minDistanceRule, "minStopOrProfitDistance");
  const maxDistance = rule(maxDistanceRule, "maxStopOrProfitDistance");
  const referencePrice = snapshot.offer;
  const asPriceDistance = (value: number, unit: string) =>
    unit === "PERCENTAGE" ? (referencePrice * value) / 100 : value;
  const minStop = asPriceDistance(minDistance, minDistanceRule.unit);
  const maxStop = asPriceDistance(maxDistance, maxDistanceRule.unit);
  if (!positiveNumber(minStop) || !positiveNumber(maxStop) || minStop > maxStop)
    throw new Error("Faixas de distância de stop/profit inválidas.");
  const decimalPlaces = snapshot.decimalPlacesFactor ?? market.decimalPlacesFactor;
  if (!finiteNumber(decimalPlaces) || !Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 10)
    throw new Error("decimalPlacesFactor inválido.");
  const decimalFactor = 10 ** decimalPlaces;
  return {
    referencePrice,
    minStop,
    maxStop,
    minIncrement,
    minSize,
    maxSize,
    marginFactor: instrument.marginFactor,
    decimalFactor,
  };
}

function floorTo(value: number, factor: number): number {
  return Number((Math.floor((value + 1e-12) * factor) / factor).toFixed(12));
}

function ceilTo(value: number, factor: number): number {
  return Number((Math.ceil((value - 1e-12) * factor) / factor).toFixed(12));
}

function floorIncrement(value: number, increment: number): number {
  return Number((Math.floor((value + 1e-10) / increment) * increment).toFixed(12));
}

/**
 * Monta somente uma ordem BUY DEMO de CFD cripto USD. O budget é obrigatório e
 * explícito: nunca substituí-lo pelo saldo total da conta.
 */
export function planDemoBuy(input: DemoBuyInput): DemoOrder {
  if (!input || !input.market || !input.account)
    throw new Error("Mercado e conta DEMO são obrigatórios.");
  if (input.account.currency !== "USD")
    throw new Error("Conta DEMO deve estar em USD.");
  if (!positiveNumber(input.account.balance?.available))
    throw new Error("Saldo disponível DEMO inválido.");
  if (!positiveNumber(input.budgetUSD) || input.budgetUSD > input.account.balance.available)
    throw new Error("budgetUSD deve ser positivo e não pode exceder available.");
  if (!positiveNumber(input.riskPct) || input.riskPct > 1)
    throw new Error("riskPct deve estar entre 0 e 1%.");
  if (!positiveNumber(input.maxAllocationPct) || input.maxAllocationPct > 25)
    throw new Error("maxAllocationPct deve estar entre 0 e 25%.");
  if (!finiteNumber(input.feeBps) || input.feeBps < 0 || input.feeBps > 1000 || !finiteNumber(input.slippageBps) || input.slippageBps < 0 || input.slippageBps > 1000)
    throw new Error("feeBps/slippageBps inválidos.");
  if (!finiteNumber(input.stop) || !finiteNumber(input.target) || input.stop <= 0 || input.target <= 0)
    throw new Error("stop e target devem ser níveis positivos.");
  if (!finiteNumber(input.now)) throw new Error("now inválido.");

  const checks = validateMarketForPlan(input.market, input.now);
  const reference = checks.referencePrice;
  const slipRate = input.slippageBps / 10_000;
  const feeRate = input.feeBps / 10_000;
  const entry = reference * (1 + slipRate);
  const stopLevel = floorTo(input.stop, checks.decimalFactor);
  const profitLevel = ceilTo(input.target, checks.decimalFactor);
  if (!(stopLevel > 0 && stopLevel < input.market.snapshot.bid && profitLevel > reference))
    throw new Error("stop/target inválidos para uma compra BUY.");
  const stopDistance = reference - stopLevel;
  const targetDistance = profitLevel - reference;
  if (stopDistance < checks.minStop || stopDistance > checks.maxStop)
    throw new Error("stop fora da distância mínima/máxima do broker.");
  if (targetDistance < checks.minStop || targetDistance > checks.maxStop)
    throw new Error("target fora da distância mínima/máxima do broker.");

  // Perda/recompensa conservadoras com entrada/saída slippage e duas taxas.
  const stopFill = stopLevel * (1 - slipRate);
  const targetFill = profitLevel * (1 - slipRate);
  const costIn = entry * (1 + feeRate);
  const proceedsAtStop = stopFill * (1 - feeRate);
  const proceedsAtTarget = targetFill * (1 - feeRate);
  const lossPerUnit = costIn - proceedsAtStop;
  const rewardPerUnit = proceedsAtTarget - costIn;
  if (!positiveNumber(lossPerUnit) || !positiveNumber(rewardPerUnit))
    throw new Error("stop/target não produzem perda e recompensa líquidas positivas.");
  if (rewardPerUnit / lossPerUnit < 1.5)
    throw new Error("RR líquido inferior a 1,5 após fee e slippage.");

  const riskBudget = input.budgetUSD * (input.riskPct / 100);
  const notionalBudget = input.budgetUSD * (input.maxAllocationPct / 100);
  const marginPerUnit = entry * (checks.marginFactor / 100);
  if (!positiveNumber(riskBudget) || !positiveNumber(notionalBudget) || !positiveNumber(marginPerUnit))
    throw new Error("Orçamento de risco ou margem inválido.");
  const rawSize = Math.min(
    riskBudget / lossPerUnit,
    notionalBudget / costIn,
    input.account.balance.available / marginPerUnit,
    checks.maxSize,
  );
  const size = floorIncrement(rawSize, checks.minIncrement);
  if (!(size >= checks.minSize) || size <= 0)
    throw new Error("Capital insuficiente após arredondar para o incremento; minDealSize não será elevado.");
  const notional = size * costIn;
  const plannedLoss = size * lossPerUnit;
  const margin = size * marginPerUnit;
  if (notional > notionalBudget + 1e-8)
    throw new Error("Notional excede a alocação máxima do budget.");
  if (plannedLoss > riskBudget + 1e-8)
    throw new Error("Risco planejado excede 1%/riskPct do budget.");
  if (margin > input.account.balance.available + 1e-8)
    throw new Error("Margem planejada excede o saldo available.");

  return {
    epic: input.market.epic,
    direction: "BUY",
    size,
    stopLevel,
    profitLevel,
    guaranteedStop: false,
    trailingStop: false,
  };
}
