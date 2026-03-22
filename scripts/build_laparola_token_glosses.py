import html
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
NT_DIR = ROOT / "assets" / "data" / "nt"
SOURCE_PATH = ROOT / "source" / "laparola_interlinear" / "interlineare.sql"
MANUAL_PATH = ROOT / "source" / "build_support" / "token_glosses_manual_it.json"
FUNCTION_GLOSSES_PATH = ROOT / "assets" / "data" / "function_glosses.json"
FUNCTION_FORM_GLOSSES_PATH = ROOT / "assets" / "data" / "function_form_glosses.json"
FIXED_LEXICON_PATH = ROOT / "assets" / "data" / "fixed_lexicon.json"
OUTPUT_PATH = ROOT / "assets" / "data" / "token_glosses_fixed.json"


TAG_RE = re.compile(r"<[^>]+>")
BRACE_RE = re.compile(r"\{([^}]+)\}")
SPACE_RE = re.compile(r"\s+")
DIGIT_RE = re.compile(r"\d+")

NAME_NORMALIZATION = {
    "Abraamo": "Abramo",
    "Isaac": "Isacco",
    "Jacob": "Giacobbe",
    "Judah": "Giuda",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_italian(text: str) -> str:
    text = text or ""
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    return SPACE_RE.sub(" ", text).strip()


def sort_token_key(item):
    key = item[0]
    bcv, _, token_index = key.partition(":")
    try:
        return int(bcv), int(token_index)
    except ValueError:
        return key, 0


def load_nt_books():
    gospels = {}
    for path in sorted(NT_DIR.glob("*.json")):
        gospels[path.stem] = load_json(path)
    if not gospels:
        raise FileNotFoundError(f"Nessun file del NT trovato in {NT_DIR}")
    return gospels


def normalize_greek(text: str) -> str:
    text = text or ""
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[·.,;:!?\"'“”‘’«»()\\[\\]{}⸂⸃⸀⸁⟦⟧<>]", "", text)
    return text.strip()


def clean_gloss(value: str) -> str:
    value = html.unescape(value or "")
    value = TAG_RE.sub("", value)
    value = BRACE_RE.sub(r"\1", value)
    value = value.replace("&nbsp;", " ")
    value = DIGIT_RE.sub("", value)
    value = SPACE_RE.sub(" ", value).strip()
    for source, target in NAME_NORMALIZATION.items():
        value = value.replace(source, target)
    if value in {"", "-", ">", "*"} or re.fullmatch(r"[<>*]+", value):
        return ""
    return value


def token_traits(token):
    morphology = normalize_greek(token.get("morphologyLabel", ""))
    case_name = next((v for v in ["nominativo", "genitivo", "dativo", "accusativo"] if v in morphology), "")
    number = next((v for v in ["singolare", "plurale"] if v in morphology), "")
    gender = next((v for v in ["maschile", "femminile", "neutro"] if v in morphology), "")
    return case_name, number, gender


def get_verb_person_label(token):
    person = normalize_greek(token.get("morphology", {}).get("person", ""))
    number = normalize_greek(token.get("morphology", {}).get("number", ""))
    person_map = {
        "prima": "1a",
        "seconda": "2a",
        "terza": "3a",
        "1a": "1a",
        "2a": "2a",
        "3a": "3a",
    }
    mapped_person = person_map.get(person, "")
    if not mapped_person or not number:
        return ""
    return f"{mapped_person} {number}"


def conjugate_italian_gloss(gloss: str, label: str):
    value = (gloss or "").split(",")[0].strip().lower()
    if not value:
        return ""

    irregulars = {
        "benedire": {
            "1a singolare": "benedico",
            "2a singolare": "benedici",
            "3a singolare": "benedice",
            "1a plurale": "benediciamo",
            "2a plurale": "benedite",
            "3a plurale": "benedicono",
        },
        "essere": {
            "1a singolare": "sono",
            "2a singolare": "sei",
            "3a singolare": "e",
            "1a plurale": "siamo",
            "2a plurale": "siete",
            "3a plurale": "sono",
        },
        "avere": {
            "1a singolare": "ho",
            "2a singolare": "hai",
            "3a singolare": "ha",
            "1a plurale": "abbiamo",
            "2a plurale": "avete",
            "3a plurale": "hanno",
        },
        "dire": {
            "1a singolare": "dico",
            "2a singolare": "dici",
            "3a singolare": "dice",
            "1a plurale": "diciamo",
            "2a plurale": "dite",
            "3a plurale": "dicono",
        },
        "fare": {
            "1a singolare": "faccio",
            "2a singolare": "fai",
            "3a singolare": "fa",
            "1a plurale": "facciamo",
            "2a plurale": "fate",
            "3a plurale": "fanno",
        },
        "venire": {
            "1a singolare": "vengo",
            "2a singolare": "vieni",
            "3a singolare": "viene",
            "1a plurale": "veniamo",
            "2a plurale": "venite",
            "3a plurale": "vengono",
        },
        "compiere": {
            "1a singolare": "compio",
            "2a singolare": "compi",
            "3a singolare": "compie",
            "1a plurale": "compiamo",
            "2a plurale": "compite",
            "3a plurale": "compiono",
        },
    }

    if value in irregulars and label in irregulars[value]:
        return irregulars[value][label]

    endings = {
        "1a singolare": ("o", "o", "o"),
        "2a singolare": ("i", "i", "i"),
        "3a singolare": ("a", "e", "e"),
        "1a plurale": ("iamo", "iamo", "iamo"),
        "2a plurale": ("ate", "ete", "ite"),
        "3a plurale": ("ano", "ono", "ono"),
    }
    person_endings = endings.get(label)
    if not person_endings:
        return value

    if value.endswith("iere"):
        stem = value[:-4]
        iere_endings = {
            "1a singolare": "o",
            "2a singolare": "",
            "3a singolare": "e",
            "1a plurale": "amo",
            "2a plurale": "te",
            "3a plurale": "ono",
        }
        return f"{stem}{iere_endings.get(label, '')}"

    if value.endswith("are"):
        return f"{value[:-3]}{person_endings[0]}"
    if value.endswith("ere"):
        return f"{value[:-3]}{person_endings[1]}"
    if value.endswith("ire"):
        return f"{value[:-3]}{person_endings[2]}"
    return value


def conjugate_italian_imperative(gloss: str, token):
    value = (gloss or "").split(",")[0].strip().lower()
    if not value:
        return ""
    label = get_verb_person_label(token)
    if not label:
        return value

    irregulars = {
        "andare": {
            "2a singolare": "va'",
            "1a plurale": "andiamo",
            "2a plurale": "andate",
        },
        "avere": {
            "2a singolare": "abbi",
            "1a plurale": "abbiamo",
            "2a plurale": "abbiate",
        },
        "dare": {
            "2a singolare": "da'",
            "1a plurale": "diamo",
            "2a plurale": "date",
        },
        "dire": {
            "2a singolare": "di'",
            "1a plurale": "diciamo",
            "2a plurale": "dite",
        },
        "essere": {
            "2a singolare": "sii",
            "1a plurale": "siamo",
            "2a plurale": "siate",
        },
        "fare": {
            "2a singolare": "fa'",
            "1a plurale": "facciamo",
            "2a plurale": "fate",
        },
        "stare": {
            "2a singolare": "sta'",
            "1a plurale": "stiamo",
            "2a plurale": "state",
        },
        "venire": {
            "2a singolare": "vieni",
            "1a plurale": "veniamo",
            "2a plurale": "venite",
        },
    }

    if value in irregulars and label in irregulars[value]:
        return irregulars[value][label]

    if label in {"1a plurale", "2a plurale"}:
        return conjugate_italian_gloss(value, label)
    if label != "2a singolare":
        return value

    if value.endswith("care"):
        return f"{value[:-4]}ca"
    if value.endswith("gare"):
        return f"{value[:-4]}ga"
    if value.endswith("are"):
        return f"{value[:-3]}a"
    if value.endswith("ere"):
        return f"{value[:-3]}i"
    if value.endswith("ire"):
        return f"{value[:-3]}i"
    return value


def build_italian_participle(gloss: str):
    value = (gloss or "").split(",")[0].strip().lower()
    if not value:
        return ""
    irregulars = {
        "benedire": "benedetto",
        "compiere": "compiuto",
        "dare": "dato",
        "dire": "detto",
        "essere": "stato",
        "fare": "fatto",
        "generare": "generato",
        "avere": "avuto",
        "venire": "venuto",
    }
    if value in irregulars:
        return irregulars[value]
    if value.endswith("are"):
        return f"{value[:-3]}ato"
    if value.endswith("ere"):
        return f"{value[:-3]}uto"
    if value.endswith("ire"):
        return f"{value[:-3]}ito"
    return value


def adapt_verb_gloss(token, gloss: str):
    base = (gloss or "").strip()
    if not base:
        return ""

    mood = normalize_greek(token.get("morphology", {}).get("mood", ""))
    tense = normalize_greek(token.get("morphology", {}).get("tense", ""))
    voice = normalize_greek(token.get("morphology", {}).get("voice", ""))
    label = get_verb_person_label(token)

    if mood == "participio":
        return build_italian_participle(base) or base
    if mood == "imperativo":
        return conjugate_italian_imperative(base, token) or base
    if mood == "indicativo" and tense == "presente" and voice == "attiva" and label:
        return conjugate_italian_gloss(base, label) or base
    return base


def get_function_gloss(token, function_glosses, function_form_glosses):
    lemma = normalize_greek(token.get("lemma", ""))
    case_name, number, gender = token_traits(token)
    keys = [
        "|".join([x for x in [lemma, case_name, number, gender] if x]),
        "|".join([x for x in [lemma, case_name, number] if x]),
        "|".join([x for x in [lemma, case_name] if x]),
    ]
    for key in keys:
        if key and key in function_form_glosses:
            return function_form_glosses[key]
    entry = function_glosses.get(lemma, {})
    if isinstance(entry, dict):
        return entry.get("glossIt", "")
    return ""


def get_lexicon_fallback(token, fixed_lexicon):
    lemma = normalize_greek(token.get("lemma", ""))
    entry = fixed_lexicon.get(lemma, {})
    if not isinstance(entry, dict):
        return ""
    gloss = (entry.get("glossIt") or "").strip()
    if not gloss:
        return ""
    if token.get("partOfSpeech") == "verbo":
        return adapt_verb_gloss(token, gloss)
    case_name, _, _ = token_traits(token)
    if case_name == "genitivo":
        return f"di {gloss}"
    if case_name == "dativo":
        return f"a {gloss}"
    return gloss


def parse_source():
    verses = defaultdict(list)
    for raw_line in SOURCE_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or "|" not in line:
            continue
        parts = line.split("|")
        if len(parts) < 9:
            continue
        book, chapter, verse, order = parts[:4]
        surface = parts[4]
        glosses = parts[6:9]
        gloss = ""
        for candidate in glosses:
            cleaned = clean_gloss(candidate)
            if cleaned:
                gloss = cleaned
                break
        bcv = f"{int(book):02}{int(chapter):02}{int(verse):02}"
        verses[bcv].append(
            {
                "order": int(order),
                "surface": surface,
                "norm_surface": normalize_greek(surface),
                "gloss": gloss,
            }
        )
    for bcv in verses:
        verses[bcv].sort(key=lambda item: item["order"])
    return verses


def find_entry(entries, token, start_index):
    token_forms = {
        normalize_greek(token.get("surface", "")),
        normalize_greek(token.get("word", "")),
        normalize_greek(token.get("normalizedWord", "")),
    }
    token_forms.discard("")

    for index in range(start_index, len(entries)):
        if entries[index].get("used"):
            continue
        if entries[index]["norm_surface"] in token_forms:
            return index

    for index in range(start_index, len(entries)):
        if not entries[index].get("used"):
            return index

    return None


def main():
    nt = load_nt_books()
    source = parse_source()
    manual = load_json(MANUAL_PATH)
    function_glosses = load_json(FUNCTION_GLOSSES_PATH)
    function_form_glosses = load_json(FUNCTION_FORM_GLOSSES_PATH)
    fixed_lexicon = load_json(FIXED_LEXICON_PATH)

    output = {}
    matched = 0
    total = 0

    for verses in nt.values():
        for verse in verses:
            tokens = verse.get("tokens", [])
            if not tokens:
                continue
            bcv = tokens[0].get("bcv", "")
            entries = [dict(item) for item in source.get(bcv, [])]
            if not entries:
                continue
            start_index = 0
            for token_index, token in enumerate(tokens):
                total += 1
                entry_index = find_entry(entries, token, start_index)
                if entry_index is None:
                    continue
                entries[entry_index]["used"] = True
                start_index = entry_index + 1
                gloss = entries[entry_index]["gloss"]
                if not gloss:
                    gloss = get_function_gloss(token, function_glosses, function_form_glosses)
                if not gloss:
                    gloss = get_lexicon_fallback(token, fixed_lexicon)
                if gloss:
                    output[f"{bcv}:{token_index}"] = gloss
                    matched += 1

    output.update(manual)
    ordered_output = dict(sorted(output.items(), key=sort_token_key))

    OUTPUT_PATH.write_text(
        json.dumps(ordered_output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(ordered_output)} glosses to {OUTPUT_PATH} ({matched}/{total} token matches from LaParola)")


if __name__ == "__main__":
    main()
