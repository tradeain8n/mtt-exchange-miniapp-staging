import test from 'node:test';
import assert from 'node:assert/strict';
import {OFFICIAL_YAAKO_LOGIN, MTT_CHAIN_HEX, isYaakoProvider, discoverYaako, connectYaako}
  from '../docs/assets/yaako-provider.js';

function fakeWindow(provider, info={rdns:'com.yaako.wallet'}) {
  const listeners = new Map();
  const win = {
    Event: class {constructor(type){this.type=type;}},
    addEventListener(type, callback) {listeners.set(type,callback);},
    removeEventListener(type) {listeners.delete(type);},
    dispatchEvent(event) {
      if(event.type==='eip6963:requestProvider' && provider)
        listeners.get('eip6963:announceProvider')?.({detail:{provider,info}});
    }
  };
  return win;
}

test('only matching Yaako provider is discovered, not arbitrary EVM wallet', async () => {
  const fake={request:async()=>[]};
  assert.equal(isYaakoProvider({rdns:'com.other.wallet'},fake),false);
  assert.equal(isYaakoProvider({rdns:'com.yaako.wallet'},fake),true);
  assert.equal(await discoverYaako(fakeWindow(fake,{rdns:'com.other.wallet'}),1),null);
  assert.equal(await discoverYaako(fakeWindow(fake),1),fake);
});

test('staging connector obtains address without pretending ownership proof', async () => {
  const address='0x1234567890123456789012345678901234567890';
  const requests=[];
  const provider={request:async({method})=>{
    requests.push(method);
    return method==='eth_requestAccounts'?[address]:MTT_CHAIN_HEX;
  }};
  const result=await connectYaako(fakeWindow(provider),1);
  assert.equal(result.status,'connected_unverified');
  assert.equal(result.address,address);
  assert.equal(result.verified,false);
  assert.deepEqual(requests,['eth_requestAccounts','eth_chainId']);
  assert.equal(OFFICIAL_YAAKO_LOGIN,'https://account.yaako.io/oauth2/login');
});

test('unavailable Yaako, wrong chain and refused connection are distinguished', async () => {
  assert.deepEqual(await connectYaako(fakeWindow(null),1),{status:'unavailable'});
  const wrongChain={request:async({method})=>method==='eth_requestAccounts'?
    ['0x1234567890123456789012345678901234567890']:'0x1'};
  assert.equal((await connectYaako(fakeWindow(wrongChain),1)).status,'chain_mismatch');
  const refused={request:async()=>{throw Error('User rejected');}};
  assert.equal((await connectYaako(fakeWindow(refused),1)).status,'cancelled');
});
