export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const buckets = new Map<string,{count:number;until:number}>();
export function limitRequest(key: string, count = 10, interval = 60000, now = Date.now()) {
  if (buckets.size > 2000) for (const [k,v] of buckets) if (v.until < now) buckets.delete(k);
  if (buckets.size > 2000 && !buckets.has(key)) throw new ApiError(429,'Serviço ocupado. Tente novamente em instantes.');
  const b = buckets.get(key);
  if (!b || b.until <= now) { buckets.set(key,{count:1,until:now+interval}); return; }
  if (b.count >= count) throw new ApiError(429,'Limite temporário atingido. Aguarde antes de repetir.');
  b.count++;
}
export function requestKey(req: Request, scope: string) { return `${scope}:${req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'}`; }
export function requireSameOrigin(req: Request) {
  const origin = req.headers.get('origin'); const host = new URL(req.url).host;
  if (!origin) throw new ApiError(403,'Origem da solicitação ausente.');
  let url: URL; try { url = new URL(origin); } catch { throw new ApiError(403,'Origem inválida.'); }
  if (url.host !== host || !['http:','https:'].includes(url.protocol)) throw new ApiError(403,'Solicitação de outra origem recusada.');
  if (url.protocol === 'http:' && !['localhost','127.0.0.1'].includes(url.hostname)) throw new ApiError(403,'Use conexão HTTPS.');
}
export async function readJson(req: Request, maxBytes = 16384): Promise<Record<string,unknown>> {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415,'Envie JSON.');
  if (!req.body) throw new ApiError(400,'Corpo ausente.');
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let size=0;
  while (true) { const {done,value}=await reader.read(); if (done) break; size+=value.length; if(size>maxBytes){await reader.cancel();throw new ApiError(413,'Solicitação muito grande.');} chunks.push(value); }
  const all = new Uint8Array(size); let offset=0; for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
  try { const data = JSON.parse(new TextDecoder().decode(all)); if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error(); return data; } catch { throw new ApiError(400,'JSON inválido.'); }
}
export function errorPayload(e: unknown) { return e instanceof ApiError ? { status:e.status,message:e.message } : {status:503,message:'Serviço indisponível ou ainda não configurado. Nenhuma operação foi confirmada.'}; }
