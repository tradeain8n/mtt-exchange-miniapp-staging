import {pilotRequest,assertPilotOrder} from './giftmutant-pilot.js';
import {internalTonPaymentRequest} from './giftmutant-tonpay-client.js';
import {mttSendRequest,validMttSendInput} from './mtt-send-client.js';
import {loadChainPortfolio,NETWORKS_WALLET} from './wallet-portfolio.js';
import {parseUsdt,formatWei,fetchLiveReserves,calculateQuote} from './quote.js';
import {readWalletFragment} from './exchange-model.js';
import {exchangeRoute,parseInput,EXCHANGE_NETWORKS} from './swap-routes.js';

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
let nativeSendEnabled=false,nativeSendBusy=false,nativeSendIntent=null;
let refreshSequence=0,toastTimer=null;
let quoteReady=false,quoteLoading=false,placingOrder=false,currentOrder=null;
let latestEstimate=null,lastQuoteAt=0;
let internalTonPayment=null,internalTonBusy=false;
let liveGiftmutantReadiness=null;
let liquidityReading=false;
let swapBalanceVersion=0,routeVersion=0,quoteDebounce=null;
let sellDraft=null,sellBusy=false;
const swapChoice=()=>exchangeRoute({
 inputToken:el('source-token').value,inputNetwork:el('network').value,
 outputNetwork:el('destination-network').value,amount:el('amount').value
});
const outputToken=()=>el('source-token').value==='MTT'?'USDT':'MTT';
function syncSwapControls({changedToken=false}={}){
 const token=el('source-token').value;
 const sell=token==='MTT';
 for(const option of el('network').options){
  option.disabled=!EXCHANGE_NETWORKS[option.value].tokens.includes(token);
 }
 if(!EXCHANGE_NETWORKS[el('network').value].tokens.includes(token))
  el('network').value=sell?'mtt':'ton';
 for(const option of el('destination-network').options)
  option.disabled=!EXCHANGE_NETWORKS[option.value].tokens.includes(outputToken());
 if(!EXCHANGE_NETWORKS[el('destination-network').value].tokens.includes(outputToken()))
  el('destination-network').value='mtt';
 if(changedToken)el('amount').value=sell?'5000':'3.00';
 el('source-amount-symbol').textContent=token;
 el('destination-amount-symbol').textContent=outputToken();
 el('destination-token-label').textContent=outputToken();
 el('swap-fee-value').textContent=sell?'0%':'10%';
 el('swap-fee-value').title=sell?'Прямой обмен: только комиссия пула и сети':'Комиссия пилотной покупки';
 el('sell-review').classList.add('hidden');
 sellDraft=null;
 updateRecipient();
 void refreshSwapBalances();
 scheduleQuote();
}
function scheduleQuote(){
 const version=++routeVersion;
 quoteReady=false;latestEstimate=null;
 el('result').textContent='—';
 if(quoteDebounce)clearTimeout(quoteDebounce);
 setAction();
 quoteDebounce=setTimeout(()=>{if(version===routeVersion)void refreshQuote()},280);
}
async function refreshSwapBalances(){
 const version=++swapBalanceVersion;
 const source=el('network').value,target=el('destination-network').value;
 const input=el('source-token').value,output=outputToken();
 el('swap-from-balance').textContent='Загрузка…';
 el('swap-to-balance').textContent='Загрузка…';
 if(!wallet.evm||!wallet.ton){
  el('swap-from-balance').textContent='—';
  el('swap-to-balance').textContent='—';return;
 }
 try{
  const entries=await Promise.all([...new Set([source,target])]
   .map(async network=>[network,await loadChainPortfolio(network,wallet)]));
  if(version!==swapBalanceVersion)return;
  const byNetwork=Object.fromEntries(entries);
  const text=(network,asset)=>{
   const value=byNetwork[network]?.assets?.find(a=>a.symbol===asset);
   return value?.state==='verified'?value.balance+' '+asset:'Нет данных';
  };
  el('swap-from-balance').textContent=text(source,input);
  el('swap-to-balance').textContent=text(target,output);
 }catch{
  if(version===swapBalanceVersion){
   el('swap-from-balance').textContent='Нет связи';
   el('swap-to-balance').textContent='Нет связи';
  }
 }
}
async function sellRequest(action,values={}){
 if(!gateway||!tg?.initData)throw Error('Откройте приложение из Telegram-бота.');
 const resp=await fetch(gateway+'/api/giftmutant/sell/'+action,{
  method:'POST',headers:{'content-type':'application/json'},cache:'no-store',
  credentials:'omit',referrerPolicy:'no-referrer',
  body:JSON.stringify({initData:tg.initData,...values}),
  signal:AbortSignal.timeout(18000)
 });
 const data=await resp.json();
 if(!resp.ok||data.ok!==true)throw Error(data.error||'mtt_sell_temporarily_unavailable');
 return data;
}
const sellReason=e=>({
 backup_confirmation_required:'Подтвердите сохранение резервной фразы в разделе кошелька.',
 sell_insufficient_mtt:'Недостаточно MTT для обмена и комиссии.',
 sell_usd_limit_0_1_to_20:'Лимит продажи: от 0,10 до 20 USDT по текущему курсу.',
 sell_pending_nonce:'Кошелёк ещё обрабатывает предыдущую транзакцию.',
 sell_already_pending:'Сначала проверьте предыдущую продажу.',
 sell_slippage_exceeded:'Цена изменилась. Запросите новую котировку.',
 sell_intent_expired:'Котировка устарела. Создайте новую заявку.',
 telegram_session_expired:'Сессия Telegram устарела. Откройте приложение заново.',
 mtt_sell_not_available:'Продажа временно недоступна на сервере.'
})[e?.message]||'Продажа пока недоступна: '+String(e?.message||e).slice(0,65);
async function prepareSell(){
 const choice=swapChoice();
 if(!choice.liveSell||!quoteReady||sellBusy)return;
 sellBusy=true;setAction();
 try{
  await getAuthenticatedWallet();
  const res=await sellRequest('prepare',{amountMtt:el('amount').value.replace(',','.')});
  sellDraft=res.sell;
  el('sell-review-summary').textContent=
   'Продать '+res.sell.amountMtt+' MTT за ориентировочно '+res.sell.expectedUsdt+
   ' USDT. Минимум к получению: '+res.sell.minimumUsdt+
   ' USDT (MTT Network). Получатель: '+fmt(res.sell.recipient)+
   '. Комиссия сервиса 0%; газ оплачивается в MTT.';
  el('sell-review-status').textContent='Проверьте сумму и нажмите подтверждение.';
  el('sell-confirm').classList.remove('hidden');
  el('sell-refresh').classList.add('hidden');
  el('sell-review').classList.remove('hidden');
 }catch(e){setFeedback(sellReason(e),true)}
 finally{sellBusy=false;setAction()}
}
async function confirmSell(){
 if(!sellDraft||sellBusy||sellDraft.state!=='prepared')return;
 sellBusy=true;el('sell-confirm').disabled=true;
 el('sell-review-status').textContent='Подписываем продажу и фиксируем транзакцию…';
 try{
  const result=await sellRequest('confirm',{intentId:sellDraft.id,
   confirmation:'SELL_MTT_FOR_USDT_MTT'});
  sellDraft=result.sell;
  renderSellStatus();
 }catch(e){
  el('sell-review-status').textContent=sellReason(e)+
   ' Проверьте статус перед повторным действием.';
  el('sell-refresh').classList.remove('hidden');
  el('sell-confirm').classList.add('hidden');
 }finally{sellBusy=false;el('sell-confirm').disabled=false;setAction()}
}
function renderSellStatus(){
 if(!sellDraft)return;
 const states={
  prepared:'Ожидает подтверждения.',
  signing:'Подготавливается подпись; не отправляйте повторно.',
  signed:'Подписана. Проверяем блокчейн…',
  broadcast:'Отправлена в MTT Network. Ожидаем подтверждения…',
  confirmed:'Продажа исполнена. USDT зачислены на ваш кошелёк MTT Network.',
  manual_review:'Нужна проверка выплаты. Не повторяйте операцию.',
  reverted:'Транзакция отклонена сетью.',expired:'Время заявки истекло.',
  failed:'Операция не выполнена.',interrupted:'Статус требует проверки.'
 };
 el('sell-review-status').textContent=states[sellDraft.state]||'Проверяем статус продажи.';
 if(sellDraft.txHash){
  const a=el('sell-review-status');
  a.textContent+=' TX: '+sellDraft.txHash.slice(0,10)+'…'+sellDraft.txHash.slice(-8);
 }
 el('sell-confirm').classList.toggle('hidden',sellDraft.state!=='prepared');
 el('sell-refresh').classList.toggle('hidden',!['signing','signed','broadcast','manual_review'].includes(sellDraft.state));
 el('sell-review').classList.remove('hidden');
 if(sellDraft.state==='confirmed')void refreshSwapBalances();
}
async function checkSellStatus(){
 if(!sellDraft||sellBusy)return;
 try{
  const r=await sellRequest('status',{intentId:sellDraft.id});
  if(r.sell)sellDraft=r.sell;
  renderSellStatus();
 }catch(e){el('sell-review-status').textContent=sellReason(e);}
}

