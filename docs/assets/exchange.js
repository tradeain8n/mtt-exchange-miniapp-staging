import {pilotRequest,assertPilotOrder} from './giftmutant-pilot.js';
import {loadChainPortfolio,NETWORKS_WALLET,explorerHistoryUrl} from './wallet-portfolio.js';
import {parseUsdt,formatWei,fetchLiveReserves,calculateQuote} from './quote.js';
import {readWalletFragment} from './exchange-model.js';

const tg=window.Telegram?.WebApp;
try{
 tg?.ready();tg?.expand();tg?.setHeaderColor?.('#111b35');
 tg?.setBackgroundColor?.('#0a1224');
}catch{}
const el=id=>document.getElementById(id);
const context=readWalletFragment(window.location.hash);
const wallet={...context.wallet};
const fmt=value=>value&&value.length>26?value.slice(0,9)+'…'+value.slice(-7):(value||'—');
let gateway=null;
let currentWalletNetwork='mtt';
let refreshSequence=0,toastTimer=null;
let quoteReady=false,quoteLoading=false,placingOrder=false,currentOrder=null;
let latestEstimate=null,lastQuoteAt=0;
const nameForState={
 awaiting_ton:'Ожидаем оплату',ton_confirmed:'Оплата получена',
 approval_pending:'Подготавливаем обмен',approved:'Обмениваем USDT',
 swap_pending:'Покупаем MTT',swap_confirmed:'MTT куплены',
 payout_pending:'Отправляем MTT',completed:'Готово! MTT отправлены',
 manual_review:'Обмен требует проверки'
};
function toast(message){
 const box=el('toast');box.textContent=message;box.classList.remove('hidden');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.add('hidden'),3500);
}
function tab(value){
 const current=value==='wallet'?'wallet':'swap';
 for(const key of ['wallet','swap']){
  const selected=current===key;
  el('tab-'+key).classList.toggle('selected',selected);
  el('tab-'+key).setAttribute('aria-selected',String(selected));
  el('view-'+key).classList.toggle('hidden',!selected);
 }
 if(current==='wallet'){void refreshPortfolio();void refreshBackupStatus();}
}
document.querySelectorAll('.tab').forEach(button=>
 button.addEventListener('click',()=>tab(button.dataset.tab)));
tab(context.tab);

