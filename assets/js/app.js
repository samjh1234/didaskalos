// app.js e il cuore della single-page application.
// Gestisce:
// - routing tramite hash
// - stato corrente dell'interfaccia
// - rendering delle viste principali
// - collegamento tra UI e dataset caricati da data-loader.js

import { loadData } from "./data-loader.js";
import {
  buildVerbSectionEntries,
  cleanVocabularyItalianNote,
  escapeHtml,
  normalize,
  normalizeParadigmSection,
  pronounceGreek,
  renderParadigmCard,
  renderVerbSectionControls,
  shouldShowItalianNote,
  wireVerbSectionControls,
} from "./display-helpers.js";
import { analyzeNoun, analyzeVerb } from "./morphology.js";

// Stato centrale della SPA.
// Ogni vista legge qui i parametri che servono per ricostruire la pagina.
const state = {
  route: "home",
  selectedLemma: "",
  selectedMorphType: "verb",
  vocabularySelection: {
    query: "",
    page: "1",
  },
  interlinearSelection: {
    book: "",
    chapter: "",
    verse: "",
  },
  data: null,
};

// Riferimenti ai contenitori delle viste principali.
const views = {
  home: document.querySelector("#home-view"),
  interlinear: document.querySelector("#interlinear-view"),
  vocabulary: document.querySelector("#vocabulary-view"),
  grammar: document.querySelector("#grammar-view"),
  morphology: document.querySelector("#morphology-view"),
};

// Template HTML clonati al bisogno per popolare le viste.
const templates = {
  home: document.querySelector("#home-template"),
  interlinear: document.querySelector("#interlinear-template"),
  vocabulary: document.querySelector("#vocabulary-template"),
  grammar: document.querySelector("#grammar-template"),
  morphology: document.querySelector("#morphology-template"),
};

const cloneTemplate = (template) => template.content.cloneNode(true);

// Costruisce l'hash dell'URL a partire dalla route e dai parametri.
// E il meccanismo che rende la pagina condivisibile e ripristinabile.
const buildHash = (route, params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `${route}?${query}` : route;
};

// Cambio completo di route:
// aggiorna stato, URL e re-renderizza.
const setRoute = (route, params = {}) => {
  state.route = route;
  state.selectedLemma = params.lemma || "";
  state.selectedMorphType = params.type || "verb";
  state.vocabularySelection = {
    query: params.q || "",
    page: params.page || "1",
  };
  state.interlinearSelection = {
    book: params.book || "",
    chapter: params.chapter || "",
    verse: params.verse || "",
  };
  window.location.hash = buildHash(route, params);
  render();
};

// Aggiornamento leggero dello stato della route senza cambiare pagina.
// Qui usiamo history.replaceState per tenere l'URL sincronizzato
// mentre l'utente cambia filtri, pagine o selezioni.
const replaceRouteState = (route, params = {}) => {
  state.route = route;
  state.selectedLemma = params.lemma || "";
  state.selectedMorphType = params.type || "verb";
  state.vocabularySelection = {
    query: params.q || "",
    page: params.page || "1",
  };
  state.interlinearSelection = {
    book: params.book || "",
    chapter: params.chapter || "",
    verse: params.verse || "",
  };
  const nextHash = buildHash(route, params);
  history.replaceState(null, "", `#${nextHash}`);
};

// Apertura della pagina parola dedicata.
// Qui il lemma viene passato come querystring.
const goToWord = (lemma) => {
  window.location.href = `word.html?lemma=${encodeURIComponent(normalize(lemma))}`;
};

// Legge lo stato dall'hash e ricostruisce la route corrente.
const activateRouteFromHash = () => {
  const rawHash = window.location.hash.replace("#", "");
  if (!rawHash) {
    state.route = "home";
    state.selectedLemma = "";
    state.selectedMorphType = "verb";
    state.vocabularySelection = { query: "", page: "1" };
    state.interlinearSelection = { book: "", chapter: "", verse: "" };
    return;
  }

  const [hash, query = ""] = rawHash.split("?");
  const params = new URLSearchParams(query);
  const allowed = Object.keys(views);
  state.route = allowed.includes(hash) ? hash : "home";
  state.selectedLemma = normalize(params.get("lemma") || "");
  state.selectedMorphType = ["verb", "noun", "pronoun"].includes(params.get("type"))
    ? params.get("type")
    : "verb";
  state.vocabularySelection = {
    query: params.get("q") || "",
    page: params.get("page") || "1",
  };
  state.interlinearSelection = {
    book: params.get("book") || "",
    chapter: params.get("chapter") || "",
    verse: params.get("verse") || "",
  };
};

