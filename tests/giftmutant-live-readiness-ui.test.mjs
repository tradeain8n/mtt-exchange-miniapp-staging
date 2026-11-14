import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../docs/assets/exchange.js',import.meta.url),'utf8');
test('swap checks dedicated GiftMutant readiness, not legacy BSC production status',()=>{
 assert.match(code,/\/api\/giftmutant\/readiness/);
 assert.doesNotMatch(code,/\/api\/health/);
 assert.match(code,/liveGiftmutantReadiness\?\.accepting!==true/);
 assert.match(code,/currentOrder&&currentOrder\.state!=='completed'/);
 assert.match(code,/else if\(!currentOrder\)void refreshLiveReadiness\(\)/);
 assert.match(code,/treasury_liquidity_replenishment/);
});
