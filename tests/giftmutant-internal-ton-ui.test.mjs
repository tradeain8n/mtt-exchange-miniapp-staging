import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {internalTonPaymentRequest} from '../docs/assets/giftmutant-tonpay-client.js';
const orderId='11111111-2222-3333-4444-555555555555';
test('Mini App pays within GiftMutant without Tonkeeper and has a separate confirmation button',()=>{
 const html=readFileSync(new URL('../docs/exchange.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../docs/assets/exchange.js',import.meta.url),'utf8');
 for(const id of ['swap-pay','swap-pay-confirm','swap-pay-cancel',
 'swap-internal-review','swap-internal-central','swap-internal-memo',
 'swap-internal-message'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/Оплатить из GiftMutant/);
 assert.match(html,/Подтвердить списание 3 USD₮/);
 assert.match(js,/previewInternalTonPayment/);
 assert.match(js,/confirmInternalTonPayment/);
 assert.match(js,/tonPay\('confirm',\{confirmation:'PAY_EXACTLY_3_USDT_TON'\}\)/);
 assert.doesNotMatch(js,/app\.tonkeeper\.com\/transfer|linkForWallet/);
 assert.doesNotMatch(js,/privateKey|mnemonic|seedPhrase/);
});
test('client never sends without a signed Telegram session and exact user confirmation',async()=>{
 let calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  return {ok:true,json:async()=>({ok:true,ready:true,
   summary:{sourceTon:'owner',amountUsdt:'3'}})};
 };
 const base='https://example.org';
 const args={base,initData:'signed-telegram-initdata',orderId,fetcher};
 await internalTonPaymentRequest({...args,action:'preview'});
 assert.match(calls[0].url,/\/tonpay\/preview/);
 assert.equal(calls[0].body.confirmation,undefined);
 await assert.rejects(()=>internalTonPaymentRequest({...args,action:'confirm',
  confirmation:'NOT_APPROVED'}),/confirmation_required/);
 assert.equal(calls.length,1);
 await internalTonPaymentRequest({...args,action:'confirm',
  confirmation:'PAY_EXACTLY_3_USDT_TON'});
 assert.equal(calls[1].body.orderId,orderId);
 assert.equal(calls[1].body.confirmation,'PAY_EXACTLY_3_USDT_TON');
 assert.ok(!('secretKey' in calls[1].body));
});
