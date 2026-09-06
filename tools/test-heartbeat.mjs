/**
 * Exercises MA.heartbeat against a fake store and fetch, to check the three
 * behaviours that matter: airgapped by default, retry reuses the session id,
 * and a permanent refusal does not wedge the queue.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* Run with: node tools/test-heartbeat.mjs
   There is no test runner in this repo — no package.json, no build step — so
   this is a plain script that exits non-zero when something is wrong. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const mod = html.slice(html.indexOf('/* ---- js/modules/heartbeat.js ---- */'),
                       html.indexOf('/* ---- js/app.js ---- */'));

const kv = new Map();
const listeners = {};
globalThis.window = {
  MA: {
    util: { uid: () => Math.random().toString(36).slice(2, 10) },
    store: {
      getKV: async (k, d) => (kv.has(k) ? kv.get(k) : d),
      setKV: async (k, v) => void kv.set(k, v),
    },
  },
  addEventListener: (e, f) => { listeners[e] = f; },
};
const calls = [];
let responder = () => ({ ok: true, status: 200 });
globalThis.fetch = async (url, init) => {
  calls.push({ url, body: JSON.parse(init.body) });
  return responder(calls.length);
};

new Function(mod)();
const HB = window.MA.heartbeat;

const eq = (a, b, msg) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok ? '' : `  (${JSON.stringify(a)} != ${JSON.stringify(b)})`}`);
  if (!ok) process.exitCode = 1;
};

// 1. Airgapped until connected.
await HB.record('deck');
eq(calls.length, 0, 'sends nothing at all with no code saved');
eq(await HB.pending(), 0, 'queues nothing either');

// 2. Connected: a finished deck goes out with only the three fields.
await HB.save('tok-123');
await HB.record('deck');
eq(calls.length, 1, 'sends once connected');
eq(Object.keys(calls[0].body).sort(), ['at', 'kind', 'sessionId'], 'sends only session, kind and time');
eq(calls[0].body.kind, 'deck', 'says what was finished');

// 3. An unknown kind is refused rather than queued forever.
await HB.record('bribe');
eq(calls.length, 1, 'refuses a kind HeartBeat does not know');

// 4. Offline: queued, and the retry reuses the same session id.
responder = () => { throw new Error('offline'); };
await HB.record('quiz');
eq(await HB.pending(), 1, 'queues a session when the network is down');
const firstTry = calls[calls.length - 1].body.sessionId;

responder = () => ({ ok: true, status: 200 });
await HB.drain();
const retried = calls[calls.length - 1].body.sessionId;
eq(retried, firstTry, 'a retry reuses the session id, so the pet is not paid twice');
eq(await HB.pending(), 0, 'queue drains once it goes through');

// 5. A permanent refusal is dropped; a 401 is kept for when the code is fixed.
responder = () => ({ ok: false, status: 400 });
await HB.record('quiz');
eq(await HB.pending(), 0, 'drops a session the server will never accept');

responder = () => ({ ok: false, status: 401 });
await HB.record('quiz');
eq(await HB.pending(), 1, 'keeps a session refused by a revoked code');

// 6. Disconnecting stops it.
await HB.save('');
const before = calls.length;
await HB.record('deck');
eq(calls.length, before, 'stops sending once disconnected');
