(function () {
  "use strict";

  const STORAGE_KEY = "teas-flashcard-progress-v1";

  /** @type {{known: number[], unknown: number[], starred: number[]}} */
  let progress = loadProgress();

  let deck = FLASHCARDS.slice();
  let currentIndex = 0;
  let isFlipped = false;

  const categorySelect = document.getElementById("category-select");
  const subcategorySelect = document.getElementById("subcategory-select");
  const searchInput = document.getElementById("search-input");
  const starredOnly = document.getElementById("starred-only");
  const unknownOnly = document.getElementById("unknown-only");

  const flashcard = document.getElementById("flashcard");
  const flashcardInner = document.getElementById("flashcard-inner");
  const cardCategory = document.getElementById("card-category");
  const cardCategoryBack = document.getElementById("card-category-back");
  const cardQuestion = document.getElementById("card-question");
  const cardAnswer = document.getElementById("card-answer");

  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const starBtn = document.getElementById("star-btn");
  const knowBtn = document.getElementById("know-btn");
  const unknownBtn = document.getElementById("unknown-btn");
  const shuffleBtn = document.getElementById("shuffle-btn");
  const resetBtn = document.getElementById("reset-btn");

  const statsBar = document.getElementById("stats-bar");
  const progressText = document.getElementById("progress-text");

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupted storage */ }
    return { known: [], unknown: [], starred: [] };
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function buildCategoryOptions() {
    const categories = [...new Set(FLASHCARDS.map((c) => c.category))];
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  }

  function buildSubcategoryOptions(selectedCategory) {
    subcategorySelect.innerHTML = '<option value="all">All topics</option>';
    const pool = selectedCategory === "all"
      ? FLASHCARDS
      : FLASHCARDS.filter((c) => c.category === selectedCategory);
    const subcats = [...new Set(pool.map((c) => c.subcategory))];
    subcats.forEach((sub) => {
      const opt = document.createElement("option");
      opt.value = sub;
      opt.textContent = sub;
      subcategorySelect.appendChild(opt);
    });
  }

  function applyFilters() {
    const cat = categorySelect.value;
    const sub = subcategorySelect.value;
    const query = searchInput.value.trim().toLowerCase();
    const onlyStarred = starredOnly.checked;
    const onlyUnknown = unknownOnly.checked;

    deck = FLASHCARDS.filter((card) => {
      if (cat !== "all" && card.category !== cat) return false;
      if (sub !== "all" && card.subcategory !== sub) return false;
      if (onlyStarred && !progress.starred.includes(card.id)) return false;
      if (onlyUnknown && !progress.unknown.includes(card.id)) return false;
      if (query) {
        const haystack = (card.question + " " + card.answer).toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    currentIndex = 0;
    isFlipped = false;
    renderCard();
    renderStats();
  }

  function renderCard() {
    flashcard.classList.remove("flipped");
    isFlipped = false;

    if (deck.length === 0) {
      cardCategory.textContent = "";
      cardCategoryBack.textContent = "";
      cardQuestion.textContent = "No cards match your filters.";
      cardAnswer.textContent = "Try adjusting the filters above.";
      progressText.textContent = "0 / 0";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      updateToolbarState(null);
      return;
    }

    prevBtn.disabled = false;
    nextBtn.disabled = false;

    const card = deck[currentIndex];
    const label = `${card.category} · ${card.subcategory}`;
    cardCategory.textContent = label;
    cardCategoryBack.textContent = label;
    cardQuestion.textContent = card.question;
    cardAnswer.textContent = card.answer;
    progressText.textContent = `Card ${currentIndex + 1} of ${deck.length}`;
    updateToolbarState(card);
  }

  function updateToolbarState(card) {
    if (!card) {
      starBtn.classList.remove("starred");
      knowBtn.classList.remove("active");
      unknownBtn.classList.remove("active");
      return;
    }
    starBtn.classList.toggle("starred", progress.starred.includes(card.id));
    starBtn.textContent = progress.starred.includes(card.id) ? "★ Starred" : "☆ Star";
    knowBtn.classList.toggle("active", progress.known.includes(card.id));
    unknownBtn.classList.toggle("active", progress.unknown.includes(card.id));
  }

  function renderStats() {
    const totalKnown = progress.known.length;
    const totalUnknown = progress.unknown.length;
    const totalStarred = progress.starred.length;
    statsBar.innerHTML = `
      <span>${FLASHCARDS.length} total cards</span>
      <span>${deck.length} in current view</span>
      <span class="stat-known">${totalKnown} known</span>
      <span class="stat-unknown">${totalUnknown} needs review</span>
      <span class="stat-starred">${totalStarred} starred</span>
    `;
  }

  function flipCard() {
    if (deck.length === 0) return;
    isFlipped = !isFlipped;
    flashcard.classList.toggle("flipped", isFlipped);
    flashcard.setAttribute("aria-pressed", String(isFlipped));
  }

  function goNext() {
    if (deck.length === 0) return;
    currentIndex = (currentIndex + 1) % deck.length;
    renderCard();
  }

  function goPrev() {
    if (deck.length === 0) return;
    currentIndex = (currentIndex - 1 + deck.length) % deck.length;
    renderCard();
  }

  function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    currentIndex = 0;
    renderCard();
  }

  function toggleInList(list, id) {
    const idx = list.indexOf(id);
    if (idx === -1) list.push(id);
    else list.splice(idx, 1);
  }

  function toggleStar() {
    if (deck.length === 0) return;
    const card = deck[currentIndex];
    toggleInList(progress.starred, card.id);
    saveProgress();
    updateToolbarState(card);
    renderStats();
  }

  function markKnown() {
    if (deck.length === 0) return;
    const card = deck[currentIndex];
    progress.unknown = progress.unknown.filter((id) => id !== card.id);
    if (!progress.known.includes(card.id)) progress.known.push(card.id);
    else progress.known = progress.known.filter((id) => id !== card.id);
    saveProgress();
    updateToolbarState(card);
    renderStats();
  }

  function markUnknown() {
    if (deck.length === 0) return;
    const card = deck[currentIndex];
    progress.known = progress.known.filter((id) => id !== card.id);
    if (!progress.unknown.includes(card.id)) progress.unknown.push(card.id);
    else progress.unknown = progress.unknown.filter((id) => id !== card.id);
    saveProgress();
    updateToolbarState(card);
    renderStats();
  }

  function resetProgress() {
    if (!confirm("Reset all star/known/needs-review progress?")) return;
    progress = { known: [], unknown: [], starred: [] };
    saveProgress();
    renderCard();
    renderStats();
  }

  categorySelect.addEventListener("change", () => {
    buildSubcategoryOptions(categorySelect.value);
    applyFilters();
  });
  subcategorySelect.addEventListener("change", applyFilters);
  searchInput.addEventListener("input", applyFilters);
  starredOnly.addEventListener("change", applyFilters);
  unknownOnly.addEventListener("change", applyFilters);

  flashcard.addEventListener("click", flipCard);
  flashcard.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flipCard();
    }
  });

  prevBtn.addEventListener("click", goPrev);
  nextBtn.addEventListener("click", goNext);
  starBtn.addEventListener("click", toggleStar);
  knowBtn.addEventListener("click", markKnown);
  unknownBtn.addEventListener("click", markUnknown);
  shuffleBtn.addEventListener("click", shuffleDeck);
  resetBtn.addEventListener("click", resetProgress);

  document.addEventListener("keydown", (e) => {
    if (document.activeElement === searchInput) return;
    if (e.key === "ArrowRight") goNext();
    else if (e.key === "ArrowLeft") goPrev();
  });

  buildCategoryOptions();
  buildSubcategoryOptions("all");
  applyFilters();
})();
