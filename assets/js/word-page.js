// word-page.js costruisce la scheda completa di una singola parola.
// Qui confluiscono tre livelli:
// - lessico del lemma
// - morfologia/paradigmi
// - occorrenze nel Nuovo Testamento

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

const result = document.querySelector("#word-page-result");

// Fallback molto semplice per intuire la categoria della parola
// quando il lessico non offre ancora un dato completo.
const inferPartOfSpeech = (lemma) => {
  if (lemma.endsWith("ω") || lemma.endsWith("μι")) return "verbo";
  if (
    lemma.endsWith("ος") ||
    lemma.endsWith("ον") ||
    lemma.endsWith("η") ||
    lemma.endsWith("α") ||
    lemma.endsWith("ις")
  ) {
    return "sostantivo";
  }
  return "parola";
};

// Raccoglie tutte le occorrenze di un lemma nel NT gia caricato.
const collectOccurrences = (gospels, lemma) => {
  const matches = [];
  Object.values(gospels).forEach((verses) => {
    verses.forEach((verse) => {
      verse.tokens.forEach((token) => {
        if (normalize(token.lemma) === normalize(lemma)) {
          matches.push({
            lemma: token.lemma,
            reference: verse.reference,
            verseGreek: verse.greek,
            surface: token.surface,
            gloss: token.gloss,
            alignedGloss: token.alignedGloss || "",
            alignedGlossIt: token.alignedGlossIt || "",
            alignedGlossDetail: token.alignedGlossDetail || "",
            pronunciation: token.pronunciation || pronounceGreek(token.surface),
            morphologyLabel: token.morphologyLabel || "",
            partOfSpeech: token.partOfSpeech || "",
            bcv: token.bcv || "",
          });
        }
      });
    });
  });
  return matches;
};

// Traduce il prefisso BCV nel relativo slug del libro usato dal progetto.
const getSlugFromBcv = (bcv = "") => {
  const slugByIndex = {
    1: "matthew",
    2: "mark",
    3: "luke",
    4: "john",
    5: "acts",
    6: "romans",
    7: "1-corinthians",
    8: "2-corinthians",
    9: "galatians",
    10: "ephesians",
    11: "philippians",
    12: "colossians",
    13: "1-thessalonians",
    14: "2-thessalonians",
    15: "1-timothy",
    16: "2-timothy",
    17: "titus",
    18: "philemon",
    19: "hebrews",
    20: "james",
    21: "1-peter",
    22: "2-peter",
    23: "1-john",
    24: "2-john",
    25: "3-john",
    26: "jude",
    27: "revelation",
  };
  return slugByIndex[Number(String(bcv).slice(0, 2))] || "";
};

// Recupera il versetto strutturato a cui appartiene una certa occorrenza.
const getVerseRecord = (data, occurrence) => {
  if (!occurrence?.bcv) return null;
  const slug = getSlugFromBcv(occurrence.bcv);
  const chapter = Number(String(occurrence.bcv).slice(2, 4));
  const verse = Number(String(occurrence.bcv).slice(4, 6));
  return (data.gospels?.[slug] || []).find((item) => {
    const tokenBcv = item.tokens?.[0]?.bcv;
    return (
      tokenBcv &&
      Number(String(tokenBcv).slice(2, 4)) === chapter &&
      Number(String(tokenBcv).slice(4, 6)) === verse
    );
  });
};

// Recupera il testo CEI 2008 del versetto dell'occorrenza.
const getCeiVerseText = (data, occurrence) => {
  if (!occurrence?.bcv || !data.ceiVerses) return "";
  const bcv = String(occurrence.bcv);
  const bookIndex = Number(bcv.slice(0, 2));
  const chapter = String(Number(bcv.slice(2, 4)));
  const verse = String(Number(bcv.slice(4, 6)));
  const slug = getSlugFromBcv(bookIndex);
  const rawText = data.ceiVerses?.[slug]?.chapters?.[chapter]?.[verse] || "";
  return rawText.replace(/^\s*\d+\s*-->\s*/, "").trim();
};

// Traduce la parte del discorso in uno dei tipi attesi dalla pagina morfologia.
const morphologyTypeFromPartOfSpeech = (partOfSpeech = "") =>
  normalize(partOfSpeech).startsWith("pronome")
    ? "pronoun"
    : normalize(partOfSpeech) === "sostantivo"
      ? "noun"
      : "verb";

// Link diretto dalla scheda parola alla pagina Morfologia.
const buildMorphologyHref = (lemma, partOfSpeech) =>
  `index.html#morphology?lemma=${encodeURIComponent(normalize(lemma))}&type=${encodeURIComponent(
    morphologyTypeFromPartOfSpeech(partOfSpeech),
  )}`;

