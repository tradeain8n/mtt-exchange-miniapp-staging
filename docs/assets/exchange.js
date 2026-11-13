import {parseUsdt,formatWei,fetchLiveReserves,calculateQuote} from './quote.js';
import {NETWORKS,DEFAULT_AMOUNT,evaluateRoute,readWalletFragment} from './exchange-model.js';

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
function openBot(){
  const url='https://t.me/GiftMutantBot?start=wallet';
  if(tg?.openTelegramLink)tg.openTelegramLink(url);
  else window.open(url,'_blank','noopener,noreferrer');
}
el('open-wallet-bot').addEventListener('click',openBot);
el('network').addEventListener('change',()=>{el('result').textContent='—';refreshRoute();});
el('amount').addEventListener('input',()=>{el('result').textContent='—';refreshRoute();});
function refreshRoute(){
  const route=evaluateRoute({network:el('network').value,token:'USDT',amount:el('amount').value});
  const status=el('route-state');
  if(!route.ok){
    status.querySelector('strong').textContent='Маршрут недоступен';
    status.querySelector('span').textContent=route.reason+' Депозит запрещён.';
  }else{
    status.querySelector('strong').textContent='Пилот: USDT BSC → MTT Network';
    status.querySelector('span').textContent=route.reason+
      ' Сначала требуется безопасная выдача seed-фразы и подтверждение затрат на газ.';
  }
  el('quote').disabled=!route.ok||pending;
  el('quote').textContent=route.ok?'Рассчитать ориентир для '+route.amount+' USDT':'Выберите поддерживаемую сеть';
  el('pay').disabled=true;
  return route;
}
refreshRoute();
async function quote(){
  const route=refreshRoute();
  if(!route.ok||pending)return;
  pending=true;
  el('quote').disabled=true;
  el('quote').textContent='Читаем резерв пула…';
  const started=el('amount').value;
  const network=el('network').value;
  try{
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
