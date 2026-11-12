import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReport,verifyOfficialReferralLanding,inspectReferralTransport,nativePlayNow} from '../scripts/mttsports_autocheck.mjs';
test('report states amount, recipient and SSO/quote limitations',()=>{
 const result=buildReport();
 assert.match(result,/3\.3 USDT \(TON\)/);
 assert.match(result,/6880/);
 assert.match(result,/ba434b5a/);
 assert.match(result,/не проверенный OAuth callback/);
 assert.match(result,/НЕ РАЗРЕШЁН/);
 assert.match(result,/не подтверждены/);
});

test('real public referral success requires correct final query and HTML',()=>{
 const base={status:200,finalUrl:'https://mtt.xyz/?i=ba434b5a',
   contentType:'text/html; charset=utf-8',htmlLength:2000};
 assert.equal(verifyOfficialReferralLanding(base),true);
 assert.equal(verifyOfficialReferralLanding({...base,finalUrl:'https://mtt.xyz/?i=cd042562'}),false);
 assert.equal(verifyOfficialReferralLanding({...base,finalUrl:'https://fake.example/?i=ba434b5a'}),false);
 assert.equal(verifyOfficialReferralLanding({...base,contentType:'application/json'}),false);
});

test('Telegram Play Now payload omits the real affiliate while our official signup URL contains it',()=>{
 const d=inspectReferralTransport();
 assert.equal(d.nativeTargetValid,true);
 assert.deepEqual(d.nativePayload,{path:'/',params:{}});
 assert.equal(d.nativeContainsOurCode,false);
 assert.equal(d.officialReferralUrlValid,true);
 assert.equal(d.missingAffiliateAtGameLaunch,true);
 assert.equal(d.firstSignupAttribution,'UNVERIFIED_BY_PLATFORM');
 assert.equal(d.retroactiveLinking,'NOT_DOCUMENTED_OR_APPROVED');
 assert.match(buildReport(),/почему пользователь не появился/);
 assert.match(buildReport(),/РАЗНЫЕ события/);
});

test('unexpected host or fake referral is rejected in read-only transport diagnosis',()=>{
 assert.equal(inspectReferralTransport('https://example.com/', 'https://mtt.xyz/?i=ba434b5a').nativeTargetValid,false);
 assert.equal(inspectReferralTransport(nativePlayNow,'https://mtt.xyz/?i=cd042562').officialReferralUrlValid,false);
});
