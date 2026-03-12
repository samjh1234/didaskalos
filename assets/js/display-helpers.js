export const normalize = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const escapeHtml = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const cleanVocabularyItalianNote = (value = "") => {
  if (!value) return "";
  if (/[ØøŁł]/u.test(value) || value.includes("=")) return "";
  let cleaned = value.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\([^)]*\)/g, "").trim();
  cleaned = cleaned.replace(/\s+\+\s+.+$/u, "").trim();
  cleaned = cleaned.replace(/\s+[A-Za-zÀ-ÿ][^|]{0,40}:\s*\d+(\s*\|\s*.*)?$/u, "").trim();
  cleaned = cleaned.replace(/\s*["“”].*$/u, "").trim();
  const numbered = cleaned.match(/1\)\s*.+/);
  if (!numbered) return cleaned.length > 160 ? `${cleaned.slice(0, 157).trim()}...` : cleaned;
  cleaned = numbered[0];
  const senses = [...cleaned.matchAll(/(\d\))\s*([^0-9]+?)(?=\s+\d\)\s*|$)/g)]
    .map((match) => {
      const body = match[2]
        .replace(/\s+\+\s+.+$/u, "")
        .replace(/\s*["“”].*$/u, "")
        .replace(/\s+[A-Za-zÀ-ÿ][^|]{0,40}:\s*\d+(\s*\|\s*.*)?$/u, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      return body ? `${match[1]} ${body}` : "";
    })
    .filter(Boolean)
    .slice(0, 3);
  const concise = senses.join(" ").trim();
  return concise.length > 220 ? `${concise.slice(0, 217).trim()}...` : concise;
};

export const shouldShowItalianNote = (entry, cleanedNote, gloss = "") => {
  if (!cleanedNote) return false;
  const normalizedGloss = normalize(gloss);
  const looksLikeProperName = !!gloss && gloss[0] === gloss[0]?.toUpperCase();
  if (looksLikeProperName && /\b2\)/.test(cleanedNote)) return false;
  if (entry?.partOfSpeech === "sostantivo" && looksLikeProperName && normalizedGloss !== "θεος") return false;
  return true;
};

const transliterationMap = {
  α: "a",
  β: "b",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "e",
  θ: "th",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  ς: "s",
  τ: "t",
  υ: "u",
  φ: "ph",
  χ: "kh",
  ψ: "ps",
  ω: "o",
};

export const pronounceGreek = (value = "") => {
  const normalized = normalize(value);
  let output = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const pair = normalized.slice(index, index + 2);
    if (pair === "αι") {
      output += "ai";
      index += 1;
      continue;
    }
    if (pair === "ει") {
      output += "ei";
      index += 1;
      continue;
    }
    if (pair === "οι") {
      output += "oi";
      index += 1;
      continue;
    }
    if (pair === "ου") {
      output += "ou";
      index += 1;
      continue;
    }
    if (pair === "αυ") {
      output += "au";
      index += 1;
      continue;
    }
    if (pair === "ευ") {
      output += "eu";
      index += 1;
      continue;
    }
    if (pair === "γγ") {
      output += "ng";
      index += 1;
      continue;
    }
    if (pair === "γκ") {
      output += "nk";
      index += 1;
      continue;
    }

    output += transliterationMap[normalized[index]] || normalized[index];
  }

  return output || value;
};

