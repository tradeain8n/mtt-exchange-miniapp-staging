// GiftMutant wallet portfolio: read-only, real blockchain values, no signing.
export const TON_USDT_MASTER='EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
export const NETWORKS_WALLET=Object.freeze({
 bsc:{name:'BNB Smart Chain',native:'BNB',addressType:'evm',chainId:56,
  rpc:'https://bsc-rpc.publicnode.com',
  stable:'0x55d398326f99059fF775485246999027B3197955',
  history:'https://bscscan.com/address/'},
 ton:{name:'TON',native:'TON',addressType:'ton',
  history:'https://tonviewer.com/'},
 mtt:{name:'MTT Network',native:'MTT',addressType:'evm',chainId:6880,
  rpc:'https://evm-rpc.mtt.network/',
  stable:'0x78a39b9101983D2009Ff14773E8e47Ca3a23BBfD',
  history:'https://explorer.mtt.network/address/'}
});
const goodEvm=a=>/^0x[0-9a-fA-F]{40}$/.test(a||'');
export function toRawTon(address){
 const input=String(address||'');
 if(/^(?:0|-1):[0-9a-fA-F]{64}$/.test(input))return input.toLowerCase();
 if(!/^[EU]Q[A-Za-z0-9_-]{46}$/.test(input))throw Error('invalid_ton_address');
 const normalized=input.replace(/-/g,'+').replace(/_/g,'/');
 const bytes=Uint8Array.from(atob(normalized),s=>s.charCodeAt(0));
 if(bytes.length!==36)throw Error('invalid_ton_length');
 const network=bytes[1]===255?'-1':bytes[1]===0?'0':null;
 if(!network)throw Error('invalid_ton_workchain');
 return network+':'+Array.from(bytes.slice(2,34)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function amountDisplay(units,decimals,precision=6){
 if(!/^\d+$/.test(String(units))||decimals<0||decimals>18)throw Error('invalid_balance');
 const n=BigInt(units),ten=10n**BigInt(decimals),major=n/ten;
 let minor=(n%ten).toString().padStart(decimals,'0').slice(0,precision);
 minor=minor.replace(/0+$/,'');
 return major.toString()+(minor?'.'+minor:'');
}
async function rpc(url,method,params,fetcher){
 const response=await fetcher(url,{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',method,params,id:1}),
  signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw Error('rpc_http_error');
 const payload=await response.json();
 if(payload.error||!/^0x[0-9a-fA-F]*$/.test(payload.result||''))throw Error('rpc_invalid');
 return payload.result;
}
async function requestJson(url,fetcher){
 const response=await fetcher(url,{headers:{accept:'application/json'},
  signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('api_http_'+response.status);
 return response.json();
}
const entry=(symbol,units,decimals)=>({symbol,balance:amountDisplay(BigInt(units).toString(),decimals),
 state:'verified'});
const missing=symbol=>({symbol,balance:null,state:'unavailable'});
export async function loadChainPortfolio(network,wallet,{fetcher=fetch}={}){
 const config=NETWORKS_WALLET[network];
 if(!config)throw Error('unsupported_network');
 const address=wallet?.[config.addressType];
 if(!address||(config.addressType==='evm'&&!goodEvm(address))){
  return {network,address:null,state:'wallet_missing',assets:[missing(config.native),missing('USDT')]};
 }
 if(network==='ton'){
  let expected;
  try{expected=toRawTon(TON_USDT_MASTER);toRawTon(address);}
  catch{return {network,address:null,state:'wallet_missing',assets:[missing('TON'),missing('USDT')]};}
  const base='https://tonapi.io/v2/accounts/'+encodeURIComponent(address);
  const results=await Promise.allSettled([
   requestJson(base,fetcher),requestJson(base+'/jettons',fetcher)
  ]);
  let ton=missing('TON'),usdt=missing('USDT');
  if(results[0].status==='fulfilled'){
   try{ton=entry('TON',results[0].value.balance,9);}catch{}
  }
  if(results[1].status==='fulfilled'&&Array.isArray(results[1].value.balances)){
   const verified=results[1].value.balances.filter(row=>{
    try{return toRawTon(row.jetton?.address)===expected&&Number(row.jetton?.decimals)===6;}
    catch{return false;}
   });
   if(verified.length===1)try{usdt=entry('USDT',verified[0].balance,6);}catch{}
   else if(verified.length===0)usdt=entry('USDT','0',6);
  }
  return {network,address,state:ton.state==='verified'||usdt.state==='verified'?'partial':'unavailable',
   assets:[ton,usdt],source:'tonapi',observedAt:new Date().toISOString()};
 }
 const chain=await rpc(config.rpc,'eth_chainId',[],fetcher).catch(()=>null);
 if(chain===null||BigInt(chain)!==BigInt(config.chainId)){
  return {network,address,state:'unavailable',assets:[missing(config.native),missing('USDT')]};
 }
 const data='0x70a08231'+address.slice(2).toLowerCase().padStart(64,'0');
 const results=await Promise.allSettled([
  rpc(config.rpc,'eth_getBalance',[address,'latest'],fetcher),
  rpc(config.rpc,'eth_call',[{to:config.stable,data},'latest'],fetcher)
 ]);
 const assets=results.map((res,i)=>{
  if(res.status!=='fulfilled')return missing(i===0?config.native:'USDT');
  try{return entry(i===0?config.native:'USDT',BigInt(res.value),18);}
  catch{return missing(i===0?config.native:'USDT');}
 });
 return {network,address,state:assets.every(x=>x.state==='verified')?'verified':'partial',
  assets,source:'rpc',observedAt:new Date().toISOString()};
}
export function explorerHistoryUrl(network,address){
 const cfg=NETWORKS_WALLET[network];
 if(!cfg||!address)throw Error('missing_network_or_address');
 if(cfg.addressType==='evm'&&!goodEvm(address))throw Error('invalid_evm_address');
 if(cfg.addressType==='ton')toRawTon(address);
 return cfg.history+encodeURIComponent(address);
}
