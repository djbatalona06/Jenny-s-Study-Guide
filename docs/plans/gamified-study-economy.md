# Plan — Gamified Study Economy & Shop

**App:** Jenny's Study Guide (MA / ATI TEAS 7 offline PWA)
**Source:** Design Spec #2 — Gamified Study & Shopping App (approved 2026-07-28)
**Base commit:** `b9eee07` (origin/main tip)
**File under change:** `index.html` (single-file PWA, ~239 KB) — everything lives here.

---

## Context

The app is a **single-file, offline, no-build PWA**. All code is vanilla ES5-style JS
inside `<script>` blocks in `index.html`, organized as IIFE modules hanging off a
global `window.MA` namespace. There is **no framework, no bundler, no npm, no test
runner**. State persists through `MA.store` (IndexedDB with a localStorage fallback).

**Verified existing seams (line numbers at base `b9eee07`; re-confirm before editing):**

- `MA.store` — IIFE at `index.html:1674-1743`. `DB_NAME="ma-study"`, `DB_VER=1`,
  `STORES=["kv","notes","folders","events"]`. `onupgradeneeded` (1686) guards each
  store with `if (!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:"id"})`.
  API: `put(store,obj)`, `get(store,id)`, `all(store)`, `del(store,id)`,
  `setKV(key,value)`, `getKV(key,default)` → all return Promises. kv values are stored
  as `{id:key, value:value}` and `getKV` returns the `.value`.
- `MA.util` — IIFE at `index.html:1749-1846`. Exposes `el(tag,attrs,children)` (DOM
  builder: `class`, `html`, `text`, `dataset`, `on*` handlers, boolean/attr values),
  `esc`, `uid`, `fmtDate`, `daysUntil`, `isoWeek`, `weekKey(date)` (deterministic
  `YYYY-Www`), `shuffle` (seeded), `mdToHtml`, `download`.
- `MA.app` — exposed at `index.html:3668`: `{ go, setView, onLeave, toast, openSheet,
  closeSheet, bumpStreak }`. `toast(msg)` shows a transient toast (3337). `openSheet`/
  `closeSheet` drive the bottom sheet (markup at `index.html:908`). There is an
  **existing** `streak`/`bumpStreak` concept (study-day streak in kv key `streak` =
  `{count}`) — this is SEPARATE from the new daily-login streak; do not modify or
  collide with it.
- **Nav** — `index.html:889-903`: 5 bottom tabs with `data-route`: `home`, `study`,
  `anatomy`, `notes`, `more` (⋯). Tab click handler at `index.html:3414`; `more` calls
  `openMore()` (3417). The `openMore()` builder is at `index.html:3421-3431` (renders an
  `<h3>More</h3>` sheet). App-bar gear `#navSettings` (`index.html:882`) currently routes
  to `settings` (handler `index.html:3419`).
- **Flashcards** — IIFE at `index.html:1856+`. `renderLearn(deckId)` (1973): the "Got it ✓"
  button (2011) calls `grade(c,true)`; the deck-complete screen shows a "Back to deck"
  button (~2021). `renderCards`, `renderMatch` (2029), `renderTest`. Decks are
  `{id,title,subject,emoji,cards:[{id,term,def,hint?}]}`.
- **Match** — `renderMatch(deckId)` (2029). Matched cell gets class `.match-cell.ok`
  (CSS 274-277, 552-556); board clear = all pairs matched.
- **Quiz** — IIFE at `index.html:2246+`. `banks()` = `MA_DATA.quizzes`. Correct answer
  option gets class `.opt.correct` (CSS 282, 562). Weekly quiz opt-in in kv `weeklyOptIn`;
  results in `weeklyDone`. Final score computed at end of quiz flow.
- **Anatomy** — IIFE at `index.html:2742+`. `topics()` = `MA_DATA.topics` (defined at
  `index.html:963-974`). Each topic: `{id,name,emoji,model,proc,deck,blurb,...}`. The
  `deck` field links to a deck id (e.g. `"anatomy"`, `"teas-science"`). Uses `window.MA3D`
  for the 3D viewer.
- **Confetti** — the app already has a confetti effect used on success moments; locate and
  reuse it (search `confetti`). If none exists, provide a lightweight CSS-only fallback.

Modules are registered by an IIFE that runs on load and typically starts with
`var MA = window.MA, U = MA.util, el = U.el;`. Follow that exact house pattern.

---

## Global Constraints (binding for EVERY task — reviewers enforce these verbatim)

**G1 — Single file, house style.** All new code goes into `index.html` as new
`<script>` IIFE block(s) on `window.MA`, matching the existing ES5-style vanilla JS
(no `const`/`let` only if the file uses `var`; match the surrounding style — the file
uses `var` and function declarations). Build DOM with `MA.util.el`. No new JS/CSS files,
no frameworks, no CDN/network calls, no build step. New CSS goes in a `<style>` block
reusing existing design tokens (`--primary`, `--accent`, `--card`, `--border`,
`--success`, `--destructive`, `--muted-fg`, radius/shadow vars, glass-card and `.btn`,
`.btn--accent`, `.btn--primary`, `.btn--block` classes).

