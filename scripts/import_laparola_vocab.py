import json
import re
import subprocess
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RTF_PATH = ROOT / "source" / "laparola_vocab" / "unpacked" / "Vocabolario del NT.rtf"
LEXICON_PATH = ROOT / "assets" / "data" / "lexicon.json"
SOURCE_JSON_PATH = ROOT / "source" / "build_support" / "lexicon_laparola.json"
FIXED_LEXICON_PATH = ROOT / "assets" / "data" / "fixed_lexicon.json"


ENTRY_START_RE = re.compile(r"^(.+?) \(([^)]+)\)$")
STRONG_RE = re.compile(r"^Numero Strong:\s*(\d+)")

TRANSLITERATION_MAP = {
    "α": "a",
    "β": "b",
    "γ": "g",
    "δ": "d",
    "ε": "e",
    "ζ": "z",
    "η": "e",
    "θ": "th",
    "ι": "i",
    "κ": "k",
    "λ": "l",
    "μ": "m",
    "ν": "n",
    "ξ": "x",
    "ο": "o",
    "π": "p",
    "ρ": "r",
    "σ": "s",
    "ς": "s",
    "τ": "t",
    "υ": "u",
    "φ": "ph",
    "χ": "kh",
    "ψ": "ps",
    "ω": "o",
}

ALT_TRANSLITERATION_MAP = {
    "α": "a",
    "β": "b",
    "γ": "g",
    "δ": "d",
    "ε": "e",
    "ζ": "z",
    "η": "e",
    "θ": "th",
    "ι": "i",
    "κ": "k",
    "λ": "l",
    "μ": "m",
    "ν": "n",
    "ξ": "x",
    "ο": "o",
    "π": "p",
    "ρ": "r",
    "σ": "s",
    "ς": "s",
    "τ": "t",
    "υ": "u",
    "φ": "ph",
    "χ": "ch",
    "ψ": "ps",
    "ω": "o",
}

POS_MAP = {
    "verbo": "verbo",
    "aggettivo": "aggettivo",
    "avverbio": "avverbio",
    "particella": "particella",
    "congiunzione": "congiunzione",
    "preposizione": "preposizione",
    "interiezione": "interiezione",
    "nome maschile": "sostantivo",
    "nome femminile": "sostantivo",
    "nome località": "sostantivo",
    "sostantivo maschile": "sostantivo",
    "sostantivo femminile": "sostantivo",
    "sostantivo neutro": "sostantivo",
    "pronome": "pronome",
}


def normalize(value: str = "") -> str:
    value = unicodedata.normalize("NFD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    replacements = {
        "û": "o",
        "ô": "o",
        "Œ": "e",
        "œ": "e",
        "Ø": "e",
        "ø": "e",
        "Ł": "e",
        "ł": "e",
        "©": "e",
        "£": "a",
        "¢": "a",
        "Ð": "",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    value = value.lower()
    value = value.replace("gg", "ng").replace("gk", "nk").replace("kh", "ch")
    value = value.replace("œ", "oe").replace("æ", "ae")
    value = re.sub(r"[^a-z0-9]+", "", value)
    return value.strip()


def transliterate_greek(value: str = "", mapping=None) -> str:
    mapping = mapping or TRANSLITERATION_MAP
    normalized = unicodedata.normalize("NFD", value or "")
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch)).lower().strip()
    result = []
    index = 0
    while index < len(normalized):
        pair = normalized[index : index + 2]
        if pair in {"αι", "ει", "οι", "ου", "αυ", "ευ", "γγ", "γκ"}:
            result.append(
                {
                    "αι": "ai",
                    "ει": "ei",
                    "οι": "oi",
                    "ου": "ou",
                    "αυ": "au",
                    "ευ": "eu",
                    "γγ": "ng" if mapping is TRANSLITERATION_MAP else "gg",
                    "γκ": "nk" if mapping is TRANSLITERATION_MAP else "gk",
                }[pair]
            )
            index += 2
            continue
        result.append(mapping.get(normalized[index], normalized[index]))
        index += 1
    return "".join(result)


def pronounce_greek(value: str = "") -> str:
    return transliterate_greek(value, TRANSLITERATION_MAP)


def convert_rtf_to_text() -> str:
    output = subprocess.check_output(
        ["textutil", "-convert", "txt", "-stdout", str(RTF_PATH)],
        cwd=ROOT,
        text=True,
        errors="replace",
    )
    return output.replace("\r", "")


def clean_line(value: str) -> str:
    value = value.replace("\x0c", "").strip()
    value = re.sub(r"\s+", " ", value)
    return value


def parse_entries(text: str):
    blocks = [block.strip() for block in text.split("\n\n") if block.strip()]
    entries = []
    i = 0
    while i < len(blocks):
        lines = [clean_line(line) for line in blocks[i].splitlines() if clean_line(line)]
        if not lines:
            i += 1
            continue
        match = ENTRY_START_RE.match(lines[0])
        if not match:
            i += 1
            continue

        entry = {
            "headwordRaw": match.group(1),
            "translitRaw": match.group(2),
            "strong": "",
            "partOfSpeechRaw": "",
            "definition": "",
            "translationSummary": "",
        }

        j = i + 1
        while j < len(blocks):
            next_lines = [clean_line(line) for line in blocks[j].splitlines() if clean_line(line)]
            if not next_lines:
                j += 1
                continue
            if ENTRY_START_RE.match(next_lines[0]):
                break
            strong_match = next((STRONG_RE.match(line) for line in next_lines if STRONG_RE.match(line)), None)
            if strong_match:
                entry["strong"] = strong_match.group(1)
            if not entry["partOfSpeechRaw"]:
                for line in next_lines:
                    lowered = line.lower()
                    if lowered in POS_MAP:
                        entry["partOfSpeechRaw"] = lowered
                        break
            if next_lines and next_lines[0].startswith("1)") or any(line.startswith("1)") for line in next_lines):
                definition_lines = [line for line in next_lines if not line.startswith("Totale:")]
                entry["definition"] = " ".join(definition_lines).strip()
            if any(line.startswith("Totale:") for line in next_lines):
                translation_lines = [
                    line
                    for line in next_lines
                    if not line.startswith("Totale:")
                    and not STRONG_RE.match(line)
                    and line.lower() not in POS_MAP
                    and not line.startswith("1)")
                    and not line.startswith("2)")
                    and not line.startswith("3)")
                    and not line.startswith("4)")
                ]
                entry["translationSummary"] = " | ".join(translation_lines[-6:]).strip(" |")
            j += 1

        entries.append(entry)
        i = j
    return entries


