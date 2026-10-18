// Encrypt the .ROBLOSECURITY cookie at rest with Windows DPAPI (user scope).
// DPAPI ties the ciphertext to the current Windows user + machine, so a copied
// config.json is useless on any other account or PC — no key to manage.
//
// We shell out to PowerShell's System.Security.Cryptography.ProtectedData
// instead of adding a native npm dependency (keeps the pkg .exe build simple).
// In-memory cookies stay plaintext; only the on-disk form is wrapped.
//
// Off Windows (dev only — the product is Windows) this is a transparent no-op.
const { execFileSync } = require('child_process');

const MARKER = 'dpapi:';
const isWin  = process.platform === 'win32';

// Cache so we never spawn PowerShell twice for the same value during a run.
const decCache = new Map(); // ciphertext -> plaintext
const encCache = new Map(); // plaintext  -> ciphertext

function ps(script, inputB64) {
  return execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { input: inputB64, encoding: 'utf8', windowsHide: true, timeout: 8000 },
  ).trim();
}

function isEncrypted(v) {
  return typeof v === 'string' && v.startsWith(MARKER);
}

// ponytail: DPAPI failures NEVER throw out — losing a user's cookie is worse
// than leaving it unencrypted (encrypt) or asking them to re-enter (decrypt).
function encryptCookie(plain) {
  if (!isWin || !plain || typeof plain !== 'string' || isEncrypted(plain)) return plain;
  if (encCache.has(plain)) return encCache.get(plain);
  const inB64 = Buffer.from(plain, 'utf8').toString('base64');
  const script =
    'Add-Type -AssemblyName System.Security;' +
    '$in=[Console]::In.ReadToEnd().Trim();' +
    '$b=[Convert]::FromBase64String($in);' +
    '$e=[System.Security.Cryptography.ProtectedData]::Protect($b,$null,' +
      '[System.Security.Cryptography.DataProtectionScope]::CurrentUser);' +
    '[Convert]::ToBase64String($e)';
  try {
    const out = MARKER + ps(script, inB64);
    encCache.set(plain, out);
    decCache.set(out, plain);
    return out;
  } catch {
    throw new Error('Windows DPAPI encryption failed. Configuration was not saved; retry under the original Windows account.');
  }
}

function decryptCookie(stored) {
  if (!isWin || !isEncrypted(stored)) return stored;
  if (decCache.has(stored)) return decCache.get(stored);
  const encB64 = stored.slice(MARKER.length);
  const script =
    'Add-Type -AssemblyName System.Security;' +
    '$in=[Console]::In.ReadToEnd().Trim();' +
    '$e=[Convert]::FromBase64String($in);' +
    '$b=[System.Security.Cryptography.ProtectedData]::Unprotect($e,$null,' +
      '[System.Security.Cryptography.DataProtectionScope]::CurrentUser);' +
    '[Convert]::ToBase64String($b)';
  try {
    const outB64 = ps(script, encB64);
    if (!outB64) return stored;
    const plain = Buffer.from(outB64, 'base64').toString('utf8');
    decCache.set(stored, plain);
    encCache.set(plain, stored); // reuse this ciphertext on re-save (no churn)
    return plain;
  } catch {
    // Wrong user/machine (DPAPI doing its job) → unrecoverable here.
    // Return the original so an accidental save round-trips it unchanged
    // rather than overwriting good ciphertext with garbage.
    return stored;
  }
}

module.exports = { encryptCookie, decryptCookie, isEncrypted, MARKER };
