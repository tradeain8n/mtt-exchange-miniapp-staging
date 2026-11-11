// Public-only website/SDK inventory: no cookies, credentials or account data.
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const PUBLIC_URLS=[
 'https://yaako.io/',
 'https://account.yaako.io/oauth2/login?lang=ru&oauth2SiteType=container&mainurl=https%3A%2F%2Fyaako.io%2Foauth2%2Fcallback'
];
const allow=new Set(['yaako.io','account.yaako.io','static-s3.mtt.xyz']);
const signals=['oauth2','google','apple','custodial','noncustodial','wallet',
'evm','solana','mtt','eip6963','personal_sign','eth_requestAccounts',
'walletconnect','export','import','mnemonic','bridge','staking','transaction','dapp','api'];
export function discoverScripts(html,baseUrl){
 const urls=[];
 const re=/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/ig;
 for(const match of html.matchAll(re)){
  try{
   const url=new URL(match[1],baseUrl);
   if(url.protocol==='https:'&&allow.has(url.hostname)&&!urls.includes(url.href))urls.push(url.href);
  }catch{}
 }
 return urls;
}
export function fingerprint(source,url){
 const counts={};
 for(const term of signals)counts[term]=[...source.matchAll(new RegExp(term,'gi'))].length;
 return {url,bytes:Buffer.byteLength(source),sha256:createHash('sha256').update(source).digest('hex'),
  indicators:counts,scope:'Static string presence does not establish working third-party API'};
}
export async function collectPublic(options={}){
 const report={generatedAt:new Date().toISOString(),classification:'Public unauthenticated front-end only',
  methodology:'Allowlisted HTTPS GET, static JS string signatures; no cookies or raw code persisted',
  pages:[],assets:[],failures:[]};
 async function load(url){
  const requested=new URL(url);
  if(requested.protocol!=='https:'||!allow.has(requested.hostname))throw Error('host_not_allowlisted');
  const res=await fetch(url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(30000),
   cache:'no-store',credentials:'omit'});
  if(!allow.has(new URL(res.url).hostname))throw Error('redirect_outside_allowlist');
  if(!res.ok)throw Error('http_'+res.status);
  if(Number(res.headers.get('content-length')||0)>12000000)throw Error('asset_too_large');
  const source=await res.text();
  if(Buffer.byteLength(source)>12000000)throw Error('asset_too_large');
  return {source,url:res.url,status:res.status};
 }
 const seen=new Set();
 for(const root of options.roots||PUBLIC_URLS){
  try{
   const page=await load(root);
   const scripts=discoverScripts(page.source,page.url);
   report.pages.push({url:root,finalUrl:page.url,http:page.status,
    htmlBytes:Buffer.byteLength(page.source),scriptCount:scripts.length});
   for(const url of scripts.slice(0,options.maxScripts??3)){
    if(seen.has(url))continue;
    seen.add(url);
    try{const asset=await load(url);report.assets.push(fingerprint(asset.source,asset.url));}
    catch(error){report.failures.push({url,error:String(error.message).slice(0,100)});}
   }
  }catch(error){report.failures.push({url:root,error:String(error.message).slice(0,100)});}
 }
 return report;
}
if(import.meta.url==='file://'+process.argv[1]){
 const report=await collectPublic();
 mkdirSync('research-output',{recursive:true});
 writeFileSync('research-output/yaako-public-research.json',JSON.stringify(report,null,2)+'\n');
 console.log('YAAKO_PUBLIC_REPORT',JSON.stringify({pages:report.pages.length,
  assets:report.assets.length,errors:report.failures.length}));
 if(!report.pages.length||!report.assets.length)process.exitCode=1;
}
