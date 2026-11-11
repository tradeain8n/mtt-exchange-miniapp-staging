# Baby MTT V2: Yaako public integration & GitHub Actions plan

Updated 2026-11-11. This is public-only technical research. No personal
account data, OTP, Google tokens, Yaako cookies or wallet keys are stored here.

## Confirmed by device-side manual screenshots
- The official Yaako login at account.yaako.io/oauth2/login can load inside
  Telegram on iOS.
- Sign-in by email and verification challenge proceeds into the official Yaako
  Web Wallet interface without leaving Telegram.
- The wallet interface labels a profile as Custodial Wallet, provides an MTT
  Network selector, balance, Wallet and Bridge navigation.
- The login view may show different Google/Apple buttons between Safari and the
  Telegram browser. Do not depend on browser spoofing or unofficial OAuth URLs.
- This evidence proves a Yaako session inside Telegram. It DOES NOT prove
  ownership of the underlying EVM address to a separate Baby MTT application.

## Already implemented in staging
- Telegram Bot API identity -> signed, expiring Ed25519 link ticket.
- Supabase Edge Function checks ticket signature, issues one-time EIP-191
  challenge, validates recovered address, rejects replay.
- Separate approval command in the test bot after comparing a full address.
- Verified EVM recipient stored in server-only Supabase tables with RLS.
- Financial payouts remain disabled.
- EIP-6963 provider discovery and manual address option.

## Missing evidence
- Whether the actual Yaako custodial web wallet exposes personal_sign to
  third-party DApps in the same Telegram WebView.
- Whether Yaako offers a partner OAuth/OIDC client or an approved return
  payload containing wallet address and ownership proof.
- Whether the displayed EVM receiving address matches the MTT SPORTS
  deposit/receiving address.
- Whether native/app-only functions are accessible from Yaako Web Wallet,
  and whether Solana addresses can be linked with a separate proof.
- Whether the wallet is an EOA or requires EIP-1271 verification.
- Which restrictions, supported fees and transactions apply to the account.

## GitHub Actions integration
- mtt-exchange-engine-staging: yaako-link-ci.yml runs ONLY Yaako token,
  onboarding and bot syntax tests; optional manually invoked invalid-ticket
  Supabase test does not create any records.
- mtt-exchange-miniapp-staging: existing CI + targeted public UI tests.
- configure-bot.yml: manual only. Uses an existing GitHub encrypted
  GIFT_MUTANT_BOT_TOKEN secret to configure only @GiftMutantBot.
  It does not store bot token in source or change @babymttbot.
- yaako-public-study.yml: manual public asset analysis, optional unauthenticated
  public login UI inspection in Chromium, redacted metadata artifact only.
- All workflows use contents:read and do not contain money-transfer credentials.

## Real-device acceptance (no funds)
1. Open the staging bot and /start; verify public Yaako login still works.
2. From Yaako Wallet -> MTT Network -> Receive, copy the full EVM address.
3. Compare it with MTT SPORTS Web3 receiving address, both MTT Network.
4. In staging /start choose EVM verification. Attempt provider discovery.
5. If no provider is available, record this as a platform limitation. Do not
   paste Yaako credentials/cookies into our site.
6. If Yaako supports personal_sign, sign only the one-time message and return to
   the bot for separate /approve. Check /recipient remains stable on re-login.
7. For custodial wallets without an exposed signer, use a provisional recipient
   with explicit manual confirmation until an official partner API is available.

## Product roadmap
1. Official Yaako linking request: ask for partner OAuth/OIDC specs and callback,
   approved address/chain scopes, signature/SIWE and app DApp support.
2. User-focused verified recipient picker: Baby MTT, Yaako EVM, MTT SPORTS
   receiving address, and Solana separately. Never imply addresses are equal.
3. Read-only MTT explorer and recipient risk validation before funding any swap.
4. Design an independently branded EVM wallet and swap UI, not a copied Yaako app.

## Security
Do not publish email codes, OTP screenshots, private keys, recovery phrases,
OAuth tokens or authenticated network traces. Never upload screenshots from
a logged-in personal Yaako account to GitHub Actions artifacts. Screenshots,
HTTP requests and source maps can contain sensitive session material.
