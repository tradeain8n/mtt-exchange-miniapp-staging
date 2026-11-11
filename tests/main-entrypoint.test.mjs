import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=readFileSync('docs/index.html','utf8');
const legacy=readFileSync('docs/legacy-bsc.html','utf8');
test('short GitHub Pages root redirects to current Yaako staging onboarding',()=>{
 assert.match(root,/<meta http-equiv="refresh" content="0;url=\.\/yaako\.html"/);
 assert.match(root,/window\.location\.replace\('\.\/yaako\.html' \+ window\.location\.search \+ window\.location\.hash\)/);
 assert.ok(existsSync('docs/yaako.html'));
 assert.match(readFileSync('docs/yaako.html','utf8'),/MTT SPORTS \+ Yaako/);
});
test('legacy BSC exchange remains accessible, no payment settings touched',()=>{
 assert.match(legacy,/GIFT MUTANT/);
 assert.match(legacy,/BSC · BEP-20/);
 assert.match(legacy,/БЕЗ РЕАЛЬНЫХ ДЕПОЗИТОВ/);
 assert.ok(existsSync('docs/assets/main.js'));
});