export const conjugateItalianGloss = (gloss, label) => {
  const value = (gloss || "").split(",")[0].trim().toLowerCase();
  if (!value) return "";

  const irregulars = {
    benedire: {
      "1a singolare": "benedico",
      "2a singolare": "benedici",
      "3a singolare": "benedice",
      "1a plurale": "benediciamo",
      "2a plurale": "benedite",
      "3a plurale": "benedicono",
    },
    essere: {
      "1a singolare": "sono",
      "2a singolare": "sei",
      "3a singolare": "e",
      "1a plurale": "siamo",
      "2a plurale": "siete",
      "3a plurale": "sono",
    },
    avere: {
      "1a singolare": "ho",
      "2a singolare": "hai",
      "3a singolare": "ha",
      "1a plurale": "abbiamo",
      "2a plurale": "avete",
      "3a plurale": "hanno",
    },
    dire: {
      "1a singolare": "dico",
      "2a singolare": "dici",
      "3a singolare": "dice",
      "1a plurale": "diciamo",
      "2a plurale": "dite",
      "3a plurale": "dicono",
    },
    fare: {
      "1a singolare": "faccio",
      "2a singolare": "fai",
      "3a singolare": "fa",
      "1a plurale": "facciamo",
      "2a plurale": "fate",
      "3a plurale": "fanno",
    },
    venire: {
      "1a singolare": "vengo",
      "2a singolare": "vieni",
      "3a singolare": "viene",
      "1a plurale": "veniamo",
      "2a plurale": "venite",
      "3a plurale": "vengono",
    },
    compiere: {
      "1a singolare": "compio",
      "2a singolare": "compi",
      "3a singolare": "compie",
      "1a plurale": "compiamo",
      "2a plurale": "compite",
      "3a plurale": "compiono",
    },
  };

  if (irregulars[value]?.[label]) return irregulars[value][label];

  const endings = {
    "1a singolare": ["o", "o", "o"],
    "2a singolare": ["i", "i", "i"],
    "3a singolare": ["a", "e", "e"],
    "1a plurale": ["iamo", "iamo", "iamo"],
    "2a plurale": ["ate", "ete", "ite"],
    "3a plurale": ["ano", "ono", "ono"],
  };

  const personEndings = endings[label];
  if (!personEndings) return value;

  if (value.endsWith("iere")) {
    const stem = value.slice(0, -4);
    const iereEndings = {
      "1a singolare": "o",
      "2a singolare": "",
      "3a singolare": "e",
      "1a plurale": "amo",
      "2a plurale": "te",
      "3a plurale": "ono",
    };
    return `${stem}${iereEndings[label] ?? ""}`;
  }

  if (value.endsWith("are")) return `${value.slice(0, -3)}${personEndings[0]}`;
  if (value.endsWith("ere")) return `${value.slice(0, -3)}${personEndings[1]}`;
  if (value.endsWith("ire")) return `${value.slice(0, -3)}${personEndings[2]}`;
  return value;
};

export const buildParadigmMeaning = (gloss, label) => {
  if (!gloss) return label;
  return conjugateItalianGloss(gloss, label) || gloss;
};

export const buildNominalMeaning = (gloss, label) => {
  if (!gloss) return "";
  const normalized = normalize(label);
  if (normalized.includes("genitivo")) return `di ${gloss}`;
  if (normalized.includes("dativo")) return `a ${gloss}`;
  return gloss;
};

export const normalizeParadigmSection = (section) => {
  if (!section) return { forms: [], meanings: {} };
  if (section.forms) {
    return {
      forms: Object.entries(section.forms),
      meanings: section.meanings_it || {},
    };
  }
  return {
    forms: Object.entries(section),
    meanings: {},
  };
};

export const parseVerbSectionMeta = (title = "") => {
  const lowered = normalize(title);
  const mood =
    ["indicativo", "congiuntivo", "ottativo", "imperativo", "infinito", "participio"].find((value) =>
      lowered.includes(value),
    ) || "";
  const tense =
    ["presente", "imperfetto", "futuro", "aoristo", "perfetto", "piuccheperfetto"].find((value) =>
      lowered.includes(value),
    ) || "";
  const voice =
    ["medio/passivo", "passivo", "medio", "attivo"].find((value) => lowered.includes(normalize(value))) || "";
  return { mood, tense, voice };
};

export const buildVerbSectionEntries = (sections, idPrefix = "verb-section") =>
  sections
    .filter((section) => section.forms.length)
    .map((section, index) => ({
      ...section,
      id: `${idPrefix}-${index}`,
      meta: parseVerbSectionMeta(section.title),
    }));

const uniqueByKey = (items, key) => [...new Set(items.map((item) => item.meta[key]).filter(Boolean))];

