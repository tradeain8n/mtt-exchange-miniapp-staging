import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const page=readFileSync(fileURLToPath(new URL('../docs/mttsports-email.html',import.meta.url)),'utf8');
const target='https://mtt.xyz/?i=ba434b5a';
test('Email handoff points to official affiliate URL inside Telegram WebView',()=>{
 assert(page.includes('href="'+target+'"'));
 assert(page.includes('name="referrer" content="no-referrer"'));
 assert(page.includes('content="0; url='+target+'"')||
        page.includes('window.location.replace(official)'));
 assert.doesNotMatch(page,/fetch\(|XMLHttpRequest|localStorage\.|sessionStorage\.|telegram-web-app\.js/);
 assert.doesNotMatch(page,/<form\b/i);
});
