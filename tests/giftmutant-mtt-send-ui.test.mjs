import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mttSendRequest,validMttSendInput} from '../docs/assets/mtt-send-client.js';

const to='0x136e104e88916152a9C7bdDA9d5FaBaaEf63088a';
test('wallet MTT send requires two separate confirmation steps in same Mini App',()=>{
 const html=readFileSync(new URL('../docs/exchange.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../docs/assets/exchange.js',import.meta.url),'utf8');
 for(const id of ['wallet-send','wallet-send-panel','wallet-send-to','wallet-send-amount',
 'wallet-send-prepare','wallet-send-preview','wallet-send-confirm',
 'wallet-send-check','wallet-send-explorer','wallet-send-fee'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/nativeSendEnabled=true;syncMttSendButton/);
 assert.match(js,/currentWalletNetwork==='mtt'/);
 assert.match(js,/SEND_MTT_NOW/);
 assert.match(js,/mttSendRequest/);
 assert.match(html,/wallet-send-confirm/);
 assert.doesNotMatch(js,/recoverLocally|privateKey|seedPhrase|mnemonic/);
});
test('client requires signed telegram session, sane address/amount and exact confirmation',async()=>{
 assert.equal(validMttSendInput(to,'1000.123'),true);
 assert.equal(validMttSendInput(to,'0'),false);
 assert.equal(validMttSendInput('bad','1'),false);
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,params:JSON.parse(options.body)});
  return {ok:true,json:async()=>({ok:true,send:{id:'example',state:'prepared'}})};
 };
 const base='https://giftmutant.example';
 await mttSendRequest({base,initData:'signed',action:'prepare',
  recipient:to,amountMtt:'2,5',fetcher});
 assert.equal(calls[0].params.amountMtt,'2.5');
 assert.equal(calls[0].params.recipient,to);
 assert.equal(calls[0].params.initData,'signed');
 assert.match(calls[0].url,/\/api\/wallet\/mtt-send\/prepare$/);
 await assert.rejects(()=>mttSendRequest({base,initData:'signed',
  action:'confirm',intentId:'example',confirm:'NO',fetcher}),/confirmation_required/);
 assert.equal(calls.length,1);
 await mttSendRequest({base,initData:'signed',action:'confirm',
  intentId:'example',confirm:'SEND_MTT_NOW',fetcher});
 assert.equal(calls[1].params.confirm,'SEND_MTT_NOW');
 assert.equal(calls.length,2);
});
