# Baby MTT V2 — Telegram Main Mini App versus inline Web App

Дата анализа: 12 ноября 2026. Основа: два скриншота пользователя с iPhone и публичная документация Telegram.

## Наблюдаемое
- В другом MTT-боте в меню троеточия присутствует Add to Home Screen, а существующий игровой аккаунт открывается сразу.
- В GiftMutant, когда чужой сайт mtt.xyz запускается через inline web_app, пункта Add to Home Screen нет, сайт требует вход и Telegram SSO сообщает о недействительной привязке.
- Когда GiftMutant открывает mtt.xyz обычной кнопкой URL, iOS предлагает открыть ссылку и переводит в Safari.
- По одному меню нельзя доказать точный тип кнопки другого бота и факт автоматической регистрации действительно нового игрока.

## Техническая причина различий
Telegram поддерживает отдельные механизмы:
- Inline Web App: URL в inline-кнопке, запуск через messages.requestWebView.
- Menu Button: выставляется Bot API setChatMenuButton, также запускается как Inline Web App.
- Main Mini App: регистрируется владельцем бота через @BotFather, клиент запускает его через messages.requestMainWebView; поддерживает профильную кнопку Launch App и ссылку t.me/<bot>?startapp.

Наш GitHub workflow configure-bot.yml настраивает именно Menu Button для @GiftMutantBot. **Он не включает Main Mini App**. В GitHub-лог настройки добавлен read-only флаг getMe.has_main_web_app.

Пункт Add to Home Screen — полезная подсказка о специальной конфигурации Main Mini App или возможностях клиента, но без MTProto-профиля и типа кнопки нельзя категорически объяснять его наличие только одной настройкой.

Ограничение безопасности: Telegram WebApp initData криптографически привязаны к боту запуска. Включение Main Mini App у Baby MTT не означает, что MTT SPORTS начнёт принимать наши initData для своего собственного SSO.

## Исправления в тестовом Baby MTT
1. Убрана кнопка, которая ошибочно обещала быстрый Telegram ID-вход в сторонний MTT SPORTS: этот эксперимент повторно не сработал на iPhone.
2. Первой кнопкой поставлен реферальный вход по email внутри Telegram (inline web_app), строго https://mtt.xyz/?i=ba434b5a. Этот вариант пользователь ранее успешно проверил.
3. Второй кнопкой запускается **наш** Mini App https://tradeain8n.github.io/mtt-exchange-miniapp-staging/yaako.html — корректный контекст собственного бота.
4. Отдельная обычная URL-кнопка ведёт в Safari (по решению Telegram/iOS) с тем же рефералом.
5. Сохранены user-attested статус, публичная GitHub-проверка и последующее независимое доказательство владения EVM-адресом Yaako.
6. Реальные обмены, депозиты и платежи отключены.

## Для включения Main Mini App (выполняется владельцем в BotFather)
1. Открыть https://t.me/BotFather и отправить /mybots.
2. Выбрать @GiftMutantBot → настройки Mini App / Main Mini App (наименования пунктов могут меняться).
3. Указать HTTPS URL: https://tradeain8n.github.io/mtt-exchange-miniapp-staging/yaako.html
4. Сохранить и включить кнопку открытия приложения в профиле.
5. Открыть https://t.me/GiftMutantBot?startapp и проверить открытие Main Mini App.
6. Запустить существующий GitHub Action configure-bot.yml и посмотреть строку BOT_MENU_VERIFIED с has_main_web_app. Если true — Main Mini App действительно зарегистрирован. Если false — настройка не завершена.

Важно: конфигурация Main Mini App доступна только владельцу в BotFather; Bot API setChatMenuButton не устанавливает этот статус. Внешний mtt.xyz не должен быть нашим Main Mini App — он не принадлежит Baby MTT.

## Приёмка без средств
- /start показывает email-вход MTT SPORTS по ba434b5a, затем запуск собственного Baby MTT Mini App.
- Никакая кнопка не обещает автоматический MTT SPORTS Telegram SSO.
- На iPhone внешний mtt.xyz может открываться Safari; это не ошибка Baby MTT.
- По почте выполняется официальный MTT SPORTS вход, код остаётся внутри стороннего сайта.
- Реферальное начисление и состояние MTT SPORTS проверяются на стороне платформы, не приписываются GitHub Actions.
- Telegram ID нашего пользователя в собственном приложении отдельно проверяется на Supabase, EVM-адрес подтверждается криптографически.
- Цель 3,3 USDT TON → нативный MTT Network 6880 остаётся заблокированной до проверки маршрута, суммы, ликвидности и получателя.

Источники:
- https://core.telegram.org/bots/webapps
- https://core.telegram.org/api/bots/webapps
- https://core.telegram.org/api/links

Дальнейшие идеи: официальный партнёрский MTT SPORTS OAuth / Telegram bot SSO; собственный Main Mini App Baby MTT; проверяемый интерфейс выбора игрового EVM-кошелька.
