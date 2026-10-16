import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaperState,paperStep,DEFAULT_CONFIG,type Snapshot,type PaperOptions} from '../src/lib/paper-engine';
import {evaluateStrategies} from '../src/lib/strategy-engine';
import {decodePaper,encodePaper} from '../src/lib/paper-storage';
const T=Math.floor(1802720000000/3600000)*3600000+10000;
const closedTime=Math.floor(T/1000/3600)*3600-3600;
const candles=Array.from({length:120},(_,n)=>({time:closedTime-(119-n)*3600,open:100,close:100,low:99,high:101,volume:100}));
candles[119]={...candles[119],close:110,high:111,volume:1000};
const decision=evaluateStrategies(candles,'breakout');
function snap(at=T,bid=100):Snapshot{const ask=bid+0.01;return {success:true,symbol:'BTC-USD',timestamp:at,marketTimestamp:at,source:'TEST_ONLY',price:bid,bid,ask,orderBook:{buyerDominance:45,bids:[{price:bid,size:(45/55)*ask/bid}],asks:[{price:ask,size:1}]},indicators:{rsi:80,vwap:105,atr:10},candles,timeframeSeconds:3600};}
const options:PaperOptions={decision:{...decision,features:{...decision.features!,atr:10}},signalCandleTime:closedTime,timeframeSeconds:3600};
test('usa a estratégia de candles sem depender da regra legada de livro comprador',()=>{const result=paperStep(createPaperState(),snap(),T,true,false,options);assert.equal(result.action,'OPEN');assert.equal(result.state.position?.strategyId,'breakout');assert.equal(result.state.position?.maxHoldingMs,48*3600000);assert.equal(result.state.realizedBRL,0);assert.ok(result.state.cashBRL<30);});
test('HOLD da estratégia preserva dinheiro mesmo que a regra legada fosse elegível',()=>{const result=paperStep(createPaperState(),snap(),T,true,false,{...options,decision:{...options.decision,action:'HOLD',reason:'Sem hipótese confirmada'}});assert.equal(result.action,'HOLD');assert.equal(result.state.cashBRL,30);});
test('sinal atrasado ou ainda não fechado não produz entrada',()=>{assert.equal(paperStep(createPaperState(),snap(T+70000),T+70000,true,false,options).action,'HOLD');assert.equal(paperStep(createPaperState(),snap(),T,true,false,{...options,signalCandleTime:closedTime+3600}).action,'HOLD');});
test('não reentra no mesmo candle após um fechamento mesmo com cooldown satisfeito',()=>{const opened=paperStep(createPaperState(),snap(),T,true,false,options).state;const closed=paperStep(opened,snap(T+2000),T+2000,false,true).state;const result=paperStep({...closed,lastClosedAt:0},snap(T+30000),T+30000,true,false,options);assert.equal(result.action,'HOLD');assert.match(result.message,/candle já originou/);});
test('posição inteligente não é encerrada pelo limite legado de15min',()=>{const opened=paperStep(createPaperState(),snap(),T,true,false,options).state;assert.equal(paperStep(opened,snap(T+900001),T+900001,false).action,'HOLD');const elapsed=48*3600000;assert.equal(paperStep(opened,snap(T+elapsed),T+elapsed,false).action,'CLOSE');});
test('carteira com plano e último sinal reconcilia; plano malformado não restaura',()=>{const opened=paperStep(createPaperState(),snap(),T,true,false,options).state;assert.deepEqual(decodePaper(encodePaper(opened,[]),T).session,opened);assert.throws(()=>decodePaper(encodePaper({...opened,position:{...opened.position!,maxHoldingMs:1}},[]),T),/Plano/);assert.throws(()=>decodePaper(encodePaper({...opened,lastSignalCandleTime:closedTime-3600},[]),T),/Deduplicação/);});
test('custos continuam vetando plano aparentemente inteligente com ATR pequeno',()=>{const result=paperStep(createPaperState({...DEFAULT_CONFIG}),snap(),T,true,false,{...options,decision:{...options.decision,features:{...options.decision.features!,atr:0.01}}});assert.equal(result.action,'HOLD');assert.match(result.message,/Custos/);});