const labelVerbMeta = (value) =>
  ({
    indicativo: "Indicativo",
    congiuntivo: "Congiuntivo",
    ottativo: "Ottativo",
    imperativo: "Imperativo",
    infinito: "Infinito",
    participio: "Participio",
    presente: "Presente",
    imperfetto: "Imperfetto",
    futuro: "Futuro",
    aoristo: "Aoristo",
    perfetto: "Perfetto",
    piuccheperfetto: "Piuccheperfetto",
    attivo: "Attivo",
    medio: "Medio",
    passivo: "Passivo",
    "medio/passivo": "Medio/Passivo",
  })[value] || value;

export const renderVerbSectionControls = (entries, idPrefix) => {
  const moods = uniqueByKey(entries, "mood");
  if (entries.length <= 1 || !moods.length) return "";
  return `
    <div class="paradigm-filters" data-verb-filters="${escapeHtml(idPrefix)}">
      <label>
        Modo
        <select data-filter-kind="mood"></select>
      </label>
      <label>
        Tempo
        <select data-filter-kind="tense"></select>
      </label>
      <label>
        Voce
        <select data-filter-kind="voice"></select>
      </label>
    </div>
    <div data-verb-sections="${escapeHtml(idPrefix)}"></div>
  `;
};

const getPronounCellMeaning = (caseName, gender, number) => {
  const key = `${normalize(caseName)}|${normalize(number)}|${normalize(gender)}`;
  const map = {
    "nominativo|singolare|maschile": "egli, lui",
    "nominativo|singolare|femminile": "ella, lei",
    "nominativo|singolare|neutro": "esso",
    "nominativo|plurale|maschile": "essi, loro",
    "nominativo|plurale|femminile": "esse, loro",
    "nominativo|plurale|neutro": "essi",
    "genitivo|singolare|maschile": "di lui, suo",
    "genitivo|singolare|femminile": "di lei, sua",
    "genitivo|singolare|neutro": "di esso",
    "genitivo|plurale|maschile": "di loro",
    "genitivo|plurale|femminile": "di loro",
    "genitivo|plurale|neutro": "di essi",
    "dativo|singolare|maschile": "a lui",
    "dativo|singolare|femminile": "a lei",
    "dativo|singolare|neutro": "ad esso",
    "dativo|plurale|maschile": "a loro",
    "dativo|plurale|femminile": "a loro",
    "dativo|plurale|neutro": "ad essi",
    "accusativo|singolare|maschile": "lui",
    "accusativo|singolare|femminile": "lei",
    "accusativo|singolare|neutro": "esso",
    "accusativo|plurale|maschile": "loro",
    "accusativo|plurale|femminile": "loro",
    "accusativo|plurale|neutro": "essi",
  };
  return map[key] || "";
};

const buildPronounGrid = (forms) => {
  const numbers = ["singolare", "plurale"];
  const cases = ["Nominativo", "Genitivo", "Dativo", "Accusativo"];
  const genders = ["maschile", "femminile", "neutro"];

  return numbers
    .map((number) => {
      const rows = cases
        .map((caseName) => {
          const cells = genders
            .map((gender) => {
              const key = `${caseName} ${number} ${gender}`;
              const formValue = forms[key];
              return formValue
                ? `<td>
                    <strong class="paradigm-greek">${escapeHtml(formValue)}</strong>
                    <span class="paradigm-pronunciation">${escapeHtml(pronounceGreek(formValue))}</span>
                    <span class="paradigm-meaning">${escapeHtml(
                      getPronounCellMeaning(caseName, gender, number),
                    )}</span>
                  </td>`
                : "<td></td>";
            })
            .join("");
          return `
            <tr>
              <th scope="row">${escapeHtml(caseName)}</th>
              ${cells}
            </tr>
          `;
        })
        .join("");

      return `
        <section class="pronoun-table-card">
          <h5>${escapeHtml(number[0].toUpperCase() + number.slice(1))}</h5>
          <table class="pronoun-table">
            <thead>
              <tr>
                <th>Caso</th>
                <th>Maschile</th>
                <th>Femminile</th>
                <th>Neutro</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </section>
      `;
    })
    .join("");
};

