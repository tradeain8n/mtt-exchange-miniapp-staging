import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../docs/mttsports-start.html',import.meta.url)),'utf8');
const target='https://mtt.xyz/?i=ba434b5a';
test('one-tap Telegram landing navigates only to canonical referral URL',()=>{
 const urls=[...html.matchAll(/https:\/\/[^"'\s<]+/g)].map(x=>x[0]);
 assert(urls.length>=3);
 assert(urls.every(u=>u===target||u==='https://mtt.xyz'));
 assert.equal(html.includes('MTTSPORTS_bot'),false);
 assert.equal(html.includes('startapp'),false);
 assert.equal(html.includes('initDataRaw'),false);
 assert.equal(html.includes('fetch('),false);
 assert.equal(html.includes('localStorage'),false);
 assert.equal(html.includes('sessionStorage'),false);
 assert.match(html,/content="3;url=https:\/\/mtt\.xyz\/\?i=ba434b5a"/);
});
test('single visit triggers one in-webview navigation, not a fake registration',()=>{
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert(script);
 const scheduled=[];
 const navigations=[];
 const sandbox={
  URL,
  window:{
   location:{replace:url=>navigations.push(url)},
   Telegram:{WebApp:{ready:()=>scheduled.push('ready')}}
  },
  setTimeout:(fn,delay)=>{scheduled.push(delay);fn();}
 };
 vm.runInNewContext(script,sandbox,{timeout:1000});
 assert.deepEqual(navigations,[target]);
 assert(scheduled.includes('ready'));
 assert(scheduled.some(x=>Number.isInteger(x)&&x<=100));
});
test('no Telegram credentials or cross-origin session claims',()=>{
 assert.match(html,/No cookies, user identifiers, Telegram tokens/);
 assert.match(html,/Game-side login remains controlled by the MTT SPORTS website/);
 assert.doesNotMatch(html,/oauth2\/callback|Telegram\.WebApp\.initData|sendData\(/);
});
