import {discoverYaako} from './yaako-provider.js';

const API='https://lisysjunbaxyjieuwpxf.supabase.co/functions/v1/baby-mtt-yaako-link';
const $=id=>document.getElementById(id);
const tg=window.Telegram?.WebApp;
tg?.ready(); tg?.expand();

const initialUrl=new URL(location.href);
const incomingTicket=initialUrl.searchParams.get('ticket');
if (incomingTicket) sessionStorage.setItem('baby_mtt_yaako_staging_ticket',incomingTicket);
const ticket=incomingTicket || sessionStorage.getItem('baby_mtt_yaako_staging_ticket') || '';
initialUrl.searchParams.delete('ticket');
try{history.replaceState(null,'',initialUrl.pathname+initialUrl.search+initialUrl.hash);}catch{}
let provider=null, connectedAddress=null, currentChallenge=null, approveCommand=null;

function status(id, message, type='') {
 const target=$(id);
 target.textContent=message;
 target.className='status'+(type?' '+type:'');
}
const validAddress=value=>/^0x[a-fA-F0-9]{40}$/.test(String(value||''));
const disabled=bool=>['connect','challenge','sign','verify'].forEach(id=>$(id).disabled=bool);
function explain(error) {
 const key=error?.message||'';
 const map={
  invalid_ticket:'Недействительная ссылка. Получи новую через /start.',
  ticket_expired:'Ссылка истекла. Получи новую через /start.',
  challenge_expired:'Время подписи истекло. Начни подтверждение заново.',
  signature_invalid:'Подпись не соответствует сообщению.',
  signature_address_mismatch:'Подпись сделана другим EVM-адресом.',
  wallet_already_linked:'Адрес уже подтверждён за другим Telegram ID.',
  scope_forbidden:'Эта операция недоступна из веб-страницы.',
  challenge_rate_limit:'Лимит запросов. Попробуй позже.',
  challenge_replayed:'Этот запрос уже использован.',
  service_unavailable:'Сервис временно недоступен.'
 };
 return map[key]||key||'Не удалось выполнить запрос.';
}
async function api(action, rest={}) {
 const response=await fetch(API,{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action,ticket,...rest}),
  cache:'no-store',
  credentials:'omit'
 });
 const json=await response.json();
 if(!response.ok) throw new Error(json.error||'service_unavailable');
 return json;
}
async function copyText(text, id='provider-status') {
 try {await navigator.clipboard.writeText(text);status(id,'Скопировано.');}
 catch {status(id,'Скопировать автоматически не удалось. Выдели текст вручную.','warning');}
}
async function refresh() {
 try {
  const result=await api('status');
  if(result.verified){
   status('link-status','✅ EVM-адрес подтверждён в Telegram:\n'+result.verified.address+
    '\nПолучатель по умолчанию: '+(result.verified.defaultRecipient?'Yaako EVM':'не выбран')+
    '\nMTT Network 6880. Выплаты и обмены выключены.','success');
   approveCommand=null;$('copy-approve').disabled=true;return;
  }
  if(result.pending){
   approveCommand='/approve '+result.pending.confirmSuffix;
   status('link-status','🟡 Подпись проверена. Требуется одобрение в Telegram.\nАдрес: '+
    result.pending.address+'\nОтправь в тестовом боте: '+approveCommand,'warning');
   $('copy-approve').disabled=false;return;
  }
  status('link-status','Пока нет подтверждённого адреса. Сначала подпиши сообщение, затем подтверди последние 6 символов адреса в Telegram.');
 }catch(error){status('link-status',explain(error),'error');}
}
async function onConnect() {
 disabled(true);
 try {
  provider=await discoverYaako(window,450);
  const isYaako=!!provider;
  if(!provider && window.ethereum?.request) provider=window.ethereum;
  if(!provider) {
   status('provider-status','EVM-провайдер не найден в этом браузере. Скопируй временную ссылку и открой её в DApp-браузере Yaako (если он поддерживается).','warning');
   return;
  }
  const accounts=await provider.request({method:'eth_requestAccounts'});
  if(!Array.isArray(accounts)||!validAddress(accounts[0])) throw Error('Кошелёк не вернул EVM-адрес.');
  connectedAddress=accounts[0];
  $('address').value=connectedAddress;
  const chain=await provider.request({method:'eth_chainId'}).catch(()=>null);
  const matching=String(chain).toLowerCase()==='0x1ae0';
  status('provider-status',(isYaako?'Провайдер Yaako обнаружен. ':'Найден другой EVM-провайдер. ')+
   'Адрес: '+connectedAddress+
   (matching?'\nMTT Network подтверждена по chainId.':'\nСеть отличается от MTT Network 6880 — проверь выбор сети.')+
   '\nКонтроль адреса ещё требуется подтвердить подписью.',matching?'success':'warning');
 }catch(error){status('provider-status','Подключение отменено или недоступно: '+explain(error),'warning');}
 finally {disabled(false);}
}
async function onChallenge() {
 const address=$('address').value.trim();
 if(!validAddress(address))return status('proof-status','Нужен публичный EVM-адрес: 0x и 40 шестнадцатеричных символов.','error');
 disabled(true);
 try {
  const result=await api('challenge',{address});
  currentChallenge=result;
  $('message').value=result.message;
  $('signature').value='';
  $('proof-area').classList.remove('hidden');
  status('proof-status','Сообщение выпущено. Действует 5 минут. Подпись бесплатна и не разрешает перевод средств.','success');
 }catch(error){status('proof-status',explain(error),'error');}
 finally{disabled(false);}
}
async function submitSignature(signature) {
 if(!currentChallenge)throw Error('Сначала получи новое сообщение.');
 const result=await api('prove',{challengeId:currentChallenge.challengeId,signature});
 if(result.status!=='pending_telegram_confirmation')throw Error('Сервер не подтвердил подпись.');
 currentChallenge=null;
 $('proof-area').classList.add('hidden');
 approveCommand='/approve '+result.confirmSuffix;
 status('proof-status','Подпись адреса '+result.address+' прошла проверку EIP-191. Требуется отдельное подтверждение в Telegram.','success');
 await refresh();
}
async function onSign() {
 if(!provider || !connectedAddress || !currentChallenge)
  return status('proof-status','Подключи EVM-кошелёк и получи сообщение, затем подпиши его.','warning');
 if(connectedAddress.toLowerCase()!==currentChallenge.address.toLowerCase())
  return status('proof-status','Адрес для подписи отличается от подключённого кошелька.','error');
 disabled(true);
 try{
  const payload='0x'+[...new TextEncoder().encode(currentChallenge.message)]
    .map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const signature=await provider.request({method:'personal_sign',params:[payload,connectedAddress]});
  await submitSignature(signature);
 }catch(error){status('proof-status',explain(error),'error');}
 finally{disabled(false);}
}
async function onManualVerify() {
 disabled(true);
 try{await submitSignature($('signature').value.trim());}
 catch(error){status('proof-status',explain(error),'error');}
 finally{disabled(false);}
}
$('connect').addEventListener('click',onConnect);
$('challenge').addEventListener('click',onChallenge);
$('sign').addEventListener('click',onSign);
$('verify').addEventListener('click',onManualVerify);
$('refresh').addEventListener('click',refresh);
$('copy-message').addEventListener('click',()=>copyText($('message').value,'proof-status'));
$('copy-approve').addEventListener('click',()=>{if(approveCommand)copyText(approveCommand,'link-status');});
$('copy-link').addEventListener('click',()=>{
 const url=location.origin+location.pathname+'?ticket='+encodeURIComponent(ticket);
 copyText(url,'provider-status');
});
if(!ticket) {
 status('telegram-status','Нет подписанной Telegram-ссылки. Открой тестовый бот и отправь /start.','error');
 disabled(true);$('copy-link').disabled=true;
}else{
 status('telegram-status','Подписанная ссылка получена. Проверяем на сервере…');
 api('status').then(result=>{
  status('telegram-status','Telegram ID подтверждён через подпись тестового бота. Ссылка действительна 10 минут.','success');
  refresh();
 }).catch(err=>{
  status('telegram-status',explain(err),'error');
  disabled(true);
 });
}