// Estrae capitolo e versetto dai codici BCV presenti nei token.
const getVerseAddress = (verse) => {
  const bcv = verse?.tokens?.[0]?.bcv;
  if (!bcv) return null;
  return {
    chapter: String(Number(String(bcv).slice(2, 4))),
    verse: String(Number(String(bcv).slice(4, 6))),
  };
};

// Recupera il versetto CEI 2008 quando disponibile.
// Questo testo serve per la riga italiana del versetto,
// non per i singoli quadrini dell'interlineare.
const getCeiVerseText = (slug, verse) => {
  const address = getVerseAddress(verse);
  if (!address || !state.data.ceiVerses?.[slug]) return "";
  const rawText = state.data.ceiVerses[slug]?.chapters?.[address.chapter]?.[address.verse] || "";
  return rawText.replace(/^\s*\d+\s*-->\s*/, "").trim();
};

// Accesso rapido al significato base di una voce lessicale.
const getLexiconGloss = (lemma) => {
  const entry = state.data.lexicon.find((item) => normalize(item.lemma) === normalize(lemma));
  return entry?.glossIt || "";
};

// Gloss fissi per parole grammaticali e lemma lessicale.
const getFixedFunctionGloss = (lemma) => state.data.functionGlosses?.[normalize(lemma)]?.glossIt || "";
const getFixedLexiconGloss = (lemma) => state.data.fixedLexicon?.[normalize(lemma)]?.glossIt || "";

// Per articoli, pronomi e parole-funzione usiamo gloss dipendenti da caso/numero/genere.
const getFixedFunctionFormGloss = (token) => {
  const lemma = normalize(token.lemma);
  const morphology = normalize(token.morphologyLabel || "");
  const caseName = ["nominativo", "genitivo", "dativo", "accusativo"].find((value) =>
    morphology.includes(value),
  );
  const number = ["singolare", "plurale"].find((value) => morphology.includes(value));
  const gender = ["maschile", "femminile", "neutro"].find((value) => morphology.includes(value));
  const keys = [
    [lemma, caseName, number, gender].filter(Boolean).join("|"),
    [lemma, caseName, number].filter(Boolean).join("|"),
    [lemma, caseName].filter(Boolean).join("|"),
  ].filter(Boolean);
  return keys.map((key) => state.data.functionFormGlosses?.[key]).find(Boolean) || "";
};

// Gloss token-per-token usati soltanto per l'interlineare.
const getFixedTokenGloss = (verse, tokenIndex) => {
  const bcv = verse?.tokens?.[tokenIndex]?.bcv;
  if (!bcv && bcv !== "") return "";
  return state.data.tokenGlossesFixed?.[`${bcv}:${tokenIndex}`] || "";
};

// Piccolo dizionario di supporto per interpretare alcune fonti secondarie.
const dictionaryMeaningToItalian = (detail) => {
  if (!detail) return "";
  const raw = detail.includes("=") ? detail.split("=")[1] : detail;
  const normalized = raw
    .replace(/^to\s+/i, "")
    .replace(/\//g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const dictionaryMap = {
    "he, she, it, self": "egli, lui, stesso",
    "the, this, who": "il, la, lo",
    "but, and": "ma, e",
    "then": "allora, poi",
    "and": "e",
    "but": "ma",
    "bless": "benedire",
    "blessing": "benedizione",
    "beget": "generare",
    "give birth": "dare alla luce",
    "be born": "nascere",
    "brother": "fratello",
    "son": "figlio",
    "daughter": "figlia",
    "father": "padre",
    "mother": "madre",
    "man": "uomo",
    "woman": "donna",
    "god": "Dio",
    "lord": "Signore",
    "king": "re",
    "prophet": "profeta",
    "book": "libro",
    "word": "parola",
    "light": "luce",
    "life": "vita",
    "love": "amare",
    "say": "dire",
    "speak": "parlare",
    "see": "vedere",
    "go": "andare",
    "come": "venire",
    "have": "avere",
    "do": "fare",
    "know": "conoscere",
    "hear": "udire",
    "believe": "credere",
    "fulfill": "compiere",
    "complete": "compiere",
    "fill": "riempire",
    "make full": "riempire",
  };

  return dictionaryMap[normalized] || "";
};