**G2 — Persistence only via `MA.store`.** No direct `localStorage`/`indexedDB` use in
new modules. Reads/writes go through `getKV/setKV` (kv values) and `put/get/all/del`
(object stores). All are async (Promises). Everything must survive reload and work
offline, including the localStorage-fallback path (`useLS`).

**G3 — Currency model.** 1 Study Coin = $1. Displayed in dollars with thousands
separators (e.g. `$120`, `$2,500,000`). Wallet + prices are integers. Realistic prices
are never scaled down.

**G4 — The economy contract (the shared interface all tasks depend on).**
`MA.economy` (built in Task 1) exposes and MUST keep this stable API:
- `MA.economy.streakMult(streak)` → number. Ladder: day 1→1.0, 2→1.2, 3→1.5, 4→1.8,
  5→2.2, 6→2.7, **7+→3.5** (holds at 3.5 for any streak ≥ 7). `streak < 1` → `1.0`.
- `MA.economy.effectiveMultiplier()` → **synchronous** number =
  `streakMult(currentStreak) × (character === 'prowler' ? 1.5 : 1)`, read from an
  in-memory cache (see below). Used for study earnings and the Home "Earning ×N" badge.
- `MA.economy.earnCoins(baseAmount, source)` → applies `effectiveMultiplier()`,
  `earned = Math.round(baseAmount × effective)`; adds `earned` to wallet + walletLifetime
  + earnedToday (in-memory immediately for instant UI, persisted async via MA.store);
  fires the floating `+N 🪙` animation near the trigger (or a static toast under
  `prefers-reduced-motion`); dispatches a `ma:coins` event. Returns the earned integer.
- `MA.economy.spend(amount)` → Promise<boolean>. Deduct if wallet ≥ amount (persist +
  dispatch `ma:coins`); false + no change otherwise.
- `MA.economy.getWallet()` / `getLifetime()` / `getEarnedToday()` → current in-memory
  integers (sync getters); plus a `ready` Promise that resolves after kv hydration.
- **In-memory cache + events:** on init, economy hydrates `{wallet, lifetime,
  earnedToday, character, streak}` from kv (keys in G6). It listens for `ma:character`
  (detail `{character}`) and `ma:login` (detail `{streak}`) to refresh the cached
  `character`/`streak` so `effectiveMultiplier()` stays correct without re-reading kv.
  Defaults when absent: character `null` (→ ×1 study), streak `0` (→ ×1).
- **Events (window-level `CustomEvent`, dispatched on `window`):**
  `ma:coins` `{detail:{balance,lifetime,earnedToday,earned?}}` on any wallet change;
  `ma:character` `{detail:{character}}` from Task 2 on select/switch;
  `ma:login` `{detail:{streak,multiplier}}` from Task 3 on claim/streak change.
  Home/Shop headers refresh on `ma:coins`; economy listens to `ma:character`/`ma:login`.

**G5 — Character bonuses (built in Task 2, honored by later tasks):**
- **Diva** 👑 — 15% off shop purchases, applied at checkout only.
- **Prowler** 🐆 — ×1.5 on all study earnings, stacking on the streak multiplier
  (this is the `character === 'prowler'` branch in `effectiveMultiplier`).
- **Expert** 🧠 — ×1.5 daily-login bonus AND one weekly streak-freeze.
- **Analyst** 🔍 — Learn mode gets 3 hint charges (refill 1 / 5 min); others get 1 basic
  hint per card.

**G6 — kv keys (via `MA.store.setKV/getKV`):** `wallet` (int), `walletLifetime` (int),
`character` (`'diva'|'prowler'|'expert'|'analyst'`), `login`
(`{streak, lastClaimDate:ISO-date-string, freezeWeek:ISO-week-key}`), `earnedToday`
(`{date:ISO-date-string, amount:int}`), `firstRunDone` (bool). Object store `owned`
(added in Task 1) records `{id:itemId, at:timestamp, price:coinsPaid, usd:listPrice}`.

**G7 — Verification standard (how "tested" is defined here — there is no unit-test
runner).** Every implementer MUST verify by loading the actual app in a browser and
recording concrete results in the report:
1. Serve the worktree over HTTP (e.g. `python -m http.server 8123` from the repo root)
   and open it with the available browser automation tools (Claude Browser
   `preview_start`/`navigate` + `javascript_tool`, or Playwright/chrome-devtools MCP).
   If HTTP serving is impossible, load `index.html` directly and note that.
2. Confirm the app loads with **no new console errors** and existing routes still work
   (home, study, anatomy, notes) — no regressions.
3. Exercise the new module's public API and DOM by evaluating expressions against
   `window.MA.*` and interacting with the UI; assert the spec's concrete numeric
   examples (each task lists its required assertions). Record the exact
   expressions/actions run and their actual results (pass/fail) in the report.
   Reviewers will NOT re-run these — the report is the evidence.

