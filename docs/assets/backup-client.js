// GiftMutant recovery pages: mnemonic only in transient DOM memory.
// Secret words remain transient in memory; never persisted or logged.
const tg=window.Telegram?.WebApp;
try{tg?.ready();tg?.expand();tg?.setHeaderColor?.('#101f4d');}catch{}
const $=id=>document.getElementById(id);
const page=document.body.dataset.backupPage;
const SESSION_KEY='giftmutant-backup-challenge-v1';
let words=[];
let gateway=null;
function status(message,success=false){
 const node=$('recovery-state');
 if(!node)return;
 node.querySelector('span').textContent=message;
 node.classList.toggle('notice-warning',!success);
 node.classList.toggle('notice-info',success);
}
async function resolveGateway(){
 if(!tg?.initData)throw Error('Откройте кошелёк через GiftMutantBot внутри Telegram.');
 const response=await fetch('./config.json',{cache:'no-store'});
 if(!response.ok)throw Error('Не удалось загрузить конфигурацию.');
 const config=await response.json();
 if(typeof config.apiBaseUrl!=='string'||!config.apiBaseUrl)
  throw Error('Сервис защищённой выдачи резервной фразы ещё не подключён.');
 const url=new URL(config.apiBaseUrl);
 if(url.protocol!=='https:'||url.hostname==='tradeain8n.github.io')
  throw Error('Нужен отдельный защищённый HTTPS-сервер кошельков.');
 gateway=url.href.replace(/\/$/,'');
}
async function api(action,params={}){
 if(!gateway)throw Error('Нет защищённого соединения.');
 const response=await fetch(gateway+'/api/wallet/backup/'+action,{
  method:'POST',headers:{'content-type':'application/json'},
  cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
  body:JSON.stringify({initData:tg.initData,...params}),
  signal:AbortSignal.timeout(12000)
 });
 const result=await response.json();
 if(!response.ok)throw Error(result.error||result.reason||'Ошибка проверки');
 return result;
}
function clearSecrets(){
 words=[];
 if($('recovery-words'))$('recovery-words').replaceChildren();
}
window.addEventListener('pagehide',clearSecrets);
if(page==='reveal'){
 const begin=$('recovery-begin'),next=$('recovery-next'),ack=$('recovery-written');
 const copy=$('recovery-copy');
 begin.addEventListener('click',async()=>{
  begin.disabled=true;
  try{
   const result=await api('start');
   if(result.alreadyConfirmed){
    status('Кошелёк уже подтверждён. Слова не показываются повторно.',true);return;
   }
   if(!Array.isArray(result.words)||result.words.length!==12||
      !Array.isArray(result.positions)||result.positions.length!==3)
    throw Error('Неполный ответ сервера. Не используйте эту копию.');
   words=[...result.words];
   const grid=$('recovery-words');grid.replaceChildren();
   words.forEach((value,i)=>{
    const item=document.createElement('div');item.className='recovery-word';
    const number=document.createElement('span');number.textContent=String(i+1)+'.';
    const word=document.createElement('strong');word.textContent=value;
    item.append(number,word);grid.append(item);
   });
   sessionStorage.setItem(SESSION_KEY,JSON.stringify({
    challengeId:result.challengeId,positions:result.positions
   }));
   $('recovery-content').classList.remove('hidden');
   begin.classList.add('hidden');
   status('Запишите слова по порядку. На следующем экране попросим три из них.',true);
  }catch(error){status(error.message||'Не удалось открыть резервную фразу.');begin.disabled=false;}
 });
 ack.addEventListener('change',()=>{next.disabled=!ack.checked||words.length!==12;});
 next.addEventListener('click',()=>{
  if(!ack.checked||words.length!==12)return;
  clearSecrets();
  window.location.assign('./backup-confirm.html');
 });
 copy.addEventListener('click',async()=>{
  if(words.length!==12)return;
  try{
   await navigator.clipboard.writeText(words.join(' '));
   status('Слова скопированы в буфер обмена. Удалите копию после сохранения!',false);
  }catch{status('Копирование недоступно. Запишите слова вручную.');}
 });
 resolveGateway().then(async()=>{
  const result=await api('status');
  if(result.backupStatus==='confirmed'){
   begin.disabled=true;status('Резервная фраза этого кошелька уже подтверждена.',true);
  }else {begin.disabled=false;status('Нажмите «Показать» только когда рядом никого нет.',true);}
 }).catch(e=>{begin.disabled=true;status(e.message);});
}
if(page==='verify'){
 let challenge=null;
 try{
  challenge=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
  if(!/^[0-9a-f]{48}$/.test(challenge?.challengeId||'')||
     !Array.isArray(challenge?.positions)||
     challenge.positions.length!==3||
     new Set(challenge.positions).size!==3||
     !challenge.positions.every(n=>Number.isInteger(n)&&n>=1&&n<=12))
   throw Error('Сначала откройте и сохраните резервную фразу.');
  const holder=$('recovery-inputs');holder.replaceChildren();
  challenge.positions.forEach((position,i)=>{
   const label=document.createElement('label');label.className='recovery-input-label';
   label.textContent='Слово №'+position;
   const input=document.createElement('input');input.type='text';input.name='word'+i;
   input.autocomplete='off';input.autocapitalize='off';input.spellcheck=false;
   input.maxLength=12;input.required=true;input.placeholder='Введите слово';
   label.append(input);holder.append(label);
  });
  $('recovery-submit').disabled=false;
  status('Введите три слова из вашей записи.',true);
 }catch(e){status(e.message||'Нет сохранённого задания.');}
 resolveGateway().catch(e=>{status(e.message);$('recovery-submit').disabled=true;});
 $('recovery-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!challenge||!gateway)return;
  const submit=$('recovery-submit');
  const inputs=[...$('recovery-inputs').querySelectorAll('input')];
  const answers=inputs.map(x=>x.value.trim().toLowerCase());
  if(answers.some(w=>!/^[a-z]{2,12}$/.test(w))){
   status('Введите английские слова точно как в резервной фразе.');return;
  }
  submit.disabled=true;
  try{
   const result=await api('verify',{challengeId:challenge.challengeId,answers});
   inputs.forEach(input=>input.value='');
   sessionStorage.removeItem(SESSION_KEY);
   $('recovery-inputs').replaceChildren();
   status(result.confirmed
    ?'Кошелёк подтверждён! Резервная фраза отмечена как сохранённая. Реальные переводы пока отдельно отключены.'
    :'Проверка не завершена.',Boolean(result.confirmed));
   if(result.confirmed)submit.classList.add('hidden');
  }catch(error){
   inputs.forEach(input=>input.value='');
   status('Не удалось подтвердить слова. Проверьте номера и повторите попытку. '+String(error.message||'').slice(0,65));
   submit.disabled=false;
  }
 });
}