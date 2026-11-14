import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangeRoute,parseInput,EXCHANGE_NETWORKS} from '../docs/assets/swap-routes.js';
test('all three networks are selectable for supported USDT tokens',()=>{
 assert.deepEqual(Object.keys(EXCHANGE_NETWORKS).sort(),['bsc','mtt','ton']);
 for(const network of ['ton','bsc','mtt'])
  assert.equal(EXCHANGE_NETWORKS[network].tokens.includes('USDT'),true);
});
test('buy USDT 0.10 to 20 USD, but only real TON 3 USDT pilot executes',()=>{
 for(const amount of ['0.1','20']){
  const r=exchangeRoute({inputToken:'USDT',inputNetwork:'ton',outputNetwork:'mtt',amount});
  assert.equal(r.valid,true);assert.equal(r.quoteOnly,true);assert.equal(r.executable,false);
 }
 assert.equal(exchangeRoute({inputToken:'USDT',inputNetwork:'ton',outputNetwork:'mtt',amount:'3'}).livePilot,true);
 for(const amount of ['0.09','20.1']){
  assert.equal(exchangeRoute({inputToken:'USDT',inputNetwork:'ton',outputNetwork:'mtt',amount}).valid,false);
 }
});
test('sell native MTT to USDT MTT is executable; TON/BSC USDT payouts only quote',()=>{
 assert.equal(exchangeRoute({inputToken:'MTT',inputNetwork:'mtt',outputNetwork:'mtt',amount:'5000'}).liveSell,true);
 for(const network of ['ton','bsc']){
  const r=exchangeRoute({inputToken:'MTT',inputNetwork:'mtt',outputNetwork:network,amount:'5000'});
  assert.equal(r.valid,true);
  assert.equal(r.executable,false);
 }
 assert.equal(exchangeRoute({inputToken:'MTT',inputNetwork:'ton',outputNetwork:'mtt',amount:'5000'}).valid,false);
});
test('amount input uses comma or period, never NaN or negative',()=>{
 assert.equal(parseInput('0,10'),0.1);
 assert.equal(parseInput('5000.5'),5000.5);
 assert.equal(parseInput('-5'),null);
 assert.equal(parseInput('NaN'),null);
});
