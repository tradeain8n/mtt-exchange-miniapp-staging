const token=process.env.TELEGRAM_BOT_TOKEN;
const appUrl=process.env.MINIAPP_URL||'https://tradeain8n.github.io/mtt-exchange-miniapp-staging/yaako.html';
const expectedUsername='giftmutantbot';
if(!token)throw Error('TELEGRAM_BOT_TOKEN GitHub Secret is missing');
if(!appUrl.startsWith('https://'))throw Error('Telegram Mini App requires HTTPS');
if(new URL(appUrl).hostname!=='tradeain8n.github.io')throw Error('Unexpected Staging Mini App host');
async function api(method,body){
  const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(15000)
  });
  const data=await r.json();
  if(!data.ok)throw Error('Telegram method '+method+' failed: '+String(data.description).slice(0,100));
  return data.result;
}
const me=await api('getMe',{});
if(String(me.username||'').toLowerCase()!==expectedUsername)throw Error('Secret does not belong to GiftMutantBot');
// A short command menu leads to the /start wallet instead of the obsolete
// registration wizard. The Yaako Mini App remains available from /start.
await api('setChatMenuButton',{menu_button:{type:'commands'}});
const minimalCommands=[
  {command:'start',description:'Главная · личный кошелёк'},
  {command:'wallet',description:'Мой кошелёк · адреса сетей'},
  {command:'mttsports',description:'Play Now · MTT SPORTS'},
  {command:'yaako',description:'Yaako · войти и привязать'},
  {command:'help',description:'Помощь'}
];
await api('setMyCommands',{commands:minimalCommands});
await api('setMyShortDescription',{short_description:
  'Baby MTT · личный мультисетевой кошелёк, Play Now и Yaako. STAGING.'});
await api('setMyDescription',{description:
  'Baby MTT: постоянный кошелёк при Telegram /start, MTT SPORTS Play Now, Yaako. Переводы не включены до проверки резервной фразы и безопасности.'});
const menu=await api('getChatMenuButton',{});
const commands=await api('getMyCommands',{});
const webhook=await api('getWebhookInfo',{});
if(menu.type!=='commands'){
  throw Error('Telegram menu configuration could not be verified');
}
if(commands.length!==minimalCommands.length || !minimalCommands.every(x=>commands.some(c=>c.command===x.command))){
  throw Error('Telegram commands were not saved');
}
console.log('BOT_MENU_VERIFIED',JSON.stringify({
  bot_id:me.id,username:me.username,
  has_main_web_app:me.has_main_web_app===true,
  menu_type:menu.type,
  commands:commands.map(x=>x.command),
  webhook_configured:Boolean(webhook.url)
}));
