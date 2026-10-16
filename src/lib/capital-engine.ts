/** Cliente legado somente para leitura. Nenhuma rota pública utiliza este cliente. */
export interface CapitalCredentials {
  apiKey: string;
  identifier: string;
  password?: string;
  isDemo?: boolean;
}
export class CapitalComClient {
  private baseUrl: string;
  private credentials: CapitalCredentials;
  private cstToken: string | null = null;
  private securityToken: string | null = null;
  constructor(creds: CapitalCredentials) {
    if (!creds.apiKey || !creds.identifier || !creds.password)
      throw new Error("Credenciais da corretora ausentes.");
    if (creds.isDemo !== true)
      throw new Error("Conta real não habilitada nesta versão.");
    this.credentials = creds;
    this.baseUrl = "https://demo-api-capital.backend-capital.com/api/v1";
  }
  public async createSession(): Promise<boolean> {
    this.cstToken = null;
    this.securityToken = null;
    const res = await fetch(`${this.baseUrl}/session`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        "X-CAP-API-KEY": this.credentials.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: this.credentials.identifier,
        password: this.credentials.password,
      }),
    });
    if (!res.ok) throw new Error("Autenticação na corretora recusada.");
    const cst = res.headers.get("CST");
    const security = res.headers.get("X-SECURITY-TOKEN");
    if (!cst || !security)
      throw new Error("Sessão da corretora sem tokens válidos.");
    this.cstToken = cst;
    this.securityToken = security;
    return true;
  }
  public async getAccountBalance() {
    if (!this.cstToken || !this.securityToken) await this.createSession();
    const res = await fetch(`${this.baseUrl}/accounts`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        "X-CAP-API-KEY": this.credentials.apiKey,
        CST: this.cstToken!,
        "X-SECURITY-TOKEN": this.securityToken!,
      },
    });
    if (!res.ok) throw new Error("Não foi possível consultar a conta demo.");
    const data = await res.json();
    if (!Array.isArray(data.accounts))
      throw new Error("Resposta inválida da corretora.");
    return {
      connected: true,
      accounts: data.accounts,
      status: "AUTHENTICATED_DEMO",
    };
  }
  public async placeMarketOrder(
    _epic: string,
    _direction: "BUY" | "SELL",
    _size: number,
    _stopLevel?: number,
    _profitLevel?: number,
  ): Promise<never> {
    throw new Error(
      "Envio de ordens desativado nesta versão. Não existe fallback de sucesso simulado.",
    );
  }
}
