import {loadChainPortfolio,NETWORKS_WALLET,explorerHistoryUrl} from './wallet-portfolio.js';
import {parseUsdt,formatWei,fetchLiveReserves,calculateQuote} from './quote.js';
import {NETWORKS,DEFAULT_AMOUNT,evaluateRoute,readWalletFragment} from './exchange-model.js';
import {normalizeAppApi,isEvmAddress,fetchTonPreview,createTonDraft}
 from './ton-flow-client.js';

const tg=window.Telegram?.WebApp;
try{
  tg?.ready(); tg?.expand();
  tg?.setHeaderColor?.('#101f4d');tg?.setBackgroundColor?.('#071023');
}catch{}
const el=id=>document.getElementById(id);
const context=readWalletFragment(window.location.hash);
const wallet=context.wallet;
const fmt=x=>x.length>26?x.slice(0,10)+'…'+x.slice(-8):x;
let pending=false;
let gateway=null;
let toastTimer=null;
let currentWalletNetwork='mtt';
let refreshSequence=0;
function toast(message){
  const box=el('toast');
  box.textContent=message;box.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>box.classList.add('hidden'),3500);
}
function tab(value){
  const current=value==='wallet'?'wallet':'swap';
  for(const item of ['wallet','swap']){
    const selected=current===item;
    el('tab-'+item).classList.toggle('selected',selected);
    el('tab-'+item).setAttribute('aria-selected',String(selected));
    el('view-'+item).classList.toggle('hidden',!selected);
  }
  if(current==='wallet'){
   void refreshPortfolio();
   void refreshBackupStatus();
   void refreshTonCompatibilityStatus();
  }
}
document.querySelectorAll('.tab').forEach(b=>
  b.addEventListener('click',()=>tab(b.dataset.tab)));
tab(context.tab);
for(const {id,label} of NETWORKS){
  if(!document.querySelector('#network option[value="'+id+'"]'))throw Error('network_missing_'+label);
}
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
 if(currentWalletNetwork==='ton')el('network').value='ton';
 else el('network').value='bsc';
 if(wallet.evm)el('evm-recipient').value=wallet.evm;
 tab('swap');refreshRoute();
 if(currentWalletNetwork==='mtt')toast('Обмен внутри MTT Network пока не запущен. Показан маршрут BSC.');
});

