// GiftMutant staging route matrix. Visible != executable: only verified routes sign.
export const EXCHANGE_NETWORKS=Object.freeze({
 ton:{label:'TON',tokens:['USDT']},
 bsc:{label:'BNB Smart Chain',tokens:['USDT']},
 mtt:{label:'MTT Network',tokens:['USDT','MTT']}
});
export const LIMITS=Object.freeze({minUsd:'0.1',maxUsd:'20'});
const re=/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;
export function parseInput(value){
 const text=String(value||'').trim().replace(',','.');
 if(!re.test(text))return null;
 const number=Number(text);
 return Number.isFinite(number)&&number>0?number:null;
}
export function exchangeRoute({inputToken='USDT',inputNetwork='ton',outputNetwork='mtt',amount='3'}={}){
 const sell=inputToken==='MTT';
 if(!['USDT','MTT'].includes(inputToken)||!EXCHANGE_NETWORKS[inputNetwork]?.tokens.includes(inputToken))
  return {valid:false,reason:'Токен недоступен в выбранной сети.'};
 const outputToken=sell?'USDT':'MTT';
 if(!EXCHANGE_NETWORKS[outputNetwork]?.tokens.includes(outputToken))
  return {valid:false,reason:'Токен назначения недоступен в выбранной сети.'};
 const amountNum=parseInput(amount);
 if(amountNum===null)return {valid:false,reason:'Введите положительную сумму.'};
 if(!sell&&(amountNum<0.1||amountNum>20))
  return {valid:false,reason:'Лимит обмена: от 0,10 до 20 USDT.'};
 const livePilot=!sell&&inputNetwork==='ton'&&outputNetwork==='mtt'&&amountNum===3;
 const liveSell=sell&&inputNetwork==='mtt'&&outputNetwork==='mtt';
 return {
  valid:true,kind:sell?'sell':'buy',inputToken,outputToken,inputNetwork,outputNetwork,
  executable:livePilot||liveSell,livePilot,liveSell,
  quoteOnly:!(livePilot||liveSell),
  feeBps:sell?0:1000,
  reason:livePilot?'Действующий пилот: ровно 3 USDT TON → MTT.'
   :liveSell?'MTT → USDT MTT через проверенный пул. Выплата на тот же EVM-адрес.'
   :'Курс доступен для оценки; исполнение этого маршрута ещё не подключено.'
 };
}