// Primo livello di gloss sensibile alla morfologia per le parole-funzione.
const getMorphologyAwareGloss = (token) => {
  return getFixedFunctionFormGloss(token);
};

// Coordinate morfologiche minime usate per confrontare nome/aggettivo/pronome.
const getTokenTraits = (token) => {
  const morphology = normalize(token?.morphologyLabel || "");
  const caseName = ["nominativo", "genitivo", "dativo", "accusativo"].find((value) =>
    morphology.includes(value),
  );
  const number = ["singolare", "plurale"].find((value) => morphology.includes(value));
  const gender = ["maschile", "femminile", "neutro"].find((value) => morphology.includes(value));
  return [caseName || "", number || "", gender || ""].join("|");
};

// Verifica se due token condividono gli stessi tratti nominali di base.
const sameNominalTraits = (left, right) => {
  if (!left || !right) return false;
  return getTokenTraits(left) === getTokenTraits(right);
};

// Applica una resa italiana minima del caso per sostantivi e aggettivi.
// Serve soprattutto nell'interlineare quando non esiste gia un gloss token-specifico.
const applyNominalCaseGloss = (token, baseGloss, previousToken = null, nextToken = null) => {
  if (!baseGloss) return "";
  const morphology = normalize(token.morphologyLabel || "");
  const appositiveTitles = new Set(["χριστος", "κυριος", "βασιλευς"]);
  if (token.partOfSpeech === "aggettivo") {
    if (previousToken?.partOfSpeech === "sostantivo" && sameNominalTraits(previousToken, token)) return baseGloss;
    if (nextToken?.partOfSpeech === "sostantivo" && sameNominalTraits(nextToken, token)) return baseGloss;
  }
  if (
    morphology.includes("genitivo") &&
    previousToken?.partOfSpeech === "sostantivo" &&
    sameNominalTraits(previousToken, token) &&
    appositiveTitles.has(normalize(token.lemma))
  ) {
    return baseGloss;
  }
  if (morphology.includes("genitivo")) return `di ${baseGloss}`;
  if (morphology.includes("dativo")) return `a ${baseGloss}`;
  return baseGloss;
};

// Significato lessicale di base del lemma.
const getBaseLexicalGloss = (token) =>
  getFixedLexiconGloss(token.lemma) ||
  "";

// Regola generale per il significato del singolo quadrino nell'interlineare.
// Ordine di priorita:
// 1. gloss fisso del token
// 2. gloss grammaticale fisso
// 3. gloss lessicale adattato
// 4. placeholder di completamento
const getTokenDisplayGloss = (token, verse = null, tokenIndex = -1) => {
  const fixedTokenGloss =
    verse && Number.isInteger(tokenIndex) && tokenIndex >= 0 ? getFixedTokenGloss(verse, tokenIndex) : "";
  if (fixedTokenGloss) return fixedTokenGloss;

  const functionGloss = getMorphologyAwareGloss(token) || getFixedFunctionGloss(token.lemma);
  if (functionGloss) return functionGloss;

  if (["sostantivo", "aggettivo"].includes(token.partOfSpeech)) {
    const previousToken = verse && tokenIndex > 0 ? verse.tokens[tokenIndex - 1] : null;
    const nextToken =
      verse && tokenIndex >= 0 && tokenIndex + 1 < verse.tokens.length ? verse.tokens[tokenIndex + 1] : null;
    return (
      applyNominalCaseGloss(token, getBaseLexicalGloss(token), previousToken, nextToken) ||
      "da completare nel lessico fisso"
    );
  }

  if (token.partOfSpeech === "verbo") {
    return (
      getFixedLexiconGloss(token.lemma) ||
      "da completare nel lessico fisso"
    );
  }

  return getBaseLexicalGloss(token) || "da completare nel lessico fisso";
};

