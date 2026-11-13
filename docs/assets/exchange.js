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
}
document.querySelectorAll('.tab').forEach(b=>
  b.addEventListener('click',()=>tab(b.dataset.tab)));
tab(context.tab);
for(const {id,label} of NETWORKS){
  if(!document.querySelector('#network option[value="'+id+'"]'))throw Error('network_missing_'+label);
}
function walletScreen(){
  el('wallet-hero-address').textContent=wallet.evm?fmt(wallet.evm):'Не привязан в этом окне';
  el('recipient').textContent=wallet.evm?fmt(wallet.evm):'Откройте личный кошелёк';
  for(const kind of ['evm','ton','tron','near']){
    el('wallet-'+kind).textContent=wallet[kind]||'Не подключён';
    const copy=document.querySelector('[data-copy="'+kind+'"]');
    copy.disabled=!wallet[kind];
    copy.addEventListener('click',async()=>{
      if(!wallet[kind])return;
      try{
        await navigator.clipboard.writeText(wallet[kind]);
        toast('Публичный адрес скопирован. Не отправляйте на него деньги до разблокировки депозитов.');
      }catch{toast('Буфер обмена недоступен: адрес можно выделить вручную.');}
    });
  }
  if(wallet.evm){
    el('wallet-link-status').querySelector('strong').textContent='Адреса из личного сообщения бота';
    el('wallet-link-status').querySelector('span').textContent=
      'Публичные адреса получены из вашей кнопки «Мой кошелёк». Получение средств заблокировано до резервного копирования и проверки владения.';
  }
}
walletScreen();
el('evm-recipient').value=wallet.evm||'';
async function loadTonGateway(){
  try{
    const response=await fetch('./config.json',{cache:'no-store'});
    if(response.ok)gateway=normalizeAppApi(await response.json());
  }catch{}
  refreshRoute();
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