function displayMttAmount(value){
 if(typeof value!=='string'||!/^\d+(?:\.\d+)?$/.test(value))return '—';
 const amount=Number(value);
 return Number.isFinite(amount)
  ?amount.toLocaleString('ru-RU',{maximumFractionDigits:2})+' MTT':'—';
}
async function refreshGiftmutantLiquidity(){
 if(liquidityReading||!gateway)return;
 liquidityReading=true;
 try{
  const response=await fetch(gateway+'/api/giftmutant/liquidity',{
   method:'GET',cache:'no-store',credentials:'omit',
   signal:AbortSignal.timeout(16000)
  });
  if(!response.ok)throw Error('liquidity_unavailable');
  const snapshot=await response.json();
  if(!snapshot.ok||snapshot.chainId!==6880||snapshot.network!=='MTT Network')
   throw Error('invalid_liquidity_network');
  el('liquidity-mtt-buy').textContent=displayMttAmount(snapshot.buy?.availableMtt);
  el('liquidity-mtt-sell').textContent=displayMttAmount(snapshot.sell?.availableMtt);
  el('liquidity-mtt-buy').title=snapshot.buy?.orderSupported
   ?'Средства подтверждены в MTT Network'
   :'Резерв MTT; новые заявки требуют доступного маршрута оплаты';
  el('liquidity-mtt-sell').title=snapshot.sell?.orderSupported
   ?'Обмен MTT доступен'
   :'Продажа ожидает подключение подтверждённой выплаты USDT';
 }catch{
  el('liquidity-mtt-buy').textContent='—';
  el('liquidity-mtt-sell').textContent='—';
 }finally{liquidityReading=false;}
}

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
function syncMttSendButton(){
 const btn=el('wallet-send');
 btn.disabled=!(currentWalletNetwork==='mtt'&&nativeSendEnabled&&
  gateway&&tg?.initData&&wallet.evm);
 btn.setAttribute('aria-disabled',String(btn.disabled));
 btn.title=currentWalletNetwork!=='mtt'?'Сейчас доступна отправка MTT в MTT Network':
  btn.disabled?'Подтвердите резервную фразу кошелька':'Отправить MTT';
}
function renderPortfolio(result){
  const config=NETWORKS_WALLET[currentWalletNetwork],addr=walletAddress(currentWalletNetwork);
  el('wallet-hero-address').textContent=formatWalletAddress(addr);
  el('wallet-main-symbol').textContent=config.native;
  el('wallet-copy').disabled=!addr;
  el('wallet-receive').disabled=!addr;
  el('wallet-history').disabled=!addr;
  syncMttSendButton();
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
 el('wallet-send-panel').classList.add('hidden');
 el('wallet-history-panel').classList.add('hidden');
 el('wallet-contacts-panel').classList.add('hidden');
 syncMttSendButton();
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
// Personal contacts and first-party transaction timeline (no explorer redirect).
const briefAddress=value=>value?value.slice(0,9)+'…'+value.slice(-6):'—';
function renderContacts(items){
 const list=el('wallet-contacts-list');list.replaceChildren();
 if(!items.length){
  const info=document.createElement('p');info.className='wallet-history-empty';
  info.textContent='Пока нет сохранённых адресов.';list.append(info);return;
 }
 for(const item of items){
  const row=document.createElement('div');row.className='wallet-contact-row';
  const pick=document.createElement('button');pick.type='button';pick.className='wallet-contact-pick';
  const name=document.createElement('strong');name.textContent=item.name;
  const address=document.createElement('span');address.textContent=briefAddress(item.address);
  pick.append(name,address);pick.addEventListener('click',()=>{
   el('wallet-send-to').value=item.address;
   invalidateMttSendPreview();el('wallet-contacts-panel').classList.add('hidden');
   toast('Адрес выбран');
  });
  const remove=document.createElement('button');remove.type='button';
  remove.className='wallet-contact-remove';remove.textContent='✕';
  remove.setAttribute('aria-label','Удалить '+item.name);
  remove.addEventListener('click',async()=>{
   remove.disabled=true;
   try{const data=await callMttSend('contacts/delete',{recipient:item.address});
    renderContacts(data.contacts);toast('Контакт удалён');}
   catch(error){sendText(sendError(error),true);}
   finally{remove.disabled=false;}
  });
  row.append(pick,remove);list.append(row);
 }
}
async function loadContacts(){
 const data=await callMttSend('contacts/list');
 renderContacts(data.contacts||[]);
}
el('wallet-contacts-open').addEventListener('click',async()=>{
 const panel=el('wallet-contacts-panel');
 panel.classList.toggle('hidden');
 if(!panel.classList.contains('hidden')){
  try{await loadContacts();}catch(error){sendText(sendError(error),true);}
 }
});
el('wallet-contact-save').addEventListener('click',async()=>{
 const name=el('wallet-contact-name').value.trim(),recipient=el('wallet-send-to').value.trim();
 if(!name||!validMttSendInput(recipient,'1')){
  sendText('Введите название и полный EVM-адрес.',true);return;
 }
 const btn=el('wallet-contact-save');btn.disabled=true;
 try{
  const data=await callMttSend('contacts/save',{name,recipient});
  renderContacts(data.contacts);el('wallet-contact-name').value='';
  toast('Контакт сохранён');sendText('');
 }catch(error){sendText(sendError(error),true);}
 finally{btn.disabled=false;}
});
el('wallet-send-max').addEventListener('click',async()=>{
 const recipient=el('wallet-send-to').value.trim();
 if(!validMttSendInput(recipient,'1')){
  sendText('Сначала укажите адрес получателя для расчёта комиссии.',true);return;
 }
 const btn=el('wallet-send-max');btn.disabled=true;
 sendText('Рассчитываем доступную сумму с учётом комиссии…');
 try{
  const data=await callMttSend('max',{recipient});
  el('wallet-send-amount').value=data.amountMtt;
  invalidateMttSendPreview();
  sendText('MAX рассчитан. На комиссию зарезервировано до '+data.maxFeeMtt+' MTT.');
 }catch(error){sendText(sendError(error),true);}
 finally{btn.disabled=false;}
});
function historyRow(tx){
 const row=document.createElement('div');row.className='wallet-history-row';
 const left=document.createElement('div');left.style.minWidth='0';
 const title=document.createElement('strong');
 const states={confirmed:'Подтверждено',broadcast:'Отправлено',signed:'Подписано',
  prepared:'Ожидает подтверждения',signing:'Подпись',failed:'Ошибка',
  reverted:'Отклонено',expired:'Истекло',superseded:'Заменено',
  interrupted:'Прервано',pending:'В обработке'};
 title.textContent=tx.direction==='in'?'↓ Получено':'↗ Отправлено';
 const details=document.createElement('small');
 const time=tx.at?new Date(tx.at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',
  hour:'2-digit',minute:'2-digit'}):'';
 details.textContent=time+' · '+briefAddress(tx.direction==='in'?tx.from:tx.to);
 const status=document.createElement('small');
 status.textContent=(states[tx.state]||tx.state)+(tx.hash?' · '+briefAddress(tx.hash):'');
 left.append(title,details,status);
 const right=document.createElement('div');right.className='wallet-history-amount';
 const value=document.createElement('strong');
 value.textContent=(tx.direction==='in'?'+':'−')+tx.amountMtt;
 const unit=document.createElement('span');unit.textContent='MTT';
 right.append(value,unit);row.append(left,right);
 return row;
}
async function openWalletHistory(){
 el('wallet-history-panel').classList.remove('hidden');
 el('wallet-send-panel').classList.add('hidden');
 el('wallet-receive-panel').classList.add('hidden');
 const note=el('wallet-history-note'),list=el('wallet-history-list');
 list.replaceChildren();note.textContent='Загружаем операции…';
 if(currentWalletNetwork!=='mtt'){
  note.textContent=NETWORKS_WALLET[currentWalletNetwork].name;
  const text=document.createElement('p');text.className='wallet-history-empty';
  text.textContent='Встроенная история сейчас доступна для MTT Network. Переключите сеть на MTT.';
  list.append(text);return;
 }
 try{
  const data=await callMttSend('history');
  note.textContent=data.partial?
   'MTT Network · история сети временно недоступна, показаны сохранённые операции':
   'MTT Network · входящие и исходящие MTT';
  if(!data.transactions?.length){
   const text=document.createElement('p');text.className='wallet-history-empty';
   text.textContent='Переводов пока нет.';list.append(text);
  }else for(const tx of data.transactions)list.append(historyRow(tx));
 }catch(error){
  note.textContent=sendError(error);
 }
}
el('wallet-history').addEventListener('click',()=>void openWalletHistory());
el('wallet-history-refresh').addEventListener('click',()=>void openWalletHistory());
el('wallet-history-close').addEventListener('click',()=>{
 el('wallet-history-panel').classList.add('hidden');
});
el('wallet-send-reopen').addEventListener('click',()=>{
 const url='https://t.me/GiftMutantBot?start=wallet';
 if(tg?.openTelegramLink)tg.openTelegramLink(url);
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
   nativeSendEnabled=true;syncMttSendButton();
  }
 }catch{/* No false-positive backup confirmation on error. */}
}