// Rende il versetto italiano intero:
// prima prova il CEI 2008, altrimenti usa il fallback ricostruito dai token.
const getVerseItalianText = (slug, verse) => {
  const ceiText = getCeiVerseText(slug, verse);
  if (ceiText) return ceiText;
  return verse.tokens.map((token, index) => getTokenDisplayGloss(token, verse, index)).join(" ");
};

// Home page: presenta i moduli del progetto e calcola le statistiche sintetiche.
const renderHome = () => {
  views.home.replaceChildren(cloneTemplate(templates.home));
  const summary = views.home.querySelector("#home-summary");
  const booksCount = state.data.books.length;
  const versesCount = Object.values(state.data.gospels).reduce((total, verses) => total + verses.length, 0);
  const lexiconCount = state.data.lexicon.length;
  const verbTotal = Object.keys(state.data.verbMetadata || {}).length;
  const verbComplete = Object.values(state.data.verbMetadata || {}).filter((item) =>
    item?.completion?.meets_minimum_profile,
  ).length;
  const nounTotal = Object.keys(state.data.nounParadigms || {}).length;
  const pronounTotal = Object.keys(state.data.pronounParadigms || {}).length;

  const cards = [
    {
      title: "Interlineare",
      body: "Leggi il testo greco del Nuovo Testamento parola per parola con supporto diretto al significato e alla pronuncia.",
      stat: `${booksCount} libri e ${versesCount} versetti consultabili`,
      route: "interlinear",
    },
    {
      title: "Vocabolario",
      body: "Consulta i lemmi greci, il significato italiano e le note utili per orientarti nello studio del testo biblico.",
      stat: `${lexiconCount} voci lessicali attualmente indicizzate`,
      route: "vocabulary",
    },
    {
      title: "Grammatica",
      body: "Raccoglie gli argomenti essenziali per accompagnare la lettura del koine in modo più ordinato e progressivo.",
      stat: `${state.data.grammar.length} aree grammaticali disponibili`,
      route: "grammar",
    },
    {
      title: "Morfologia",
      body: "Esplora paradigmi, forme e categorie grammaticali per approfondire verbi, sostantivi, pronomi e altre strutture.",
      stat: `${verbComplete}/${verbTotal} verbi completi, ${nounTotal} sostantivi e ${pronounTotal} pronome nel dataset locale`,
      route: "morphology",
    },
  ];

  summary.innerHTML = cards
    .map(
      (card) => `
        <article class="panel summary-card" data-route-link="${escapeHtml(card.route)}" tabindex="0" role="link">
          <h3>${card.title}</h3>
          <p>${card.body}</p>
          <span class="summary-stat">${escapeHtml(card.stat)}</span>
        </article>
      `,
    )
    .join("");

  wireRouteLinks(views.home);
  summary.querySelectorAll(".summary-card[data-route-link]").forEach((card) => {
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const route = card.dataset.routeLink;
      if (route) setRoute(route);
    });
  });
};