function walletScreen(){
  el('wallet-evm').textContent=wallet.evm||'Адрес не создан';
  el('wallet-ton').textContent=wallet.ton||'Адрес не создан';
  if(wallet.evm&&wallet.ton){
    el('wallet-link-status').querySelector('strong').textContent='Личный кошелёк';
    el('wallet-link-status').querySelector('span').textContent=
      'Публичные адреса получены через кнопку GiftMutantBot. Балансы проверяются в сетях отдельно.';
  }
}
walletScreen();
const formatWalletAddress=address=>address?fmt(address):'Адрес не создан';
const walletAddress=network=>wallet[NETWORKS_WALLET[network].addressType];
const walletButtons=[...document.querySelectorAll('[data-wallet-network]')];
function renderPortfolio(result){
  const config=NETWORKS_WALLET[currentWalletNetwork],addr=walletAddress(currentWalletNetwork);
  el('wallet-hero-address').textContent=formatWalletAddress(addr);
  el('wallet-main-symbol').textContent=config.native;
  el('wallet-copy').disabled=!addr;
  el('wallet-receive').disabled=!addr;
  el('wallet-history').disabled=!addr;
  el('wallet-network-state').textContent=result?.state==='wallet_missing'
    ?'Не подключён':result?.state==='unavailable'?'Источник недоступен':'Данные блокчейна';
  const native=result?.assets?.[0];
  el('wallet-main-balance').textContent=native?.state==='verified'?native.balance:'—';
  el('wallet-updated').textContent=result?.observedAt
    ?'Обновлено '+new Date(result.observedAt).toLocaleTimeString('ru-RU'):'Нет данных';
  const assets=el('wallet-assets');assets.replaceChildren();
  for(const asset of result?.assets||[]){
    const row=document.createElement('div');row.className='wallet-asset';
    const icon=document.createElement('div');icon.className='wallet-asset-icon';
    icon.textContent=asset.symbol==='USDT'?'₮':asset.symbol==='BNB'?'◈':asset.symbol==='TON'?'◆':'M';
    const meta=document.createElement('div');meta.className='wallet-asset-meta';
    const name=document.createElement('strong');name.textContent=asset.symbol;
    const chain=document.createElement('span');chain.textContent=config.name;
    meta.append(name,chain);
    const number=document.createElement('div');number.className='wallet-asset-balance';
    number.textContent=asset.state==='verified'?asset.balance:'—';
    row.append(icon,meta,number);assets.append(row);
  }
  if(!addr){
    const row=document.createElement('p');row.className='helper';
    row.textContent='Откройте /start в GiftMutantBot, затем кнопку «Мой кошелёк».';
    assets.append(row);
  }
}
async function refreshPortfolio(){
  const seq=++refreshSequence,network=currentWalletNetwork;
  const config=NETWORKS_WALLET[network];
  el('wallet-network-state').textContent='Обновление...';
  el('wallet-main-balance').textContent='—';
  const result=await loadChainPortfolio(network,wallet).catch(()=>({
    network,state:'unavailable',
    assets:[{symbol:config.native,state:'unavailable'},{symbol:'USDT',state:'unavailable'}]
  }));
  if(seq!==refreshSequence||network!==currentWalletNetwork)return;
  renderPortfolio(result);
}
walletButtons.forEach(button=>button.addEventListener('click',()=>{
 currentWalletNetwork=button.dataset.walletNetwork;
 walletButtons.forEach(item=>{
  const selected=item===button;item.classList.toggle('active',selected);
  item.setAttribute('aria-pressed',String(selected));
 });
 el('wallet-receive-panel').classList.add('hidden');
 void refreshPortfolio();
}));
el('wallet-refresh').addEventListener('click',()=>void refreshPortfolio());
async function copyCurrentAddress(){
 const addr=walletAddress(currentWalletNetwork);
 if(!addr)return;
 try{await navigator.clipboard.writeText(addr);toast('Публичный адрес скопирован');}
 catch{toast('Адрес доступен для ручного копирования');}
}
el('wallet-copy').addEventListener('click',()=>void copyCurrentAddress());
el('wallet-receive').addEventListener('click',()=>{
 const addr=walletAddress(currentWalletNetwork);
 if(!addr)return;
 el('wallet-receive-panel').classList.remove('hidden');
 el('wallet-receive-address').textContent=addr;
 el('wallet-receive-network').textContent=NETWORKS_WALLET[currentWalletNetwork].name;
});
el('wallet-receive-copy').addEventListener('click',()=>void copyCurrentAddress());
el('wallet-history').addEventListener('click',()=>{
 const addr=walletAddress(currentWalletNetwork);
 if(!addr)return;
 const url=explorerHistoryUrl(currentWalletNetwork,addr);
 if(tg?.openLink)tg.openLink(url);
 else window.open(url,'_blank','noopener,noreferrer');
});
el('wallet-swap').addEventListener('click',()=>{
 el('network').value='ton';
 if(wallet.evm)el('evm-recipient').value=wallet.evm;
 tab('swap');void refreshQuote();

});

el('evm-recipient').value=wallet.evm||'';
async function refreshBackupStatus(){
 if(!gateway||!tg?.initData)return;
 try{
  const response=await fetch(gateway+'/api/wallet/backup/status',{
   method:'POST',headers:{'content-type':'application/json'},
   cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
   body:JSON.stringify({initData:tg.initData}),
   signal:AbortSignal.timeout(9000)
  });
  if(!response.ok)return;
  const result=await response.json();
  if(result.backupStatus==='confirmed'){
   const panel=el('wallet-backup-notice');
   panel.querySelector('strong').textContent='Резервная фраза подтверждена';
   panel.querySelector('span').textContent=
    'Вы успешно проверили сохранённые слова. Реальные депозиты и переводы ещё не включены.';
   el('wallet-backup').classList.add('hidden');
   panel.classList.add('hidden');
  }
 }catch{/* No false-positive backup confirmation on error. */}
}