**G8 — Accessibility & motion.** Interactive controls get `aria-label`s and visible
focus states. Modals/dialogs are `role="dialog" aria-modal="true"` with a focus trap and
Escape-to-close, matching existing sheet/owner-gate patterns. All new animation
(floating coins, confetti bumps, popups) must respect `prefers-reduced-motion` (fall back
to instant/static). Shop grid is responsive (2-col mobile), images `max-width:100%`, no
horizontal page scroll.

**G9 — Commit discipline.** Stage **only** files you actually changed (in practice just
`index.html`, plus any new doc). Never `git add -A`/`git commit -am` blindly. Use a
conventional commit subject (`feat(economy): …`) and end the commit body with:
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Small, focused commits per
task are fine.

**G10 — Scope discipline (YAGNI).** Build exactly what the task specifies — no extra
features, no speculative abstraction, no server/account/leaderboard/real-payment code.
Emoji-on-CSS-gradient art only (an optional `image` path may be reserved in data, but do
not add real images). Do not refactor unrelated existing code.

---

## Shared reference — base earn rates (before any multiplier)

| Activity | Base coins | `source` string |
|---|---|---|
| Flashcards Learn correct ("Got it") | 5 | `learn` |
| Flashcards full deck complete (Learn) | 40 | `deck` |
| Flashcards Test correct | 4 | `test` |
| Quiz correct answer | 12 | `quiz` |
| Quiz score ≥ 80% bonus | 60 | `quiz-bonus` |
| Anatomy "Identify the Part" correct | 8 | `anatomy` |
| Anatomy quiz session complete | 30 | `anatomy-done` |
| Match matched pair | 4 | `match` |
| Match board clear | 25 | `match-clear` |
| Daily login base (before ladder) | 25 | (login flow, Task 3) |
| 7-day streak cycle complete bonus | 300 | (login flow, Task 3) |

Worked examples (use as acceptance checks): 7-day streak = 3.5×; with Prowler ×1.5 →
effective ×5.25. Learn "Got it" (+5) → `round(5×5.25)=26`. Perfect 10-question quiz →
`round(10×12×5.25) + round(60×5.25) = 630 + 315 = 945`. Login bonus =
`round(25 × streakMult × (character==='expert'?1.5:1))`, plus +300 when `streak % 7 === 0`.

---

## Task 1: MA.economy core (wallet, multiplier, earnCoins/spend, coin animation, DB v2)

**Goal.** Build the `MA.economy` module — the foundation every other task calls — and
bump the DB to v2 with an `owned` object store.

**Build (all in `index.html`, new `<script>` IIFE + a small `<style>` block):**

1. **DB v2.** In the `MA.store` IIFE (`index.html:1674+`): change `DB_VER` from `1` to
   `2` and append `"owned"` to `STORES` (result: `["kv","notes","folders","events","owned"]`).
   The existing `onupgradeneeded` `contains()` guard already creates any missing store, so
   no other DB change is needed. (Optionally you MAY add `"ledger"` too, but it is not
   required — an `earnedToday` kv counter satisfies "earned today". Prefer NOT adding
   `ledger` unless you use it.)

