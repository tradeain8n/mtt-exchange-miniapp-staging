import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const page=readFileSync(fileURLToPath(new URL('../docs/mttsports-connect.html',import.meta.url)),'utf8');

test('MTT SPORTS connect is Telegram-authenticated but does not handle email OTP',()=>{
 assert.match(page,/telegram-web-app\.js/);
 assert.match(page,/tg\.initData/);
 assert.match(page,/\/api\/giftmutant\/mttsports\/status/);
 assert.match(page,/credentials:'omit'/);
 assert.match(page,/https:\/\/mtt\.xyz\/\?i=ba434b5a|mttsports-email\.html/);
 assert.match(page,/id="recipientAddress"/);
 assert.match(page,/id="recipientConfirm"/);
 assert.match(page,/\/api\/giftmutant\/mttsports\/recipient\/save/);
 assert.match(page,/подтверждённой MTT SPORTS привязкой|не подтверждённой MTT SPORTS привязкой|не подтверждённая MTT SPORTS привязка/);
 assert.doesNotMatch(page,/id="otp"|name="password"|name="captcha"/i);
 assert.doesNotMatch(page,/document\.cookie|localStorage|sessionStorage|password\s*[:=]|captcha\s*[:=]/i);
});
test('connected state requires verified provider proof, otherwise not linked',()=>{
 assert.match(page,/verified_provider_signed/);
 assert.match(page,/email_cli_authenticated/);
 assert.match(page,/chainId===6880/);
 assert.match(page,/0x\[0-9a-f\]/i);
 assert.match(page,/MTT SPORTS не подключён/);
 assert.match(page,/Не удалось проверить связь/);
 assert.match(page,/Подключение игрового кошелька/);
 assert.match(page,/self_reported/);
 assert.doesNotMatch(page,/mttmail|Gmail OAuth/i);
});

test('connect UI never opens a third-party Telegram bot',()=>{
 const html=readFileSync(new URL('../docs/mttsports-connect.html',import.meta.url),'utf8');
 assert.equal(html.includes('t.me/MTTSPORTS_bot'),false);
 assert.equal(html.includes('startapp='),false);
 assert.match(html,/https:\/\/mtt\.xyz\/\?i=ba434b5a/);
});
