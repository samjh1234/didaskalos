// Tutte le risorse JSON passano da qui.
// Questo file ha due responsabilita:
// 1. caricare i dataset runtime del progetto
// 2. applicare la versione ?v=... ai file statici per evitare cache vecchie
const assetVersion = window.__APP_VERSION__ || "dev";

const versionedPath = (path) =>
  `${path}${path.includes("?") ? "&" : "?"}v=${encodeURIComponent(assetVersion)}`;

// Loader base con errore esplicito se il file non viene trovato.
const loadJson = async (path) => {
  const response = await fetch(versionedPath(path));
  if (!response.ok) {
    throw new Error(`Impossibile caricare ${path}`);
  }
  return response.json();
};

// Loader tollerante: utile per dataset opzionali che il sito puo usare
// quando presenti, ma senza bloccarsi se mancano.
const loadOptionalJson = async (path) => {
  try {
    return await loadJson(path);
  } catch {
    return null;
  }
};

// Il testo del NT e stato spezzato libro per libro.
// Questo evita file enormi e rende il deploy piu leggero.
const loadNtBooks = async (books) => {
  const entries = await Promise.all(
    books.map(async (book) => [book.slug, await loadJson(`assets/data/nt/${book.slug}.json`)]),
  );
  return Object.fromEntries(entries);
};

// Carica tutti i dataset usati dal frontend.
// Il risultato finale e un unico oggetto passato alle pagine di rendering.
export const loadData = async () => {
  const [books, grammar, lexicon, fixedLexicon, tokenGlossesFixed, ceiVerses, verbParadigms, verbLemmas, verbNonFinite, verbMetadata, nounParadigms, pronounParadigms, functionGlosses, functionFormGlosses] = await Promise.all([
    loadJson("assets/data/books.json"),
    loadJson("assets/data/grammar.json"),
    loadJson("assets/data/lexicon.json"),
    loadJson("assets/data/fixed_lexicon.json"),
    loadJson("assets/data/token_glosses_fixed.json"),
    // Il testo CEI usato a runtime deve stare dentro assets/data,
    // altrimenti un server statico puo rispondere 404 su cartelle private/non pubblicate.
    loadOptionalJson("assets/data/cei2008_verses.json"),
    loadJson("assets/data/verb_paradigms.json"),
    loadOptionalJson("assets/data/verb_lemmas.json"),
    loadOptionalJson("assets/data/verb_non_finite.json"),
    loadOptionalJson("assets/data/verb_metadata.json"),
    loadJson("assets/data/noun_paradigms.json"),
    loadJson("assets/data/pronoun_paradigms.json"),
    loadJson("assets/data/function_glosses.json"),
    loadJson("assets/data/function_form_glosses.json"),
  ]);
  const gospels = await loadNtBooks(books);

  return {
    books,
    grammar,
    lexicon,
    fixedLexicon,
    tokenGlossesFixed,
    gospels,
    ceiVerses,
    verbParadigms,
    verbLemmas,
    verbNonFinite,
    verbMetadata,
    nounParadigms,
    pronounParadigms,
    functionGlosses,
    functionFormGlosses,
  };
};
