import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('GiftMutant wallet includes HOT public TON address reconciliation',()=>{
 const html=read('../docs/exchange.html');
 const js=read('../docs/assets/exchange.js');
 for(const id of ['wallet-hot-ton','wallet-hot-verify','wallet-hot-report','wallet-hot-apply','wallet-hot-previous'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/tonCompatRequest\('preview'/);
 assert.match(js,/tonCompatRequest\('select'/);
 assert.match(js,/refreshTonCompatibilityStatus/);
 assert.match(js,/USE_MATCHED_TON/);
 assert.match(js,/r\.backupConfirmed/);
 assert.match(js,/el\('wallet-hot-apply'\)\.disabled=!r\.backupConfirmed/);
 assert.doesNotMatch(js,/wallet-hot.*(privateKey|mnemonic|seedPhrase)/);
});
