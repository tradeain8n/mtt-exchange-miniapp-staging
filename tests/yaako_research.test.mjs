import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverScripts,fingerprint,PUBLIC_URLS} from '../scripts/yaako_public_analysis.mjs';
import {readFileSync} from 'node:fs';
test('Public JS study allowlists official HTTPS hosts',()=>{
 const html='<script src="/assets/main.js"></script><script src="https://evil.example/steal.js"></script><script src="https://account.yaako.io/assets/login.js"></script>';
 assert.deepEqual(discoverScripts(html,'https://yaako.io/'),[
  'https://yaako.io/assets/main.js','https://account.yaako.io/assets/login.js'
 ]);
 assert(PUBLIC_URLS.every(url=>url.startsWith('https://')));
 const source='oauth2 google custodial solana mtt';
 const data=fingerprint(source,'https://yaako.io/assets/main.js');
 assert.equal(data.indicators.custodial,1);
 assert.equal(data.indicators.solana,1);
 assert.equal(data.bytes,Buffer.byteLength(source));
});
test('Wallet proof UI never sends a transaction or asks for a password',()=>{
 const html=readFileSync(new URL('../docs/yaako-link.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../docs/assets/yaako-link.js',import.meta.url),'utf8');
 assert.match(html,/Подпись кошелька/);
 assert.match(html,/copy-approve/);
 assert.match(js,/personal_sign/);
 assert.match(js,/baby-mtt-yaako-link/);
 assert.doesNotMatch(js,/eth_sendTransaction|wallet_sendCalls|eth_signTransaction/);
 assert.doesNotMatch(html,/<input[^>]*type=["']password/i);
});
