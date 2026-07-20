# Jenny's Study Guide — MA Study PWA

An offline-first study app for Medical Assistants and the ATI TEAS 7, deployed at
**[ma-study-pwa.vercel.app](https://ma-study-pwa.vercel.app)**.

It's a self-contained progressive web app (no build step) with tabs for **Home**,
**Study** (flashcards), **Anatomy 3D**, **Notes**, and **More** (quizzes, calendar,
library, fun facts, settings). Everything works offline via a service worker.

## Running it

No build step — plain HTML/CSS/JS. Serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

(The service worker and 3D model loading need `http://`, not `file://`.)

## Study — flashcards

Flashcard decks live inline in `index.html` as
`{ id, title, subject, emoji, cards:[{ id, term, def, hint? }] }`. Decks include
Anatomy & Physiology, Medical Terminology, Pharmacology, Clinical Skills & Safety,
and the four TEAS sections (Science, Math, English, Reading), each with a matching
quiz bank.

The 126 curated **ATI TEAS 7 Science** cards (kept in `data/flashcards.js` as the
source) are merged into the app's existing decks by category:

- **Human Anatomy & Physiology** (61) → the `anatomy` deck
- **Biology / Life Science, Chemistry, Scientific Reasoning** (65) → the `teas-science` deck

## Anatomy 3D

The Anatomy tab renders interactive 3D models. Real `.glb` models are loaded with a
locally **bundled three.js + GLTFLoader** (`vendor/three/`) so they work fully
offline, with drag-to-rotate / scroll-to-zoom orbit controls. Topics without a
bundled model fall back to the built-in procedural (CSS-3D) diagram.

Bundled models live in `models/`:

| Topic                      | File                    |
|----------------------------|-------------------------|
| Skeletal System (overview) | `overview-skeleton.glb` |
| Upper Limb                 | `upper-limb.glb`        |
| Lower Limb                 | `lower-limb.glb`        |
| Hand                       | `hand.glb`              |

To add a model: drop `models/<name>.glb`, then add a topic to `D.topics` in
`index.html` with `model: "<name>.glb", glb: true`.

## Project layout

```
index.html           the whole app (inline CSS + JS modules)
manifest.json        PWA manifest
service-worker.js    offline cache
icons/               PWA icons
vendor/three/        bundled three.js, GLTFLoader, OrbitControls
models/              .glb anatomy models
data/flashcards.js   source for the 126 TEAS 7 Science cards
```