// Interlineare:
// - popola libro/capitolo/versetto
// - mantiene la selezione nell'URL
// - disegna il greco, il versetto italiano e i quadrini parola per parola
const renderInterlinear = () => {
  views.interlinear.replaceChildren(cloneTemplate(templates.interlinear));
  const select = views.interlinear.querySelector("#book-select");
  const chapterSelect = views.interlinear.querySelector("#chapter-select");
  const verseSelect = views.interlinear.querySelector("#verse-select");
  const results = views.interlinear.querySelector("#interlinear-results");
  const { books, gospels } = state.data;

  select.innerHTML = books
    .map(
      (book) =>
        `<option value="${book.slug}">${book.name_it} · ${book.name_gr}</option>`,
    )
    .join("");

  // Estrae capitolo e versetto a partire dal BCV del primo token del versetto.
  const getChapterVerse = (verse) => {
    const bcv = verse?.tokens?.[0]?.bcv || "";
    return {
      chapter: Number(String(bcv).slice(2, 4)),
      verse: Number(String(bcv).slice(4, 6)),
    };
  };

  // Popola la lista dei capitoli disponibili per il libro scelto.
  const populateChapterOptions = (slug) => {
    const verses = gospels[slug] || [];
    const chapters = [...new Set(verses.map((verse) => getChapterVerse(verse).chapter))];
    chapterSelect.innerHTML = chapters
      .map((chapter) => `<option value="${chapter}">${chapter}</option>`)
      .join("");
    return chapters;
  };

  // Popola la lista dei versetti del capitolo scelto.
  const populateVerseOptions = (slug, chapter) => {
    const verses = (gospels[slug] || []).filter(
      (verse) => getChapterVerse(verse).chapter === Number(chapter),
    );
    const verseNumbers = verses.map((verse) => getChapterVerse(verse).verse);
    verseSelect.innerHTML = [
      `<option value="">Tutto il capitolo</option>`,
      ...verseNumbers.map((verse) => `<option value="${verse}">${verse}</option>`),
    ].join("");
  };

  // Disegna i risultati effettivi del filtro corrente.
  const drawSelection = (slug, chapter, verseNumber = "") => {
    const verses = (gospels[slug] || []).filter((item) => {
      const address = getChapterVerse(item);
      if (address.chapter !== Number(chapter)) return false;
      if (verseNumber && address.verse !== Number(verseNumber)) return false;
      return true;
    });

    results.innerHTML = verses
      .map(
        (verse) => `
          <article class="panel">
            <h2>${escapeHtml(verse.reference)}</h2>
            <p class="greek-line">${escapeHtml(verse.greek)}</p>
            <p class="verse-italian">${escapeHtml(getVerseItalianText(slug, verse))}</p>
            <div class="token-grid">
              ${verse.tokens
                .map(
                  (token, index) => `
                    <button class="token-card" type="button" data-lemma="${escapeHtml(token.lemma)}">
                      <strong>${escapeHtml(token.surface)}</strong>
                      <span class="pronunciation">${escapeHtml(token.pronunciation || pronounceGreek(token.surface))}</span>
                      <small class="token-italian">${escapeHtml(getTokenDisplayGloss(token, verse, index))}</small>
                    </button>
                  `,
                )
                .join("")}
            </div>
          </article>
        `,
      )
      .join("");

    results.querySelectorAll("[data-lemma]").forEach((button) => {
      button.addEventListener("click", () => goToWord(button.dataset.lemma));
    });
  };

  // Sincronizza URL e risultati quando cambia libro/capitolo.
  const syncAndDraw = () => {
    populateVerseOptions(select.value, chapterSelect.value);
    replaceRouteState("interlinear", {
      book: select.value,
      chapter: chapterSelect.value,
      verse: verseSelect.value,
    });
    drawSelection(select.value, chapterSelect.value, verseSelect.value);
  };

  select.addEventListener("change", () => {
    const chapters = populateChapterOptions(select.value);
    chapterSelect.value = String(chapters[0] || 1);
    verseSelect.value = "";
    syncAndDraw();
  });

  chapterSelect.addEventListener("change", () => {
    verseSelect.value = "";
    syncAndDraw();
  });

  verseSelect.addEventListener("change", () => {
    replaceRouteState("interlinear", {
      book: select.value,
      chapter: chapterSelect.value,
      verse: verseSelect.value,
    });
    drawSelection(select.value, chapterSelect.value, verseSelect.value);
  });

  const initialSlug = state.interlinearSelection.book || books[0]?.slug || "matthew";
  select.value = initialSlug;
  const chapters = populateChapterOptions(initialSlug);
  chapterSelect.value = String(state.interlinearSelection.chapter || chapters[0] || 1);
  populateVerseOptions(initialSlug, chapterSelect.value);
  verseSelect.value = state.interlinearSelection.verse || "";
  replaceRouteState("interlinear", {
    book: initialSlug,
    chapter: chapterSelect.value,
    verse: verseSelect.value,
  });
  drawSelection(initialSlug, chapterSelect.value, verseSelect.value);
};

