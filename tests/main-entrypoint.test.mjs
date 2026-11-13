import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=readFileSync('docs/index.html','utf8');
const legacy=readFileSync('docs/legacy-bsc.html','utf8');
test('short GitHub Pages root redirects to MTT Exchange wallet and swap UI',()=>{
 assert.match(root,/<meta http-equiv="refresh" content="0;url=\.\/exchange\.html"/);
 assert.match(root,/window\.location\.replace\('\.\/exchange\.html' \+ window\.location\.search \+ window\.location\.hash\)/);
 assert.ok(existsSync('docs/exchange.html'));
 assert.match(readFileSync('docs/exchange.html','utf8'),/tab-wallet/);
});
test('legacy BSC exchange remains accessible, no payment settings touched',()=>{
 assert.match(legacy,/GIFT MUTANT/);
 assert.match(legacy,/BSC · BEP-20/);
 assert.match(legacy,/БЕЗ РЕАЛЬНЫХ ДЕПОЗИТОВ/);
 assert.ok(existsSync('docs/assets/main.js'));
});
