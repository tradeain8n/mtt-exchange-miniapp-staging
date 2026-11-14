import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../docs/admin.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../docs/assets/giftmutant-admin.js',import.meta.url),'utf8');
test('admin Mini App displays separate accounts and three-level rate tabs',()=>{
 for(const id of ['panel-users','panel-settings','panel-withdrawals','rate-1','rate-2','rate-3',
  'users','save','rates-form'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/Зарегистрированные/);
 assert.match(html,/Реферальные отчисления/);
});
test('all admin calls require signed Telegram session; no browser-side admin secret',()=>{
 assert.match(js,/tg\?\.initData/);
 assert.match(js,/api\/giftmutant\/referrals\/admin/);
 assert.match(js,/result\.error/);
 assert.doesNotMatch(js,/localStorage|window\.adminToken|sessionStorage|privateKey|seedPhrase/);
 assert.match(js,/textContent/);
});