// Vocabolario:
// - ricerca nel lessico
// - ranking dei risultati
// - paginazione
// - salvataggio della query nello stato dell'URL
const renderVocabulary = (prefill = "") => {
  views.vocabulary.replaceChildren(cloneTemplate(templates.vocabulary));
  const input = views.vocabulary.querySelector("#vocabulary-search");
  const results = views.vocabulary.querySelector("#vocabulary-results");
  const PAGE_SIZE = 10;
  let currentPage = Number(state.vocabularySelection.page || "1");
  // Gloss mostrato all'utente: prima il lessico fisso, poi il gloss del lexicon.
  const displayGlossForEntry = (entry) => getFixedLexiconGloss(entry.lemma) || entry.glossIt || "";
  const entries = [...state.data.lexicon].sort((left, right) => {
    const leftScore = Number(Boolean(displayGlossForEntry(left))) + Number(Boolean(left.notesIt));
    const rightScore = Number(Boolean(displayGlossForEntry(right))) + Number(Boolean(right.notesIt));
    if (rightScore !== leftScore) return rightScore - leftScore;
    return right.occurrences - left.occurrences;
  });

  // Costruisce i risultati del vocabolario in base alla query.
  const drawResults = (query) => {
    const needle = normalize(query);
    // Ranking: il lemma esatto e sempre piu importante dei match rumorosi.
    const scoreVocabularyMatch = (entry) => {
      if (!needle) {
        return 0;
      }

      const lemma = normalize(entry.lemma);
      const greek = normalize(entry.greek);
      const gloss = normalize(displayGlossForEntry(entry));
      const notes = normalize(entry.notes || "");
      const notesIt = normalize(entry.notesIt || "");

      if (greek === needle) return 100;
      if (lemma === needle) return 95;
      if (greek.startsWith(needle)) return 80;
      if (lemma.startsWith(needle)) return 75;
      if (gloss === needle) return 60;
      if (gloss.startsWith(needle)) return 45;
      if (greek.includes(needle)) return 30;
      if (lemma.includes(needle)) return 25;
      if (gloss.includes(needle)) return 15;
      if (notesIt.includes(needle)) return 5;
      if (notes.includes(needle)) return 1;
      return -1;
    };

    const matches = !needle
      ? entries
      : entries
          .map((entry) => ({ entry, matchScore: scoreVocabularyMatch(entry) }))
          .filter(({ matchScore }) => matchScore >= 0)
          .sort((left, right) => {
            if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore;

            const rightDataScore =
              Number(Boolean(displayGlossForEntry(right.entry))) + Number(Boolean(right.entry.notesIt));
            const leftDataScore =
              Number(Boolean(displayGlossForEntry(left.entry))) + Number(Boolean(left.entry.notesIt));
            if (rightDataScore !== leftDataScore) return rightDataScore - leftDataScore;

            return right.entry.occurrences - left.entry.occurrences;
          })
          .map(({ entry }) => entry);

    if (!matches.length) {
      results.innerHTML = `<article class="notice">Nessuna voce trovata.</article>`;
      return;
    }

    const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(currentPage, 1), totalPages);
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pagedMatches = matches.slice(start, start + PAGE_SIZE);

    const pageNumbers = [];
    const pageWindowStart = Math.max(1, currentPage - 2);
    const pageWindowEnd = Math.min(totalPages, currentPage + 2);
    for (let page = pageWindowStart; page <= pageWindowEnd; page += 1) {
      pageNumbers.push(page);
    }

    results.innerHTML = pagedMatches
      .map(
        (entry) => {
          const cleanNote = cleanVocabularyItalianNote(entry.notesIt || "");
          const showItalianNote = shouldShowItalianNote(
            entry,
            cleanNote,
            displayGlossForEntry(entry) || "",
          );
          return `
          <article class="panel">
            <div class="lexicon-head">
              <h2>${escapeHtml(entry.greek)}</h2>
              <span class="meta">${escapeHtml(entry.partOfSpeech)}</span>
            </div>
            <p class="word-pronunciation">${escapeHtml(pronounceGreek(entry.greek))}</p>
            <p><strong>Lemma:</strong> ${escapeHtml(entry.lemma)}</p>
            <p><strong>Significato:</strong> ${escapeHtml(displayGlossForEntry(entry) || "Da definire nel lessico italiano privato")}</p>
            ${
              showItalianNote
                ? `<p><strong>Nota italiana:</strong> ${escapeHtml(cleanNote)}</p>`
                : ""
            }
            <p><a href="word.html?lemma=${encodeURIComponent(normalize(entry.lemma))}" data-word-link="${escapeHtml(
              entry.lemma,
            )}">Apri analisi completa</a></p>
          </article>
        `;
        },
      )
      .join("") + `
        <nav class="pagination-bar" aria-label="Pagine vocabolario">
          <button type="button" class="pagination-arrow" data-page-nav="prev" ${currentPage === 1 ? "disabled" : ""}>←</button>
          ${pageNumbers
            .map(
              (page) => `
                <button
                  type="button"
                  class="pagination-page${page === currentPage ? " is-active" : ""}"
                  data-page-number="${page}"
                >${page}</button>
              `,
            )
            .join("")}
          <button type="button" class="pagination-arrow" data-page-nav="next" ${currentPage === totalPages ? "disabled" : ""}>→</button>
        </nav>
      `;

    results.querySelectorAll("[data-word-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        goToWord(link.dataset.wordLink);
      });
    });

    results.querySelectorAll("[data-page-number]").forEach((button) => {
      button.addEventListener("click", () => {
        currentPage = Number(button.dataset.pageNumber || "1");
        replaceRouteState("vocabulary", {
          q: input.value.trim(),
          page: String(currentPage),
        });
        drawResults(input.value);
      });
    });

    results.querySelectorAll("[data-page-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        currentPage += button.dataset.pageNav === "next" ? 1 : -1;
        replaceRouteState("vocabulary", {
          q: input.value.trim(),
          page: String(currentPage),
        });
        drawResults(input.value);
      });
    });
  };

  input.value = prefill;
  input.addEventListener("input", () => {
    currentPage = 1;
    replaceRouteState("vocabulary", {
      q: input.value.trim(),
      page: "1",
    });
    drawResults(input.value);
  });
  drawResults(prefill);
};

