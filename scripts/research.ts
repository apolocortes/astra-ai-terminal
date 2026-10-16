import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {loadHistory} from '../src/lib/historical-data';
import {runResearch,type BacktestConfig} from '../src/lib/backtest';
import {DEFAULT_CONFIG} from '../src/lib/paper-engine';
const argv=process.argv.slice(2);
function arg(name:string,fallback:string){const index=argv.indexOf(name);return index>=0?argv[index+1]:fallback;}
async function main(){
 if(argv.includes('--help')){console.log('npm run research -- --symbol BTC-USD --days 30 --output .astra-research/report.json [--config parametros.json]\nRelatório hipotético spot, com dados reais; não executa ordens de corretora.');return;}
 const known=new Set(['--symbol','--days','--output','--config']);for(let n=0;n<argv.length;n+=2)if(!known.has(argv[n])||!argv[n+1]||argv[n+1].startsWith('--'))throw new Error('Argumentos inválidos.');
 const symbol=arg('--symbol','BTC-USD');const days=Number(arg('--days','30'));const configFile=arg('--config','');
 const config:BacktestConfig={...DEFAULT_CONFIG,spreadBps:2,...(configFile?JSON.parse(await readFile(path.resolve(configFile),'utf8')):{})};
 console.log(`Obtendo${days}dias de candles reais: ${symbol} ·1h.`);const data=await loadHistory(symbol,days);const report=runResearch(data.candles,config);
 const file=path.resolve(arg('--output',`.astra-research/${symbol}-${Date.now()}.json`));await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify({version:'astra-research-v2',mode:'HYPOTHETICAL_SPOT_ONLY',symbol,config,report,provenance:{source:data.source,fetchedAt:data.fetchedAt,sha256:data.sha256,timeframeSeconds:data.timeframeSeconds,requestedDays:data.requestedDays},candles:data.candles},null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({file,verdict:report.verdict,selected:report.selectedStrategy,training:report.training.map(r=>({id:r.strategyId,trades:r.trades,netBRL:r.netBRL,feesBRL:r.feesBRL,drawdown:r.maxDrawdownPct})),validation:report.validation.map(r=>({id:r.strategyId,trades:r.trades,netBRL:r.netBRL,feesBRL:r.feesBRL,drawdown:r.maxDrawdownPct})),sha256:data.sha256},null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Pesquisa não concluída.');process.exitCode=1;});
