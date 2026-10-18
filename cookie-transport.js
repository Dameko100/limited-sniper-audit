// Excerpt from roblox-api.js (Limited Sniper v1.0.26), abridged.
// Only the code that attaches your .ROBLOSECURITY cookie to a request.
// Sections marked "…" were removed; nothing in between touches the cookie.

// Every request sent by the app uses these headers.
const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.roblox.com',
  'Referer': 'https://www.roblox.com/',
};

// ── The only place the cookie is attached to a request ──
function buildClient(cookie = '') {
  const cached = _clientCache.get(cookie);
  if (cached) return cached;
  const headers = { ...BASE_HEADERS };
  if (cookie) headers['Cookie'] = `.ROBLOSECURITY=${cookie}`;
  const client = attachDiagnostics(axios.create({ headers, timeout: 8000, httpAgent, httpsAgent }));
  if (_clientCache.size > 20) _clientCache.delete(_clientCache.keys().next().value);
  _clientCache.set(cookie, client);
  return client;
}

// ── Optional proxies: they never receive the cookie ──
// Slot 0 is always the direct connection (your IP, with cookie). Each proxy
// gets its own client built from BASE_HEADERS only (no cookie).
function setPollProxies(list) {
  // …
  _pollSlots = valid.length ? [{ label: 'direct', client: null /* uses buildClient(cookie) */ }, ...valid.map((line, index) => {
    const url = parseProxyLine(line);
    const agent = new ProxyTunnelAgent(url);
    const client = attachDiagnostics(axios.create({ headers: { ...BASE_HEADERS }, timeout: 8000, httpsAgent: agent, proxy: false }), index + 1);
    return { label: 'proxy', host: url.host, agent, client };
  })] : [];
  // …
}

// Price polling: a proxy slot uses its own anonymous client; only the direct
// slot (client: null) falls back to buildClient(cookie).
async function getUGCResaleListings(collectibleItemId, cookie) {
  if (!_pollSlots.length) return _getUGCResaleListings(collectibleItemId, buildClient(cookie), false);
  // …
  const slot = await _acquirePollSlot();
  const listings = await _getUGCResaleListings(collectibleItemId, slot.client || buildClient(cookie), !!slot.client /* … */);
  // …
}

// ── Purchases: always direct from your PC to Roblox ──
async function _authPost(cookie, url, body, options = {}) {
  const doPost = async (token) => {
    const client = buildClient(cookie);
    return client.post(url, body, token ? { headers: { 'X-CSRF-TOKEN': token } } : undefined);
  };
  let token = await getXcsrfToken(cookie).catch(() => null);
  try {
    return await doPost(token);
  } catch (err) {
    const status = err?.response?.status;
    const newToken = err?.response?.headers?.['x-csrf-token'];
    if (status === 403 && newToken) {
      csrfCache.set(cookie, { token: newToken, fetchedAt: Date.now() });
      return await doPost(newToken);
    }
    throw err;
  }
}

// Every _authPost call targets a fixed Roblox URL:
//   https://apis.roblox.com/marketplace-items/v1/items/details
//   https://apis.roblox.com/marketplace-sales/v1/item/{id}/purchase-resale
//   https://apis.roblox.com/marketplace-sales/v1/item/{id}/purchase-item
//   https://economy.roblox.com/v1/purchases/products/{productId}
