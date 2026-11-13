import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_AMOUNT,PILOT,NETWORKS,readWalletFragment,buildWalletFragment,evaluateRoute} from '../docs/assets/exchange-model.js';
const wallet={evm:'0x'+'ab'.repeat(20),ton:'UQ'+'b'.repeat(46),tron:'T'+'A'.repeat(33),near:'ac'.repeat(32)};
test('minimal $2 USDT BSC route is only a non-executable preview',()=>{
 assert.equal(DEFAULT_AMOUNT,'3.00');
 assert.equal(PILOT.targetChainId,6880);
 const route=evaluateRoute({network:'bsc',token:'USDT',amount:'2.00'});
 assert.equal(route.ok,true);
 assert.equal(route.amount,'2.00');
 assert.equal(route.destinationNetwork,'MTT Network');
 assert.equal(route.recipientPolicy,'same_evm_address');
 assert.equal(route.canDeposit,false);
 assert.equal(route.canExecute,false);
 assert.equal(route.liveQuote,false);
 assert.equal(NETWORKS.filter(x=>x.usable).length,2);
});
test('all other networks and tokens fail closed to prevent wrong-chain deposits',()=>{
 for(const network of ['polygon','ethereum','tron','near']){
   const r=evaluateRoute({network,token:'USDT',amount:'2'});
   assert.equal(r.ok,false,network);
   assert.match(r.reason,/BEP-20/);
 }
 const tonTooSmall=evaluateRoute({network:'ton',token:'USDT',amount:'2'});
 assert.equal(tonTooSmall.ok,false);
 assert.match(tonTooSmall.reason,/3 USD₮ TON/);
 assert.equal(evaluateRoute({network:'ton',token:'USDT',amount:'3.5'}).ok,false);
 const pilot=evaluateRoute({network:'ton',token:'USDT',amount:'3'});
 assert.equal(pilot.ok,true);
 assert.equal(pilot.recipientNetwork,'MTT Network');
 assert.equal(pilot.destinationChainId,6880);
 assert.equal(evaluateRoute({network:'bsc',token:'USDC',amount:'2'}).ok,false);
 assert.equal(evaluateRoute({network:'bsc',token:'USDT',amount:'0.5'}).ok,false);
 assert.equal(evaluateRoute({network:'bsc',token:'USDT',amount:'21'}).ok,false);
 assert.equal(evaluateRoute({network:'bsc',token:'USDT',amount:'bad'}).ok,false);
});
test('public addresses can enter wallet tab via URL fragment only',()=>{
 const hash=buildWalletFragment(wallet,'wallet');
 const result=readWalletFragment(hash);
 assert.equal(result.tab,'wallet');
 assert.deepEqual(result.wallet,wallet);
 assert.match(hash,/^#tab=wallet&evm=0x/);
 assert.equal(new URL('https://host.example/exchange.html'+hash).search,'');
 assert.equal(readWalletFragment('#tab=wallet&evm=0xBAD').wallet.evm,null);
 assert.throws(()=>buildWalletFragment({evm:'0xbad'}),/invalid_wallet_evm/);
 assert.equal(readWalletFragment('').tab,'swap');
});
