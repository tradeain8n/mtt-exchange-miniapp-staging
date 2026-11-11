// STAGING ONLY. Public read-only checks after USER-ATTESTED MTT SPORTS login.
// No password, OTP, Yaako sessions, wallet keys, signed transactions or deposits.
import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs';

const referral='https://mtt.xyz/?i=ba434b5a';
const source='3.3 USDT (TON)';
const destination='native MTT (MTT Network, chainId 6880)';
const results=[];
function record(label,ok,details,critical=true){
 results.push({label,ok,details:String(details).slice(0,250),critical});
}
async function publicGet(url,label,expectedHost){
 try{
  const r=await fetch(url,{method:'GET',signal:AbortSignal.timeout(16000),
   credentials:'omit',cache:'no-store',headers:{Accept:'text/html'}});
  const finalHost=new URL(r.url).hostname;
  const html=(await r.text()).slice(0,170000);
  record(label,r.ok&&finalHost===expectedHost&&html.length>100,
   'HTTP '+r.status+'; final host='+finalHost+'; HTML size='+html.length);
 }catch(e){record(label,false,e.message);}
}
async function readChain(){
 try{
  const r=await fetch('https://evm-rpc.mtt.network',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}),
   signal:AbortSignal.timeout(12000)});
  const j=await r.json();
  record('MTT Network RPC / chainId',r.ok&&Number.parseInt(j.result,16)===6880,
   'Expected 6880; received '+String(j.result||j.error?.message||'unknown'));
 }catch(e){record('MTT Network RPC / chainId',false,e.message);}
}
async function supabaseAuthBoundary(){
 try{
  const r=await fetch('https://lisysjunbaxyjieuwpxf.supabase.co/functions/v1/baby-mtt-yaako-link',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'status',ticket:'mtt2.invalid.invalid'}),
   signal:AbortSignal.timeout(12000)});
  const j=await r.json();
  record('Supabase invalid ticket protection',r.status===401&&j.error==='invalid_ticket',
   'HTTP '+r.status+'; invalid ticket refused');
 }catch(e){record('Supabase invalid ticket protection',false,e.message);}
}
async function telegramPublicSettings(){
 const token=process.env.TELEGRAM_BOT_TOKEN;
 if(!token){record('Telegram bot token secret',false,'Missing GitHub encrypted secret');return;}
 const api=async(method)=>{
  const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{
   method:'POST',headers:{'Content-Type':'application/json'},body:'{}',
   signal:AbortSignal.timeout(14000)});
  const j=await r.json();
  if(!j.ok)throw Error('Bot API HTTP '+r.status);
  return j.result;
 };
 try{
  const me=await api('getMe');
  record('Telegram test bot identity',me.username?.toLowerCase()==='giftmutantbot',
   'Expected @GiftMutantBot; actual @'+me.username);
  const commands=await api('getMyCommands');
  const names=commands.map(c=>c.command);
  record('Telegram MTT SPORTS bot menu',[
   'start','mttsports','mttsportscheck','linkstatus','recipient'
  ].every(x=>names.includes(x)),'Commands: '+names.join(', '));
  const menu=await api('getChatMenuButton');
  record('Telegram staging Web App',menu.type==='web_app' &&
   menu.web_app?.url?.startsWith('https://tradeain8n.github.io/mtt-exchange-miniapp-staging/'),
   'Type='+menu.type+'; URL is within approved staging host');
 }catch(e){record('Telegram bot API',false,e.message);}
}
export function buildReport(){
 const rows=results.map(r=>'| '+r.label.replaceAll('|','/')+' | '+(r.ok?'PASS':'FAIL')+
   ' | '+r.details.replaceAll('|','/').replaceAll('\n',' ')+' |').join('\n');
 return [
 '# Baby MTT V2 / MTT SPORTS / Public Post-Login Test',
 '',
 '**Проверено:** '+new Date().toISOString(),
 '**Запуск:** пользователь нажал «Я вошёл» в Telegram Mini App.',
 '**Предел достоверности:** это сообщение пользователя, не проверенный OAuth callback MTT SPORTS.',
 '**GitHub не получает:** Telegram ID, почту, сессионные cookie, OTP, реквизиты Yaako, приватные ключи.',
 '',
 '## Read-only результаты',
 '| Проверка | Результат | Данные |',
 '|---|---|---|',
 rows,
 '',
 '## Целевой обмен — пока НЕ РАЗРЕШЁН',
 '- Отдаём: **'+source+'**',
 '- Получаем: **'+destination+'**',
 '- Переход регистрации: '+referral,
 '- Кошелёк: только отдельно подтверждённый EVM-адрес Yaako / MTT SPORTS.',
 '- **Котировка, доступный TON→MTT маршрут, комиссии и минимум 3,3 USDT не подтверждены.**',
 '- Никакие реальные переводы или сделки не выполнялись.',
 '',
 '## Дальнейшие действия',
 '1. Пользователь сравнивает полный EVM-адрес получения в Yaako и MTT SPORTS (MTT Network 6880).',
 '2. Подтверждает контроль адреса EIP-191/поддерживаемым способом Yaako. Кастодиальные кошельки могут не поддерживать personal_sign.',
 '3. Проверяет, что реферальная регистрация действительно засчитана в MTT SPORTS: вход по URL сам по себе этого не доказывает.',
 '4. Получить проверяемую живую котировку и минимальный размер обмена USDT (TON) → нативный MTT Network.',
 '5. Только после проверки комиссии, ликвидности, получателя и отдельной приёмки разрешать реальный обмен.',
 '',
 'Автоматическая проверка Yaako/MTT SPORTS личного кабинета не проводилась: это разные сервисы и отсутствует разрешённая партнёрская авторизация.'
 ].join('\n');
}
async function main(){
 const u=new URL(referral);
 record('Referral URL',u.hostname==='mtt.xyz'&&u.searchParams.get('i')==='ba434b5a',
  'Attribution query i=ba434b5a; actual referral credit is unverified');
 await publicGet(referral,'MTT SPORTS referral landing page','mtt.xyz');
 await publicGet('https://sports.mtt.xyz/','MTT SPORTS game web app','sports.mtt.xyz');
 await publicGet('https://t.me/MTTSPORTS_bot','Сторонний промо-бот @MTTSPORTS_bot: публичная страница','t.me');
 await publicGet('https://account.yaako.io/oauth2/login','Yaako public login','account.yaako.io');
 await readChain();
 await supabaseAuthBoundary();
 await telegramPublicSettings();
 mkdirSync('research-output',{recursive:true});
 writeFileSync('research-output/mttsports-postlogin-report.md',buildReport());
 writeFileSync('research-output/mttsports-postlogin-status.json',JSON.stringify({
  generatedAt:new Date().toISOString(),results,
  goal:{source,destination,quoteVerified:false,executionEnabled:false}
 },null,2));
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,buildReport());
 console.log('MTTSPORTS_CHECKS',results.map(r=>r.label+':'+(r.ok?'PASS':'FAIL')).join('; '));
 if(results.some(r=>r.critical&&!r.ok))process.exitCode=1;
}
if(import.meta.url==='file://'+process.argv[1])await main();