const sendError=e=>{
 const codes={
  secure_mtt_session_required:'Откройте кошелёк из GiftMutantBot.',
  telegram_session_expired:'Сессия Telegram устарела. Откройте бот заново.',
  backup_confirmation_required:'Сначала сохраните и подтвердите 12 слов.',
  invalid_mtt_send_input:'Проверьте адрес и сумму MTT.',
  invalid_mtt_recipient:'Неверный адрес получателя.',
  insufficient_mtt_for_gas:'Недостаточно MTT с учётом комиссии сети.',
  send_already_pending:'Предыдущий перевод ещё не завершён.',
  nonce_pending:'В сети уже ожидается другая транзакция. Дождитесь её.',
  send_intent_expired:'Время подтверждения истекло. Проверьте перевод заново.',
  send_intent_missing:'Заявка перевода не найдена.',
  gas_fee_too_high:'Комиссия сети слишком высокая. Попробуйте позже.',
  mtt_send_not_available:'Отправка MTT временно недоступна.',
  invalid_contact_name:'Введите название контакта длиной до 32 символов.',
  contact_book_full:'В адресной книге уже 30 адресов.',
  recipient_is_self:'Нельзя отправлять MTT на собственный адрес.',
  direct_treasury_transfer_requires_order:'На центральный кошелёк отправляйте через заявку обмена.'
 };
 return codes[e.message]||'Не удалось выполнить перевод: '+String(e.message||'ошибка').slice(0,90);
};
function sendText(message,failed=false){
 const target=el('wallet-send-status');target.textContent=message;
 target.classList.toggle('error',failed);
 el('wallet-send-reopen').classList.toggle('hidden',
  !String(message).includes('Сессия Telegram устарела'));
}
async function callMttSend(action,values={}){
 return mttSendRequest({base:gateway,initData:tg?.initData,action,...values});
}
function showMttSendPreview(send){
 nativeSendIntent=send;
 el('wallet-send-target').textContent=send.to;
 el('wallet-send-value').textContent=send.amountMtt+' MTT';
 el('wallet-send-fee').textContent='до '+send.maxFeeMtt+' MTT';
 el('wallet-send-preview').classList.remove('hidden');
 el('wallet-send-prepare').classList.add('hidden');
 el('wallet-send-check').classList.add('hidden');
 el('wallet-send-confirm').disabled=false;
 sendText('Проверьте адрес, сумму и комиссию перед подтверждением.');
}
function updateMttSendStatus(send){
 nativeSendIntent=send;
 const labels={
  prepared:'Перевод ждёт подтверждения.',
  signing:'Подписываем транзакцию…',
  signed:'Транзакция подписана. Проверяем сеть…',
  broadcast:'Транзакция отправлена. Ждём подтверждения…',
  confirmed:'MTT успешно отправлены!',
  reverted:'Сеть отклонила транзакцию.',
  failed:'Не удалось подписать перевод.',
  expired:'Время подтверждения истекло.',
  interrupted:'Операция прервана до отправки. Можно создать новую.'
 };
 sendText(labels[send.state]||'Проверяем перевод…',
  ['failed','reverted','expired','interrupted'].includes(send.state));
 const final=['confirmed','reverted','failed','expired','interrupted'].includes(send.state);
 el('wallet-send-preview').classList.add('hidden');
 el('wallet-send-check').classList.toggle('hidden',final);
 el('wallet-send-explorer').classList.toggle('hidden',!send.txHash);
 el('wallet-send-prepare').classList.toggle('hidden',!final);
 if(send.state==='confirmed')void refreshPortfolio();
}
async function checkMttSendStatus(){
 if(nativeSendBusy)return;
 nativeSendBusy=true;
 try{
  const data=await callMttSend('status',nativeSendIntent?
   {intentId:nativeSendIntent.id}:{});
  if(data.send){
   if(data.send.state==='prepared')showMttSendPreview(data.send);
   else updateMttSendStatus(data.send);
  }
 }catch(e){sendText(sendError(e),true);}
 finally{nativeSendBusy=false;}
}
function invalidateMttSendPreview(){
 nativeSendIntent=null;
 el('wallet-send-preview').classList.add('hidden');
 el('wallet-send-prepare').classList.remove('hidden');
 el('wallet-send-check').classList.add('hidden');
 el('wallet-send-explorer').classList.add('hidden');
 sendText('');
}
el('wallet-send').addEventListener('click',()=>{
 if(el('wallet-send').disabled)return;
 el('wallet-send-panel').classList.remove('hidden');
 el('wallet-receive-panel').classList.add('hidden');
 el('wallet-history-panel').classList.add('hidden');
 el('wallet-send-panel').scrollIntoView?.({behavior:'smooth',block:'nearest'});
 void checkMttSendStatus();
});
el('wallet-send-close').addEventListener('click',()=>{
 el('wallet-send-panel').classList.add('hidden');
});
for(const name of ['wallet-send-amount','wallet-send-to'])
 el(name).addEventListener('input',invalidateMttSendPreview);
