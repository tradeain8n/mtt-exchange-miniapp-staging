import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../docs/exchange.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../docs/assets/exchange.js',import.meta.url),'utf8');
test('route selector shows all server-backed chain options and execution state',()=>{
 for(const id of ['swap-route-status','swap-route-list','source-token','network','destination-network'])
  assert.ok(page.includes('id="'+id+'"'),id);
 assert.match(script,/api\/giftmutant\/routes/);
 assert.match(script,/activeServerRoute\(\)\?\.executable===true/);
 assert.match(script,/route\.mode==='live'/);
 assert.match(script,/renderRouteCatalog\(\)/);
});
