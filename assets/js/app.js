// app.js e il cuore della single-page application.
// Gestisce:
// - routing tramite hash
// - stato corrente dell'interfaccia
// - rendering delle viste principali
// - collegamento tra UI e dataset caricati da data-loader.js

import { loadData } from "./data-loader.js";
import {
  buildVerbSectionEntries,
  escapeHtml,
  normalize,
  normalizeParadigmSection,
  openParadigmPrintView,
  pronounceGreek,
  renderParadigmCard,
  renderVerbSectionControls,
  wireVerbSectionControls,
} from "./display-helpers.js";
import { analyzeNoun, analyzeVerb } from "./morphology.js";

// Stato centrale della SPA.
// Ogni vista legge qui i parametri che servono per ricostruire la pagina.
const state = {
  route: "home",
  selectedLemma: "",
  selectedMorphType: "verb",
  grammarSelection: {
    chapter: "",
  },
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
  vocabularyIndex: [],
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
  state.grammarSelection = {
    chapter: params.chapter || "",
  };
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
  state.grammarSelection = {
    chapter: params.chapter || "",
  };
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

// Link diretto alla scheda parola completa.
const buildWordHref = (lemma) => `word.html?lemma=${encodeURIComponent(normalize(lemma))}`;

// Prepara una versione gia normalizzata e ordinata del lessico.
// In questo modo il Vocabolario non deve ricostruire tutto a ogni apertura
// o a ogni tasto premuto nella ricerca.
const prepareVocabularyIndex = (data) => {
  const displayGlossForEntry = (entry) => getFixedLexiconGloss(entry.lemma) || entry.glossIt || "";
  return [...data.lexicon]
    .map((entry) => ({
      entry,
      displayGloss: displayGlossForEntry(entry),
      normalizedLemma: normalize(entry.lemma),
      normalizedGreek: normalize(entry.greek),
      normalizedGloss: normalize(displayGlossForEntry(entry)),
      normalizedNotes: normalize(entry.notes || ""),
      hasDisplayGloss: Number(Boolean(displayGlossForEntry(entry))),
    }))
    .sort((left, right) => {
      if (right.hasDisplayGloss !== left.hasDisplayGloss) return right.hasDisplayGloss - left.hasDisplayGloss;
      return right.entry.occurrences - left.entry.occurrences;
    });
};

// Legge lo stato dall'hash e ricostruisce la route corrente.
const activateRouteFromHash = () => {
  const rawHash = window.location.hash.replace("#", "");
  if (!rawHash) {
    state.route = "home";
    state.selectedLemma = "";
    state.selectedMorphType = "verb";
    state.grammarSelection = { chapter: "" };
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
  state.grammarSelection = {
    chapter: params.get("chapter") || "",
  };
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

// Raccoglie tutte le occorrenze di un lemma nel Nuovo Testamento gia caricato.
// Serve per mostrare nella pagina Morfologia dove la parola compare davvero nel testo.
const collectOccurrences = (gospels, lemma) => {
  const matches = [];
  Object.entries(gospels).forEach(([slug, verses]) => {
    verses.forEach((verse) => {
      verse.tokens.forEach((token) => {
        if (normalize(token.lemma) !== normalize(lemma)) return;
        matches.push({
          slug,
          lemma: token.lemma,
          surface: token.surface,
          reference: verse.reference,
          pronunciation: token.pronunciation || pronounceGreek(token.surface),
          morphologyLabel: token.morphologyLabel || "",
          verseGreek: verse.greek,
          verseItalian: getVerseItalianText(slug, verse),
          bcv: token.bcv || "",
        });
      });
    });
  });
  return matches;
};

// Link diretto dall'occorrenza al versetto corrispondente nell'Interlineare.
const buildInterlinearHref = (occurrence) =>
  `#interlinear?book=${encodeURIComponent(occurrence.slug)}&chapter=${encodeURIComponent(
    String(Number(String(occurrence.bcv).slice(2, 4))),
  )}&verse=${encodeURIComponent(String(Number(String(occurrence.bcv).slice(4, 6))))}`;

// Evidenzia nel versetto greco solo la parola attualmente cercata nella scheda.
const renderGreekVerseWithHighlight = (occurrence) => {
  const verse = (state.data.gospels?.[occurrence.slug] || []).find((item) => item.reference === occurrence.reference);
  if (!verse?.tokens?.length) return escapeHtml(occurrence.verseGreek || "");
  return verse.tokens
    .map((token) => {
      const content = escapeHtml(token.surface);
      return normalize(token.lemma) === normalize(occurrence.lemma)
        ? `<strong class="occurrence-focus">${content}</strong>`
        : content;
    })
    .join(" ");
};

// Piccole statistiche riassuntive per il blocco "Occorrenze nel NT".
const buildOccurrenceStats = (occurrences) => {
  const references = [...new Set(occurrences.map((item) => item.reference))];
  const books = [...new Set(references.map((item) => item.split(" ")[0]).filter(Boolean))];
  const forms = [...new Set(occurrences.map((item) => item.surface))];
  return {
    total: occurrences.length,
    references: references.length,
    books: books.length,
    forms: forms.length,
  };
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
  let drawTimer = null;
  const entries = state.vocabularyIndex;

  // Render condiviso della barra di paginazione del vocabolario.
  // Viene mostrata sia sopra che sotto i risultati correnti.
  const renderVocabularyPagination = (current, total, pageNumbers) => `
    <nav class="pagination-bar" aria-label="Pagine vocabolario">
      <button type="button" class="pagination-arrow" data-page-nav="prev" ${current === 1 ? "disabled" : ""}>←</button>
      ${pageNumbers
        .map(
          (page) => `
            <button
              type="button"
              class="pagination-page${page === current ? " is-active" : ""}"
              data-page-number="${page}"
            >${page}</button>
          `,
        )
        .join("")}
      <button type="button" class="pagination-arrow" data-page-nav="next" ${current === total ? "disabled" : ""}>→</button>
    </nav>
  `;

  // Costruisce i risultati del vocabolario in base alla query.
  const drawResults = (query) => {
    const needle = normalize(query);
    // Ranking: il lemma esatto e sempre piu importante dei match rumorosi.
    const scoreVocabularyMatch = (entry) => {
      if (!needle) {
        return 0;
      }

      const lemma = entry.normalizedLemma;
      const greek = entry.normalizedGreek;
      const gloss = entry.normalizedGloss;
      const notes = entry.normalizedNotes;

      if (greek === needle) return 100;
      if (lemma === needle) return 95;
      if (greek.startsWith(needle)) return 80;
      if (lemma.startsWith(needle)) return 75;
      if (gloss === needle) return 60;
      if (gloss.startsWith(needle)) return 45;
      if (greek.includes(needle)) return 30;
      if (lemma.includes(needle)) return 25;
      if (gloss.includes(needle)) return 15;
      if (notes.includes(needle)) return 1;
      return -1;
    };

    const matches = !needle
      ? entries.map(({ entry }) => entry)
      : entries
          .map((prepared) => ({ entry: prepared.entry, matchScore: scoreVocabularyMatch(prepared) }))
          .filter(({ matchScore }) => matchScore >= 0)
          .sort((left, right) => {
            if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore;

            const rightDataScore = Number(Boolean(getFixedLexiconGloss(right.entry.lemma) || right.entry.glossIt || ""));
            const leftDataScore = Number(Boolean(getFixedLexiconGloss(left.entry.lemma) || left.entry.glossIt || ""));
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

    const cardsHtml = pagedMatches
      .map((entry) => {
        const displayGloss = getFixedLexiconGloss(entry.lemma) || entry.glossIt || "";
        return `
          <article class="panel lexicon-card">
            <div class="lexicon-head">
              <h2>${escapeHtml(entry.greek)}</h2>
              <span class="meta">${escapeHtml(entry.partOfSpeech)}</span>
            </div>
            <div class="lexicon-meta-grid">
              <div class="lexicon-meta-cell">
                <strong>Pronuncia</strong>
                <span class="word-pronunciation">${escapeHtml(pronounceGreek(entry.greek))}</span>
              </div>
              <div class="lexicon-meta-cell">
                <strong>Lemma</strong>
                <span>${escapeHtml(entry.lemma)}</span>
              </div>
              <div class="lexicon-meta-cell lexicon-meta-cell-wide">
                <strong>Significato</strong>
                <span>${escapeHtml(displayGloss || "Da definire nel lessico italiano")}</span>
              </div>
            </div>
            <p class="lexicon-link-row"><a href="word.html?lemma=${encodeURIComponent(normalize(entry.lemma))}" data-word-link="${escapeHtml(
              entry.lemma,
            )}">Apri analisi completa</a></p>
          </article>
        `;
      })
      .join("");

    const rangeStart = start + 1;
    const rangeEnd = Math.min(start + PAGE_SIZE, matches.length);
    const resultsLabel = `
      <div class="results-summary" aria-label="Riepilogo risultati vocabolario">
        <span class="results-count">Mostra ${rangeStart}-${rangeEnd} di ${matches.length} ${matches.length === 1 ? "risultato" : "risultati"}</span>
      </div>
    `;
    const paginationHtml = renderVocabularyPagination(currentPage, totalPages, pageNumbers);
    results.innerHTML = `${resultsLabel}${paginationHtml}${cardsHtml}${paginationHtml}`;

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
    window.clearTimeout(drawTimer);
    drawTimer = window.setTimeout(() => {
      currentPage = 1;
      replaceRouteState("vocabulary", {
        q: input.value.trim(),
        page: "1",
      });
      drawResults(input.value);
    }, 120);
  });
  drawResults(prefill);
};

// Grammatica:
// - indice generale del manuale
// - apertura del singolo capitolo via hash
// - struttura pensata come manuale consultabile, non come lista piatta
const renderGrammar = () => {
  views.grammar.replaceChildren(cloneTemplate(templates.grammar));
  const container = views.grammar.querySelector("#grammar-results");
  const chapters = state.data.grammar || [];
  const selectedChapter = chapters.find((item) => item.id === state.grammarSelection.chapter) || null;

  if (!selectedChapter) {
    const parts = chapters.reduce((grouped, chapter) => {
      if (!grouped[chapter.part]) grouped[chapter.part] = [];
      grouped[chapter.part].push(chapter);
      return grouped;
    }, {});

    container.innerHTML = `
      <section class="panel grammar-manual-intro">
        <h2>Indice del manuale</h2>
        <p>La grammatica viene presentata come un manuale di studio del greco koine: scegli un capitolo per aprire spiegazioni, temi e punti essenziali da consultare mentre leggi il Nuovo Testamento.</p>
      </section>
      <section class="stack grammar-index">
        ${Object.entries(parts)
          .map(
            ([partTitle, items]) => `
              <article class="panel grammar-part">
                <div class="grammar-part-head">
                  <h3>${escapeHtml(partTitle)}</h3>
                  <span class="meta">${items.length} ${items.length === 1 ? "capitolo" : "capitoli"}</span>
                </div>
                <div class="stack grammar-chapter-list">
                  ${items
                    .map(
                      (chapter) => `
                        <button type="button" class="grammar-chapter-card" data-grammar-chapter="${escapeHtml(chapter.id)}">
                          <span class="grammar-chapter-kicker">${escapeHtml(chapter.chapter)}</span>
                          <strong>${escapeHtml(chapter.title)}</strong>
                          <span>${escapeHtml(chapter.summary)}</span>
                        </button>
                      `,
                    )
                    .join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </section>
    `;

    container.querySelectorAll("[data-grammar-chapter]").forEach((button) => {
      button.addEventListener("click", () => {
        setRoute("grammar", { chapter: button.dataset.grammarChapter || "" });
      });
    });
    return;
  }

  const chapterIndex = chapters.findIndex((item) => item.id === selectedChapter.id);
  const previousChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null;

  container.innerHTML = `
    <section class="stack grammar-detail">
      <article class="panel grammar-breadcrumb">
        <button type="button" class="text-link-button" data-grammar-back>&larr; Torna all'indice</button>
        <span class="meta">${escapeHtml(selectedChapter.part)} · ${escapeHtml(selectedChapter.chapter)}</span>
      </article>

      <article class="panel grammar-detail-hero">
        <p class="grammar-chapter-kicker">${escapeHtml(selectedChapter.chapter)}</p>
        <h2>${escapeHtml(selectedChapter.title)}</h2>
        <p>${escapeHtml(selectedChapter.summary)}</p>
      </article>

      ${selectedChapter.sections
        .map(
          (section) => `
            <article class="panel grammar-section-card">
              <h3>${escapeHtml(section.title)}</h3>
              ${
                (section.paragraphs || [])
                  .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
                  .join("")
              }
              ${
                section.points?.length
                  ? `
                    <div class="stack">
                      ${section.points
                        .map((item) => `<div class="micro-panel">${escapeHtml(item)}</div>`)
                        .join("")}
                    </div>
                  `
                  : ""
              }
            </article>
          `,
        )
        .join("")}

      <article class="panel grammar-detail-nav">
        ${
          previousChapter
            ? `<button type="button" class="secondary-button" data-grammar-prev="${escapeHtml(previousChapter.id)}">&larr; ${escapeHtml(previousChapter.title)}</button>`
            : `<span></span>`
        }
        ${
          nextChapter
            ? `<button type="button" class="secondary-button" data-grammar-next="${escapeHtml(nextChapter.id)}">${escapeHtml(nextChapter.title)} &rarr;</button>`
            : `<span></span>`
        }
      </article>
    </section>
  `;

  container.querySelector("[data-grammar-back]")?.addEventListener("click", () => {
    setRoute("grammar");
  });
  container.querySelector("[data-grammar-prev]")?.addEventListener("click", (event) => {
    const target = event.currentTarget.dataset.grammarPrev || "";
    setRoute("grammar", { chapter: target });
  });
  container.querySelector("[data-grammar-next]")?.addEventListener("click", (event) => {
    const target = event.currentTarget.dataset.grammarNext || "";
    setRoute("grammar", { chapter: target });
  });
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
    const occurrences = lemma ? collectOccurrences(state.data.gospels, lemma) : [];
    const occurrenceStats = buildOccurrenceStats(occurrences);
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
    const verbLemmaEntry = detectedType === "verb" ? state.data.verbLemmas?.[lemma] || null : null;
    const sections = official
      ? Object.entries(official.paradigms).map(([sectionTitle, sectionData]) => ({
          title: sectionTitle,
          ...normalizeParadigmSection(sectionData),
        }))
      : [{ title: "Paradigma", forms: Object.entries(result.forms || {}), meanings: {} }];
    const filledSections = sections.filter((section) => section.forms.length);
    const allCardsHtml = filledSections
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
      .join("");
    const verbSelectorId = `morph-${lemma}`;
    const verbEntries =
      detectedType === "verb" && official ? buildVerbSectionEntries(filledSections, verbSelectorId) : [];
    const showTopNote = Boolean(note) && filledSections.length > 0;
    const morphologySummary = filledSections.length ? [title, note].filter(Boolean).join(". ") : "";
    output.innerHTML = `
      <section class="word-layout">
        <article class="panel">
          <div class="panel-head panel-head-split">
            <div class="panel-head-copy">
              <h3>Analisi morfologica</h3>
              ${showTopNote || morphologySummary ? `<p>${escapeHtml(morphologySummary)}</p>` : ""}
            </div>
            ${
              filledSections.length
                ? `
                  <div class="panel-actions">
                    <button type="button" class="secondary-button print-button" data-print-paradigm-full><span class="print-icon" aria-hidden="true"></span> Completa</button>
                    <button type="button" class="secondary-button print-button" data-print-paradigm-current><span class="print-icon" aria-hidden="true"></span> Attuale</button>
                  </div>
                `
                : ""
            }
          </div>
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

        <article class="panel">
          <h3>Occorrenze nel Nuovo Testamento</h3>
          ${
            occurrences.length
              ? `
                <div class="stats-grid">
                  <div class="micro-panel stat-card">
                    <span class="meta">Occorrenze totali</span>
                    <strong>${escapeHtml(String(occurrenceStats.total))}</strong>
                  </div>
                  <div class="micro-panel stat-card">
                    <span class="meta">Versetti distinti</span>
                    <strong>${escapeHtml(String(occurrenceStats.references))}</strong>
                  </div>
                  <div class="micro-panel stat-card">
                    <span class="meta">Libri coinvolti</span>
                    <strong>${escapeHtml(String(occurrenceStats.books))}</strong>
                  </div>
                  <div class="micro-panel stat-card">
                    <span class="meta">Forme attestate</span>
                    <strong>${escapeHtml(String(occurrenceStats.forms))}</strong>
                  </div>
                </div>
                <details class="occurrence-details">
                  <summary>Apri i versetti e le occorrenze</summary>
                  <div class="stack occurrence-stack">
                    ${occurrences
                      .map(
                        (occurrence) => `
                          <div class="micro-panel">
                            <strong><a class="verse-word-link" href="${buildWordHref(occurrence.lemma)}">${escapeHtml(
                              occurrence.surface,
                            )}</a></strong>
                            <span class="word-pronunciation">${escapeHtml(occurrence.pronunciation)}</span>
                            <span class="meta"><a class="verse-word-link" href="${buildInterlinearHref(
                              occurrence,
                            )}">${escapeHtml(occurrence.reference)}</a></span>
                            ${
                              occurrence.morphologyLabel
                                ? `<span class="meta">${escapeHtml(occurrence.morphologyLabel)}</span>`
                                : ""
                            }
                            <p class="occurrence-greek">${renderGreekVerseWithHighlight(occurrence)}</p>
                            ${
                              occurrence.verseItalian
                                ? `<p class="occurrence-italian">${escapeHtml(occurrence.verseItalian)}</p>`
                                : ""
                            }
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                </details>
              `
              : `<div class="notice">Nessuna occorrenza trovata nei dati attuali.</div>`
          }
        </article>
      </section>
    `;
    if (verbEntries.length) {
      wireVerbSectionControls(output, verbSelectorId, verbEntries, meaning, {
        mode: "default",
      });
    }
    if (filledSections.length) {
      const metadata = [
        { label: "Lemma", value: verbLemmaEntry?.greek || official?.lemma || lemmaInput.value.trim() || lemma },
        ...(verbLemmaEntry?.pronunciation ? [{ label: "Pronuncia", value: verbLemmaEntry.pronunciation }] : []),
        { label: "Categoria", value: detectedType === "noun" ? "sostantivo" : detectedType === "pronoun" ? "pronome" : "verbo" },
        { label: "Classe", value: title },
        { label: "Significato", value: meaning },
        ...(verbLemmaEntry?.principal_parts?.length
          ? [{ label: "Parti principali", value: verbLemmaEntry.principal_parts.join(" · ") }]
          : []),
      ];

      const printCurrentButton = output.querySelector("[data-print-paradigm-current]");
      const printFullButton = output.querySelector("[data-print-paradigm-full]");

      printCurrentButton.onclick = () => {
        const visibleCards = [...output.querySelectorAll(".paradigm-card")]
          .map((card) => card.outerHTML)
          .join("");
        openParadigmPrintView({
          title: verbLemmaEntry?.greek || official?.lemma || lemmaInput.value.trim() || lemma,
          subtitle: `${title} · ${meaning}`,
          metadata,
          contentHtml: visibleCards,
          notes: detectedType === "verb"
            ? "La stampa rispetta le sezioni attualmente visibili della scheda verbale."
            : "La stampa rispetta la scheda morfologica attualmente visibile.",
        });
      };

      printFullButton.onclick = () => {
        openParadigmPrintView({
          title: verbLemmaEntry?.greek || official?.lemma || lemmaInput.value.trim() || lemma,
          subtitle: `${title} · ${meaning}`,
          metadata,
          contentHtml: allCardsHtml,
          notes: detectedType === "verb"
            ? "La stampa include tutte le sezioni disponibili della scheda verbale."
            : "La stampa include tutta la scheda morfologica disponibile.",
        });
      };
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
    state.vocabularyIndex = prepareVocabularyIndex(state.data);
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