el('wallet-send-prepare').addEventListener('click',async()=>{
 if(nativeSendBusy)return;
 const recipient=el('wallet-send-to').value.trim();
 const amount=el('wallet-send-amount').value.trim();
 if(!validMttSendInput(recipient,amount)){
  sendText('Укажите EVM-адрес и положительную сумму MTT.',true);return;
 }
 nativeSendBusy=true;el('wallet-send-prepare').disabled=true;
 sendText('Проверяем баланс и комиссию сети…');
 try{
  const data=await callMttSend('prepare',{recipient,amountMtt:amount});
  showMttSendPreview(data.send);
 }catch(e){sendText(sendError(e),true);}
 finally{nativeSendBusy=false;el('wallet-send-prepare').disabled=false;}
});
el('wallet-send-confirm').addEventListener('click',async()=>{
 if(nativeSendBusy||!nativeSendIntent||nativeSendIntent.state!=='prepared')return;
 nativeSendBusy=true;el('wallet-send-confirm').disabled=true;
 sendText('Подписываем и отправляем MTT…');
 try{
  const data=await callMttSend('confirm',{
   intentId:nativeSendIntent.id,confirm:'SEND_MTT_NOW'
  });
  updateMttSendStatus(data.send);
 }catch(e){
  sendText(sendError(e),true);
  el('wallet-send-check').classList.remove('hidden');
 }finally{nativeSendBusy=false;}
});
el('wallet-send-check').addEventListener('click',()=>void checkMttSendStatus());
el('wallet-send-explorer').addEventListener('click',()=>{
 const hash=nativeSendIntent?.txHash;
 if(!/^0x[0-9a-fA-F]{64}$/.test(hash||''))return;
 const url='https://explorer.mtt.network/tx/'+hash;
 if(tg?.openLink)tg.openLink(url);
 else window.open(url,'_blank','noopener,noreferrer');
});

