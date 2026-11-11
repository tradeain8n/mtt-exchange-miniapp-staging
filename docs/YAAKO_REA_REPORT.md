# Yaako public-client REA / Baby MTT staging integration

Date: 2026-11-11. Scope: ONLY publicly served Yaako website JS and the published SDK.
No third-party account sessions, hidden APIs, authenticated requests, app binary
decompilation, PIN/OTP capture, secret extraction, or payment execution.

## Evidence, independently retrieved on TV Box

- Official website: https://yaako.io/ (HTTP 200, first-party SPA).
- Public first-party JS: https://yaako.io/assets/index-C6x--gq-.js
- JavaScript bytes: 7,334,970.
- SHA-256: 6e402e0b9c683a016d4da9a911d680323c1d4a2dc35c5ff76619e478e1e3f49f
- External wallet SDK served by official site:
  https://static-s3.mtt.xyz/unpkg/wallet-sdk/master/41/yaw.umd.js
- Related publicly readable wallet SDK:
  https://github.com/btcSteven/wallet-etherum-sdk
  (EIP-1193, EIP-6963, personal_sign, chain switch and eth_requestAccounts)

### Confirmed first-party frontend references

- Production account host: https://account.yaako.io/
- OAuth UI path: oauth2/login; official mobile route: /loginMobile.
- Site's OWN callback path: /oauth2/callback.
- The site's first-party frontend constructs its own oauth2 login URL with
  oauth2SiteType=container and mainurl pointing to its own callback.
- Public frontend includes Google/Apple OAuth interface strings.
- Public generated network enums include MttMainnet (6880), SolanaMainnet (6020),
  and other networks.
- Wallet UI localization mentions import from mnemonic/private key and viewing
  a private key. These strings are NOT proof that export/import is permitted for
  every account, wallet type or platform.
- A generated protobuf message name "PullAddressSecretReq" is present in a
  public bundle. We did NOT call it and MUST NOT try to extract wallet secrets.

### Limits and trust boundaries

The public web-client code is not the original native iOS/Android application
binary or any private server implementation. No evidence confirms that Yaako
provides a third-party OAuth client registration, published Partner SDK, or
automatic account linking to MTT SPORTS for our project. In particular, other
providers' iframe restrictions or third-party cookies can block Google/Apple
sign-in inside a Telegram Mini App.

A link to yaako.io does not authenticate a Baby MTT user. Even if Yaako signs
the user in on its origin, Baby MTT cannot legitimately read Yaako cookies,
tokens or cross-origin iframe contents. Never present an imitation Google,
Apple or Yaako password entry form. Do NOT use the custody wallet SDK merely
to inject a fake window.ethereum provider into our page.

## Implemented in STAGING

- The prior iframe was removed after a real iPhone/Telegram test showed a black page.
- The first-run button now links directly to the confirmed official
  https://account.yaako.io/oauth2/login login page, without proxying or framing it.
- No browser OAuth token or Yaako session is returned to Baby MTT; connecting
  an address remains an independent follow-up action.
- A separately triggered EIP-6963 lookup recognizes Yaako by
  rdns=com.yaako.wallet, with isYaakoWallet fallback.
- When supported, eth_requestAccounts is requested with explicit user action,
  and eth_chainId is checked against MTT Chain ID 6880 (0x1ae0).
- Returned address is always tagged UNVERIFIED: wallet branding is not
  cryptographic proof of ownership.
- The existing manual EVM public-address flow and skip-Yaako option remain.
- No seed, password, private key, OAuth code/token, payment request or transaction
  is passed through our application.

## Targeted acceptance

    cd ~/projects/mtt-exchange-miniapp-staging
    node --test tests/yaako-provider.test.mjs
    node --check docs/assets/yaako-provider.js

In a Telegram device, open the existing test bot https://t.me/GiftMutantBot
and choose the staging registration Mini App. Open the official Yaako login in Safari using the direct link.
Confirm that the previous blank iframe is gone from the staging Mini App.
The Baby MTT session and the Yaako login remain separate. Return and try wallet detection; an unavailable
injected provider is an expected, safe result inside Telegram's WebView.

## Next product features

1. Partner SSO: request documented OAuth client ID, redirect whitelisting,
   account-link response specification and scope from official Yaako owners.
   Until then do not claim "Continue with Yaako" is a Baby MTT login.
2. EVM proof: sign a one-time, domain-scoped challenge with personal_sign;
   verify EIP-191 on our backend and store a verified address in Supabase.
   Do not unlock transfers or financial activity before hardening.
3. Solana: use a separate Solana wallet adapter and signature proof. Do not
   attempt to derive Solana addresses from the Ethereum provider or assume
   one wallet key represents both networks.
4. Recipient UX: distinguish Baby MTT address, a verified external Yaako
   address and a manually entered unverified MTT SPORTS payout address.
5. Read-only portfolio/transaction history: retrieve only public MTT/Solana
   chain data for verified or willingly provided addresses, with separate
   explicit permissions where required.

## Rollback

Only the staging repository and static registration page are changed.
Production bot/exchange/settlement, secrets and on-chain transactions remain
untouched. Reverting the staging frontend commit restores the old onboarding.
