import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pilotRequest,assertPilotOrder} from '../docs/assets/giftmutant-pilot.js';
const evm='0x0Df74fCAE9a687A2B5Ba1117074184e3Ec780964';
const ton='UQALB1cbdr5SgjCRdUMHjvTARzv0_V3Mju4V6cO1YbyYg2EV';
const central='UQCfgCBihmgBCw0wqc8V2W6nIE_51SLqGgT_y4YH90vXWenS';
const memo='GFT-aabbccddeeff0011';
const master='EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
test('pilot UI uses TON wallet confirmation only, no private seed or keys',()=>{
 const page=readFileSync(new URL('../docs/exchange.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../docs/assets/exchange.js',import.meta.url),'utf8');
 assert.match(page,/id="swap-main"/);
 assert.match(page,/id="swap-check-status"/);
 assert.match(js,/assertPilotOrder/);
 assert.match(js,/internalTonPaymentRequest/);
 assert.match(js,/previewInternalTonPayment/);
 assert.match(js,/loadPilotStatus|swap-order-status/);
 assert.doesNotMatch(js,/centralPrivateKey|privateKey|seedPhrase/);
});
test('checkout payload keeps exact 3 USDt and authenticated bound EVM',async()=>{
 let observed=null;
 const response=await pilotRequest({base:'https://safe.example',initData:'signed',
  recipientEvm:evm,action:'create',fetcher:async(url,options)=>{
   observed={url,data:JSON.parse(options.body)};
   return {ok:true,json:async()=>({ok:true,order:{amountUsdt:'3',
    recipientEvm:evm,sourceTon:ton,centralTon:central,memo,paymentUrl:'ton://transfer/'+central+'?amount=3000000&jetton='+master+'&text='+memo}})};
  }});
 assert.equal(observed.data.amountUsdt,'3');
 assert.equal(observed.data.recipientEvm,evm);
 assert.equal(observed.data.initData,'signed');
 assert.equal(assertPilotOrder(response.order,evm,ton).amountUsdt,'3');
 assert.throws(()=>assertPilotOrder({...response.order,
  paymentUrl:response.order.paymentUrl.replace(master,central)},evm,ton),/untrusted/);
 assert.throws(()=>assertPilotOrder({...response.order,
  paymentUrl:response.order.paymentUrl.replace('3000000','3000001')},evm,ton),/untrusted/);
 assert.throws(()=>assertPilotOrder({...response.order,recipientEvm:'0x123'},evm,ton),/unrecognized/);
});
