# Limited Sniper — cookie audit

Limited Sniper asks for your `.ROBLOSECURITY` cookie, so you deserve to see what it does with it. This repo shows exactly that part of the code.

It is **not** the full source. It holds the code that stores your cookie and the code that sends it.

## Where your cookie goes

| Destination | Gets your cookie? | What is sent |
|---|---|---|
| `*.roblox.com` | **Yes, only here** | Price checks, inventory, balance, purchases |
| Your proxies (optional) | No | Anonymous price checks only |
| `rolimons.com` | No | Public item page |
| `limitedsniper.app` | No | Your license key only |
| `discord.com` | No | Only if you add your own webhook: snipe alerts |

Purchases always go straight from your PC to Roblox. They never pass through a proxy or our server.

## How it is stored

`cookiecrypto.js`: on disk the cookie is encrypted with Windows DPAPI, tied to your Windows user. A copied `config.json` is useless on any other PC or account. There is no key for us (or anyone) to hold.

## How it is sent

`cookie-transport.js`: an abridged excerpt of `roblox-api.js`.
- `buildClient()` is the only function that puts the cookie in a request header.
- Proxy clients are built without it.
- Every purchase URL is a hard-coded Roblox address.

## Logs and diagnostics

Diagnostic reports strip cookies, license keys, emails, IPs, URLs and proxy credentials before anything is written. An automated test checks that `.ROBLOSECURITY` never appears in them.

## Questions

Ask in our Discord: https://discord.gg/UCX8Rp7SJ6 · Website: https://limitedsniper.app
