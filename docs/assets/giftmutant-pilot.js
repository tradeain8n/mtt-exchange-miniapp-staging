import {USDT_TON_MASTER} from './ton-flow-client.js';
// Pilot checkout: Telegram-signed backend only. Never touches private keys.
const endpoint=(base,path)=>base.replace(/\/$/,'')+'/api/giftmutant/pilot/'+path;
export async function pilotRequest({base,initData,action,recipientEvm,fetcher=fetch}){
 if(!base||!/^https:\/\//.test(base)||!initData||!['create','status'].includes(action))
  throw Error('secure_pilot_connection_required');
 const response=await fetcher(endpoint(base,action),{
  method:'POST',headers:{'content-type':'application/json'},
  cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
  body:JSON.stringify({initData,...(action==='create'?{
   amountUsdt:'3',recipientEvm
  }:{})}),signal:AbortSignal.timeout(16000)
 });
 const value=await response.json();
 if(!response.ok)throw Error(value.error||'pilot_order_unavailable');
 return value;
}
export function assertPilotOrder(order,clientEvm,clientTon){
 if(!order||order.amountUsdt!=='3'||order.recipientEvm?.toLowerCase()
   !==clientEvm?.toLowerCase()||order.sourceTon!==clientTon)
  throw Error('unrecognized_pilot_order');
 if(order.paymentUrl){
  let invoice;
  try{invoice=new URL(order.paymentUrl);}
  catch{throw Error('untrusted_ton_payment_link');}
  if(invoice.protocol!=='ton:'||invoice.hostname!=='transfer'||
    decodeURIComponent(invoice.pathname.slice(1))!==order.centralTon||
    invoice.searchParams.get('jetton')!==USDT_TON_MASTER||
    invoice.searchParams.get('amount')!=='3000000'||
    invoice.searchParams.get('text')!==order.memo||
    !/^GFT-[a-f0-9]{16}$/.test(order.memo||''))
    throw Error('untrusted_ton_payment_link');
 }
 return order;
}