2. **`MA.economy` module** implementing the full G4 contract:
   - Hydrate in-memory `state = {wallet, lifetime, earnedToday:{date,amount}, character,
     streak}` from kv keys `wallet`, `walletLifetime`, `earnedToday`, `character`, `login`
     (read `login.streak`). Expose a `ready` Promise resolving after hydration.
   - `streakMult(streak)` per the G4 ladder (array lookup `[1.0,1.2,1.5,1.8,2.2,2.7,3.5]`
     indexed by `min(max(streak,1),7)`; `streak<1`→1.0).
   - `effectiveMultiplier()` synchronous = `streakMult(state.streak) ×
     (state.character==='prowler'?1.5:1)`.
   - `earnCoins(baseAmount, source)`: `earned=Math.round(baseAmount×effectiveMultiplier())`;
     update in-memory wallet/lifetime immediately; update `earnedToday` (reset to today
     with amount 0 first if `earnedToday.date` ≠ today's local ISO date, then add);
     persist `wallet`, `walletLifetime`, `earnedToday` via `setKV` (fire-and-forget, but
     chained so writes are ordered); trigger the floating `+N 🪙` animation at/near an
     optional anchor element or the wallet; dispatch `ma:coins`. Return `earned`.
   - `spend(amount)`: if `state.wallet ≥ amount`, deduct in-memory + persist + dispatch
     `ma:coins`, resolve `true`; else resolve `false` with no change.
   - Sync getters `getWallet/getLifetime/getEarnedToday`; listen for `ma:character` and
     `ma:login` to refresh `state.character`/`state.streak`.
   - **Floating coin animation:** a lightweight CSS transform/opacity chip showing the
     already-multiplied `+N 🪙`, near the trigger; under `prefers-reduced-motion`, show a
     static `MA.app.toast("+N 🪙")` instead. Also briefly bump the wallet display if one
     is on screen (Home/Shop add displays later; this task just needs the helper +
     event).

**Public API exposed:** exactly the G4 surface (`streakMult`, `effectiveMultiplier`,
`earnCoins`, `spend`, `getWallet`, `getLifetime`, `getEarnedToday`, `ready`).

**Dependencies:** none (first task). It must NOT reference `MA.characters`/`MA.daily`
objects (they don't exist yet) — it only reads kv + listens for events.

**Acceptance checks (verify per G7 and record in report):**
- `MA.economy.streakMult(1)===1.0`, `(4)===1.8`, `(7)===3.5`, `(9)===3.5`, `(0)===1.0`.
- With kv cleared (no character, no login): `effectiveMultiplier()===1.0`; `earnCoins(5,'learn')`
  returns `5`, wallet becomes 5, `ma:coins` fires with `balance:5`.
- Simulate a 7-day streak + Prowler by dispatching `window.dispatchEvent(new CustomEvent('ma:login',{detail:{streak:7}}))`
  and `ma:character {character:'prowler'}`: `effectiveMultiplier()===5.25`;
  `earnCoins(5,'learn')===26`; a perfect-quiz combo `earnCoins(120,'quiz')+earnCoins(60,'quiz-bonus')` ⇒ 630+315.
- `spend(1000)` on a wallet < 1000 returns `false`, wallet unchanged; `spend(x)` with
  wallet ≥ x deducts and fires `ma:coins`.
- Reload the page: wallet, lifetime, earnedToday persist (kv + localStorage-fallback path).
- App loads with no new console errors; existing routes still work.

**Out of scope:** character selection UI, login popup, shop, Home widgets (later tasks).

---

## Task 2: MA.characters (data + first-launch selection modal + Settings re-select)

**Goal.** Character data, the first-launch selection modal, and re-selection from
Settings. Selection drives the bonuses in G5.

**Build:**
- `MA.characters` module with the 4 characters (G5): `diva` 👑 (15% off shop),
  `prowler` 🐆 (×1.5 study), `expert` 🧠 (×1.5 login + 1 weekly freeze), `analyst` 🔍
  (3 Learn hint charges, refill 1/5min; others 1 hint/card). Each: `{id,emoji,name,bonus}`
  where `bonus` is a short human string for display.
- Helpers: `getCharacter()` (sync from a cached value hydrated from kv `character`;
  expose a `ready` Promise), `select(id)` → persist kv `character`, dispatch
  `ma:character {character:id}`, and **on the very first selection** grant the 500-coin
  welcome bonus (spec §3: add 500 to wallet exactly once — key off `firstRunDone`), set
  `firstRunDone=true`, then confetti. Switching character later just swaps the bonus
  immediately (dispatch `ma:character`); no welcome re-grant, no streak reset.
- **First-launch modal:** on app start, if kv `firstRunDone` is falsy, show a full-screen
  modal (dark backdrop, 2×2 card grid; each card = emoji + name + bonus + "Choose"
  button). Choosing calls `select(id)`, closes the modal. `role="dialog" aria-modal`,
  focus trap, but this modal has no dismiss-without-choice (choice is required); it must
  not block if kv is unavailable (fallback still lets earning work with no character).
- **Settings re-select:** add a "Characters" entry in Settings (the existing settings
  view, reached today via the gear; after Task 7 the gear opens the More sheet and
  Settings lives there — for THIS task, wire it into the current Settings view so it is
  reachable). It opens the same 2×2 chooser (re-selectable anytime, no first-run
  restriction) and calls `select(id)`.

**Public API:** `MA.characters.getCharacter()`, `.select(id)`, `.list()` (the 4 defs),
`.ready`, plus a function to open the chooser (e.g. `.openChooser({firstRun:bool})`).

**Dependencies:** Task 1 (`MA.economy` for the 500 welcome grant — add via a direct
wallet write through economy, e.g. an `economy.grant(500)` helper you add in Task 1 OR
`earnCoins` is wrong here because it multiplies; use a NON-multiplied direct grant. If
Task 1 did not expose a non-multiplied grant, add `MA.economy.grant(n)` here in the
economy module and note it). Dispatches `ma:character` which economy listens for.

> **Note for controller/implementer:** the 500 welcome grant must NOT go through
> `earnCoins` (which multiplies). Use a direct, unmultiplied credit. If Task 1's economy
> lacks a `grant(n)`/direct-credit path, add a minimal `MA.economy.grant(n)` (adds to
> wallet+lifetime, persists, dispatches `ma:coins`) — this is the sanctioned way.

**Acceptance checks (G7):**
- Fresh state (kv cleared): first-launch modal appears once; choosing a character sets
  kv `character`, sets `firstRunDone=true`, grants exactly 500 coins (wallet 500), fires
  `ma:character`, and the modal does not reappear on reload.
- After first run, choosing again from Settings switches character (kv updates, `ma:character`
  fires) with NO additional welcome grant and NO wallet change beyond none.
- Selecting `prowler` then `MA.economy.effectiveMultiplier()` reflects ×1.5 (e.g. at
  streak 1 → 1.5).
- No new console errors; existing routes intact.

**Out of scope:** the actual hint mechanics in Learn (Analyst) and login boost (Expert)
are consumed in Tasks 3/7; here only the data + selection + welcome grant + event.

---

## Task 3: MA.daily (consecutive-day streak, login popup + Claim, Home streak widget)

**Goal.** Daily-login streak with the login popup and Claim reward; drive the `ma:login`
event that economy consumes.

**Build:**
- `MA.daily` module reading/writing kv `login` = `{streak, lastClaimDate, freezeWeek}`.
- **Streak computation** from `login.lastClaimDate` vs today's local ISO date
  (`YYYY-MM-DD`):
  - same day as `lastClaimDate` → already claimed today (no popup / disabled claim).
  - exactly +1 calendar day → streak continues (`streak+1`).
  - gap > 1 day → reset to `1`, EXCEPT Expert's freeze: if character is `expert` and the
    freeze has not been used this ISO week (`freezeWeek !== weekKey(today)`), a **single**
    missed day is protected (streak continues as if consecutive) and `freezeWeek` is set
    to this week's key (consumes the freeze once per ISO week). A gap of more than one
    missed day, or freeze already used this week, still resets to 1.
  - never claimed before (`login` absent) → streak 1.
  - Provide the streak the popup should show WITHOUT mutating kv until Claim.
- **Login popup:** on app open, if today's bonus is unclaimed, show a centered card popup:
  "Day X of 7" (cycle position = `((streak-1) % 7) + 1`), a progress bar, the current
  multiplier (`streakMult(streak)`), and the coins to be awarded
  (`round(25 × streakMult(streak) × (character==='expert'?1.5:1))`, plus `+300` when
  `streak % 7 === 0`). `role="dialog" aria-modal`, focus trap, Escape/tap-outside =
  DISMISS (not claimed; reappears next open — do NOT write kv on dismiss).
- **Claim:** award the coins via a **non-multiplied** direct credit (`MA.economy.grant(n)`
  — the daily bonus already includes its own ladder/Expert math; do NOT pass it through
  `earnCoins`). Then persist `login = {streak, lastClaimDate:today, freezeWeek}`, dispatch
  `ma:login {streak, multiplier:streakMult(streak)}`, and fire the existing confetti
  shower. Close the popup.
- **Home streak widget:** provide a render helper `MA.daily.renderWidget()` returning a DOM
  node (Day X / 7 + current multiplier) that Task 7 mounts on Home. (This task builds the
  helper; Task 7 places it. Wiring it onto Home now is acceptable but not required.)

**Public API:** `MA.daily.getStreakInfo()` (→ `{streak, claimedToday, bonus, cyclePos}`),
`.claim()`, `.showPopupIfDue()`, `.renderWidget()`, `.ready`.

**Dependencies:** Task 1 (`streakMult`, `grant`, `ma:login`), Task 2 (character for Expert
boost/freeze — read `MA.characters.getCharacter()` if present, else treat as no bonus).

**Acceptance checks (G7):**
- Fresh state → popup shows "Day 1 of 7", multiplier 1.0×, bonus `25`. Claim → wallet +25,
  `login.streak===1`, `login.lastClaimDate===today`, `ma:login` fires, popup closes.
- Simulate `lastClaimDate = yesterday, streak=6` then reopen: popup "Day 7 of 7",
  multiplier 3.5×, bonus `round(25×3.5)+300 = 88+300 = 388`. Claim → wallet +388,
  streak 7.
- Simulate `streak=7, lastClaimDate=yesterday` → popup "Day 1 of 7"
  (`((8-1)%7)+1 = 1`) with streak now 8 and multiplier still 3.5× (holds).
- Same-day reopen after claiming → no popup (or disabled), no double credit.
- Expert freeze: character `expert`, `lastClaimDate = 2 days ago` (one missed day),
  `freezeWeek` unset → streak continues (not reset to 1) and `freezeWeek` becomes this
  week's key; a second gap in the same ISO week resets to 1.
- Dismiss (tap outside) does not write kv and the popup reappears on next open.
- No new console errors; existing routes intact.

---

## Task 4: MA.shop (56-item catalog, render, detail sheet, purchase flow)

**Goal.** The Shop: catalog data (56 items, 5 tiers), category-chip + 2-col grid render,
detail sheet, and the purchase flow with the Diva discount and owned tracking. This task
builds the Shop **view** but does NOT yet replace the nav tab (Task 7 wires nav).

**Build:**
- `MA.shop` module with a hard-coded catalog array; each item
  `{id, tier, name, emoji, usd, blurb, gallery?}`. `id` stable kebab-case. `image?` may be
  reserved in the shape but unused. Tiers 1–5 below (price = USD = coins):

  **Tier 1 — Munchies (10):** hot-cheetos 🌶️ 3, glazed-donut 🍩 4, pizza-slice 🍕 5,
  iced-latte 🧋 6, chocolate-bar 🍫 6, boba-tea 🧋 7, cheeseburger-combo 🍔 12,
  acai-bowl 🍨 13, ramen-bowl 🍜 14, sushi-roll 🍣 18.

  **Tier 2 — Fashion & Beauty (12):** lululemon-align-set 🧘 200, telfar-shopping-bag 👜 257,
  sephora-haul 💄 500, louboutin-so-kate 👠 795, apple-watch-ultra-2 ⌚ 800,
  gucci-marmont-dress 👗 2650, dior-saddle-bag 👛 4200, van-cleef-alhambra 📿 6900,
  cartier-love-bracelet 💛 7350, rolex-datejust-36 ⌚ 9550, chanel-classic-flap 👜 10800,
  hermes-birkin-30 👜 25000.

  **Tier 3 — Loan Payoffs & Grown-Up Wins (10):** loan-500 💵 500, year-of-scrubs 🩺 600,
  one-months-rent 🏠 1800, macbook-pro 💻 2000, loan-1000 💵 1000, loan-2500 💵 2500,
  emergency-fund-3mo 🛟 5000, loan-5000 💵 5000, loan-10000 💸 10000,
  pay-off-a-semester 🎓 12000.

  **Tier 4 — Cars (12):** tesla-model-3 🚗 42000, porsche-macan 🚙 65000,
  porsche-718-cayman 🏎️ 70000, porsche-718-boxster 🏎️ 72000, porsche-cayenne 🚙 80000,
  porsche-panamera 🏎️ 95000, range-rover-sport 🚙 110000, porsche-911-carrera 🏎️ 115000,
  mercedes-g-wagon 🚙 140000, porsche-taycan-turbo ⚡ 190000, porsche-911-turbo-s 🏎️ 230000,
  porsche-918-spyder 🏁 1000000.

  **Tier 5 — Real Estate & Experiences (12):** coachella-vip 🎪 5000, disney-vip-week 🏰 12000,
  first-class-paris ✈️ 15000, siblings-nursing-fund 🎓 30000, dream-wedding 💍 75000,
  private-island-week 🏝️ 250000, bellevue-condo 🏢 900000, hawaii-vacation-home 🌺 1800000,
  seatac-mansion 🏡 2500000, napa-vineyard 🍇 3200000, lake-washington-waterfront 🌊 4500000,
  nyc-penthouse 🌆 6000000.

  Write a short 1-sentence `blurb` per item (factual, aspirational, no brand disparagement).
  `seatac-mansion` gets `gallery` data for a **5-scene CSS gallery** (5 emoji-on-gradient
  "scenes" e.g. exterior/kitchen/pool/view/bedroom).

- **Category tiers → chips (scrollable):** All · Munchies · Fashion · Loan Payoffs · Cars ·
  Real Estate · **Owned**. Map each tier number to its label; "Owned" filters to purchased.
- **Item art:** every card = emoji on a themed CSS gradient/glass card. Use a per-tier
  gradient family (5 families), matching the pastel design system. Zero external images.
- **Shop view render:** header with wallet balance (coin icon + `$` value, formatted with
  commas) and the active character icon; category chips; a responsive **2-column grid**
  (mobile) of item cards (emoji art, name, `$price`, Buy button — or an **Owned** badge if
  owned). Listen for `ma:coins` to keep the header balance live.
- **Detail sheet:** tapping a card opens a sheet (reuse `MA.app.openSheet`) with larger
  art, blurb, price, big Buy button; the mansion shows its 5-scene CSS gallery.
- **Purchase flow:** Buy → confirm dialog (item + price; if character is `diva`, show the
  15%-off discounted price and use it) → if affordable: `MA.economy.spend(finalPrice)`,
  on success write an `owned` record `{id,at,price:finalPrice,usd:listPrice}` to the
  `owned` store, confetti, flip the card to an Owned badge (Buy disabled). If not
  affordable: error toast stating the exact shortfall (`"You need $4,200 more"`), wallet
  unchanged. Already-owned items cannot be re-purchased.
- **Diva discount:** `finalPrice = Math.round(usd × (character==='diva' ? 0.85 : 1))`,
  applied at checkout only (grid shows list price; confirm dialog shows discount).

**Public API:** `MA.shop.render()` (returns/mounts the shop view), `MA.shop.catalog` (the
array), `MA.shop.isOwned(id)`, `MA.shop.openDetail(id)`. A route/entry will be wired in
Task 7; for THIS task make the view mountable and reachable for verification (e.g. a temp
route or the existing More menu — note how you exposed it).

**Dependencies:** Task 1 (`spend`, `getWallet`, `ma:coins`, `owned` store), Task 2
(character for Diva discount + header icon).

**Acceptance checks (G7):**
- Catalog has exactly **56** items: 10 + 12 + 10 + 12 + 12, tiers 1–5; every price matches
  the tables above; prices render with commas and `$`.
- Grid renders 2-col; category chips filter correctly; "Owned" chip shows only purchased.
- Purchase with sufficient funds: wallet decremented by the (possibly discounted) price,
  item marked owned + Owned badge, confetti; persists across reload (owned store).
- Diva active: confirm dialog shows 15%-off price and that price is charged
  (`round(usd×0.85)`); non-Diva charges full price.
- Purchase with insufficient funds: blocked, exact-shortfall toast, wallet unchanged.
- Re-purchase of an owned item is blocked.
- No new console errors; existing routes intact.

**Out of scope:** replacing the nav tab (Task 7), Home featured-item card (Task 7).

---

## Task 5: MA.anatomyQuiz ("Identify the Part" MCQ + earn hook)

**Goal.** An "Identify the Part" MCQ quiz per anatomy topic, drawn from the topic's linked
deck cards, that earns coins through `earnCoins`.

**Build:**
- `MA.anatomyQuiz` module. For a given topic (`MA_DATA.topics` entry, `index.html:963`),
  use the topic's `deck` id to get that deck's cards (`{id,term,def,hint?}`). Build a short
  MCQ quiz: each question presents a card's `def` (the description of the part) as the
  prompt and 4 `term` options — the correct card's `term` plus 3 distractor terms drawn
  from other cards in the same deck — shuffled with the existing seeded `MA.util.shuffle`.
  Cap the quiz at a sensible length (e.g. up to 8 questions or the deck size, whichever is
  smaller). If a topic's deck has < 4 cards, gracefully skip/disable (not enough options).
- **Earn hooks:** correct answer → `MA.economy.earnCoins(8,'anatomy')`; on session
  complete (all questions answered) → `MA.economy.earnCoins(30,'anatomy-done')`. Correct
  answers reuse the existing `.opt.correct` styling + success animation (match the quiz
  module's option pattern).
- **Entry point:** add an "Identify the Part" button next to the 3D viewer for each topic
  (in the anatomy module's topic view, `index.html:2742+`). Clicking launches the quiz for
  that topic. No 3D hotspot rigging.

**Public API:** `MA.anatomyQuiz.start(topicId)` (renders the quiz), and whatever the
anatomy view needs to mount the button.

**Dependencies:** Task 1 (`earnCoins`), the existing anatomy module + `MA_DATA.topics` +
decks. Multiplier (streak × Prowler) applies automatically via `earnCoins` — verify it
does for anatomy specifically (spec calls this out explicitly).

**Acceptance checks (G7):**
- Opening a topic (e.g. Heart, deck `anatomy`) shows an "Identify the Part" button; it
  launches an MCQ quiz with 4 options per question drawn from the linked deck.
- A correct answer fires `earnCoins(8,'anatomy')`; with a 7-day streak + Prowler active,
  the wallet delta for one correct is `round(8×5.25)=42` (spot-check the multiplier
  applies to anatomy). Session complete fires `earnCoins(30,'anatomy-done')`.
- Correct option gets `.opt.correct` styling; wrong options handled like the existing quiz.
- Topics whose deck has too few cards degrade gracefully (button disabled/hidden, no crash).
- No new console errors; existing anatomy 3D viewer still works.

---

## Task 6: MA.quizBuilder ("Build Your Quiz" sliders + live payout + custom-quiz start)

**Goal.** A "Build Your Quiz" panel: one slider per quiz bank with a live `$` payout
readout and a running total, that launches a custom quiz scored through the normal quiz
flow (so `earnCoins` fires per correct + the ≥80% bonus).

**Build:**
- `MA.quizBuilder` module rendering a panel (reachable in the Quizzes area; Task 7 places
  the Quizzes entry behind the gear/More sheet — for THIS task make the panel reachable and
  note how, e.g. a route or the existing quiz view).
- **One slider per bank** in `MA_DATA.quizzes` (`banks()` at `index.html:2248`): TEAS
  Science/Math/English/Reading + MA banks (A&P, Med Terminology, Pharmacology, Clinical
  Skills — whatever banks actually exist). Range `0 … bank.length`.
- **Live payout readout per slider:** `up to $<count × 12 × effectiveMultiplier()>` (e.g.
  "10 Science Q → up to $120" at ×1) plus a `≥80% = +$60 bonus` note. Update live as the
  slider moves and when `effectiveMultiplier()` changes.
- **Running total:** "Potential earnings: $X" summing all sliders' payouts, live.
- **Start:** builds a quiz from exactly the selected per-section counts (seeded shuffle
  from each bank via `MA.util.shuffle`), and runs it through the **existing quiz flow** so
  scoring, `.opt.correct`, per-correct `earnCoins(12,'quiz')` and the final `≥80% →
  earnCoins(60,'quiz-bonus')` all apply. Reuse the existing quiz renderer/engine rather
  than reimplementing scoring — integrate with the quiz module (`index.html:2246+`); if the
  quiz engine needs a "run these specific questions" entry, add a minimal seam to it (and
  note it), do not fork the scoring logic.

**Public API:** `MA.quizBuilder.render()` (mount the panel), `MA.quizBuilder.start(counts)`.

**Dependencies:** Task 1 (`effectiveMultiplier`, and `earnCoins` fires inside the quiz
flow — the actual `earnCoins` wiring into the quiz "correct"/"≥80%" points is Task 7's
hook; here ensure the custom quiz runs THROUGH that same flow so those hooks apply). Coord
note: if Task 7's quiz hooks are not yet present at build time, wire the custom quiz to the
same code path so that once Task 7 adds the quiz `earnCoins` calls, the custom quiz earns
too. Verify end-to-end after Task 7.

**Acceptance checks (G7):**
- A slider per existing bank; moving a slider updates that section's `$` payout and the
  running total live; payout = `count × 12 × effectiveMultiplier()` and reflects the
  current multiplier (e.g. doubles-ish under a higher streak/Prowler).
- Start with e.g. {Science:5, Math:5} launches a 10-question quiz built from those banks,
  scored through the normal flow.
- With Task 7 hooks present: each correct answer earns `earnCoins(12,'quiz')` and a final
  score ≥80% earns `earnCoins(60,'quiz-bonus')`; wallet reflects the multiplied amounts.
- No new console errors; existing weekly quiz still works.

---

## Task 7: Hooks + Home widgets + Nav (Shop tab replaces More; gear opens More sheet)

**Goal.** Wire `earnCoins` into the existing study flows, add the Home widgets, and
restructure navigation so Shop becomes a tab and the old "More" content moves behind the
gear. This is the integration task that makes everything visible and earning.

**Build:**

1. **Earn hooks into existing flows** (`index.html`):
   - Flashcards Learn: on "Got it ✓" success (the `grade(c,true)` path, ~`index.html:2011`)
     → `MA.economy.earnCoins(5,'learn')`; on full-deck completion (the Learn deck-complete
     screen, ~2013-2021) → `earnCoins(40,'deck')`.
   - Flashcards Test: on a correct answer (`renderTest`) → `earnCoins(4,'test')`.
   - Match: on each matched pair (`.match-cell.ok` becoming matched, in `renderMatch`
     ~2029) → `earnCoins(4,'match')`; on board clear → `earnCoins(25,'match-clear')`.
   - Quiz (weekly + custom): per correct answer (`.opt.correct` path in the quiz module
     ~2246+) → `earnCoins(12,'quiz')`; final score ≥80% → `earnCoins(60,'quiz-bonus')`.
     Ensure this same code path is what Task 6's custom quiz runs through.
   - Anatomy quiz already self-hooks (Task 5); no change needed here.
   Each hook fires the floating `+N 🪙` near the trigger (earnCoins handles the animation).

2. **Home additions** (the home view):
   - Welcome banner: active character emoji + name (from `MA.characters`).
   - Streak widget: Day X / 7 + current multiplier (mount `MA.daily.renderWidget()`), with
     a live "Earning ×N today" badge (N = `MA.economy.effectiveMultiplier()`, refreshed on
     `ma:login`/`ma:character`/`ma:coins`).
   - Coin summary: earned today · total balance · next-purchase goal (nearest affordable or
     nearest target item from `MA.shop.catalog`).
   - Featured item card: rotates deterministically by `MA.util.weekKey()` (offline-stable).
   - Quick "Open Shop" button (routes to the Shop tab).

3. **Navigation restructure:**
   - Replace the 5th bottom tab (currently `more` ⋯, `index.html:902`) with **🛍️ Shop**
     (`data-route="shop"`, label "Shop", icon 🛍️). Add a `shop` route that mounts
     `MA.shop.render()`.
   - The app-bar gear `#navSettings` (handler `index.html:3419`) now opens the **More
     sheet** (the `openMore()` content) instead of routing to `settings`.
   - The More sheet (`openMore()`, ~`index.html:3421`) must contain: Quizzes (→ the quiz
     area incl. Task 6's "Build Your Quiz"), Calendar, Library / BSN-TEAS, Fun Facts, and
     **Settings** (Settings now also contains **Characters** from Task 2). No previously
     reachable "More" destination may be lost — audit the current `openMore()` contents and
     ensure every one is still reachable behind the gear.
   - Update the tab click handler (`index.html:3414`) so `shop` routes to the shop view and
     `more` is gone; ensure `aria-current` highlighting works for the new tab set.

**Dependencies:** Tasks 1–6 (economy, characters, daily, shop, anatomyQuiz, quizBuilder).
This task assumes their public APIs exist.

**Acceptance checks (G7):**
- Each study flow increments the wallet by the correct multiplied amount and floats a
  `+N 🪙`: Learn "Got it" (+5 base), deck complete (+40), Test correct (+4), match pair
  (+4), board clear (+25), quiz correct (+12), quiz ≥80% (+60). Spot-check the multiplied
  values under a known streak/character (e.g. Learn at ×5.25 → +26).
- Bottom tabs are exactly: 🏠 Home · 🃏 Study · 🫀 Anatomy · 🛍️ Shop · 📓 Notes. The Shop
  tab opens the shop; the old "More" tab is gone.
- The gear opens the More sheet; Quizzes, Calendar, Library/BSN-TEAS, Fun Facts, and
  Settings (with Characters) are ALL reachable there — nothing from the old More is lost.
- Home shows: welcome banner, streak widget + live "Earning ×N today" badge, coin summary
  (earned today / balance / next goal), a weekly-rotating featured item, and an Open Shop
  button. Widgets update on `ma:coins`/`ma:login`/`ma:character`.
- Custom quiz (Task 6) earns per correct + ≥80% bonus end-to-end.
- No new console errors; all routes (home/study/anatomy/shop/notes + gear destinations)
  work; data survives reload.