export const renderParadigmCard = (title, forms, gloss, options = {}) => {
  if (options.mode === "pronoun") {
    return `
      <section class="paradigm-card">
        <div class="paradigm-header">
          <h4>${escapeHtml(title)}</h4>
          <p class="paradigm-subtitle">${escapeHtml(gloss || "")}</p>
        </div>
        ${buildPronounGrid(Object.fromEntries(forms))}
      </section>
    `;
  }

  return `
    <section class="paradigm-card">
      <div class="paradigm-header">
        <h4>${escapeHtml(title)}</h4>
      </div>
      <div class="paradigm-list">
        ${forms
          .map(
            ([label, formValue]) => `
              <div class="paradigm-row">
                <span class="paradigm-label">${escapeHtml(label)}</span>
                <strong class="paradigm-greek">${escapeHtml(formValue)}</strong>
                <span class="paradigm-pronunciation">${escapeHtml(pronounceGreek(formValue))}</span>
                <span class="paradigm-meaning">${escapeHtml(
                  options.meanings?.[label] ||
                    (options.mode === "case" ? buildNominalMeaning(gloss, label) : buildParadigmMeaning(gloss, label)),
                )}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
};

export const wireVerbSectionControls = (root, idPrefix, entries, gloss, options = {}) => {
  const filterRoot = root.querySelector(`[data-verb-filters="${idPrefix}"]`);
  const sectionsRoot = root.querySelector(`[data-verb-sections="${idPrefix}"]`);
  if (!filterRoot || !sectionsRoot) {
    return;
  }

  const selects = {
    mood: filterRoot.querySelector('[data-filter-kind="mood"]'),
    tense: filterRoot.querySelector('[data-filter-kind="tense"]'),
    voice: filterRoot.querySelector('[data-filter-kind="voice"]'),
  };

  const current = {
    mood: entries[0]?.meta.mood || "all",
    tense: entries[0]?.meta.tense || "all",
    voice: entries[0]?.meta.voice || "all",
  };

  const fillSelect = (select, values, selected) => {
    if (!select) return;
    const allValues = ["all", ...values];
    select.innerHTML = allValues
      .map((value) =>
        `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(
          value === "all" ? "Tutto" : labelVerbMeta(value),
        )}</option>`,
      )
      .join("");
    select.closest("label").hidden = false;
  };

  const update = () => {
    const moodValues = uniqueByKey(entries, "mood");
    if (current.mood !== "all" && !moodValues.includes(current.mood)) current.mood = moodValues[0] || "all";

    const tensePool =
      current.mood === "all" ? entries : entries.filter((entry) => entry.meta.mood === current.mood);
    const tenseValues = uniqueByKey(tensePool, "tense");
    if (current.tense !== "all" && !tenseValues.includes(current.tense)) current.tense = tenseValues[0] || "all";

    const voicePool =
      current.tense === "all" ? tensePool : tensePool.filter((entry) => entry.meta.tense === current.tense);
    const voiceValues = uniqueByKey(voicePool, "voice");
    if (current.voice !== "all" && !voiceValues.includes(current.voice)) current.voice = voiceValues[0] || "all";

    fillSelect(selects.mood, moodValues, current.mood);
    fillSelect(selects.tense, tenseValues, current.tense);
    fillSelect(selects.voice, voiceValues, current.voice);

    const visible = entries.filter(
      (entry) =>
        (current.mood === "all" || entry.meta.mood === current.mood) &&
        (current.tense === "all" || entry.meta.tense === current.tense) &&
        (current.voice === "all" || entry.meta.voice === current.voice),
    );

    sectionsRoot.innerHTML = visible
      .map((section) =>
        renderParadigmCard(section.title, section.forms, gloss, {
          ...options,
          meanings: section.meanings,
        }),
      )
      .join("");
  };

  Object.entries(selects).forEach(([key, select]) => {
    if (!select) return;
    select.addEventListener("change", () => {
      current[key] = select.value;
      update();
    });
  });

  update();
};
