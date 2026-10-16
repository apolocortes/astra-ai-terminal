import {NextResponse} from 'next/server';
import {loadHistory} from '@/lib/historical-data';
import {runResearch,type BacktestConfig} from '@/lib/backtest';
import {DEFAULT_CONFIG,validateConfig} from '@/lib/paper-engine';
import {ApiError,errorPayload,limitRequest,readJson,requestKey,requireSameOrigin} from '@/lib/server-guards';
export const dynamic='force-dynamic';
export const maxDuration=60;
const cache=new Map<string,{expires:number;body:unknown}>();
const pending=new Map<string,Promise<unknown>>();
export async function POST(req:Request){try{
  requireSameOrigin(req);limitRequest(requestKey(req,'research'),4,60000);const input=await readJson(req);
  const symbol=typeof input.symbol==='string'?input.symbol:'BTC-USD';const days=input.days===undefined?30:Number(input.days);
  const config:BacktestConfig={...DEFAULT_CONFIG,spreadBps:2};
  for(const key of ['initialBRL','usdBRL','feeBps','slippageBps','spreadBps'] as const)if(input[key]!==undefined){if(typeof input[key]!=='number'||!Number.isFinite(input[key]))throw new ApiError(400,'Parâmetros devem ser números finitos.');config[key]=input[key];}
  try{validateConfig(config);if(config.spreadBps<0||config.spreadBps>1000)throw new Error();}catch{throw new ApiError(400,'Parâmetros fora dos limites de pesquisa.');}
  if(![7,14,30].includes(days))throw new ApiError(400,'Use7,14ou30dias.');
  const key=JSON.stringify({symbol,days,config});const hit=cache.get(key);
  if(hit&&hit.expires>Date.now())return NextResponse.json(hit.body,{headers:{'Cache-Control':'no-store'}});
  if(pending.size>=4&&!pending.has(key))throw new ApiError(429,'Há pesquisas em execução. Aguarde uma delas terminar.');
  const calculate=async()=>{const data=await loadHistory(symbol,days);const report=runResearch(data.candles,config);const body={success:true,version:'astra-research-v2',mode:'HYPOTHETICAL_SPOT_ONLY',symbol,config,report,provenance:{source:data.source,fetchedAt:data.fetchedAt,sha256:data.sha256,timeframeSeconds:data.timeframeSeconds,requestedDays:data.requestedDays},candles:data.candles};if(cache.size>=16)cache.delete(cache.keys().next().value!);cache.set(key,{body,expires:Date.now()+300000});return body;};
  let task=pending.get(key);if(!task){task=calculate();pending.set(key,task);}
  try{return NextResponse.json(await task,{headers:{'Cache-Control':'no-store'}});}finally{pending.delete(key);}
}catch(e){const error=errorPayload(e);return NextResponse.json({success:false,error:e instanceof ApiError?error.message:'Histórico indisponível, incompleto ou inválido. Nenhum resultado sintético foi criado.'},{status:error.status,headers:{'Cache-Control':'no-store'}});}}