function setFeedback(message,warning=false){
 const node=el('swap-message');node.textContent=message;
 node.classList.toggle('error',warning);
}
function updateRecipient(){
 const network=el('destination-network')?.value||'mtt';
 const address=network==='ton'?wallet.ton:wallet.evm;
 el('evm-recipient').value=address||'';
 el('swap-evm-target').textContent=fmt(address);
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
 void refreshSwapBalances();
 return data.wallet;
}
function showStage(stage){
 for(const item of ['swap-input-stage','swap-checkout','swap-order-stage']){
  el(item).classList.toggle('hidden',item!==stage);
 }
}
const readinessMessage={
 treasury_liquidity_replenishment:'Пополняем ликвидность MTT. Оплата временно недоступна.',
 treasury_gas_insufficient:'Обмен временно недоступен: пополняется сетевой резерв.',
 settlement_worker_offline:'Обмен временно недоступен. Сервис восстанавливается.',
 treasury_signer_not_armed:'Обмен временно недоступен. Сервис восстанавливается.',
 central_wallet_not_configured:'Обмен временно недоступен.',
 mtt_rpc_unavailable:'Не удаётся проверить баланс. Повторяем подключение.',
 manual_review_required:'Обмен временно приостановлен для проверки.'
};
async function refreshLiveReadiness(){
 if(!gateway)return;
 try{
  const resp=await fetch(gateway+'/api/giftmutant/readiness',{
   method:'GET',cache:'no-store',credentials:'omit',
   signal:AbortSignal.timeout(10000)
  });
  const data=await resp.json();
  if(!resp.ok||data.route!=='TON_USDT_TO_MTT')
   throw Error('invalid_giftmutant_readiness');
  liveGiftmutantReadiness=data;
  if(!currentOrder&&swapChoice().livePilot){
   if(!data.accepting)setFeedback(
    readinessMessage[data.reason]||'Обмен временно недоступен.',true);
   else if(quoteReady)setFeedback('Готово к обмену · 3 USD₮ TON → MTT Network');
  }
 }catch{
  liveGiftmutantReadiness={accepting:false,reason:'connection_unavailable'};
  if(!currentOrder&&swapChoice().livePilot)
   setFeedback('Нет связи с обменником. Проверяем подключение…',true);
 }
 setAction();
}
function setAction(){
 const button=el('swap-main'),choice=swapChoice();
 if(placingOrder||sellBusy){
  button.disabled=true;button.textContent='Подготавливаем обмен…';return;
 }
 if(!choice.valid){
  button.disabled=true;button.textContent='Проверьте сумму и маршрут';return;
 }
 if(choice.quoteOnly){
  button.disabled=true;button.textContent='Маршрут: только котировка';return;
 }
 const permitted=choice.liveSell||liveGiftmutantReadiness?.accepting===true;
 button.disabled=quoteLoading||!quoteReady||!permitted||!gateway||
  !tg?.initData||!wallet.evm||!wallet.ton;
 button.textContent=choice.liveSell?'Продать MTT':!permitted
  ?'Обмен временно недоступен':'Продолжить';
}
async function refreshQuote(){
 if(quoteLoading||currentOrder)return;
 const version=routeVersion,choice=swapChoice();
 if(!choice.valid){
  quoteReady=false;
  el('result').textContent='—';
  el('quote-note').textContent='Лимиты: 0,10–20 USD';
  setFeedback(choice.reason,true);setAction();return;
 }
 quoteLoading=true;setAction();
 el('quote-note').textContent='Курс обновляется';
 try{
  if(choice.kind==='sell'){
   // The server quotes the verified MTT router; no invented cross-chain rate.
   const response=await sellRequest('quote',{
    amountMtt:el('amount').value.replace(',','.')
   });
   if(version!==routeVersion)return;
   latestEstimate=response.quote;
   el('result').textContent='≈ '+Number(response.quote.expectedUsdt)
    .toLocaleString('ru-RU',{maximumFractionDigits:6});
   el('quote-note').textContent=choice.liveSell
    ?'Курс пула · минимум '+Number(response.quote.minimumUsdt)
     .toLocaleString('ru-RU',{maximumFractionDigits:6})+' USDT'
    :'Курс пула; комиссии межсетевого вывода не учтены';
  }else{
   const reserves=await fetchLiveReserves();
   const estimate=calculateQuote(parseUsdt(el('amount').value),reserves);
   if(version!==routeVersion)return;
   latestEstimate=estimate;
   el('result').textContent='≈ '+formatWei(estimate.amountOut,0);
   el('quote-note').textContent='Предварительная котировка из пула MTT';
  }
  lastQuoteAt=Date.now();quoteReady=true;
  setFeedback(choice.reason,choice.quoteOnly);
 }catch(e){
  if(version!==routeVersion)return;
  quoteReady=false;latestEstimate=null;
  el('result').textContent='—';
  el('quote-note').textContent='Нет котировки';
  const message=choice.kind==='sell'?sellReason(e):
   'Не удалось получить курс. Проверьте сумму и подключение.';
  setFeedback(message,true);
 }finally{quoteLoading=false;
  if(version!==routeVersion){setAction();scheduleQuote()}
  else setAction();
 }
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
function shortTon(value){
 return value?value.slice(0,10)+'…'+value.slice(-8):'—';
}
async function tonPay(action,params={}){
 if(!currentOrder)throw Error('ton_order_not_found');
 return internalTonPaymentRequest({base:gateway,initData:tg?.initData,
  orderId:currentOrder.id,action,...params});
}
function internalTonError(e){
 const map={
  insufficient_ton_usdt:'Недостаточно USD₮ TON для оплаты 3 USD₮.',
  insufficient_ton_gas:'Не хватает TON для сетевой комиссии. Нужно минимум 0,12 TON.',
  ton_order_expired:'Время оплаты истекло. Не переводите средства по этой заявке.',
  ton_payment_already_requested:'Оплата уже отправлялась. Проверяем подтверждение.',
  ton_order_already_processing:'Оплата уже обнаружена. Проверяем обмен.',
  ton_payment_temporarily_unavailable:'Сеть TON временно недоступна. Повторно не отправляйте.',
  backup_confirmation_required:'Сначала подтвердите сохранение резервной фразы кошелька.',
  official_ton_usdt_wallet_not_found:'На кошельке не найден официальный USD₮ TON.',
  ton_payment_confirmation_required:'Для оплаты требуется ваше подтверждение.'
 };
 return map[e.message]||'Не удалось выполнить оплату: '+
  String(e.message||'ошибка').slice(0,75);
}
async function previewInternalTonPayment(){
 if(internalTonBusy||!currentOrder||currentOrder.state!=='awaiting_ton')return;
 internalTonBusy=true;el('swap-pay').disabled=true;
 el('swap-internal-message').textContent='Проверяем баланс USD₮ TON…';
 try{
  const response=await tonPay('preview');
  if(response.payment){
   internalTonPayment=response.payment;
   renderOrder(currentOrder);return;
  }
  if(!response.ready||response.summary.amountUsdt!=='3'||
     response.summary.centralTon!==currentOrder.centralTon||
     response.summary.memo!==currentOrder.memo||
     response.summary.sourceTon!==currentOrder.sourceTon)
   throw Error('ton_order_wallet_mismatch');
  el('swap-internal-central').textContent=shortTon(currentOrder.centralTon);
  el('swap-internal-memo').textContent=currentOrder.memo;
  el('swap-internal-source').textContent=shortTon(currentOrder.sourceTon);
  el('swap-internal-message').textContent='Доступно '+response.summary.balanceUsdt+
   ' USD₮. Проверьте списание 3 USD₮ TON.';
  el('swap-internal-review').classList.remove('hidden');
  el('swap-pay').classList.add('hidden');
 }catch(e){
  el('swap-internal-message').textContent=internalTonError(e);
 }finally{internalTonBusy=false;el('swap-pay').disabled=false;}
}
async function confirmInternalTonPayment(){
 if(internalTonBusy||!currentOrder||currentOrder.state!=='awaiting_ton')return;
 internalTonBusy=true;el('swap-pay-confirm').disabled=true;
 el('swap-internal-message').textContent='Подписываем перевод в GiftMutant…';
 try{
  const response=await tonPay('confirm',{confirmation:'PAY_EXACTLY_3_USDT_TON'});
  if(!response.payment||!['signed','submitted','confirmed'].includes(response.payment.state))
   throw Error('ton_payment_temporarily_unavailable');
  internalTonPayment=response.payment;
  el('swap-internal-review').classList.add('hidden');
  renderOrder(currentOrder);
  await loadPilotStatus();
 }catch(e){
  el('swap-internal-message').textContent=internalTonError(e)+
   ' Для проверки используйте «Проверить оплату».';
  // On uncertain RPC outcomes never present another "pay" button silently.
  await checkInternalTonPayment();
 }finally{internalTonBusy=false;el('swap-pay-confirm').disabled=false;}
}
async function checkInternalTonPayment(){
 if(!currentOrder||!gateway||!tg?.initData)return;
 try{
  const response=await tonPay('status');
  if(response.payment){
   internalTonPayment=response.payment;
   if(['signed','submitted','confirmed'].includes(internalTonPayment.state))
    renderOrder(currentOrder);
  }
 }catch{/* Old non-internal orders still use regular TON deposit verification. */}
}

function renderOrder(order){
 const data=validatedOrder(order);
 currentOrder=data;
 const payStage=data.state==='awaiting_ton'&&Boolean(data.paymentUrl)&&
   Math.floor(Date.now()/1000)<data.expiresAt;
 const internalPending=internalTonPayment?.orderId===data.id&&
   ['signed','submitted','confirmed'].includes(internalTonPayment.state);
 el('swap-minimum-mtt').textContent=
  data.minimumClientMttWei&&/^\d+$/.test(data.minimumClientMttWei)
   ?'Минимум к получению: '+formatWei(BigInt(data.minimumClientMttWei),2)+' MTT'
   :'Минимальная сумма уточняется';
 el('swap-ton-recipient').textContent=data.centralTon;
 el('swap-payment-memo').textContent=data.memo;
 el('swap-evm-target').textContent=fmt(data.recipientEvm);
 if(payStage&&!internalPending){
  showStage('swap-checkout');
 }else{
  showStage('swap-order-stage');
  el('swap-order-heading').textContent=nameForState[data.state]||'Проверяем обмен';
  el('swap-order-status').textContent=internalPending&&data.state==='awaiting_ton'
   ?'Внутренний перевод подписан. Проверяем подтверждение USD₮ TON.'
   :data.state==='completed'
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
   renderOrder(response.order);
   if(response.order.state==='awaiting_ton')await checkInternalTonPayment();
   return response.order;
  }
 }catch(error){
  if(currentOrder)el('swap-order-status').textContent=pilotError(error);
 }
 return null;
}
async function createOrder(){
 if(!swapChoice().livePilot||placingOrder||!quoteReady||!gateway||
  liveGiftmutantReadiness?.accepting!==true)return;
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
  void refreshGiftmutantLiquidity();
  void refreshSwapBalances();
  try{
   const prior=await sellRequest('status');
   if(prior.sell&&['prepared','signing','signed','broadcast','manual_review'].includes(prior.sell.state)){
    sellDraft=prior.sell;renderSellStatus();
   }
  }catch{/* Sell status is optional; legacy swap remains usable. */}
  const existing=await loadPilotStatus();
  if(!existing){await refreshLiveReadiness();await refreshQuote();}
 }catch(error){
  setFeedback(String(error.message||'Сервис временно недоступен'),true);
  quoteReady=false;setAction();
 }
}
el('source-token').addEventListener('change',()=>syncSwapControls({changedToken:true}));
el('network').addEventListener('change',()=>syncSwapControls());
el('destination-network').addEventListener('change',()=>syncSwapControls());
el('swap-reverse').addEventListener('click',()=>{
 el('source-token').value=el('source-token').value==='USDT'?'MTT':'USDT';
 el('network').value=el('source-token').value==='MTT'?'mtt':'ton';
 el('destination-network').value='mtt';
 syncSwapControls({changedToken:true});
});
el('amount').addEventListener('input',()=>{
 if(sellDraft?.state==='prepared')sellDraft=null;
 el('sell-review').classList.add('hidden');
 scheduleQuote();
});
el('swap-main').addEventListener('click',async()=>{
 const route=swapChoice();
 if(!quoteReady){await refreshQuote();return}
 if(route.liveSell)await prepareSell();
 else if(route.livePilot)await createOrder();
});
el('sell-confirm').addEventListener('click',()=>void confirmSell());
el('sell-refresh').addEventListener('click',()=>void checkSellStatus());
el('sell-cancel').addEventListener('click',()=>{
 if(sellDraft&&['signed','broadcast','signing'].includes(sellDraft.state)){
  el('sell-review-status').textContent='Сделка уже отправлена. Проверяйте статус; повторно не продавайте.';
  return;
 }
 el('sell-review').classList.add('hidden');sellDraft=null;
});
el('swap-pay').addEventListener('click',()=>void previewInternalTonPayment());
el('swap-pay-confirm').addEventListener('click',()=>void confirmInternalTonPayment());
el('swap-pay-cancel').addEventListener('click',()=>{
 el('swap-internal-review').classList.add('hidden');
 el('swap-pay').classList.remove('hidden');
});
el('swap-back').addEventListener('click',()=>{
 showStage('swap-input-stage');
 setFeedback('Заявка сохранена. Для оплаты нажмите «Продолжить».');
});
el('swap-check-status').addEventListener('click',()=>void loadPilotStatus());
el('swap-pay-status').addEventListener('click',async()=>{
 await checkInternalTonPayment();
 const result=await loadPilotStatus();
 if(result?.state==='awaiting_ton')toast('Платёж пока не найден. Если уже отправили — повторите через минуту.');
});
el('swap-again').addEventListener('click',()=>{
 if(currentOrder?.state!=='completed')return;
 currentOrder=null;internalTonPayment=null;quoteReady=false;lastQuoteAt=0;
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
syncSwapControls();
void bootSwap();
window.setInterval(()=>{
 if(currentOrder&&currentOrder.state!=='completed'){
  void checkInternalTonPayment();
  void loadPilotStatus();
 }
 else if(!currentOrder)void refreshLiveReadiness();
},15000);
window.setInterval(()=>void refreshGiftmutantLiquidity(),20000);
window.setInterval(()=>{
 if(sellDraft&&['signing','signed','broadcast'].includes(sellDraft.state))
  void checkSellStatus();
},12000);
window.setInterval(()=>void refreshSwapBalances(),45000);
