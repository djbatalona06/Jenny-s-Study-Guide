# Jenny-s-Study-Guide
MA study guide meant to prep for TEAS test

## ATI TEAS 7 Science Flashcards

A self-contained flashcard study app with 126 cards covering the official ATI TEAS 7 Science blueprint:

- **Human Anatomy & Physiology** (61 cards) — body organization, skeletal, muscular, cardiovascular, respiratory, digestive, nervous, endocrine, urinary/renal, immune/lymphatic, integumentary, and reproductive systems
- **Biology / Life Science** (27 cards) — cell structure, genetics, DNA/RNA/protein synthesis, macromolecules, microorganisms & disease
- **Chemistry** (26 cards) — atomic structure, chemical bonds, chemical reactions, states of matter, acids & bases, solutions & biochemistry
- **Scientific Reasoning** (12 cards) — scientific method, experimental design, variables & data interpretation

### Running it

No build step required — it's plain HTML/CSS/JS. Just open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

### Features

- Filter by category and topic, or search questions/answers
- Click (or press Enter/Space) to flip a card
- Star cards, mark them as known / needs review, and filter down to just those
- Shuffle the deck; progress is saved locally in your browser (`localStorage`)

Flashcard content lives in `data/flashcards.js`.