def build_lexicon_index(lexicon):
    index = {}
    for entry in lexicon:
        lemma = entry["lemma"]
        keys = {
            normalize(lemma),
            normalize(pronounce_greek(entry.get("greek", ""))),
            normalize(transliterate_greek(entry.get("greek", ""), ALT_TRANSLITERATION_MAP)),
        }
        for key in keys:
            if key:
                index.setdefault(key, []).append(entry)
    return index


def source_keys(source_entry):
    base = normalize(source_entry["translitRaw"])
    keys = {base}
    if base.endswith("au"):
        keys.add(f"{base[:-2]}ao")
    if base.endswith("eu"):
        keys.add(f"{base[:-2]}eo")
    if base.endswith("ou"):
        keys.add(f"{base[:-2]}oo")
    return {key for key in keys if key}


def choose_match(candidates, source_entry):
    if not candidates:
        return None
    pos = POS_MAP.get(source_entry["partOfSpeechRaw"], "")
    if pos:
        same_pos = [item for item in candidates if item.get("partOfSpeech") == pos]
        if len(same_pos) == 1:
            return same_pos[0]
        if same_pos:
            candidates = same_pos
    if len(candidates) == 1:
        return candidates[0]
    return max(candidates, key=lambda item: item.get("occurrences", 0))


def build_gloss(source_entry):
    definition = source_entry["definition"]
    summary = source_entry["translationSummary"]
    gloss = ""

    if summary:
        ranked = []
        for chunk in summary.split("|"):
            part = chunk.strip()
            if not part or ":" not in part:
                continue
            label, count = part.rsplit(":", 1)
            try:
                score = int(count.strip())
            except ValueError:
                continue
            label = re.sub(r"^\(\+[^)]+\)\s*", "", label).strip()
            label = re.sub(r"^(di|in|a|da|con|per|su|il|lo|la|i|gli|le|uno|una)\s+", "", label, flags=re.I)
            label = label.strip()
            if label:
                ranked.append((score, label))
        if ranked:
            gloss = max(ranked, key=lambda item: item[0])[1]

    match = re.search(r'=\s*"([^"]+)"', definition)
    if match and not gloss:
        gloss = match.group(1).strip()
    if not gloss:
        numbered = re.findall(r"\b1\)\s*([^0-9]+?)(?=\b2\)|$)", definition)
        if numbered:
            gloss = numbered[0].strip(" ;,")
    gloss = re.sub(r"\s+", " ", gloss).strip(" ;,")
    return gloss


def main():
    text = convert_rtf_to_text()
    source_entries = parse_entries(text)

    lexicon = json.loads(LEXICON_PATH.read_text(encoding="utf-8"))
    fixed_lexicon = json.loads(FIXED_LEXICON_PATH.read_text(encoding="utf-8"))
    index = build_lexicon_index(lexicon)

    mapped = []
    updated = 0
    for source_entry in source_entries:
        candidates = []
        for key in source_keys(source_entry):
            candidates.extend(index.get(key, []))
        deduped = {}
        for candidate in candidates:
            deduped[candidate["lemma"]] = candidate
        candidates = list(deduped.values())
        target = choose_match(candidates, source_entry)
        mapped_entry = {
            "translit": source_entry["translitRaw"],
            "strong": source_entry["strong"],
            "partOfSpeech": POS_MAP.get(source_entry["partOfSpeechRaw"], source_entry["partOfSpeechRaw"]),
            "definition": source_entry["definition"],
            "translationSummary": source_entry["translationSummary"],
            "matchedLemma": target["lemma"] if target else "",
            "matchedGreek": target["greek"] if target else "",
        }
        mapped.append(mapped_entry)

        if not target:
            continue

        gloss = build_gloss(source_entry)
        notes_parts = [part for part in [source_entry["definition"], source_entry["translationSummary"]] if part]
        fixed_entry = fixed_lexicon.get(target["lemma"], {})
        should_preserve_fixed = bool(fixed_entry.get("glossIt")) and (
            fixed_entry.get("source") in {"function", "override"}
            or target.get("partOfSpeech") in {"congiunzione", "articolo", "preposizione", "pronome personale", "particella"}
        )

        if gloss and not should_preserve_fixed:
            target["glossIt"] = gloss
        if notes_parts:
            target["notesIt"] = " ".join(notes_parts).strip()
        updated += 1

    SOURCE_JSON_PATH.write_text(json.dumps(mapped, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    LEXICON_PATH.write_text(json.dumps(lexicon, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Parsed {len(source_entries)} LaParola entries")
    print(f"Matched/updated {updated} project lexicon entries")
    print(f"Wrote source map to {SOURCE_JSON_PATH}")


if __name__ == "__main__":
    main()