// Grammatica: semplice rendering della lista di argomenti.
const renderGrammar = () => {
  views.grammar.replaceChildren(cloneTemplate(templates.grammar));
  const container = views.grammar.querySelector("#grammar-results");
  container.innerHTML = state.data.grammar
    .map(
      (topic) => `
        <article class="panel">
          <h2>${escapeHtml(topic.title)}</h2>
          <p>${escapeHtml(topic.summary)}</p>
          <div class="stack">
            ${topic.details
              .map((item) => `<div class="micro-panel">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");
};

// Morfologia:
// - riconosce automaticamente il tipo di parola
// - cerca il lemma
// - usa prima i paradigmi ufficiali del dataset
// - solo in mancanza, ricorre al fallback minimo di morphology.js
const renderMorphology = () => {
  views.morphology.replaceChildren(cloneTemplate(templates.morphology));
  const form = views.morphology.querySelector("#morphology-form");
  const lemmaInput = views.morphology.querySelector("#morph-lemma");
  const output = views.morphology.querySelector("#morphology-result");

  // Cerca il paradigma ufficiale nel dataset corretto in base al tipo di parola.
  const getOfficialParadigm = (lemma, type) => {
    const source =
      type === "noun"
        ? state.data.nounParadigms
        : type === "pronoun"
          ? state.data.pronounParadigms
          : state.data.verbParadigms;
    return source[lemma] || null;
  };

  // Riconosce il tipo grammaticale partendo prima dal lessico
  // e poi dai dataset paradigmatici ufficiali.
  const resolveMorphType = (lemma) => {
    const lexiconEntry = state.data.lexicon.find((entry) => normalize(entry.lemma) === lemma);
    const partOfSpeech = normalize(lexiconEntry?.partOfSpeech || "");

    if (partOfSpeech.startsWith("pronome")) return "pronoun";
    if (partOfSpeech === "sostantivo") return "noun";
    if (partOfSpeech === "verbo") return "verb";

    if (state.data.pronounParadigms?.[lemma]) return "pronoun";
    if (state.data.nounParadigms?.[lemma]) return "noun";
    if (state.data.verbParadigms?.[lemma]) return "verb";

    if (lemma.endsWith("ω") || lemma.endsWith("μι")) return "verb";
    return "noun";
  };

  // Disegna la scheda morfologica corrente.
  const draw = () => {
    const lemma = normalize(lemmaInput.value);
    const detectedType = lemma ? resolveMorphType(lemma) : "";
    replaceRouteState("morphology", {
      lemma,
    });
    if (!lemma) {
      output.innerHTML = `<article class="notice">Inserisci un lemma per visualizzare la scheda morfologica.</article>`;
      return;
    }

    const officialCandidate = getOfficialParadigm(lemma, detectedType);
    const official =
      officialCandidate && Object.keys(officialCandidate.paradigms || {}).length
        ? officialCandidate
        : null;
    const result =
      detectedType === "noun"
        ? analyzeNoun(lemma)
        : detectedType === "pronoun"
          ? { forms: {}, pattern: "Pronome", note: "Scheda pronominale disponibile." }
          : analyzeVerb(lemma);
    const meaning =
      official?.meaning_it ||
      (detectedType === "noun" ? "sostantivo" : detectedType === "pronoun" ? "pronome" : "verbo");
    const title = official ? official.class : result.pattern;
    const note = official ? "" : result.note;
    const sections = official
      ? Object.entries(official.paradigms).map(([sectionTitle, sectionData]) => ({
          title: sectionTitle,
          ...normalizeParadigmSection(sectionData),
        }))
      : [{ title: "Paradigma", forms: Object.entries(result.forms || {}), meanings: {} }];
    const filledSections = sections.filter((section) => section.forms.length);
    const verbSelectorId = `morph-${lemma}`;
    const verbEntries =
      detectedType === "verb" && official ? buildVerbSectionEntries(filledSections, verbSelectorId) : [];
    const showTopNote = Boolean(note) && filledSections.length > 0;
    output.innerHTML = `
      <article class="panel">
        <h2>${escapeHtml(title)}</h2>
        ${showTopNote ? `<p>${escapeHtml(note)}</p>` : ""}
        ${
          filledSections.length
            ? verbEntries.length
              ? renderVerbSectionControls(verbEntries, verbSelectorId)
              : filledSections
                  .map((section) =>
                    renderParadigmCard(section.title, section.forms, meaning, {
                      mode:
                        detectedType === "pronoun"
                          ? "pronoun"
                          : detectedType === "noun"
                            ? "case"
                            : "default",
                      meanings: section.meanings,
                    }),
                  )
                  .join("")
            : `<div class="notice">Per questo lemma non è ancora disponibile una scheda morfologica completa.</div>`
        }
      </article>
    `;
    if (verbEntries.length) {
      wireVerbSectionControls(output, verbSelectorId, verbEntries, meaning, {
        mode: "default",
      });
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    draw();
  });

  lemmaInput.addEventListener("input", () => {
    draw();
  });

  if (state.selectedLemma) {
    lemmaInput.value = state.selectedLemma;
    draw();
    return;
  }

  replaceRouteState("morphology", {
    lemma: "",
  });
  output.innerHTML = `<article class="notice">Inserisci un lemma per visualizzare la scheda morfologica.</article>`;
};

// Collega i link della UI al router interno della SPA.
const wireRouteLinks = (root = document) => {
  root.querySelectorAll("[data-route], [data-route-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const route = link.dataset.route || link.dataset.routeLink;
      if (!route) return;
      event.preventDefault();
      setRoute(route);
    });
  });
};

