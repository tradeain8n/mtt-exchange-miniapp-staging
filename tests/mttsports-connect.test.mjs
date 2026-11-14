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
 assert.doesNotMatch(page,/<input\b/i);
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
});
