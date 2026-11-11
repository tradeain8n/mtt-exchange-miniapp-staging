import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReport} from '../scripts/mttsports_autocheck.mjs';
test('report states amount, recipient and SSO/quote limitations',()=>{
 const result=buildReport();
 assert.match(result,/3\.3 USDT \(TON\)/);
 assert.match(result,/6880/);
 assert.match(result,/ba434b5a/);
 assert.match(result,/не проверенный OAuth callback/);
 assert.match(result,/НЕ РАЗРЕШЁН/);
 assert.match(result,/не подтверждены/);
});
