#!/usr/bin/env python3
"""Genera un lessico italiano completo partendo da lexicon.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_private_lexicon(entries: list[dict[str, object]], existing: dict[str, object]):
    output = {}
    for entry in entries:
        lemma = str(entry["lemma"])
        current = existing.get(lemma, {})
        output[lemma] = {
            "greek": entry.get("greek", ""),
            "part_of_speech": entry.get("partOfSpeech", ""),
            "occurrences": entry.get("occurrences", 0),
            "gloss_it": current.get("gloss_it", entry.get("glossIt", "")),
            "notes_it": current.get("notes_it", entry.get("notesIt", "")),
        }
    return output


def main(argv: list[str]) -> int:
    source = Path(argv[0]) if len(argv) > 0 else Path("assets/data/lexicon.json")
    target = Path(argv[1]) if len(argv) > 1 else Path("assets/data/lexicon_it.json")

    entries = read_json(source)
    existing = read_json(target) if target.exists() else {}
    output = build_private_lexicon(entries, existing)
    write_json(target, output)
    print(f"Lessico italiano generato: {len(output)} lemmi in {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
