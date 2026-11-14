import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../docs/exchange.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../docs/assets/exchange.js',import.meta.url),'utf8');
test('GiftMutant shows just two MTT liquidity numbers to customers',()=>{
 assert.match(page,/id="liquidity-mtt-buy"/);
 assert.match(page,/id="liquidity-mtt-sell"/);
 assert.match(page,/MTT для покупки/);
 assert.match(page,/MTT для продажи/);
 assert.doesNotMatch(page,/USD₮ TON в резерве|USDT BSC в резерве/);
});
test('client only accepts verified 6880 response, resets unverified balances',()=>{
 assert.match(script,/\/api\/giftmutant\/liquidity/);
 assert.match(script,/snapshot\.chainId!==6880/);
 assert.match(script,/displayMttAmount\(snapshot\.buy\?\.availableMtt\)/);
 assert.match(script,/displayMttAmount\(snapshot\.sell\?\.availableMtt\)/);
 assert.match(script,/liquidity-mtt-buy'\)\.textContent='—'/);
 assert.match(script,/liquidity-mtt-sell'\)\.textContent='—'/);
 assert.match(script,/refreshGiftmutantLiquidity\(\),20000/);
});
