const tg=window.Telegram?.WebApp;
const el=id=>document.getElementById(id);
const panels=['users','settings','withdrawals'];
let base='',offset=0,total=0,busy=false;
const LIMIT=25;
try{tg?.ready();tg?.expand();tg?.setBackgroundColor?.('#0d152a')}catch{}
const showError=(text)=>{el('lock').hidden=false;el('lock').textContent=text;el('admin').hidden=true};
const setNotice=(text)=>{el('save-state').textContent=text};
async function post(action,data={}){
 if(!base||!tg?.initData)throw Error('Откройте админку кнопкой внутри GiftMutant в Telegram.');
 const res=await fetch(base+'/api/giftmutant/referrals/admin/'+action,{
  method:'POST',mode:'cors',cache:'no-store',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({initData:tg.initData,...data}),
  signal:AbortSignal.timeout(15000)
 });
 let result;
 try{result=await res.json()}catch{throw Error('Сервер вернул некорректный ответ')}
 if(!res.ok||!result.ok){
  if(res.status===403)throw Error('Доступ запрещён. Администратор не подтверждён.');
  if(res.status===401)throw Error('Сессия Telegram устарела. Откройте админку заново.');
  throw Error(result.error||'Временная ошибка сервиса');
 }
 return result;
}
const node=(tag,cls='',content='')=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(content!==undefined)e.textContent=content;
 return e;
};
const fmt=n=>{
 const x=Number(n);
 return Number.isFinite(x)?x.toLocaleString('ru-RU',{maximumFractionDigits:6}):'—';
};
function tab(name){
 for(const k of panels)el('panel-'+k).hidden=k!==name;
 document.querySelectorAll('.tab').forEach(b=>{
  const active=b.dataset.tab===name;b.classList.toggle('active',active);
  b.setAttribute('aria-selected',String(active));
 });
 if(name==='users')void users();
 if(name==='settings')void rates();
 if(name==='withdrawals')void withdrawals();
}
async function users(){
 const target=el('users');target.replaceChildren(node('p','hint','Загрузка…'));
 try{
  const value=await post('users',{query:el('search').value,offset,limit:LIMIT});
  target.replaceChildren();total=value.total;
  el('total-users').textContent=fmt(total);
  if(!value.rows.length)target.append(node('p','hint','Пока нет зарегистрированных аккаунтов'));
  for(const u of value.rows){
   const card=node('article','account');
   const header=node('div','account-head');
   const title=node('strong','',u.firstName||u.username||'Пользователь');
   const meta=node('span','id','ID: '+u.telegramId);
   header.append(title,meta);
   const grid=node('div','fields');
   for(const [name,val] of [
    ['Telegram',u.username?'@'+u.username:'—'],
    ['EVM',u.wallet?u.wallet.slice(0,8)+'…'+u.wallet.slice(-6):'Нет кошелька'],
    ['Пригласил',u.invitedBy||'—'],
    ['Приглашено',String(u.directInvites)],
    ['Заработано',fmt(u.earnedMtt)+' MTT'],
    ['Регистрация',String(u.createdAt||'').slice(0,16).replace('T',' ')]
   ]){
    const item=node('div','field');
    item.append(node('span','meta',name),node('strong','',val));grid.append(item);
   }
   card.append(header,grid);
   if(u.isAdmin)card.append(node('span','admin-tag','Администратор'));
   target.append(card);
  }
  el('page-info').textContent=total?Math.floor(offset/LIMIT)+1+' / '+Math.max(1,Math.ceil(total/LIMIT)):'0';
  el('prev').disabled=offset===0;
  el('next').disabled=offset+LIMIT>=total;
 }catch(e){target.replaceChildren(node('p','error',e.message))}
}
function rateInput(i){return el('rate-'+i)}
function normalizeNumber(value){
 const text=String(value).trim().replace(',','.');
 if(!/^\d{1,2}(?:\.\d{1,4})?$/.test(text))throw Error('Используйте проценты от 0 до 1 с точностью до 0,0001.');
 if(Number(text)>1)throw Error('Одна ставка не может превышать 1%.');
 return text;
}
function preview(){
 try{
  const values=[1,2,3].map(i=>Number(normalizeNumber(rateInput(i).value)));
  const sum=values.reduce((a,b)=>a+b,0);
  el('preview').textContent=values.map((v,i)=>
   'L'+(i+1)+': '+fmt(100000*v/100)+' MTT').join(' · ')+
   ' · Всего '+fmt(sum*1000)+' MTT';
  el('save').disabled=sum>1;
  setNotice(sum>1?'Сумма ставок превышает 1%.':'');
 }catch(e){el('preview').textContent='Укажите корректные ставки';el('save').disabled=true}
}
async function rates(){
 try{
  const value=await post('rates');
  for(const r of value.rates)rateInput(r.level).value=r.percent;
  preview();
 }catch(e){setNotice(e.message)}
}
async function withdrawals(){
 const target=el('withdrawals');target.replaceChildren(node('p','hint','Загрузка…'));
 try{
  const value=await post('withdrawals');
  target.replaceChildren();
  if(!value.requests.length)target.append(node('p','hint','Ожидающих заявок нет.'));
  for(const req of value.requests){
   const card=node('article','account');
   card.append(node('strong','',fmt(req.amountMtt)+' MTT'),
    node('div','hint','Заявка #'+req.id+' · Telegram ID '+req.userId),
    node('div','hint','Статус: ожидает ручной проверки · '+req.createdAt));
   target.append(card);
  }
 }catch(e){target.replaceChildren(node('p','error',e.message))}
}
for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>tab(b.dataset.tab));
el('refresh-users').addEventListener('click',()=>void users());
el('refresh-withdrawals').addEventListener('click',()=>void withdrawals());
el('prev').addEventListener('click',()=>{offset=Math.max(0,offset-LIMIT);void users()});
el('next').addEventListener('click',()=>{if(offset+LIMIT<total){offset+=LIMIT;void users()}});
let debounce;
el('search').addEventListener('input',()=>{
 clearTimeout(debounce);debounce=setTimeout(()=>{offset=0;void users()},260);
});
for(let i=1;i<=3;i++)rateInput(i).addEventListener('input',preview);
el('rates-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 busy=true;el('save').disabled=true;setNotice('Сохраняем настройки…');
 try{
  const percentages=[1,2,3].map(i=>normalizeNumber(rateInput(i).value));
  const value=await post('rates/update',{percentages});
  setNotice('✅ Сохранено. Ставки применяются только к новым обменам.');
  for(const r of value.rates)rateInput(r.level).value=r.percent;
 }catch(e){setNotice('Ошибка: '+e.message)}
 finally{busy=false;preview()}
});
(async()=>{
 try{
  if(!tg?.initData)throw Error('Откройте админ-панель кнопкой в чате GiftMutant.');
  const res=await fetch('./config.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  const config=await res.json();
  if(!/^https:\/\/[a-z0-9.-]+$/i.test(config.apiBaseUrl||''))throw Error('Шлюз не настроен.');
  base=config.apiBaseUrl;
  await post('rates');
  el('lock').hidden=true;el('admin').hidden=false;
  await users();
 }catch(e){showError(e.message)}
})();
