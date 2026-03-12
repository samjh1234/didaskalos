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
    if value in {"", "-", ">", "*"}:
        return ""
    return value


def token_traits(token):
    morphology = normalize_greek(token.get("morphologyLabel", ""))
    case_name = next((v for v in ["nominativo", "genitivo", "dativo", "accusativo"] if v in morphology), "")
    number = next((v for v in ["singolare", "plurale"] if v in morphology), "")
    gender = next((v for v in ["maschile", "femminile", "neutro"] if v in morphology), "")
    return case_name, number, gender


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

    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(output)} glosses to {OUTPUT_PATH} ({matched}/{total} token matches from LaParola)")


if __name__ == "__main__":
    main()
