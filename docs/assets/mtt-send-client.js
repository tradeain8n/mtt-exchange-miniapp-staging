// Sends only public intent fields. Signing happens on the TV Box after
// a second explicit user confirmation in the authenticated Telegram Mini App.
export function validMttSendInput(recipient,amount){
 return /^0x[0-9a-fA-F]{40}$/.test(String(recipient||''))&&
  /^(?:0|[1-9]\d*)(?:[.,]\d{1,18})?$/.test(String(amount||''))&&
  Number(String(amount).replace(',','.'))>0;
}
export async function mttSendRequest({
 base,initData,action,recipient,amountMtt,intentId,confirm,name,fetcher=fetch
}={}){
 if(typeof base!=='string'||!/^https:\/\//.test(base)||
  typeof initData!=='string'||!initData||
  !['prepare','confirm','status','max','history',
   'contacts/list','contacts/save','contacts/delete'].includes(action))
  throw Error('secure_mtt_session_required');
 const params={initData};
 if(action==='prepare'){
  if(!validMttSendInput(recipient,amountMtt))throw Error('invalid_mtt_send_input');
  params.recipient=recipient;
  params.amountMtt=String(amountMtt).replace(',','.');
 }else if(action==='confirm'){
  if(typeof intentId!=='string'||confirm!=='SEND_MTT_NOW')
   throw Error('confirmation_required');
  params.intentId=intentId;params.confirm=confirm;
 }else if(action==='max'||action==='contacts/save'||action==='contacts/delete'){
  if(!/^0x[0-9a-fA-F]{40}$/.test(recipient||''))throw Error('invalid_mtt_recipient');
  params.recipient=recipient;
  if(action==='contacts/save')params.name=name;
 }else if(intentId)params.intentId=intentId;
 const response=await fetcher(base.replace(/\/$/,'')+'/api/wallet/mtt-send/'+action,{
  method:'POST',headers:{'content-type':'application/json'},cache:'no-store',
  credentials:'omit',referrerPolicy:'no-referrer',
  body:JSON.stringify(params),signal:AbortSignal.timeout(18000)
 });
 const data=await response.json();
 if(!response.ok||!data.ok)throw Error(data.error||'mtt_send_service_unavailable');
 return data;
}
