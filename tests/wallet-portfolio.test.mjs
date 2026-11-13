import test from 'node:test';
import assert from 'node:assert/strict';
import {amountDisplay,toRawTon,TON_USDT_MASTER,loadChainPortfolio,
  explorerHistoryUrl,NETWORKS_WALLET} from '../docs/assets/wallet-portfolio.js';
const EVM='0x0Df74fCAE9a687A2B5Ba1117074184e3Ec780964';
const TON='UQCQIE9Aimu_7c2QEu2SfY2x8lKu5-rG_ntHwh5IWTwzF2Tk';
const response=x=>({ok:true,json:async()=>x});
test('wallet catalog contains exactly three networks and two user addresses',()=>{
 assert.deepEqual(Object.keys(NETWORKS_WALLET),['bsc','ton','mtt']);
 assert.equal(NETWORKS_WALLET.bsc.addressType,NETWORKS_WALLET.mtt.addressType);
 assert.equal(NETWORKS_WALLET.ton.addressType,'ton');
});
test('money units and TON USDT master normalize correctly',()=>{
 assert.equal(amountDisplay('1234567',6),'1.234567');
 assert.equal(amountDisplay('1000000000000000000',18),'1');
 assert.equal(toRawTon(TON_USDT_MASTER).length,66);
 assert.throws(()=>toRawTon('fake-USDT'),/invalid_ton/);
});
test('BSC balanceOf uses public customer address, never central wallet',async()=>{
 const calls=[];
 const fetcher=async(url,opts)=>{
  const req=JSON.parse(opts.body);calls.push(req);
  if(req.method==='eth_chainId')return response({result:'0x38'});
  if(req.method==='eth_getBalance')return response({result:'0xde0b6b3a7640000'});
  if(req.method==='eth_call')return response({result:'0x'+(2000000000000000000n).toString(16)});
  throw Error('Unexpected call');
 };
 const x=await loadChainPortfolio('bsc',{evm:EVM,ton:TON},{fetcher});
 assert.equal(x.assets[0].balance,'1');
 assert.equal(x.assets[1].balance,'2');
 assert.equal(calls[1].params[0],EVM);
 assert.match(calls[2].params[0].data,new RegExp(EVM.slice(2).toLowerCase()));
});
test('TON balance filters fake USDT jettons by official master address',async()=>{
 const fetcher=async(url)=>response(url.endsWith('/jettons')?{balances:[
  {balance:'999999999',jetton:{address:TON,decimals:6,symbol:'USDT'}},
  {balance:'1234500',jetton:{address:toRawTon(TON_USDT_MASTER),decimals:6,symbol:'USDT'}}
 ]}:{balance:'2500000000'});
 const x=await loadChainPortfolio('ton',{ton:TON,evm:EVM},{fetcher});
 assert.equal(x.assets[0].balance,'2.5');
 assert.equal(x.assets[1].balance,'1.2345');
});
test('unavailable RPC is never shown as a zero wallet balance',async()=>{
 const x=await loadChainPortfolio('mtt',{evm:EVM},{fetcher:async()=>{throw Error('offline')}});
 assert.equal(x.state,'unavailable');
 assert.equal(x.assets[0].balance,null);
 assert.equal(x.assets[1].balance,null);
});
test('network history links stay pointed to expected chain',()=>{
 assert.match(explorerHistoryUrl('bsc',EVM),/^https:\/\/bscscan.com/);
 assert.match(explorerHistoryUrl('mtt',EVM),/^https:\/\/explorer.mtt.network/);
 assert.match(explorerHistoryUrl('ton',TON),/^https:\/\/tonviewer.com/);
});
