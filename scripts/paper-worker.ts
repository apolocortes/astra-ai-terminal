import {mkdir,open,readFile,rename,appendFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {GET} from '../src/app/api/live-depth/route';
import {createPaperState,DEFAULT_CONFIG,paperStep,snapshotError,validateConfig,type Config,type Snapshot} from '../src/lib/paper-engine';
import {decodePaper,encodePaper,type Evidence} from '../src/lib/paper-storage';
import {evaluateStrategies,STRATEGIES,type StrategyMode} from '../src/lib/strategy-engine';
const argv=process.argv.slice(2);
function arg(name:string,fallback:string){const n=argv.indexOf(name);if(n<0)return fallback;if(!argv[n+1]||argv[n+1].startsWith('--'))throw new Error(`Valor ausente: ${name}`);return argv[n+1];}
if(argv.includes('--help')){console.log('Worker PAPER, sem ordens de corretora. Uso: npm run bot:paper -- --start --symbol BTC-USD --strategy auto --timeframe 3600 --state-dir .astra-paper\n--once faz uma única leitura; sem --start, novas entradas ficam pausadas. --config arquivo.json recebe parâmetros virtuais numéricos. Não compartilhe o mesmo diretório entre workers.');process.exit(0);}
async function main(){
  const known=new Set(['--start','--once','--symbol','--strategy','--timeframe','--state-dir','--config']);for(let n=0;n<argv.length;n++){if(!known.has(argv[n]))throw new Error(`Opção desconhecida: ${argv[n]}`);if(!['--start','--once'].includes(argv[n]))n++;}
  const symbol=arg('--symbol','BTC-USD');if(!['BTC-USD','ETH-USD','SOL-USD','AVAX-USD','LINK-USD','DOGE-USD','XRP-USD'].includes(symbol))throw new Error('Ativo não suportado.');
  const strategy=arg('--strategy','auto') as StrategyMode;if(strategy!=='auto'&&!STRATEGIES.some(s=>s.id===strategy))throw new Error('Estratégia inválida.');
  const timeframe=Number(arg('--timeframe','3600'));if(![60,3600].includes(timeframe))throw new Error('Timeframe inválido. Use60ou3600segundos.');
  const folder=path.resolve(arg('--state-dir','.astra-paper'));await mkdir(folder,{recursive:true,mode:0o700});const lockPath=path.join(folder,'worker.lock');
  let lock;try{lock=await open(lockPath,'wx',0o600);}catch{throw new Error('Outro worker ou lock pendente existe. Não iniciar processo concorrente; verificar o processo antes de remover um lock antigo.');}
  await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString(),symbol,strategy,timeframe}));
  let stopping=false;const stop=()=>{stopping=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try{
    let config:Config={...DEFAULT_CONFIG};const configFile=arg('--config','');if(configFile){config=JSON.parse(await readFile(path.resolve(configFile),'utf8'));validateConfig(config);}
    let state=createPaperState(config);let evidence:Evidence[]=[];const file=path.join(folder,'checkpoint.json');
    try{const saved=JSON.parse(await readFile(file,'utf8'));if(saved.version!==1||saved.mode!=='PAPER_ONLY'||saved.symbol!==symbol||saved.strategy!==strategy||saved.timeframe!==timeframe)throw new Error('Checkpoint pertence a outro modo/ativo/estratégia/timeframe.');const restored=decodePaper(saved.paper);if(configFile&&JSON.stringify(restored.session.config)!==JSON.stringify(config))throw new Error('Configuração difere do checkpoint. Use outro diretório para um novo experimento.');state=restored.session;evidence=restored.evidence;if(state.position&&state.position.symbol!==symbol)throw new Error('Posição e ativo do worker divergem.');}
    catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    async function checkpoint(){const temporary=`${file}.${process.pid}.tmp`;const handle=await open(temporary,'w',0o600);try{await handle.writeFile(JSON.stringify({version:1,mode:'PAPER_ONLY',symbol,strategy,timeframe,savedAt:new Date().toISOString(),paper:encodePaper(state,evidence)}));await handle.sync();}finally{await handle.close();}await rename(temporary,file);}
    let previous='';let lastLogAt=0;
    await checkpoint();console.log(`PAPER_ONLY · ${symbol} · ${strategy} · ${timeframe}s · entradas ${argv.includes('--start')?'permitidas por regras':'pausadas'} · ${folder}`);
    while(!stopping){
      const started=Date.now();let action='FEED_ERROR';let message='';let snap:Snapshot|null=null;let analysis:ReturnType<typeof evaluateStrategies>|null=null;
      try{const response=await GET(new Request(`https://paper.local/api/live-depth?symbol=${symbol}&granularity=${timeframe}`));const data=await response.json();if(!response.ok||data.success!==true)throw new Error('Feed indisponível ou inválido.');snap=data;const invalid=snapshotError(snap,Date.now());if(invalid)throw new Error(invalid);analysis=evaluateStrategies(snap!.candles||[],strategy);if(stopping)break;const step=paperStep(state,snap,Date.now(),argv.includes('--start'),false,{decision:analysis,signalCandleTime:snap!.candles?.at(-1)?.time??-1,timeframeSeconds:timeframe});state=step.state;action=step.action;message=step.message;}
      catch(e){message=e instanceof Error?e.message:'Falha no feed.';}
      const now=Date.now();if(`${action}:${message}`!==previous||now-lastLogAt>=60000){const event={at:now,action,message,snapshot:snap?{...snap,candles:undefined}:null};evidence=[...evidence,event].slice(-300);await appendFile(path.join(folder,'events.jsonl'),JSON.stringify({...event,decision:analysis,mode:'PAPER_ONLY'})+'\n',{mode:0o600});console.log(`${new Date(now).toISOString()} ${action} ${message}`);previous=`${action}:${message}`;lastLogAt=now;}
      await checkpoint();if(argv.includes('--once'))break;const wait=Math.max(1000,5000-(Date.now()-started));for(let n=0;n<wait&&!stopping;n+=250)await new Promise(resolve=>setTimeout(resolve,Math.min(250,wait-n)));
    }
    await checkpoint();console.log('Worker encerrado. Checkpoint salvo; nenhuma posição de corretora foi enviada ou fechada.');
  }finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);await lock.close();await unlink(lockPath);}
}
main().catch(e=>{console.error(`WORKER_STOPPED: ${e instanceof Error?e.message:'Erro no worker.'}`);process.exitCode=1;});
