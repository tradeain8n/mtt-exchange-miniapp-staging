// Standalone, publicly testable MVP routing policy. No signed orders here.
export const DEFAULT_AMOUNT = '3.00';
export const PILOT = Object.freeze({network:'ton',token:'USDT',target:'MTT',targetChainId:6880});
export const NETWORKS = Object.freeze([
  {id:'bsc',label:'BNB Smart Chain · BEP-20',usable:true},
  {id:'ton',label:'TON · USD₮ Jetton',usable:true}
]);
export const TOKENS=Object.freeze(['USDT','USDC']);
export const WALLET_CHAINS=Object.freeze(['evm','ton','tron','near']);

const ADDRESS={
  evm:/^0x[0-9a-fA-F]{40}$/,
  ton:/^[EU]Q[a-zA-Z0-9_-]{46}$/,
  tron:/^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  near:/^[a-fA-F0-9]{64}$/
};

export function readWalletFragment(fragment=''){
  const params=new URLSearchParams(String(fragment).replace(/^#/,''));
  const wallet=Object.fromEntries(WALLET_CHAINS.map(k=>[k,ADDRESS[k].test(params.get(k)||'')?params.get(k):null]));
  return {tab:params.get('tab')==='wallet'?'wallet':'swap',wallet};
}
export function buildWalletFragment(wallet,tab='wallet'){
  const params=new URLSearchParams({tab:tab==='swap'?'swap':'wallet'});
  for(const kind of WALLET_CHAINS)if(wallet?.[kind]){
    if(!ADDRESS[kind].test(wallet[kind]))throw Error('invalid_wallet_'+kind);
    params.set(kind,wallet[kind]);
  }
  return '#'+params.toString();
}
export function evaluateRoute({network,token,amount}){
  const a=String(amount||'').replace(',','.').trim();
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(a))return {ok:false,reason:'Укажите сумму цифрами.'};
  const amountNum=Number(a);
  if(!Number.isFinite(amountNum)||amountNum<=0)return {ok:false,reason:'Сумма должна быть положительной.'};
  if(network==='ton'&&token==='USDT'){
    if(amountNum!==3)return {ok:false,network:'ton',reason:'Для первого реального теста доступен обмен ровно 3 USD₮ TON.'};
    return {ok:true,network:'ton',token:'USDT',amount:a,
      recipientNetwork:'MTT Network',destinationChainId:6880,
      recipientPolicy:'same_evm_address',
      quoteSource:'treasury_mtt_swap_quote',minReference:'3',
      liveQuote:false,canDeposit:false,canExecute:false,previewOnly:true,
      reason:'Оплата 3 USD₮ в TON → покупка MTT из резерва 3 USDT в MTT Network → выплата на привязанный EVM. Заказ и оплата доступны только через подтверждённый сервер.'};
  }
  if(network!=='bsc'||token!=='USDT')return {
    ok:false,reason:'Для первого пилота подтверждён только маршрут USDT в BNB Smart Chain (BEP-20). Не переводите средства из другой сети.'
  };
  if(amountNum<1||amountNum>20)return {
    ok:false,reason:'Первый тестовый маршрут рассчитан на сумму от 1 до 20 USDT.'
  };
  return {
    ok:true,amount:a,network:'bsc',token:'USDT',
    destinationNetwork:'MTT Network',destinationChainId:6880,
    recipientPolicy:'same_evm_address',
    quoteSource:'mt_network_pool_reserves_indicative_only',
    liveQuote:false,canDeposit:false,canExecute:false,
    reason:'Маршрут исследован, но зачисления отключены до безопасного резервного копирования и подтверждения комиссий.'
  };
}
