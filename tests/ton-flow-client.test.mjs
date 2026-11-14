import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateRoute} from '../docs/assets/exchange-model.js';
import {isEvmAddress,normalizeAppApi,fetchTonPreview,createTonDraft,
 USDT_TON_MASTER} from '../docs/assets/ton-flow-client.js';
const addr='0x'+'aB'.repeat(20);
test('TON USDT route is displayed but cannot accept or spend coins',()=>{
 assert.equal(USDT_TON_MASTER,'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs');
 assert.equal(isEvmAddress(addr),true);
 assert.equal(isEvmAddress('0xBAD'),false);
 const tooSmall=evaluateRoute({network:'ton',token:'USDT',amount:'2'});
 assert.equal(tooSmall.ok,false);
 assert.match(tooSmall.reason,/3 USD₮ TON/);
 assert.equal(evaluateRoute({network:'ton',token:'USDT',amount:'3.5'}).ok,false);
 const draft=evaluateRoute({network:'ton',token:'USDT',amount:'3'});
 assert.equal(draft.ok,true);
 assert.equal(draft.previewOnly,true);
 assert.equal(draft.canDeposit,false);
 assert.equal(draft.canExecute,false);
 assert.equal(evaluateRoute({network:'ton',token:'TON',amount:'10'}).ok,false);
 assert.equal(evaluateRoute({network:'bsc',token:'USDT',amount:'2'}).ok,true);
});
test('read-only quote transport is disabled without approved HTTPS API',async()=>{
 assert.equal(normalizeAppApi({apiBaseUrl:null}),null);
 assert.equal(normalizeAppApi({apiBaseUrl:'http://localhost:3000'}),null);
 assert.equal(normalizeAppApi({apiBaseUrl:'https://tradeain8n.github.io/other'}),null);
 assert.equal(normalizeAppApi({apiBaseUrl:'https://gateway.example/v1/'}),'https://gateway.example/v1');
 const noGateway=await fetchTonPreview({baseUrl:null,amount:'3',recipient:addr,
   fetcher:async()=>{throw Error('should not call');}});
 assert.equal(noGateway.ok,false);
 let seen=0;
 const result=await fetchTonPreview({baseUrl:'https://gateway.example',amount:'3',recipient:addr,
   fetcher:async(url)=>{
     seen++;
     assert.equal(new URL(url).pathname,'/api/ton/route');
     return {ok:true,json:async()=>({ok:true,depositEnabled:false,
       bridge:{ok:false,reason:'provider_unreachable'}})};
   }});
 assert.equal(seen,1);
 assert.equal(result.bridge.ok,false);
 assert.equal(result.depositEnabled,false);
 const injected=await fetchTonPreview({baseUrl:'https://gateway.example',amount:'3',recipient:addr,
   fetcher:async()=>({ok:true,json:async()=>({ok:true,depositEnabled:true,depositAddress:'bad'})})});
 assert.equal(injected.ok,false);
});
test('Telegram initData is necessary for private draft and never becomes a deposit',async()=>{
 const noAuth=await createTonDraft({baseUrl:'https://gateway.example',
  amount:'3',recipient:addr,initData:''});
 assert.equal(noAuth.ok,false);
 const result=await createTonDraft({baseUrl:'https://gateway.example',
  amount:'3',recipient:addr,initData:'signed-example',
  fetcher:async(url,opts)=>{
    assert.equal(opts.method,'POST');
    assert.equal(url,'https://gateway.example/api/ton/draft');
    const body=JSON.parse(opts.body);
    assert.equal(body.recipient,addr);
    assert.equal(body.initData,'signed-example');
    return {ok:true,status:201,json:async()=>({ok:true,depositEnabled:false,
      draft:{id:'draft-test',status:'draft',depositAddress:null,depositEnabled:false}})};
  }});
 assert.equal(result.ok,true);
 assert.equal(result.draft.status,'draft');
});
test('checkout verifies order before showing native TON wallet payment link',()=>{
 const html=readFileSync('docs/exchange.html','utf8');
 const js=readFileSync('docs/assets/exchange.js','utf8');
 assert.match(html,/id="evm-recipient"/);
 assert.match(html,/id="swap-ton-recipient"/);
 assert.match(html,/id="swap-payment-memo"/);
 assert.match(html,/id="swap-pay"/);
 assert.match(html,/id="swap-pay-status"/);
 assert.match(html,/id="swap-order-status"/);
 assert.match(js,/getAuthenticatedWallet/);
 assert.match(js,/assertPilotOrder/);
 assert.match(js,/previewInternalTonPayment/);
 assert.match(js,/confirmInternalTonPayment/);
 assert.doesNotMatch(js,/sendViaWallet|eth_sendTransaction|sendTransaction\(/);
});
