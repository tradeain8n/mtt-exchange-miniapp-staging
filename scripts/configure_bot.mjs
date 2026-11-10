const token=process.env.TELEGRAM_BOT_TOKEN;
const appUrl=process.env.MINIAPP_URL||'https://tradeain8n.github.io/mtt-exchange-miniapp/';
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
  type:'web_app',text:'GiftMutant · Тесты',web_app:{url:appUrl}
}});
await api('setMyCommands',{commands:[
  {command:'start',description:'Открыть GiftMutant · STAGING'},
  {command:'help',description:'Статус и условия обмена'}
]});
await api('setMyShortDescription',{short_description:
  'GiftMutant · STAGING — обмен USDT (BSC) на MTT Network, курс и статус переводов.'});
await api('setMyDescription',{description:
  'GiftMutant · STAGING: калькулятор по ликвидности пула, прозрачный операционный статус и проверка транзакций USDT BSC → MTT Network. Приём активируется только после готовности платёжного процессора.'});
const menu=await api('getChatMenuButton',{});
const commands=await api('getMyCommands',{});
const webhook=await api('getWebhookInfo',{});
if(menu.type!=='web_app'||menu.web_app?.url!==appUrl){
  throw Error('Telegram menu configuration could not be verified');
}
if(!commands.some(x=>x.command==='start')||!commands.some(x=>x.command==='help')){
  throw Error('Telegram commands were not saved');
}
console.log('BOT_MENU_VERIFIED',JSON.stringify({
  bot_id:me.id,username:me.username,
  menu_url:menu.web_app.url,
  commands:commands.map(x=>x.command),
  webhook_configured:Boolean(webhook.url)
}));