el('evm-recipient').value=wallet.evm||'';
// HOT Wallet compatibility: public address only. The server derives
// supported TON profiles from the encrypted seed and requires an exact match.
let compatibleTon=null;
let hotCheckRunning=false;
async function tonCompatRequest(action,params={}){
 if(!gateway||!tg?.initData)throw Error('Откройте кошелёк через GiftMutantBot в Telegram.');
 const response=await fetch(gateway+'/api/wallet/ton/compat/'+action,{
  method:'POST',headers:{'content-type':'application/json'},cache:'no-store',
  credentials:'omit',referrerPolicy:'no-referrer',
  body:JSON.stringify({initData:tg.initData,...params}),
  signal:AbortSignal.timeout(14000)
 });
 const json=await response.json();
 if(!response.ok){
  const errors={
   wallet_compat_offline:'Проверка TON временно недоступна.',
   telegram_session_expired:'Сессия Telegram устарела. Откройте кошелёк заново из бота.',
   backup_confirmation_required:'Сначала сохраните и подтвердите 12 слов.',
   ton_profile_not_reproducible:'Этот TON-адрес нельзя восстановить из сохранённой seed-фразы.'
  };
  throw Error(errors[json.error]||'Ошибка проверки TON-адреса.');
 }
 return json;
}
function showLegacyTon(original){
 const note=el('wallet-hot-previous');
 note.classList.toggle('hidden',!original);
 if(original)note.textContent='Предыдущий TON-адрес сохранён: '+original;
}
async function refreshTonCompatibilityStatus(){
 if(!gateway||!tg?.initData)return;
 try{
  const data=await tonCompatRequest('status');
  const current=data.wallet;
  if(wallet.evm&&current.evm.toLowerCase()!==wallet.evm.toLowerCase()){
   el('wallet-hot-report').textContent='Адрес EVM не совпадает с текущим Telegram-аккаунтом. Откройте кошелёк заново из бота.';
   return;
  }
  wallet.evm=current.evm;
  wallet.ton=current.ton;
  walletScreen();
  showLegacyTon(current.tonOriginal);
  if(context.tab==='wallet')void refreshPortfolio();
  if(current.tonOriginal)el('wallet-hot-report').textContent=
   'Текущий TON-адрес подтверждён. Старый адрес сохранён отдельно.';
 }catch{/* Keep previous public wallet info when the gateway is unavailable. */}
}
el('wallet-hot-ton').addEventListener('input',()=>{
 compatibleTon=null;el('wallet-hot-apply').disabled=true;
});
el('wallet-hot-verify').addEventListener('click',async()=>{
 if(hotCheckRunning)return;
 const target=el('wallet-hot-ton').value.trim();
 if(!/^(?:[EU]Q[A-Za-z0-9_-]{46}|(?:0|-1):[0-9a-fA-F]{64})$/.test(target)){
  el('wallet-hot-report').textContent='Вставьте полный публичный TON-адрес из HOT Wallet.';
  return;
 }
 hotCheckRunning=true;compatibleTon=null;
 el('wallet-hot-apply').disabled=true;
 el('wallet-hot-verify').disabled=true;
 el('wallet-hot-report').textContent='Сравниваем варианты TON-адреса…';
 try{
  const r=await tonCompatRequest('preview',{tonAddress:target});
  if(!r.matched){
   el('wallet-hot-report').textContent=
    'У поддерживаемых вариантов TON V3/V4/V5 такого адреса нет. Исходный адрес сохранён. Ключи и seed-фразу сюда не вводите.';
   return;
  }
  compatibleTon={target,profile:r.candidate.profile};
  if(r.candidate.address===r.currentTon){
   el('wallet-hot-report').textContent='Адрес уже совпадает с GiftMutant.';
   return;
  }
  el('wallet-hot-report').textContent=
   'Совпадение найдено: '+r.candidate.walletVersion.toUpperCase()+
   ', путь '+r.candidate.derivationPath+
   (r.backupConfirmed
    ?'. Можно выбрать этот TON-адрес, старый останется доступен.'
    :'. Для применения сначала подтвердите резервную фразу на странице кошелька.');
  el('wallet-hot-apply').disabled=!r.backupConfirmed;
 }catch(e){el('wallet-hot-report').textContent=e.message;}
 finally{hotCheckRunning=false;el('wallet-hot-verify').disabled=false;}
});
el('wallet-hot-apply').addEventListener('click',async()=>{
 if(!compatibleTon||hotCheckRunning)return;
 hotCheckRunning=true;el('wallet-hot-apply').disabled=true;
 try{
  const r=await tonCompatRequest('select',{
   tonAddress:compatibleTon.target,confirm:'USE_MATCHED_TON'
  });
  if(wallet.evm&&r.wallet.evm.toLowerCase()!==wallet.evm.toLowerCase())
   throw Error('После переключения EVM-адрес изменился — операция прервана.');
  wallet.ton=r.wallet.ton;
  walletScreen();
  showLegacyTon(r.wallet.tonOriginal);
  compatibleTon=null;
  el('wallet-hot-report').textContent='TON-адрес обновлён и восстановим из той же seed-фразы. EVM остался прежним.';
  void refreshPortfolio();
 }catch(e){el('wallet-hot-report').textContent=e.message;}
 finally{hotCheckRunning=false;}
});
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
   el('wallet-backup').textContent='Кошелёк подтверждён';
  }
 }catch{/* No false-positive backup confirmation on error. */}
}
async function loadTonGateway(){
  try{
    const response=await fetch('./config.json',{cache:'no-store'});
    if(response.ok)gateway=normalizeAppApi(await response.json());
  }catch{}
  refreshRoute();
  void refreshBackupStatus();
  void refreshTonCompatibilityStatus();
}
void loadTonGateway();

