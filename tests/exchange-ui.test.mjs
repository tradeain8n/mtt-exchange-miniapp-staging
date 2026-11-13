import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('exchange root and Telegram blue menu point to the new interface',()=>{
 const index=read('../docs/index.html');
 const config=read('../scripts/configure_bot.mjs');
 const action=read('../.github/workflows/configure-bot.yml');
 assert.match(index,/exchange\.html/);
 assert.doesNotMatch(index,/url=\.\/yaako\.html/);
 assert.match(config,/text:'💱 Обменник'/);
 assert.match(config,/type:'web_app'/);
 assert.match(config,/menu\.web_app\?\.url!==appUrl/);
 assert.match(action,/miniapp-staging\/exchange\.html/);
});
test('minimal exchange has only amount, two networks, receiving wallet and real checkout',()=>{
 const html=read('../docs/exchange.html');
 const js=read('../docs/assets/exchange.js');
 const css=read('../docs/assets/exchange.css');
 for(const id of ['tab-swap','tab-wallet','wallet-evm','amount','network',
  'destination-network','evm-recipient','result','swap-main','swap-pay',
  'swap-check-status','swap-order-status','swap-payment-memo'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/<option value="ton" selected>TON<\/option>/);
 assert.match(html,/<option value="mtt" selected>MTT Network<\/option>/);
 assert.match(html,/value="3\.00"/);
 assert.doesNotMatch(html,/ton-pilot-create|ton-preflight|route-state|steps|Пилот/);
 assert.match(js,/getAuthenticatedWallet/);
 assert.match(js,/pilotRequest/);
 assert.match(js,/app\.tonkeeper\.com\/transfer/);
 assert.match(js,/refreshQuote/);
 assert.doesNotMatch(js,/privateKey|seedPhrase|sendTransaction|eth_sendTransaction/);
 assert.match(css,/\.swap-card-heading/);
 assert.match(css,/\.swap-big-amount/);
});
