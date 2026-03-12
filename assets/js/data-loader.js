const loadJson = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Impossibile caricare ${path}`);
  }
  return response.json();
};

const loadOptionalJson = async (path) => {
  try {
    return await loadJson(path);
  } catch {
    return null;
  }
};

const loadNtBooks = async (books) => {
  const entries = await Promise.all(
    books.map(async (book) => [book.slug, await loadJson(`assets/data/nt/${book.slug}.json`)]),
  );
  return Object.fromEntries(entries);
};

export const loadData = async () => {
  const [books, grammar, lexicon, fixedLexicon, tokenGlossesFixed, ceiVerses, verbParadigms, verbLemmas, verbNonFinite, verbMetadata, nounParadigms, pronounParadigms, functionGlosses, functionFormGlosses] = await Promise.all([
    loadJson("assets/data/books.json"),
    loadJson("assets/data/grammar.json"),
    loadJson("assets/data/lexicon.json"),
    loadJson("assets/data/fixed_lexicon.json"),
    loadJson("assets/data/token_glosses_fixed.json"),
    loadOptionalJson("private_data/cei2008/nt_verses.json"),
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
