import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
LEXICON_PATH = ROOT / "assets/data/lexicon.json"
FUNCTION_GLOSSES_PATH = ROOT / "assets/data/function_glosses.json"
LEMMA_OVERRIDES_PATH = ROOT / "source/build_support/lemma_gloss_overrides.json"
OUTPUT_PATH = ROOT / "assets/data/fixed_lexicon.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def build_fixed_lexicon():
    lexicon = load_json(LEXICON_PATH)
    function_glosses = load_json(FUNCTION_GLOSSES_PATH)
    lemma_overrides = load_json(LEMMA_OVERRIDES_PATH)

    output = {}
    for entry in lexicon:
      lemma = entry["lemma"]
      output[lemma] = {
          "lemma": lemma,
          "greek": entry.get("greek", ""),
          "partOfSpeech": entry.get("partOfSpeech", ""),
          "occurrences": entry.get("occurrences", 0),
          "glossIt": entry.get("glossIt", ""),
          "notesIt": entry.get("notesIt", ""),
          "source": "lexicon",
      }

    for lemma, info in function_glosses.items():
        current = output.get(lemma, {
            "lemma": lemma,
            "greek": "",
            "partOfSpeech": "",
            "occurrences": 0,
            "glossIt": "",
            "notesIt": "",
            "source": "function",
        })
        current["glossIt"] = info.get("glossIt", current["glossIt"])
        current["source"] = "function"
        output[lemma] = current

    for lemma, info in lemma_overrides.items():
        current = output.get(lemma, {
            "lemma": lemma,
            "greek": "",
            "partOfSpeech": "",
            "occurrences": 0,
            "glossIt": "",
            "notesIt": "",
            "source": "override",
        })
        current["glossIt"] = info.get("glossIt", current["glossIt"])
        current["notesIt"] = info.get("notesIt", current["notesIt"])
        current["source"] = "override"
        output[lemma] = current

    ordered = dict(
        sorted(
            output.items(),
            key=lambda item: (-item[1].get("occurrences", 0), item[0]),
        )
    )
    OUTPUT_PATH.write_text(
        json.dumps(ordered, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(ordered)} entries to {OUTPUT_PATH}")


if __name__ == "__main__":
    build_fixed_lexicon()