// Link diretto dalla scheda parola all'Interlineare sul versetto preciso.
const buildInterlinearHref = (occurrence) => {
  const slug = getSlugFromBcv(occurrence.bcv);
  const chapter = Number(String(occurrence.bcv).slice(2, 4));
  const verse = Number(String(occurrence.bcv).slice(4, 6));
  return `index.html#interlinear?book=${encodeURIComponent(slug)}&chapter=${encodeURIComponent(
    String(chapter),
  )}&verse=${encodeURIComponent(String(verse))}`;
};

// Evidenzia nel versetto greco la parola attualmente studiata.
const renderGreekVerseWithLinks = (data, occurrence) => {
  const verseRecord = getVerseRecord(data, occurrence);
  if (!verseRecord?.tokens?.length) return escapeHtml(occurrence.verseGreek || "");
  return verseRecord.tokens
    .map((token) => {
      const content = escapeHtml(token.surface);
      if (normalize(token.lemma) === normalize(occurrence.lemma)) {
        return `<strong class="occurrence-focus">${content}</strong>`;
      }
      return content;
    })
    .join(" ");
};

// Utility leggere per deduplicare e contare valori nelle occorrenze.
const uniqueValues = (values) => [...new Set(values.filter(Boolean))];

const countValues = (values) => {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
};

const getFixedFunctionGloss = (data, lemma) => data.functionGlosses?.[normalize(lemma)]?.glossIt || "";
const getFixedLexiconGloss = (data, lemma) => data.fixedLexicon?.[normalize(lemma)]?.glossIt || "";

// Piccolo dizionario di supporto per interpretare gloss secondari.
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

// Elenco di parole italiane troppo deboli per essere usate come evidenziazione.
const isWeakItalianWord = (value = "") => {
  const weak = new Set([
    "il",
    "lo",
    "la",
    "i",
    "gli",
    "le",
    "un",
    "una",
    "uno",
    "di",
    "a",
    "da",
    "in",
    "con",
    "su",
    "per",
    "tra",
    "fra",
    "e",
    "o",
    "ma",
    "che",
    "si",
    "poi",
    "allora",
  ]);
  return weak.has((value || "").trim().toLowerCase());
};

// Per alcuni participi costruiamo una resa italiana piu plausibile.
const buildItalianParticiple = (lexicalGloss = "", occurrence) => {
  const gloss = (lexicalGloss || "").split(",")[0].trim().toLowerCase();
  const morphology = normalize(occurrence?.morphologyLabel || "");
  if (!gloss || !morphology.includes("participio")) return "";

  const irregulars = {
    benedire: "benedetto",
    compiere: "compiuto",
    generare: "generato",
    dire: "detto",
    fare: "fatto",
    venire: "venuto",
    essere: "stato",
    avere: "avuto",
  };
  if (irregulars[gloss]) return irregulars[gloss];
  if (gloss.endsWith("are")) return `${gloss.slice(0, -3)}ato`;
  if (gloss.endsWith("ere")) return `${gloss.slice(0, -3)}uto`;
  if (gloss.endsWith("ire")) return `${gloss.slice(0, -3)}ito`;
  return "";
};

// Candidati possibili per capire come la parola potrebbe apparire nel testo italiano.
const buildItalianHighlightCandidates = (occurrence, lexicalGloss = "") => {
  const rawCandidates = [
    buildItalianParticiple(lexicalGloss, occurrence),
    occurrence.alignedGlossIt || "",
    occurrence.gloss || "",
    lexicalGloss || "",
  ]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !isWeakItalianWord(value));

  const expanded = [];
  rawCandidates.forEach((value) => {
    expanded.push(value);
    if (value.endsWith("ere")) expanded.push(value.slice(0, -3));
    if (value.endsWith("are")) expanded.push(value.slice(0, -3));
    if (value.endsWith("ire")) expanded.push(value.slice(0, -3));
  });

  return [...new Set(expanded)].sort((left, right) => right.length - left.length);
};

