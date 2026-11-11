// STAGING ONLY: connect to a real injected Yaako EVM provider.
// This file NEVER injects or impersonates a provider and NEVER requests keys or payments.
export const OFFICIAL_YAAKO_LOGIN = 'https://yaako.io/loginMobile';
export const MTT_CHAIN_HEX = '0x1ae0'; // 6880

const evm = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);

export function isYaakoProvider(info, provider) {
  return typeof provider?.request === 'function' &&
    (info?.rdns === 'com.yaako.wallet' || provider.isYaakoWallet === true);
}

export async function discoverYaako(win = window, timeoutMs = 650) {
  if (!win?.addEventListener || !win?.dispatchEvent) return null;
  const candidates = [];
  const onProvider = event => {
    const {info, provider} = event?.detail || {};
    if (isYaakoProvider(info, provider) && !candidates.includes(provider)) candidates.push(provider);
  };
  win.addEventListener('eip6963:announceProvider', onProvider);
  try {
    const requestEvent = typeof win.Event === 'function'
      ? new win.Event('eip6963:requestProvider')
      : {type: 'eip6963:requestProvider'};
    win.dispatchEvent(requestEvent);
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
  } finally {
    win.removeEventListener?.('eip6963:announceProvider', onProvider);
  }
  if (candidates.length) return candidates[0];
  return isYaakoProvider(null, win.ethereum) ? win.ethereum : null;
}

// Explicit user action only. Provider detection is NOT proof of wallet ownership.
export async function connectYaako(win = window, timeoutMs = 650) {
  const provider = await discoverYaako(win, timeoutMs);
  if (!provider) return {status: 'unavailable'};
  let accounts;
  try { accounts = await provider.request({method:'eth_requestAccounts'}); }
  catch { return {status:'cancelled'}; }
  if (!Array.isArray(accounts) || !evm(accounts[0])) return {status:'invalid_address'};
  let chainId = null;
  try { chainId = await provider.request({method:'eth_chainId'}); } catch {}
  const address = accounts[0];
  return {
    status: String(chainId).toLowerCase() === MTT_CHAIN_HEX ? 'connected_unverified' : 'chain_mismatch',
    address, chainId, verified: false
  };
}
