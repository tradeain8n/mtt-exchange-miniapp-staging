# Baby MTT V2 — REA: однокнопочный запуск MTT SPORTS, 12.11.2026

## Подтверждено публичным MTProto (read-only)
Считано существующей авторизованной сессией Telegram MCP на TV Box, без отправки сообщений или создания аккаунтов.

- Бот @MTTSPORTS_bot, историческое сообщение ID 37833.
- Кнопка Play Now: тип InlineButtonTypeUrl.
- Её точный URL: https://t.me/MTTSPORTS_bot/MTTSPORTS?startapp=eyJwYXRoIjoiLyIsInBhcmFtcyI6e319
- Это **именованное Direct Link Mini App** с short_name MTTSPORTS, не обычный web_app и не OAuth login_url.
- Параметр startapp декодируется в JSON: {"path":"/","params":{}}.
- В этом конкретном startapp **нет реферального кода**. Отдельно найденная в истории бота ссылка https://mtt.xyz/?i=cd042562 не является URL кнопки Play Now.
- По данным user MTProto, @MTTSPORTS_bot имеет bot_has_main_app=false (но именованное приложение есть); @MTT_SPORTS_bot — false; @MttNetwork_bot и @MttPokerbot — true.
- Наличие Main Mini App и именованного Direct Link Mini App — две различные функции Telegram.
- Пользователь в другом боте попадает в **уже существующий** MTT SPORTS аккаунт. Это не доказывает автоматическую регистрацию нового человека.

## Техническая интерпретация
Telegram открывает именное Mini App по t.me/<bot>/<short_name>?startapp=<payload> через messages.getBotApp и messages.requestAppWebView. Клиент выдаёт initData для указанного бота, и MTT SPORTS может восстановить аккаунт, если его сервер доверяет этому источнику. Telegram ID пользователя глобален, но initData бот-специфична; подпись от GiftMutant не эквивалентна подписи другого бота.

В публичном JS-клиенте MTT SPORTS найден TelegramUser auth с параметром initDataRaw и резервный Telegram Login Widget. При запуске сайта как web_app от GiftMutant вход через Telegram ранее возвращал "linked account invalid". Не найден подтверждённый публичный API, которым владелец произвольного реферального бота вправе регистрировать пользователя MTT SPORTS по чужой подписи.

## Практический способ повторить UX в НАШЕМ боте
1. В @BotFather создать /newapp под @GiftMutantBot, например с short_name BabyMTT. В качестве URL указать https://tradeain8n.github.io/mtt-exchange-miniapp-staging/ .
2. Только после реальной регистрации короткого имени появится ссылка вида https://t.me/GiftMutantBot/BabyMTT?startapp=<payload> (этот пример не является подтверждённой существующей ссылкой).
3. Через Telegram initData подтвердить Telegram ID в СВОЁМ Baby MTT backend/Supabase. Это даёт мгновенный вход в Baby MTT, не MTT SPORTS.
4. Для регистрации MTT SPORTS оставить проверенную ссылку https://mtt.xyz/?i=ba434b5a и официальный вход через email-код.
5. Для реального one-tap входа именно в MTT SPORTS и реферальной атрибуции запросить у оператора MTT SPORTS зарегистрированный партнёрский bot-id, механизм доверенного Telegram SSO, принимаемые поля startapp и endpoint подтверждения реферала.

Не подставлять выдуманные referral-ключи в startapp чужого бота: Telegram передаст параметр, но MTT SPORTS может игнорировать его или зачислить пользователя другому рефереру. Не копировать чужие токены/куки. Не вводить реальные средства до проверки котировки, комиссии и EVM-адреса.

## Исправление короткого адреса BotFather
На скриншоте URL поле прокручено вправо; визуальное отсутствие последних символов не доказывает лимит.
Корневой адрес уже отвечает HTTP 200:
https://tradeain8n.github.io/mtt-exchange-miniapp-staging/

В GitHub Pages docs/index.html заменён на перенаправление к актуальной странице docs/yaako.html. Параметры Telegram запуска сохраняются. Прежняя BSC-страница перенесена в docs/legacy-bsc.html без изменения backend. Точечные тесты: 2/2 PASS.

## Внешние источники
- Telegram named Mini Apps: https://core.telegram.org/api/bots/webapps
- Telegram startapp links: https://core.telegram.org/api/links
- Telegram initData: https://core.telegram.org/bots/webapps
- Telegram iOS startapp processing: https://github.com/TelegramMessenger/Telegram-iOS/pull/2289
- Telegram Desktop app-link issue: https://github.com/telegramdesktop/tdesktop/issues/26211
- Telegram auth architecture: https://habr.com/ru/articles/889270/
- MTT SPORTS promotion: https://www.mttsports.com/

Поиск GitHub/форумов/YouTube не дал подтверждённого открытого репозитория, содержащего официальный код серверной регистрации @MTTSPORTS_bot или партнёрский API для произвольных Telegram-ботов.
