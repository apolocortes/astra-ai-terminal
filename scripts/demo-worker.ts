import {open,mkdir,readFile,rename,appendFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {CapitalDemoClient,planDemoBuy,type DemoOrder} from '../src/lib/capital-demo';
import {evaluateStrategies,STRATEGIES,type StrategyMode} from '../src/lib/strategy-engine';
const args=process.argv.slice(2);
function option(name:string,fallback:string){const n=args.indexOf(name);if(n<0)return fallback;if(!args[n+1]||args[n+1].startsWith('--'))throw new Error(`Valor ausente: ${name}`);return args[n+1];}
interface Journal {version:1;mode:'CAPITAL_DEMO_ONLY';accountId:string;controls:{epic:string;strategy:StrategyMode;budgetUSD:number;feeBps:number;slippageBps:number};initialEquityProxyUSD:number;lastSignalCandleTime:number;lastClosedAt:number;pending:null|{status:'SUBMITTING'|'UNKNOWN'|'PENDING';order:DemoOrder;reference?:string;at:number};dealIds:string[];blocked:string;updatedAt:number;closedObservations:{at:number;dealIds:string[];balanceUSD:number;unrealizedUSD:number}[]}
async function main(){
 if(args.includes('--help')){console.log('EXCLUSIVAMENTE CAPITAL.COM DEMO. Sem flag, somente observa. Uso: npm run bot:demo -- --epic EPIC_DA_CORRETORA --once\nPara permitir ordens fictícias: --enable-demo-orders --budget-usd ORCAMENTO_USD --fee-bps HIPOTESE --slippage-bps HIPOTESE --strategy auto --state-dir .astra-demo. Nunca usa conta real. Não presume que BTC-USD seja um epic da Capital.com. Credenciais são variáveis server-side novas; não são lidas de arquivos antigos.');return;}
 const known=new Set(['--epic','--strategy','--budget-usd','--fee-bps','--slippage-bps','--state-dir','--once','--enable-demo-orders']);for(let n=0;n<args.length;n++){if(!known.has(args[n]))throw new Error(`Opção inválida: ${args[n]}`);if(!['--once','--enable-demo-orders'].includes(args[n]))n++;}
 const epic=option('--epic','');if(!/^[A-Z0-9._-]{2,80}$/.test(epic))throw new Error('Informe um epic exato da Capital.com. Não inferir a partir da Coinbase.');
 const strategy=option('--strategy','auto') as StrategyMode;if(strategy!=='auto'&&!STRATEGIES.some(s=>s.id===strategy))throw new Error('Estratégia inválida.');
 const budgetUSD=Number(option('--budget-usd','0'));const feeBps=Number(option('--fee-bps','60'));const slippageBps=Number(option('--slippage-bps','5'));const enabled=args.includes('--enable-demo-orders');
 if(!Number.isFinite(budgetUSD)||budgetUSD<0||![feeBps,slippageBps].every(v=>Number.isFinite(v)&&v>=0&&v<=1000))throw new Error('Orçamento/custos inválidos.');
 if(enabled&&(budgetUSD<=0||!args.includes('--fee-bps')||!args.includes('--slippage-bps')))throw new Error('Ordens demo exigem orçamento USD positivo e hipóteses explícitas de taxa/slippage. Sem defaults silenciosos.');
 const client=new CapitalDemoClient({apiKey:process.env.CAPITAL_DEMO_API_KEY||'',identifier:process.env.CAPITAL_DEMO_IDENTIFIER||'',password:process.env.CAPITAL_DEMO_PASSWORD||''});
 const folder=path.resolve(option('--state-dir','.astra-demo'));await mkdir(folder,{recursive:true,mode:0o700});const lockPath=path.join(folder,'worker.lock');let lock;try{lock=await open(lockPath,'wx',0o600);}catch{throw new Error('Lock existente. Verifique outro worker ou reconciliação pendente antes de iniciar.');}
 await lock.writeFile(JSON.stringify({pid:process.pid,epic,mode:'CAPITAL_DEMO_ONLY',startedAt:Date.now()}));let stopping=false;const stop=()=>{stopping=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 try{
  const account=await client.account();if(account.currency!=='USD')throw new Error('Conta demo USD é requisito desta versão; conversão e PnL não serão inventados.');if(enabled&&budgetUSD>account.balance.available)throw new Error('Orçamento excede o disponível da conta demo.');
  const controls={epic,strategy,budgetUSD,feeBps,slippageBps};let state:Journal={version:1,mode:'CAPITAL_DEMO_ONLY',accountId:account.accountId,controls,initialEquityProxyUSD:account.balance.balance+account.balance.profitLoss,lastSignalCandleTime:-1,lastClosedAt:0,pending:null,dealIds:[],blocked:'',updatedAt:Date.now(),closedObservations:[]};
  const file=path.join(folder,'journal.json');try{const saved:Journal=JSON.parse(await readFile(file,'utf8'));if(saved.version!==1||saved.mode!=='CAPITAL_DEMO_ONLY'||saved.accountId!==account.accountId||JSON.stringify(saved.controls)!==JSON.stringify(controls)||!Number.isFinite(saved.initialEquityProxyUSD)||!Number.isFinite(saved.lastSignalCandleTime)||!Number.isFinite(saved.lastClosedAt)||typeof saved.blocked!=='string'||!Array.isArray(saved.dealIds)||saved.dealIds.some(id=>typeof id!=='string'||!id)||!Array.isArray(saved.closedObservations))throw new Error('Journal incompatível ou inválido. Não descartar estado nem iniciar nova sessão silenciosamente.');if(saved.pending&&(!['SUBMITTING','UNKNOWN','PENDING'].includes(saved.pending.status)||!saved.pending.order||saved.pending.order.epic!==epic||saved.pending.order.direction!=='BUY'||!Number.isFinite(saved.pending.at)))throw new Error('Intenção persistida inválida.');state=saved;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  async function save(){state.updatedAt=Date.now();const tmp=`${file}.${process.pid}.tmp`;const f=await open(tmp,'w',0o600);try{await f.writeFile(JSON.stringify(state,null,2));await f.sync();}finally{await f.close();}await rename(tmp,file);}
  let previous='';let lastLog=0;async function log(action:string,message:string,details:unknown=null){const now=Date.now();if(`${action}:${message}`===previous&&now-lastLog<60000)return;const event={at:now,mode:'CAPITAL_DEMO_ONLY',action,message,details};await appendFile(path.join(folder,'events.jsonl'),JSON.stringify(event)+'\n',{mode:0o600});console.log(`${new Date(now).toISOString()} ${action} ${message}`);previous=`${action}:${message}`;lastLog=now;}
  if(state.pending&&!state.pending.reference)state.blocked='Intenção SUBMITTING/UNKNOWN sem referência. Reconciliação manual obrigatória; não reenviar.';
  await save();console.log(`CAPITAL_DEMO_ONLY · ${epic} · ${strategy} · ordens ${enabled?'autorizadas em DEMO por regras':'DESATIVADAS'} · budget USD ${budgetUSD}. Saldo e dinheiro DEMO, não renda real.`);
  while(!stopping){try{
    const actual=await client.account();if(actual.accountId!==state.accountId||actual.currency!=='USD')throw new Error('Conta da sessão mudou. Worker deve parar.');
    const equityProxy=actual.balance.balance+actual.balance.profitLoss;if(!Number.isFinite(equityProxy))throw new Error('Saldo não finito.');
    if(enabled&&equityProxy<=state.initialEquityProxyUSD-budgetUSD*0.03)state.blocked='Variação da conta atingiu o limite de sessão. Novas entradas bloqueadas; stops do broker continuam vigentes.';
    let positions=await client.positions();
    if(state.pending?.reference){const confirmed=await client.confirm(state.pending.reference,state.pending.order);if(confirmed.confirmed){state.dealIds=confirmed.dealIds!;state.pending=null;await save();await log('CONFIRMED','Execução demo confirmada por IDs exatos, tamanho e stop/alvo do broker.',confirmed);}else{await log('UNCONFIRMED',confirmed.reason,confirmed);}}
    if(state.dealIds.length){positions=await client.positions();const ours=positions.filter(p=>state.dealIds.includes(p.position?.dealId));if(ours.length===0){const ids=state.dealIds;state.closedObservations.push({at:Date.now(),dealIds:ids,balanceUSD:actual.balance.balance,unrealizedUSD:actual.balance.profitLoss});state.dealIds=[];state.lastClosedAt=Date.now();await log('CLOSED_OBSERVED','Posições confirmadas não estão mais abertas. Registrado saldo de conta; PnL por trade não foi inventado.',{dealIds:ids,balanceUSD:actual.balance.balance});}else if(ours.length!==state.dealIds.length){state.blocked='Reconciliação parcial de posições. Não abrir outra exposição.';}else if(ours.some(p=>p.market?.epic!==epic||p.position.direction!=='BUY'||!Number.isFinite(p.position.stopLevel)||!Number.isFinite(p.position.profitLevel))){state.blocked='Posição própria alterada ou sem proteção. Intervenção manual necessária.';}}
    const unknown=positions.filter(p=>!state.dealIds.includes(p.position?.dealId));if(unknown.length&&!state.pending)state.blocked='Há posições não pertencentes ao journal. Worker não gerencia operações manuais nem abre outra exposição.';
    if(stopping)break;
    if(state.blocked){await log('BLOCKED',state.blocked);}
    else if(state.pending){await log('PENDING','Referência aguardando confirmação/reconciliação. Nenhum novo POST será enviado.');}
    else if(state.dealIds.length){await log('MONITOR','Posição demo aberta; stops/alvos ficam no broker.',{dealIds:state.dealIds,accountBalanceUSD:actual.balance.balance,accountUnrealizedUSD:actual.balance.profitLoss});}
    else{
      const market=await client.market(epic);const candles=await client.candles(epic);const signal=evaluateStrategies(candles,strategy);const candleTime=candles.at(-1)?.time??-1;const fresh=Date.now()-(candleTime+3600)*1000>=0&&Date.now()-(candleTime+3600)*1000<=60000;
      if(!enabled)await log('OBSERVE','Ordens desativadas. Inspecionando lógica sem enviar trades.',signal);
      else if(signal.action!=='BUY')await log('HOLD',signal.reason,signal);
      else if(!fresh||candleTime<=state.lastSignalCandleTime||Date.now()-state.lastClosedAt<60000)await log('HOLD','Aguardar novo candle/abertura e cooldown; não perseguir sinal antigo.',signal);
      else if(budgetUSD>actual.balance.available)await log('HOLD','Budget excede saldo disponível atual.');
      else{
        const order=planDemoBuy({market,account:actual,budgetUSD,riskPct:1,maxAllocationPct:25,feeBps,slippageBps,stop:market.snapshot.offer-signal.stopAtr*signal.features!.atr,target:market.snapshot.offer+signal.targetAtr*signal.features!.atr,now:Date.now()});
        // Rechecar posições imediatamente antes do único POST. Nunca negociar conta com exposição desconhecida.
        if((await client.positions()).length)throw new Error('Posição apareceu antes do envio. Não empilhar exposição.');
        if(stopping)break;
        state.lastSignalCandleTime=candleTime;
        try{const submission=await client.submit(order,async intent=>{state.pending={...intent,at:Date.now()};await save();});state.pending={status:'PENDING',order,reference:submission.reference,at:Date.now()};await save();await log('SUBMITTED','Referência recebida; isso ainda não é execução.',submission);}catch(e){state.blocked='Envio não concluído de forma verificável. Não reenviar; reconciliar journal e conta.';await save();await log('SUBMISSION_BLOCKED',state.blocked);throw e;}
      }
    }
    await save();
  }catch(e){await log('ERROR',e instanceof Error?e.message:'Falha demo; nenhuma entrada substituta.');await save();if(state.blocked&&state.pending&&!state.pending.reference)break;}
  if(args.includes('--once'))break;for(let n=0;n<10000&&!stopping;n+=250)await new Promise(r=>setTimeout(r,250));}
  await save();console.log('Worker demo encerrado. Não fecha posições silenciosamente; proteções confirmadas ficam na corretora. Não é conta real.');
 }finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);await lock.close();await unlink(lockPath);}
}
main().catch(e=>{console.error(`DEMO_STOPPED: ${e instanceof Error?e.message:'Falha demo.'}`);process.exitCode=1;});
