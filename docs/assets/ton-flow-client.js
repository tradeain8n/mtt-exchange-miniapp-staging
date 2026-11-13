// TON USDT -> (candidate bridge) -> BSC USDT -> MTT Network.
 // No front-end side signer, bank account, hot-key or payable address.
export const USDT_TON_MASTER='EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
export const isEvmAddress=a=>/^0x[a-fA-F0-9]{40}$/.test(String(a||''));
export const normalizeAppApi=config=>{
  if(!config||typeof config.apiBaseUrl!=='string'||!config.apiBaseUrl)
    return null;
  let url;
  try{url=new URL(config.apiBaseUrl);}
  catch{return null;}
  // Prevent keys, initData or order payloads going to arbitrary host.
  if(url.protocol!=='https:'||url.hostname==='tradeain8n.github.io'||url.username||url.password)
    return null;
  return url.origin+url.pathname.replace(/\/$/,'');
};
export async function fetchTonPreview({baseUrl,amount,recipient,fetcher=fetch}){
  if(!baseUrl)return {ok:false,reason:'quote_gateway_not_configured',depositEnabled:false};
  if(!isEvmAddress(recipient))return {ok:false,reason:'invalid_evm_recipient',depositEnabled:false};
  const base=new URL(baseUrl);
  const url=new URL(base.origin+base.pathname.replace(/\/$/,'')+'/api/ton/route');
  url.search=new URLSearchParams({asset:'USDT',amount,recipient});
  try{
    const res=await fetcher(url.toString(),{cache:'no-store',
      signal:AbortSignal.timeout(12000)});
    if(!res.ok)return {ok:false,reason:'quote_gateway_unavailable',depositEnabled:false};
    const value=await res.json();
    if(value?.depositEnabled||value?.settlementEnabled||value?.depositAddress)
      throw Error('staging_payment_response_forbidden');
    return value;
  }catch{
    return {ok:false,reason:'quote_gateway_unavailable',depositEnabled:false};
  }
}
export async function createTonDraft({baseUrl,amount,recipient,initData,fetcher=fetch}){
  if(!baseUrl||!initData||!isEvmAddress(recipient))
    return {ok:false,reason:'authenticated_gateway_required',depositEnabled:false};
  const url=new URL(baseUrl.replace(/\/$/,'')+'/api/ton/draft');
  try{
    const response=await fetcher(url.toString(),{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({asset:'USDT',amount,recipient,initData}),
      signal:AbortSignal.timeout(12000)
    });
    const json=await response.json();
    if(!response.ok||!json.ok)return {ok:false,reason:'draft_rejected',depositEnabled:false};
    if(json.depositEnabled||json.draft?.depositAddress||json.draft?.depositEnabled)
      throw Error('staging_payment_response_forbidden');
    return json;
  }catch{return {ok:false,reason:'draft_gateway_unavailable',depositEnabled:false};}
}
