# MTT SPORTS: Telegram bot registration and Yaako login (read-only research, 2026-11-12)

## Evidence
- User screenshots: MTT SPORTS opens in @GiftMutantBot Telegram WebView. Telegram login shows an official-looking `Telegram Authorization / Please confirm if authorized?` dialog then `linked account invalid`. Email OTP in the same Telegram WebView authenticated the expected existing MTT SPORTS account.
- Yaako account chooser is native Yaako; granting MTT SPORTS access returned to an authenticated Safari page, not the original Telegram WebView.
- Older screenshot from the official @MTTSPORTS_bot Mini App shows an in-game profile labeled in the `@tg_...` format, consistent with a Telegram-linked identity.
- The user's connected Telegram MCP chat history for @MTTSPORTS_bot contains /start commands and a 2025-01 welcome message advertising free / MTT games. It does not disclose a server-side account-creation event. /start must not be considered proof that a permanent account was created.

## Public JS verified directly from the MTT SPORTS frontend
- https://static-s3.mtt.xyz/app-v/s01/js/shared_telegramOAuth2-DEQ63aN1.js
- https://static-s3.mtt.xyz/app-v/s01/js/loginV2_telegramCommon-FvdNtDjJ.js
- https://static-s3.mtt.xyz/app-v/s01/js/shared_yaakoAuth-BUbh4VkZ.js
- https://static-s3.mtt.xyz/app-v/s01/js/loginV2_autoGuestRegister-DngnkbGA.js

The official Telegram OAuth client checks Telegram WebApp launch data; when present it passes `{ accountType: TelegramUser, params: initDataRaw }` into its auth callback. When absent, it has a Telegram Login Widget fallback. The script contains the exact Telegram Authorization confirmation dialog seen on the screenshot. One branch redirects from sports.mtt.xyz to play.mttsports.com with opentg=true.

The official Yaako OAuth client sends its own MTT SPORTS client_id, redirect_uri, response_type=code, scope=profile and oauth2SiteType=container. On mobile it can navigate via window.location.href. This code cannot make Baby MTT a Yaako OAuth client and cannot control iOS Safari handoff.

## Likely reason for Telegram login error
Telegram Mini App initData is signed and bot-scoped (https://core.telegram.org/bots/webapps). Launching mtt.xyz as a `web_app` from @GiftMutantBot supplies data bound to that bot, NOT the official @MTTSPORTS_bot. If MTT SPORTS expects its own bot's initData signature, this would produce invalid credentials or account-binding errors. This is a grounded hypothesis, NOT confirmed by MTT SPORTS backend logs.
Alternative explanations include a Telegram identity bound to another MTT SPORTS account, conflicting Yaako/game identities, outdated sessions and callback bugs.

## Recommended tests (no funds, no OTP screenshots)
1. Launch the Mini App from the actual https://t.me/MTTSPORTS_bot, not from our @GiftMutantBot. Confirm which existing profile is displayed. Do not blindly create a new account.
2. From @GiftMutantBot, use the referral landing page https://mtt.xyz/?i=ba434b5a for attribution; this referral URL alone does NOT prove a new referral was credited.
3. When MTT SPORTS is launched from our bot, use email OTP as the user-confirmed working fallback. Do not assume email and Telegram logins resolve to the same game account until their displayed identities match.
4. Compare FULL public MTT Network EVM receiving addresses in Yaako and MTT SPORTS Web3. Game Wallet and Web3 balances are not necessarily interchangeable.
5. Do not send Telegram initData across bot trust boundaries, copy Yaako cookies, or intercept a third-party OAuth code.

## Product decisions
- Keep separate actions for referral website, official @MTTSPORTS_bot and email fallback.
- Baby MTT should authenticate its own Telegram user and verify wallet ownership via approved signature or partner API, not infer it from MTT SPORTS's independent login.
- Target 3.3 USDT on TON -> native MTT Network is unquoted and disabled until recipient, fees, minimum amount and route are independently verified.

Documentation: https://core.telegram.org/bots/webapps and https://core.telegram.org/bots/telegram-login