// Render centrale: attiva una sola vista per volta e poi la costruisce.
const render = (vocabularyPrefill = "") => {
  Object.entries(views).forEach(([key, element]) => {
    element.classList.toggle("active", key === state.route);
  });

  document.querySelectorAll(".main-nav a").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === state.route);
  });

  if (state.route === "home") renderHome();
  if (state.route === "interlinear") renderInterlinear();
  if (state.route === "vocabulary") renderVocabulary(vocabularyPrefill || state.vocabularySelection.query);
  if (state.route === "grammar") renderGrammar();
  if (state.route === "morphology") renderMorphology();

  wireRouteLinks();
};

// Bootstrap iniziale del sito:
// carica i dati, legge l'URL e monta la vista giusta.
const bootstrap = async () => {
  try {
    state.data = await loadData();
    activateRouteFromHash();
    render();
  } catch (error) {
    document.querySelector("#app").innerHTML = `
      <article class="notice">
        Errore nel caricamento dei dati statici. Apri il progetto tramite un server locale o GitHub Pages.
      </article>
    `;
    console.error(error);
  }
};

// Se cambia l'hash, il sito ricostruisce lo stato corrispondente.
window.addEventListener("hashchange", () => {
  activateRouteFromHash();
  render();
});

bootstrap();
