import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('simple GiftMutant wallet keeps essential assets and removes HOT reconciliation UI',()=>{
 const html=read('../docs/exchange.html');
 const js=read('../docs/assets/exchange.js');
 for(const id of ['wallet-hero-address','wallet-network-state','wallet-assets',
  'wallet-receive','wallet-history','wallet-backup','wallet-backup-notice'])
  assert.match(html,new RegExp('id="'+id+'"'));
 for(const network of ['bsc','ton','mtt'])
  assert.match(html,new RegExp('data-wallet-network="'+network+'"'));
 assert.doesNotMatch(html,/wallet-hot-(?:ton|verify|report|apply|previous)/);
 assert.doesNotMatch(js,/tonCompatRequest|refreshTonCompatibilityStatus|wallet-hot-/);
 assert.match(js,/wallet-backup'\)\.classList\.add\('hidden'\)/);
 assert.match(js,/refreshBackupStatus/);
});