function setFeedback(message,warning=false){
 const node=el('swap-message');node.textContent=message;
 node.classList.toggle('error',warning);
}
function updateRecipient(){
 el('evm-recipient').value=wallet.evm||'';
 el('swap-evm-target').textContent=fmt(wallet.evm);
}
async function getAuthenticatedWallet(){
 if(!gateway||!tg?.initData)throw Error('Откройте GiftMutant через кнопку Telegram-бота.');
 const res=await fetch(gateway+'/api/wallet/ton/compat/status',{
  method:'POST',headers:{'content-type':'application/json'},cache:'no-store',
  credentials:'omit',referrerPolicy:'no-referrer',
  body:JSON.stringify({initData:tg.initData}),
  signal:AbortSignal.timeout(12000)
 });
 const data=await res.json();
 if(!res.ok||!data.wallet?.evm||!data.wallet?.ton)
  throw Error(res.status===401?'Сессия устарела. Откройте Mini App через бот заново.':
    'Личный кошелёк не найден. Откройте «Мой кошелёк» в боте.');
 wallet.evm=data.wallet.evm;wallet.ton=data.wallet.ton;
 walletScreen();updateRecipient();
 return data.wallet;
}
function showStage(stage){
 for(const item of ['swap-input-stage','swap-checkout','swap-order-stage']){
  el(item).classList.toggle('hidden',item!==stage);
 }
}
function setAction(){
 const button=el('swap-main');
 if(placingOrder){button.disabled=true;button.textContent='Создаём заявку…';return;}
 button.disabled=quoteLoading||!gateway||!tg?.initData||!wallet.evm||!wallet.ton;
 button.textContent=quoteReady?'Продолжить':'Обновить курс';
}
async function refreshQuote(){
 if(quoteLoading||currentOrder)return;
 quoteLoading=true;setAction();
 el('quote-note').textContent='Курс обновляется';
 try{
  const reserves=await fetchLiveReserves();
  const estimate=calculateQuote(parseUsdt('3.00'),reserves);
  latestEstimate=estimate;lastQuoteAt=Date.now();quoteReady=true;
  el('result').textContent='≈ '+formatWei(estimate.amountOut,0);
  el('quote-note').textContent='Курс предварительный';
  setFeedback(wallet.evm&&wallet.ton
   ?'MTT поступят на ваш привязанный кошелёк'
   :'Подключаем личный кошелёк…');
 }catch{
  quoteReady=false;latestEstimate=null;
  el('result').textContent='—';
  el('quote-note').textContent='Нет котировки';
  setFeedback('Не удалось получить курс. Нажмите «Обновить курс».',true);
 }finally{quoteLoading=false;setAction();}
}
const pilotError=error=>{
 const map={
 treasury_signer_not_armed:'Сервис выплат пока не готов. Оплату не отправляйте.',
 settlement_worker_offline:'Обмен временно недоступен. Оплату не отправляйте.',
 treasury_inventory_insufficient:'Недостаточно ликвидности. Попробуйте позже.',
 wallet_backup_not_confirmed:'Сначала подтвердите сохранение кошелька.',
 unsupported_amount_or_recipient:'Недоступный получатель. Откройте приложение из бота.',
 telegram_session_expired:'Сессия Telegram истекла. Откройте приложение заново.',
 pilot_daily_usdt_limit_exceeded:'Лимит обменов на сегодня исчерпан.',
 secure_pilot_connection_required:'Не удалось проверить Telegram-подключение.'
 };
 return map[error.message]||'Не удалось выполнить действие. '+String(error.message||'').slice(0,90);
};
function validatedOrder(value){
 return assertPilotOrder(value,wallet.evm,wallet.ton);
}
function linkForWallet(order){
 if(!order?.paymentUrl)return null;
 // TON's documented jetton deep link also supports the HTTPS Tonkeeper format.
 const link=order.paymentUrl.replace(/^ton:\/\/transfer\//,'https://app.tonkeeper.com/transfer/');
 const target=new URL(link);
 if(target.protocol!=='https:'||target.hostname!=='app.tonkeeper.com'||
    !target.pathname.startsWith('/transfer/')||
    target.searchParams.get('amount')!=='3000000'||
    !target.searchParams.get('jetton')||
    target.searchParams.get('text')!==order.memo)
  throw Error('Неверные реквизиты оплаты');
 return target.href;
}
function renderOrder(order){
 const data=validatedOrder(order);
 currentOrder=data;
 const payStage=data.state==='awaiting_ton'&&Boolean(data.paymentUrl)&&
   Math.floor(Date.now()/1000)<data.expiresAt;
 el('swap-ton-recipient').textContent=data.centralTon;
 el('swap-payment-memo').textContent=data.memo;
 el('swap-evm-target').textContent=fmt(data.recipientEvm);
 if(payStage){
  showStage('swap-checkout');
 }else{
  showStage('swap-order-stage');
  el('swap-order-heading').textContent=nameForState[data.state]||'Проверяем обмен';
  el('swap-order-status').textContent=data.state==='completed'
   ?'MTT перечислены на ваш личный EVM-адрес.'
   :data.state==='awaiting_ton'
    ?'Время заявки истекло. Не переводите деньги по старым реквизитам.'
    :data.state==='manual_review'
     ?'Требуется проверка. Повторно USD₮ не отправляйте.'
     :'Проверяем транзакции в блокчейне.';
  el('swap-again').classList.toggle('hidden',data.state!=='completed');
  el('swap-order-id').textContent='Заявка № '+data.id.slice(0,8);
  el('swap-order-output').textContent=data.payoutMttWei
   ?'Получено '+formatWei(BigInt(data.payoutMttWei),2)+' MTT':'';
  el('swap-show-payment').classList.toggle('hidden',
    !(data.state==='awaiting_ton'&&payStage));
 }
 return data;
}
async function loadPilotStatus(){
 if(!gateway||!tg?.initData||!wallet.evm||!wallet.ton)return;
 try{
  const response=await pilotRequest({base:gateway,initData:tg.initData,action:'status'});
  if(response.order){
   renderOrder(response.order);return response.order;
  }
 }catch(error){
  if(currentOrder)el('swap-order-status').textContent=pilotError(error);
 }
 return null;
}
async function createOrder(){
 if(placingOrder||!quoteReady||!gateway)return;
 placingOrder=true;setAction();
 try{
  await getAuthenticatedWallet(); // never trust a fragment-only address
  if(Date.now()-lastQuoteAt>60000)await refreshQuote();
  const res=await pilotRequest({base:gateway,initData:tg.initData,
   action:'create',recipientEvm:wallet.evm});
  const order=renderOrder(res.order);
  if(res.indicativeClientMtt){
   el('result').textContent='≈ '+Number(res.indicativeClientMtt)
    .toLocaleString('ru-RU',{maximumFractionDigits:0});
  }
  if(order.state==='awaiting_ton'&&!order.paymentUrl)
   setFeedback('Срок оплаты заявки истёк. Не переводите средства.',true);
 }catch(error){
  setFeedback(pilotError(error),true);
 }finally{placingOrder=false;setAction();}
}
async function openTonPayment(){
 if(!currentOrder||currentOrder.state!=='awaiting_ton')return;
 try{
  const url=linkForWallet(currentOrder);
  if(!url)throw Error('Срок оплаты истёк. Не отправляйте деньги.');
  // User action opens an external TON wallet to authorize the actual payment.
  if(tg?.openLink)tg.openLink(url);
  else window.open(url,'_blank','noopener,noreferrer');
 }catch(error){toast(String(error.message||'Не удалось открыть TON-кошелёк'));}
}
async function copyText(value,label){
 if(!value)return;
 try{await navigator.clipboard.writeText(value);toast(label+' скопирован');}
 catch{toast('Скопируйте значение вручную');}
}
async function bootSwap(){
 const status=el('swap-message');
 try{
  const cfg=await fetch('./config.json',{cache:'no-store'});
  if(!cfg.ok)throw Error('Не удалось подключить сервер обмена');
  const json=await cfg.json();
  gateway=typeof json.apiBaseUrl==='string'&&
   /^https:\/\/[A-Za-z0-9.-]+/.test(json.apiBaseUrl)
   ?json.apiBaseUrl.replace(/\/$/,''):null;
  if(!gateway)throw Error('Сервис временно недоступен');
  await getAuthenticatedWallet();
  void refreshBackupStatus();
  const existing=await loadPilotStatus();
  if(!existing)await refreshQuote();
 }catch(error){
  setFeedback(String(error.message||'Сервис временно недоступен'),true);
  quoteReady=false;setAction();
 }
}
el('swap-main').addEventListener('click',async()=>{
 if(!quoteReady)await refreshQuote();
 else await createOrder();
});
el('swap-pay').addEventListener('click',()=>void openTonPayment());
el('swap-back').addEventListener('click',()=>{
 showStage('swap-input-stage');
 setFeedback('Заявка сохранена. Для оплаты нажмите «Продолжить».');
});
el('swap-check-status').addEventListener('click',()=>void loadPilotStatus());
el('swap-pay-status').addEventListener('click',async()=>{
 const result=await loadPilotStatus();
 if(result?.state==='awaiting_ton')toast('Платёж пока не найден. Если уже отправили — повторите через минуту.');
});
el('swap-again').addEventListener('click',()=>{
 if(currentOrder?.state!=='completed')return;
 currentOrder=null;quoteReady=false;lastQuoteAt=0;
 showStage('swap-input-stage');void refreshQuote();
});
el('swap-show-payment').addEventListener('click',()=>renderOrder(currentOrder));
el('swap-copy-ton').addEventListener('click',()=>copyText(
 currentOrder?.centralTon,'Адрес'));
el('swap-copy-memo').addEventListener('click',()=>copyText(
 currentOrder?.memo,'Комментарий'));
const openBot=()=>{
 const url='https://t.me/GiftMutantBot?start=wallet';
 if(tg?.openTelegramLink)tg.openTelegramLink(url);
 else window.open(url,'_blank','noopener,noreferrer');
};
el('open-wallet-bot').addEventListener('click',openBot);
updateRecipient();
void bootSwap();
window.setInterval(()=>{
 if(currentOrder&&currentOrder.state!=='completed')void loadPilotStatus();
},15000);
