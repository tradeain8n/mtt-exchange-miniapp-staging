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
  type:'web_app',text:'Baby MTT · ЯАКО TEST',web_app:{url:appUrl}
}});
await api('setMyCommands',{commands:[
  {command:'start',description:'Регистрация Yaako и привязка EVM · TEST'},
  {command:'yaako',description:'Выбор кошелька и вход Yaako'},
  {command:'wallet',description:'Мой тестовый профиль'},
  {command:'linkstatus',description:'Статус подписи и привязки'},
  {command:'approve',description:'Подтвердить адрес в Telegram'},
  {command:'recipient',description:'Выбранный получатель MTT'},
  {command:'help',description:'Помощь по тестовому контуру'}
]});
await api('setMyShortDescription',{short_description:
  'Baby MTT V2 · тестовый вход Yaako и подтверждение EVM-адреса. Без платежей.'});
await api('setMyDescription',{description:
  'Baby MTT Exchange V2 · тестовый контур: Telegram-вход, Yaako, одноразовая EIP-191 подпись и выбор получателя MTT. В этом контуре реальные переводы и обмены выключены.'});
const menu=await api('getChatMenuButton',{});
const commands=await api('getMyCommands',{});
const webhook=await api('getWebhookInfo',{});
if(menu.type!=='web_app'||menu.web_app?.url!==appUrl){
  throw Error('Telegram menu configuration could not be verified');
}
if(!['start','yaako','wallet','linkstatus','approve','recipient','help'].every(name=>commands.some(x=>x.command===name))){
  throw Error('Telegram commands were not saved');
}
console.log('BOT_MENU_VERIFIED',JSON.stringify({
  bot_id:me.id,username:me.username,
  menu_url:menu.web_app.url,
  commands:commands.map(x=>x.command),
  webhook_configured:Boolean(webhook.url)
}));
