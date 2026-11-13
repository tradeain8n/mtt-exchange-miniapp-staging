import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pilotRequest,assertPilotOrder} from '../docs/assets/giftmutant-pilot.js';
const evm='0x0Df74fCAE9a687A2B5Ba1117074184e3Ec780964';
const ton='UQALB1cbdr5SgjCRdUMHjvTARzv0_V3Mju4V6cO1YbyYg2EV';
test('pilot UI uses TON wallet confirmation only, no private seed or keys',()=>{
 const page=readFileSync(new URL('../docs/exchange.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../docs/assets/exchange.js',import.meta.url),'utf8');
 assert.match(page,/id="ton-pilot-create"/);
 assert.match(page,/id="ton-pilot-refresh"/);
 assert.match(js,/assertPilotOrder/);
 assert.match(js,/window\.location\.href=order\.paymentUrl/);
 assert.match(js,/Проверить статус обмена|updatePilotStatus/);
 assert.doesNotMatch(js,/centralPrivateKey|privateKey|seedPhrase/);
});
test('checkout payload keeps exact 3 USDt and authenticated bound EVM',async()=>{
 let observed=null;
 const response=await pilotRequest({base:'https://safe.example',initData:'signed',
  recipientEvm:evm,action:'create',fetcher:async(url,options)=>{
   observed={url,data:JSON.parse(options.body)};
   return {ok:true,json:async()=>({ok:true,order:{amountUsdt:'3',
    recipientEvm:evm,sourceTon:ton,paymentUrl:'ton://transfer/x?amount=3000000&jetton=official'}})};
  }});
 assert.equal(observed.data.amountUsdt,'3');
 assert.equal(observed.data.recipientEvm,evm);
 assert.equal(observed.data.initData,'signed');
 assert.equal(assertPilotOrder(response.order,evm,ton).amountUsdt,'3');
 assert.throws(()=>assertPilotOrder({...response.order,recipientEvm:'0x123'},evm,ton),/unrecognized/);
});
