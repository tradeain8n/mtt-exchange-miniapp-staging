// Public Yaako sign-in only: no auth submission, passwords, OTP or cookies.
// Browser UA simulation is NOT identical to real iOS Telegram WKWebView.
import {chromium} from 'playwright';
import {writeFileSync,mkdirSync} from 'node:fs';
const url='https://account.yaako.io/oauth2/login?lang=ru&oauth2SiteType=container&mainurl=https%3A%2F%2Fyaako.io%2Foauth2%2Fcallback';
const personas=[
 {name:'chromium-default',userAgent:null},
 {name:'ios-safari-UA-on-chromium',
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'},
 {name:'telegram-ios-UA-on-chromium',
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram/11.15'}
];
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const user of personas){
  const context=await browser.newContext({
   viewport:{width:390,height:844},isMobile:true,
   ...(user.userAgent?{userAgent:user.userAgent}:{})
  });
  try{
   const page=await context.newPage();
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForTimeout(3500);
   const info=await page.evaluate(()=>{
    const content=document.body.innerText.toLowerCase();
    return {
     googleVisible:/google|гугл/.test(content),
     appleVisible:/apple|эппл/.test(content),
     loginHeadingVisible:/log in|sign up|войти|регистрация/.test(content),
     buttonCount:document.querySelectorAll('button').length
    };
   });
   results.push({environment:user.name,http:response?.status()??null,
    origin:new URL(page.url()).origin,...info,
    caveat:'Chromium UA test; not genuine iOS Telegram WebView'});
  }catch(error){results.push({environment:user.name,error:String(error.message).slice(0,150)});}
  finally{await context.close();}
 }
}finally{await browser.close();}
mkdirSync('research-output',{recursive:true});
writeFileSync('research-output/yaako-login-public-ui.json',JSON.stringify(results,null,2)+'\n');
console.log('YAAKO_PUBLIC_UI',JSON.stringify(results.map(x=>({
 environment:x.environment,google:x.googleVisible,apple:x.appleVisible,error:x.error||null
}))));
function userAgent(value){return value;}
