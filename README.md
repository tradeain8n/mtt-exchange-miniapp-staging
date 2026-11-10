# GiftMutantBot — isolated development / staging

Telegram bot: https://t.me/GiftMutantBot
Mini App (separate GitHub Pages): https://tradeain8n.github.io/mtt-exchange-miniapp-staging/

STAGING — never send real USDT to any address shown here. This repository has no production wallet keys and no secrets.

The GitHub Actions secret GIFT_MUTANT_BOT_TOKEN is NOT provisioned automatically. Install the token privately via Termux command gh secret set GIFT_MUTANT_BOT_TOKEN -R tradeain8n/mtt-exchange-miniapp-staging, then manually run Configure Telegram Mini App menu.

Main project: https://github.com/tradeain8n/mtt-exchange-miniapp/
Promotion pipeline: stage -> automated tests -> release reviewed -> production GitHub Pages.
