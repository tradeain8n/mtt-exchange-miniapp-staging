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
await api('setChatMenuButton',{menu_button:{
  type:'web_app',text:'Baby MTT · MTT SPORTS / Yaako',web_app:{url:appUrl}
}});
await api('setMyCommands',{commands:[
    {command:'start',description:'MTT SPORTS / Yaako · тестовый вход'},
  {command:'mttsports',description:'MTT SPORTS · регистрация по реферальной ссылке'},
  {command:'mttsportscheck',description:'Проверить после входа в MTT SPORTS'},
  {command:'refstatus',description:'Статус моего реферального приглашения'},
  {command:'yaako',description:'Выбор кошелька и вход Yaako'},
  {command:'wallet',description:'Мой тестовый профиль'},
  {command:'linkstatus',description:'Статус подписи и привязки'},
  {command:'approve',description:'Подтвердить адрес в Telegram'},
  {command:'recipient',description:'Выбранный получатель MTT'},
  {command:'help',description:'Помощь по тестовому контуру'}
]});
await api('setMyShortDescription',{short_description:
  'Baby MTT V2 · реферальный вход MTT SPORTS и EVM-кошелёк Yaako. Тест.'});
await api('setMyDescription',{description:
  'Baby MTT V2 · тестовая регистрация через MTT SPORTS, связка Yaako EVM, GitHub Actions и получатель MTT. Цель: 3,3 USDT TON → MTT; реальные переводы выключены.'});
const menu=await api('getChatMenuButton',{});
const commands=await api('getMyCommands',{});
const webhook=await api('getWebhookInfo',{});
if(menu.type!=='web_app'||menu.web_app?.url!==appUrl){
  throw Error('Telegram menu configuration could not be verified');
}
if(!['start','mttsports','mttsportscheck','refstatus','yaako','wallet','linkstatus','approve','recipient','help'].every(name=>commands.some(x=>x.command===name))){
  throw Error('Telegram commands were not saved');
}
console.log('BOT_MENU_VERIFIED',JSON.stringify({
  bot_id:me.id,username:me.username,
  has_main_web_app:me.has_main_web_app===true,
  menu_url:menu.web_app.url,
  commands:commands.map(x=>x.command),
  webhook_configured:Boolean(webhook.url)
}));
