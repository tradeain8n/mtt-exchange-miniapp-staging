import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const html=readFileSync(fileURLToPath(new URL('../docs/mttsports-connect.html',import.meta.url)),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
const ADDRESS='0x'+'4'.repeat(40);

function launch({initData='valid-fixture-data',clipboardAddress=ADDRESS,clipboardBlocked=false,saveStatus=200,linked=false}={}){
 const elements=new Map(),fetches=[];
 for(const id of ['status','explain','walletBox','uid','walletAddress','copy',
  'refresh','recipientForm','recipientAddress','recipientConfirm','saveRecipient',
  'recipientStatus','pasteRecipient','addressLength']){
  const el={value:'',checked:false,disabled:false,textContent:'',
   events:{},focusCalled:false,
   classList:{add(){},remove(){}},
   addEventListener(event,fn){this.events[event]=fn},
   focus(){this.focusCalled=true}};
  elements.set(id,el);
 }
 let readCount=0;
 const fetcher=async(url,options={})=>{
  fetches.push({url,options});
  if(url.endsWith('/config.json'))return {ok:true,json:async()=>({
   apiBaseUrl:'https://api.example.test',version:'staging-test'
  })};
  if(url.endsWith('/status'))return {ok:true,json:async()=>({
   ok:true,status:linked?'email_cli_authenticated':'not_linked',
   address:linked?ADDRESS:undefined,
   uid:linked?'442903':undefined,
   chainId:linked?6880:undefined,
   recipient:{status:'not_set',address:null},
   thirdPartyLoginSession:'not_observable'
  })};
  if(url.endsWith('/recipient/save'))return {ok:saveStatus===200,
   status:saveStatus,json:async()=>saveStatus===200
    ?{ok:true,recipient:{address:ADDRESS,status:'self_reported',providerVerified:false}}
    :{ok:false,error:'invalid_or_unconfirmed_recipient'}};
  throw Error('unexpected endpoint: '+url);
 };
 const window={innerWidth:375,Telegram:{WebApp:{initData,ready(){},expand(){}}}};
 const navigator={clipboard:{async readText(){readCount++;if(clipboardBlocked)throw Error('permission');return clipboardAddress}}};
 runInNewContext(script,{window,navigator,document:{
  getElementById:id=>{assert(elements.has(id));return elements.get(id)}},
  fetch:fetcher,URL,console,queueMicrotask});
 return {get:id=>elements.get(id),fetches,get readCount(){return readCount}};
}
const flush=async()=>new Promise(resolve=>setImmediate(resolve));

test('iPhone-width Telegram WebApp: native paste and save complete without password or OTP',async()=>{
 assert.match(html,/name="viewport" content="width=device-width,initial-scale=1/);
 assert.match(html,/max-width:540px/);
 assert.match(html,/id="pasteRecipient"/);
 const v=launch();
 await flush();
 assert.match(v.get('status').textContent,/MTT SPORTS не подключён/);
 await v.get('pasteRecipient').events.click();
 assert.equal(v.get('recipientAddress').value,ADDRESS);
 assert.equal(v.readCount,1);
 v.get('recipientConfirm').checked=true;
 let prevented=false;
 await v.get('recipientForm').events.submit({preventDefault(){prevented=true}});
 assert.equal(prevented,true);
 const post=v.fetches.find(x=>x.url.endsWith('/recipient/save'));
 assert(post);
 const body=JSON.parse(post.options.body);
 assert.deepEqual(body,{initData:'valid-fixture-data',address:ADDRESS,confirmed:true});
 assert.equal(post.options.credentials,'omit');
 assert.match(v.get('recipientStatus').textContent,/Адрес сохранён/);
 assert.match(v.get('recipientStatus').textContent,/принадлежность MTT SPORTS пока не доказана/);
 assert.equal(v.get('recipientConfirm').checked,false);
 assert.equal(v.get('saveRecipient').disabled,false);
});
test('when game account has been verified, recipient pre-fills without manual copying',async()=>{
 const v=launch({linked:true});
 await flush();
 assert.equal(v.get('recipientAddress').value,ADDRESS);
 assert.match(v.get('status').textContent,/Подключён через Email CLI/);
 assert.equal(v.get('recipientConfirm').checked,false);
 assert.equal(v.fetches.filter(x=>x.url.endsWith('/recipient/save')).length,0);
});
test('unknown Telegram identity cannot use recipient form or read game wallet',async()=>{
 const v=launch({initData:''});
 await flush();
 assert.match(v.get('status').textContent,/Открой из GiftMutant/);
 v.get('recipientAddress').value=ADDRESS;v.get('recipientConfirm').checked=true;
 await v.get('recipientForm').events.submit({preventDefault(){}});
 assert.match(v.get('recipientStatus').textContent,/Открой эту страницу из GiftMutant/);
 assert.equal(v.fetches.length,0);
});
test('invalid address and missing consent never call remote write',async()=>{
 const v=launch();
 await flush();
 v.get('recipientAddress').value='0x123';
 v.get('recipientConfirm').checked=true;
 await v.get('recipientForm').events.submit({preventDefault(){}});
 assert.match(v.get('recipientStatus').textContent,/Адрес не сохранён: 3\/40/);
 v.get('recipientAddress').value=ADDRESS;
 v.get('recipientConfirm').checked=false;
 await v.get('recipientForm').events.submit({preventDefault(){}});
 assert.match(v.get('recipientStatus').textContent,/поставь отметку/);
 assert.equal(v.fetches.filter(x=>x.url.endsWith('/recipient/save')).length,0);
});
test('clipboard unavailable on mobile permits manual paste without disrupting entry',async()=>{
 const v=launch({clipboardAddress:'not-an-address'});
 await flush();
 await v.get('pasteRecipient').events.click();
 assert.match(v.get('recipientStatus').textContent,/нет полного EVM-адреса/);
 assert.equal(v.get('recipientAddress').value,'');
});
test('iOS clipboard permission denial falls back to manual long-press paste',async()=>{
 const v=launch({clipboardBlocked:true});
 await flush();
 await v.get('pasteRecipient').events.click();
 assert.equal(v.get('recipientAddress').focusCalled,true);
 assert.match(v.get('recipientStatus').textContent,/удерживай палец/);
});
test('backend failure shows actionable error, not a success confirmation',async()=>{
 const v=launch({saveStatus:401});
 await flush();
 v.get('recipientAddress').value=ADDRESS;
 v.get('recipientConfirm').checked=true;
 await v.get('recipientForm').events.submit({preventDefault(){}});
 assert.match(v.get('recipientStatus').textContent,/Не удалось сохранить адрес/);
 assert.equal(v.get('saveRecipient').disabled,false);
});

test('iPhone-native paste is never blocked by maxlength/minlength constraint',async()=>{
 assert.match(html,/<form id="recipientForm" novalidate>/);
 assert.doesNotMatch(html,/maxlength="42"|minlength="42"/);
 const v=launch();
 await flush();
 v.get('recipientAddress').value=ADDRESS;
 v.get('recipientAddress').events.input();
 assert.match(v.get('addressLength').textContent,/40\/40/);
 v.get('recipientConfirm').checked=true;
 await v.get('recipientForm').events.submit({preventDefault(){}});
 assert.match(v.get('recipientStatus').textContent,/Адрес сохранён/);
});

test('a 40-hex-character EVM address without 0x is normalized safely',async()=>{
 const v=launch();
 await flush();
 v.get('recipientAddress').value=ADDRESS.slice(2);
 v.get('recipientConfirm').checked=true;
 await v.get('recipientForm').events.submit({preventDefault(){}});
 const req=v.fetches.find(x=>x.url.endsWith('/recipient/save'));
 assert.equal(JSON.parse(req.options.body).address,ADDRESS);
 assert.equal(v.get('recipientAddress').value,ADDRESS);
});

test('truncated copied address shows exact missing count, never a browser validity bubble',async()=>{
 const v=launch();
 await flush();
 v.get('recipientAddress').value=ADDRESS.slice(8);
 v.get('recipientConfirm').checked=true;
 await v.get('recipientForm').events.submit({preventDefault(){}});
 assert.match(v.get('recipientStatus').textContent,/Не хватает 6 символов/);
 assert.equal(v.fetches.filter(x=>x.url.endsWith('/recipient/save')).length,0);
});