function openBot(){
  const url='https://t.me/GiftMutantBot?start=wallet';
  if(tg?.openTelegramLink)tg.openTelegramLink(url);
  else window.open(url,'_blank','noopener,noreferrer');
}
el('open-wallet-bot').addEventListener('click',openBot);
el('network').addEventListener('change',()=>{el('result').textContent='—';refreshRoute();});
el('input-asset').addEventListener('change',()=>{
  el('source-token-title').textContent=el('input-asset').value;
  el('result').textContent='—';
  refreshRoute();
});
el('evm-recipient').addEventListener('input',refreshRoute);
el('amount').addEventListener('input',()=>{el('result').textContent='—';refreshRoute();});
function refreshRoute(){
  const network=el('network').value;
  const token=el('input-asset').value;
  const recipient=el('evm-recipient').value.trim();
  const route=evaluateRoute({network,token,amount:el('amount').value});
  const status=el('route-state');
  el('recipient').textContent=isEvmAddress(recipient)?fmt(recipient):'Укажите корректный EVM-адрес';
  el('ton-preflight').classList.toggle('hidden',network!=='ton');
  if(!route.ok){
    status.querySelector('strong').textContent='Маршрут недоступен';
    status.querySelector('span').textContent=route.reason+' Депозит запрещён.';
  }else if(network==='ton'){
    status.querySelector('strong').textContent='TON USDT → BSC USDT → MTT · проверка';
    status.querySelector('span').textContent=route.reason;
  }else{
    status.querySelector('strong').textContent='Пилот: USDT BSC → MTT Network';
    status.querySelector('span').textContent=route.reason+
      ' Сначала требуется безопасная выдача seed-фразы и подтверждение затрат на газ.';
  }
  el('quote').disabled=!route.ok||pending;
  el('quote').textContent=route.ok
    ?(network==='ton'?'Проверить мост TON и лимиты':'Рассчитать ориентир для '+route.amount+' USDT')
    :'Выберите поддерживаемый маршрут';
  el('ton-draft').disabled=!(network==='ton'&&route.ok&&gateway&&tg?.initData&&isEvmAddress(recipient)&&!pending);
  el('pay').disabled=true;
  return route;
}
refreshRoute();
el('ton-draft').addEventListener('click',async()=>{
  const route=refreshRoute();
  if(!route.ok||route.network!=='ton'||!gateway||!tg?.initData)return;
  const r=await createTonDraft({baseUrl:gateway,amount:route.amount,
    recipient:el('evm-recipient').value.trim(),initData:tg.initData});
  el('ton-order-status').textContent=r.ok
    ?'Тестовая заявка '+r.draft.id+' сохранена. Статус: '+r.draft.status+'. Платёжный адрес НЕ выдаётся.'
    :'Заявка не сохранена: необходим рабочий авторизованный шлюз. Деньги НЕ отправлять.';
});
async function quote(){
  const route=refreshRoute();
  if(!route.ok||pending)return;
  pending=true;
  el('quote').disabled=true;
  el('quote').textContent='Читаем резерв пула…';
  const started=el('amount').value;
  const network=el('network').value;
  try{
    if(route.network==='ton'){
      const preview=await fetchTonPreview({baseUrl:gateway,
        amount:route.amount,recipient:el('evm-recipient').value.trim()});
      if(preview?.ok&&preview.bridge?.ok){
        const b=preview.bridge;
        el('ton-order-status').textContent='SideShift: мин. '+b.depositMin+
          ' USDT; макс. '+b.depositMax+' USDT. Лимит '+(b.minMet?'выполнен':'НЕ выполнен')+
          '. Исполнимой двухэтапной котировки и платёжного адреса пока нет.';
      }else{
        el('ton-order-status').textContent='Шлюз проверки TON недоступен или партнёрская авторизация отсутствует. Заказ и адрес для перевода не создаются.';
      }
      el('result').textContent='—';
      el('quote-details').textContent='Прогноз количества MTT нельзя считать без живой цены TON→BSC, комиссии моста и котировки MTT Swap. Не переводите USDT/TON.';
      return;
    }
    // This reads current on-chain MTT/USDT liquidity only. It is NOT a
    // signed or executable MTT Swap quote, nor a promise of net output.
    const reserves=await fetchLiveReserves();
    const amount=parseUsdt(route.amount);
    const indicative=calculateQuote(amount,reserves);
    if(started!==el('amount').value||network!==el('network').value)return;
    el('result').textContent=formatWei(indicative.amountOut,2);
    el('quote-details').textContent='Ориентир по резервам MTT Network, блок '+reserves.block+
      '. Не является котировкой MTT Swap. Не включены комиссии моста, сети BSC, газ и возможное проскальзывание. Реальный заказ не создан.';
    toast('Расчёт выполнен. Переводы и оплата отключены.');
  }catch{
    el('result').textContent='—';
    el('quote-details').textContent='Нет подтверждённой актуальной котировки. Не отправляйте деньги. Повторите проверку позже.';
    toast('Публичный RPC не ответил — расчёт не выполнен.');
  }finally{pending=false;refreshRoute();}
}
el('quote').addEventListener('click',()=>void quote());
// Intentional: there is no handler able to construct or broadcast a
// transaction, display a payable deposit address or collect seed/private key.
