// No key handling in Mini App. The server signs an *explicitly approved*
// single 3-USDt TON transaction using the user's encrypted local TON wallet.
export async function internalTonPaymentRequest({
 base,initData,orderId,action,confirmation,fetcher=fetch
}={}){
 if(typeof base!=='string'||!base.startsWith('https://')||
    typeof initData!=='string'||!initData||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(orderId||'')||
    !['preview','confirm','status'].includes(action))
  throw Error('invalid_internal_ton_payment_request');
 const params={initData,orderId};
 if(action==='confirm'){
  if(confirmation!=='PAY_EXACTLY_3_USDT_TON')
   throw Error('ton_payment_confirmation_required');
  params.confirmation=confirmation;
 }
 const response=await fetcher(base.replace(/\/$/,'')+'/api/giftmutant/tonpay/'+action,{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify(params),cache:'no-store',credentials:'omit',
  referrerPolicy:'no-referrer',signal:AbortSignal.timeout(19000)
 });
 const data=await response.json();
 if(!response.ok||!data.ok)throw Error(data.error||'ton_payment_temporarily_unavailable');
 return data;
}
