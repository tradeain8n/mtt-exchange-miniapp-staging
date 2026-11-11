# Baby MTT V2 — MTT SPORTS referral and USDT TON target (STAGING)

## User goal

- Input: 3.3 USDT on TON.
- Output: native MTT on MTT Network (chainId 6880).
- Recipient: the user's MTT SPORTS Web3 EVM address, expected (but not yet
  proven) to match the existing Yaako Wallet receiving address.
- Referral registration: https://mtt.xyz/?i=ba434b5a
- Official MTT SPORTS Telegram bot: https://t.me/MTTSPORTS_bot

NO PAYMENT IS ENABLED. Public endpoint availability is not a quote or proof
of supported bridging, referral attribution or MTT SPORTS authorization.

## First-run UX

1. Open https://t.me/GiftMutantBot and send a NEW /start.
2. The first button opens MTT SPORTS registration through the original referral
   URL inside the Telegram Web App.
3. Sign in at official MTT SPORTS, return to @GiftMutantBot.
4. Tap the button "Я вошёл в MTT SPORTS · запустить автопроверку".
5. Bot dispatches a fixed, read-only GitHub Action through the TV Box's
   existing authenticated GitHub CLI; bot returns the Actions run link.
6. On the Actions page, read Summary and the Markdown report artifact.

Clicking "Я вошёл" is a USER ATTESTATION, not an OAuth callback. No verified
external OAuth callback exists for this Baby MTT integration yet. GitHub Actions
cannot independently authenticate an MTT SPORTS session from the referral URL.

## Fixed read-only GitHub Action

- Exact referral code and public site availability.
- MTT SPORTS public web and Telegram bot landing pages.
- Yaako public login page without credentials or sessions.
- Public EVM chain ID (6880), no on-chain transfers.
- Invalid Supabase link-ticket denial.
- Test Telegram Bot API identity and command/menu status.
- Financial route status: 3.3 USDT TON to native MTT unquoted and blocked.

No Telegram user ID, email, OTP, cookies, private keys, wallets or payment
details are transmitted to GitHub. Action permissions are contents:read;
the encrypted test-bot token is used only for read-only Bot API calls.

## Local acceptance

    cd ~/projects/mtt-exchange-engine-staging
    node --test tests/mttsports_referral.test.mjs tests/yaako_onboarding.test.mjs
    cd ~/projects/mtt-exchange-miniapp-staging
    node --test tests/mttsports_autocheck.test.mjs
    node --check scripts/mttsports_autocheck.mjs

In Telegram:
- /start shows MTT SPORTS referral first, then post-login test and Yaako path.
- After official login, tap post-login check, open the returned GitHub report.
- Compare FULL Yaako and MTT SPORTS EVM receiving addresses on MTT Network.
- /recipient only becomes the qualified address when a supported signing
  method verified it. No transfer to an unverified address.
- No real USDT TON payment until exchange provider, amount minimum, fees,
  liquidity and payout route are independently verified.

## Rollback

Revert staging changes and restart ONLY gift-mutant-chat. Leave baby-mtt-chat,
production financial workers and Hermes collective memory untouched.

## Further product options

1. Ask Yaako/MTT SPORTS for partner OAuth callback and approved account-to-
   address linking API instead of treating a local login as shared identity.
2. Live USDT TON to native MTT route quotation with fees/minimum checks.
3. Verified recipient picker for Yaako, MTT SPORTS and Baby MTT EVM addresses.


## Confirmed GitHub Actions acceptance (2026-11-11)

Code was merged through:
- Engine PR #8: https://github.com/tradeain8n/mtt-exchange-engine-staging/pull/8
- Mini App PR #9: https://github.com/tradeain8n/mtt-exchange-miniapp-staging/pull/9

Real Action runs:
- Backend EVM / Telegram regression CI:
  https://github.com/tradeain8n/mtt-exchange-engine-staging/actions/runs/43079841274 — PASS
- Test Telegram menu update:
  https://github.com/tradeain8n/mtt-exchange-miniapp-staging/actions/runs/43079924765 — PASS
- Read-only MTT SPORTS / Yaako / Supabase readiness:
  https://github.com/tradeain8n/mtt-exchange-miniapp-staging/actions/runs/43079931488 — PASS

The read-only report returned **10/10 PASS**:
1. Referral URL contains the user-provided code i=ba434b5a.
2. Referral landing page mtt.xyz: HTTP 200.
3. MTT SPORTS web client sports.mtt.xyz: HTTP 200.
4. @MTTSPORTS_bot public Telegram page: HTTP 200.
5. Yaako public login account.yaako.io: HTTP 200.
6. MTT Network public RPC eth_chainId: 0x1ae0 (6880).
7. Supabase EVM-link API rejects an invalid ticket: HTTP 401.
8. Test Bot API identity is @GiftMutantBot, not the production bot.
9. Bot command list includes start, mttsports, mttsportscheck, linkstatus and recipient.
10. Bot Web App menu points only to our staging GitHub Pages host.

None of these is proof of a *specific user's successful MTT SPORTS login* or of
referral reward attribution. The user confirms login by clicking the second
Telegram button; no account, cookies or personally identifying details are
transmitted into GitHub Actions.

Financial route **3.3 USDT on TON -> native MTT on chain 6880 remains UNQUOTED
and DISABLED** until a live executable route, fees, minimum amount, token
identifiers, and a confirmed final recipient are verified.

Important possible mismatch: prior user screenshots displayed differing
shortened Yaako and MTT SPORTS EVM addresses. Full receiving-address equality
must be checked manually; shared application login is insufficient.

Next acceptance:
- User opens @GiftMutantBot, sends a new /start, taps MTT SPORTS referral.
- After official login, returns and taps "Я вошёл ... запустить автопроверку".
- Bot returns a fresh Actions URL, which includes the full report in Summary.
- Only afterwards compare MTT SPORTS and Yaako full EVM addresses and test
  permitted EIP-191 ownership proof; no real transfers.
