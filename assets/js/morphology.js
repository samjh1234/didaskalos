// Questo file contiene solo il motore morfologico minimo di fallback.
// Non e il cuore definitivo della morfologia del progetto:
// quando esiste un paradigma ufficiale nei dataset locali, il sito usa quello.
// Queste funzioni servono solo quando la scheda completa non e ancora disponibile.

const verbEndings = {
  "1a singolare": "ω",
  "2a singolare": "εις",
  "3a singolare": "ει",
  "1a plurale": "ομεν",
  "2a plurale": "ετε",
  "3a plurale": "ουσι(ν)",
};

// Riconoscimento molto semplice del tipo nominale in base alla desinenza finale.
const nounPattern = (lemma) => {
  if (lemma.endsWith("ος")) return "second-declension-masculine";
  if (lemma.endsWith("ον")) return "second-declension-neuter";
  if (lemma.endsWith("η")) return "first-declension-feminine-eta";
  if (lemma.endsWith("α")) return "first-declension-feminine-alpha";
  return "unknown";
};

// Fallback per verbi:
// genera solo un presente indicativo attivo regolare in -ω.
// I verbi irregolari o complessi devono invece arrivare dai dataset locali.
export const analyzeVerb = (lemma) => {
  if (!lemma) return null;
  if (lemma.endsWith("ω")) {
    const stem = lemma.slice(0, -1);
    const forms = Object.fromEntries(
      Object.entries(verbEndings).map(([label, ending]) => [label, `${stem}${ending}`]),
    );
    return {
      supported: true,
      pattern: "Verbo regolare in -ω",
      note: "Paradigma base: presente indicativo attivo.",
      forms,
    };
  }

  if (lemma.endsWith("μι")) {
    return {
      supported: false,
      pattern: "Verbo in -μι",
      note: "Per questo verbo la scheda morfologica completa è ancora in preparazione.",
      forms: {},
    };
  }

  return {
    supported: false,
    pattern: "Schema non ancora disponibile",
    note: "Per questo lemma non è ancora disponibile una scheda morfologica completa.",
    forms: {},
  };
};

// Fallback per sostantivi:
// gestisce solo prima e seconda declinazione regolare.
// Se la parola non rientra in questi schemi, la scheda finale deve arrivare dai dataset.
export const analyzeNoun = (lemma) => {
  if (!lemma) return null;

  const pattern = nounPattern(lemma);
  let forms = {};
  let label = "Schema non riconosciuto";
  let supported = true;
  let note = "Output generato per il paradigma regolare di base.";

  if (pattern === "second-declension-masculine") {
    const stem = lemma.slice(0, -2);
    label = "Seconda declinazione maschile";
    forms = {
      "Nominativo singolare": lemma,
      "Genitivo singolare": `${stem}ου`,
      "Dativo singolare": `${stem}ῳ`,
      "Accusativo singolare": `${stem}ον`,
      "Nominativo plurale": `${stem}οι`,
      "Genitivo plurale": `${stem}ων`,
      "Dativo plurale": `${stem}οις`,
      "Accusativo plurale": `${stem}ους`,
    };
  } else if (pattern === "second-declension-neuter") {
    const stem = lemma.slice(0, -2);
    label = "Seconda declinazione neutra";
    forms = {
      "Nominativo singolare": lemma,
      "Genitivo singolare": `${stem}ου`,
      "Dativo singolare": `${stem}ῳ`,
      "Accusativo singolare": lemma,
      "Nominativo plurale": `${stem}α`,
      "Genitivo plurale": `${stem}ων`,
      "Dativo plurale": `${stem}οις`,
      "Accusativo plurale": `${stem}α`,
    };
  } else if (pattern === "first-declension-feminine-eta") {
    const stem = lemma.slice(0, -1);
    label = "Prima declinazione femminile in -η";
    forms = {
      "Nominativo singolare": lemma,
      "Genitivo singolare": `${stem}ης`,
      "Dativo singolare": `${stem}ῃ`,
      "Accusativo singolare": `${stem}ην`,
      "Nominativo plurale": `${stem}αι`,
      "Genitivo plurale": `${stem}ων`,
      "Dativo plurale": `${stem}αις`,
      "Accusativo plurale": `${stem}ας`,
    };
  } else if (pattern === "first-declension-feminine-alpha") {
    const stem = lemma.slice(0, -1);
    label = "Prima declinazione femminile in -α";
    forms = {
      "Nominativo singolare": lemma,
      "Genitivo singolare": `${stem}ας`,
      "Dativo singolare": `${stem}ᾳ`,
      "Accusativo singolare": `${stem}αν`,
      "Nominativo plurale": `${stem}αι`,
      "Genitivo plurale": `${stem}ων`,
      "Dativo plurale": `${stem}αις`,
      "Accusativo plurale": `${stem}ας`,
    };
  } else {
    supported = false;
    note = "Il declinatore MVP gestisce prima e seconda declinazione regolare.";
  }

  return { supported, pattern: label, note, forms };
};