// Evidenziatore italiano:
// oggi e una funzione conservata nel progetto,
// ma l'interfaccia non evidenzia piu il testo CEI per evitare falsi allineamenti.
const highlightItalianVerse = (verseText, occurrence, lexicalGloss = "") => {
  const text = verseText || "";
  if (!text) return "";
  const candidates = buildItalianHighlightCandidates(occurrence, lexicalGloss);
  for (const candidate of candidates) {
    const escapedCandidate = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b(${escapedCandidate}\\p{L}*)\\b`, "iu");
    if (regex.test(text)) {
      return escapeHtml(text).replace(
        new RegExp(`\\b(${escapedCandidate}[\\p{L}]*)\\b`, "iu"),
        '<strong class="occurrence-focus">$1</strong>',
      );
    }
  }
  return escapeHtml(text);
};

// Ricava il significato principale del lemma.
// Ordine di priorita:
// 1. lessico fisso
// 2. parole-funzione fisse
// 3. gloss lessicale del lexicon
// 4. gloss dedotto dalle occorrenze
const summarizeLemmaGloss = (data, entry, occurrences) => {
  const fixedLexiconGloss = getFixedLexiconGloss(data, entry?.lemma || occurrences[0]?.lemma || "");
  if (fixedLexiconGloss) return fixedLexiconGloss;
  const fixedGloss = getFixedFunctionGloss(data, entry?.lemma || occurrences[0]?.lemma || "");
  if (fixedGloss) return fixedGloss;
  if (entry?.glossIt) return entry.glossIt;
  const dictionaryCandidates = countValues(
    occurrences.map((item) => dictionaryMeaningToItalian(item.alignedGlossDetail)),
  );
  if (dictionaryCandidates.length) {
    return dictionaryCandidates
      .slice(0, 2)
      .map(([value]) => value)
      .join(", ");
  }
  const alignedCandidates = countValues(occurrences.map((item) => item.alignedGlossIt));
  if (alignedCandidates.length) return alignedCandidates[0][0];
  return "";
};

// Statistiche riassuntive mostrate sopra l'elenco delle occorrenze.
const buildOccurrenceStats = (occurrences) => {
  const total = occurrences.length;
  const references = uniqueValues(occurrences.map((item) => item.reference));
  const books = uniqueValues(references.map((item) => item.split(" ")[0]));
  const forms = uniqueValues(occurrences.map((item) => item.surface));
  return { total, references: references.length, books: books.length, forms: forms.length };
};

// Cerca il paradigma ufficiale del lemma in base alla categoria grammaticale.
const getOfficialParadigmForWord = (data, lemma, partOfSpeech) => {
  if (partOfSpeech === "verbo") return data.verbParadigms?.[lemma] || null;
  if (partOfSpeech === "sostantivo") return data.nounParadigms?.[lemma] || null;
  if (partOfSpeech.startsWith("pronome")) return data.pronounParadigms?.[lemma] || null;
  return null;
};

// Costruisce il modello dati completo della parola da renderizzare nella pagina.
const buildWordData = (data, lemma) => {
  const entry = data.lexicon.find((item) => normalize(item.lemma) === normalize(lemma));
  const occurrences = collectOccurrences(data.gospels, lemma);
  const fallbackSurface = occurrences[0]?.surface || lemma;
  const greek = entry?.greek || fallbackSurface;
  const partOfSpeech = entry?.partOfSpeech || inferPartOfSpeech(lemma);
  const gloss =
    getFixedLexiconGloss(data, lemma) ||
    getFixedFunctionGloss(data, lemma) ||
    summarizeLemmaGloss(data, entry, occurrences);
  const stats = buildOccurrenceStats(occurrences);
  const officialCandidate = getOfficialParadigmForWord(data, lemma, partOfSpeech);
  const officialParadigm =
    officialCandidate && Object.keys(officialCandidate.paradigms || {}).length
      ? officialCandidate
      : null;
  const resolvedGloss = officialParadigm?.meaning_it || gloss;

  let morphology = null;
  if (officialParadigm) {
    const sections = Object.entries(officialParadigm.paradigms).map(([sectionTitle, sectionData]) => ({
      title: sectionTitle,
      ...normalizeParadigmSection(sectionData),
    }));
    morphology = {
      pattern: officialParadigm.class,
      note: "",
      sections,
      meaningIt: officialParadigm.meaning_it || resolvedGloss,
    };
  } else {
    if (partOfSpeech === "verbo") morphology = analyzeVerb(normalize(lemma));
    if (partOfSpeech === "sostantivo") morphology = analyzeNoun(normalize(lemma));
  }

  return {
    greek,
    lemma,
    partOfSpeech,
    gloss: resolvedGloss,
    pronunciation: pronounceGreek(greek),
    notesIt: cleanVocabularyItalianNote(entry?.notesIt || ""),
    occurrences,
    stats,
    morphology,
  };
};

// Render finale della pagina parola.
// Legge il lemma dall'URL, carica i dati e costruisce:
// - scheda lessicale
// - scheda morfologica
// - occorrenze nel NT
const renderWord = async () => {
  const params = new URLSearchParams(window.location.search);
  const lemma = normalize(params.get("lemma") || "");

  if (!lemma) {
    result.innerHTML = `<article class="notice">Nessun lemma indicato nell'URL.</article>`;
    return;
  }

  try {
    const data = await loadData();
    const word = buildWordData(data, lemma);
    const sections = word.morphology?.sections?.length
      ? word.morphology.sections
      : [{ title: word.morphology?.sectionTitle || "Paradigma della parola", forms: Object.entries(word.morphology?.forms || {}), meanings: {} }];

    const filledSections = sections.filter((section) => section.forms.length);
    const isVerb = word.partOfSpeech === "verbo";
    const verbSelectorId = `word-${word.lemma}`;
    const verbEntries = isVerb ? buildVerbSectionEntries(filledSections, verbSelectorId) : [];
    const showItalianNote = shouldShowItalianNote(
      { partOfSpeech: word.partOfSpeech },
      word.notesIt,
      word.gloss || "",
    );
    result.innerHTML = `
      <section class="word-layout">
        <article class="panel word-hero">
          <h2>${escapeHtml(word.greek)}</h2>
          <p class="word-pronunciation">${escapeHtml(word.pronunciation)}</p>
          <p><strong>Lemma:</strong> ${escapeHtml(word.lemma)}</p>
          <p><strong>Categoria:</strong> ${escapeHtml(word.partOfSpeech)}</p>
          <p><strong>Significato:</strong> ${escapeHtml(word.gloss || "Da definire nel lessico italiano privato")}</p>
          ${
            showItalianNote
              ? `<p><strong>Nota italiana:</strong> ${escapeHtml(word.notesIt)}</p>`
              : ""
          }
        </article>

        <article class="panel">
          <h3>Analisi morfologica</h3>
          ${
            word.morphology && filledSections.length
              ? `<p>${escapeHtml([word.morphology.pattern, word.morphology.note].filter(Boolean).join(". "))}</p>`
              : ""
          }
          ${
            filledSections.length
              ? verbEntries.length > 1
                ? renderVerbSectionControls(verbEntries, verbSelectorId)
                : filledSections
                    .map((section) =>
                      renderParadigmCard(section.title, section.forms, word.morphology.meaningIt || word.gloss, {
                        mode: word.partOfSpeech.startsWith("pronome")
                          ? "pronoun"
                          : word.partOfSpeech === "sostantivo"
                            ? "case"
                            : "default",
                        meanings: section.meanings,
                      }),
                    )
                    .join("")
              : `<div class="notice">Non ci sono ancora forme disponibili da mostrare per questa parola.</div>`
          }
        </article>

        <article class="panel">
          <h3>Occorrenze nel Nuovo Testamento</h3>
          ${
            word.occurrences.length
              ? `
                <div class="stats-grid">
                  <div class="micro-panel stat-card">
                    <span class="meta">Occorrenze totali</span>
                    <strong>${escapeHtml(String(word.stats.total))}</strong>
                  </div>
                  <div class="micro-panel stat-card">
                    <span class="meta">Versetti distinti</span>
                    <strong>${escapeHtml(String(word.stats.references))}</strong>
                  </div>
                  <div class="micro-panel stat-card">
                    <span class="meta">Libri coinvolti</span>
                    <strong>${escapeHtml(String(word.stats.books))}</strong>
                  </div>
                  <div class="micro-panel stat-card">
                    <span class="meta">Forme attestate</span>
                    <strong>${escapeHtml(String(word.stats.forms))}</strong>
                  </div>
                </div>
                <details class="occurrence-details">
                  <summary>Apri i versetti e le occorrenze</summary>
                  <div class="stack occurrence-stack">
                    ${word.occurrences
                      .map(
                        (occurrence) => `
                          <div class="micro-panel">
                            <strong><a class="verse-word-link" href="${buildMorphologyHref(
                              occurrence.lemma,
                              occurrence.partOfSpeech,
                            )}" target="_blank" rel="noopener noreferrer">${escapeHtml(occurrence.surface)}</a></strong>
                            <span class="word-pronunciation">${escapeHtml(occurrence.pronunciation)}</span>
                            <span class="meta"><a class="verse-word-link" href="${buildInterlinearHref(
                              occurrence,
                            )}" target="_blank" rel="noopener noreferrer">${escapeHtml(occurrence.reference)}</a></span>
                            ${
                              occurrence.morphologyLabel
                                ? `<span class="meta">${escapeHtml(occurrence.morphologyLabel)}</span>`
                                : ""
                            }
                            <p class="occurrence-greek">${renderGreekVerseWithLinks(data, occurrence)}</p>
                            ${
                              getCeiVerseText(data, occurrence)
                                ? `<p class="occurrence-italian">${escapeHtml(getCeiVerseText(data, occurrence))}</p>`
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
    if (verbEntries.length > 1) {
      wireVerbSectionControls(result, verbSelectorId, verbEntries, word.morphology.meaningIt || word.gloss, {
        mode: "default",
      });
    }
  } catch (error) {
    result.innerHTML = `<article class="notice">Errore nel caricamento dei dati della parola.</article>`;
    console.error(error);
  }
};

renderWord();
