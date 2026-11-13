# Baby MTT Exchange — $2 pilot interface (2026-11-13)

## User flow
1. The blue Telegram chat menu button (setChatMenuButton type web_app, text 💱 Обменник) opens https://tradeain8n.github.io/mtt-exchange-miniapp-staging/exchange.html in Telegram.
2. /wallet and the personal Мой кошелёк button open the same app on the wallet tab. Only PUBLIC EVM/TON/TRON/NEAR addresses are passed in a URL fragment; the link itself is not a cryptographic identity proof.
3. From the global menu without a personal link, the wallet tab prompts the user to open their personal wallet button; never trust unsigned initDataUnsafe as proof of identity.
4. The swap tab defaults to 2.00 USDT, BNB Smart Chain (BEP-20). All other networks are visible but disabled until tested.
5. Check route reads current public MTT Network 6880 pool reserves; it is only a pool estimate, NOT an executable MTT Swap quote. Network, bridge fees and gas excluded.
6. The payment button is intentionally disabled. No deposit, signing, seed/private key access, wallet payment request or transaction broadcasting exists in the UI.

## Historical benchmark
The previously independently verified MTT Swap route used 1.1 USDT (BSC) to buy MTT (MTT Network) for the SAME user-controlled EVM address. That precedent does not guarantee that 2 USDT works today.

## Go-live requirements
- Backup/recovery phrase shown securely to its owner and independently restored, with encrypted off-device vault and separate master-key backups.
- Verify chain and token contract, price, spread, all fees, slippage and BNB gas BEFORE accepting a payment.
- On-chain recipient must be bound and verified. An empty personal BSC address cannot forward USDT without BNB gas or a vetted gas-sponsor route.
- Client approves exact amount/destination/fees; settlement audit and idempotency avoid duplicate broadcasts.

## Focused local checks
Mini App: node --test tests/exchange-model.test.mjs tests/exchange-ui.test.mjs
Engine: node --test tests/wallet_home.test.mjs

Do NOT send real assets to a wallet created in staging until the recovery and signing gates have passed.
