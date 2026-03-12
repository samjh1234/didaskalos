#!/usr/bin/env python3
"""Importa il Nuovo Testamento da MorphGNT e genera JSON statici per il sito."""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path


BOOKS = [
    {
        "slug": "matthew",
        "file": "61-Mt-morphgnt.txt",
        "name_it": "Matteo",
        "name_gr": "Κατὰ Ματθαῖον",
    },
    {
        "slug": "mark",
        "file": "62-Mk-morphgnt.txt",
        "name_it": "Marco",
        "name_gr": "Κατὰ Μᾶρκον",
    },
    {
        "slug": "luke",
        "file": "63-Lk-morphgnt.txt",
        "name_it": "Luca",
        "name_gr": "Κατὰ Λουκᾶν",
    },
    {
        "slug": "john",
        "file": "64-Jn-morphgnt.txt",
        "name_it": "Giovanni",
        "name_gr": "Κατὰ Ἰωάννην",
    },
    {"slug": "acts", "file": "65-Ac-morphgnt.txt", "name_it": "Atti", "name_gr": "Πράξεις"},
    {"slug": "romans", "file": "66-Ro-morphgnt.txt", "name_it": "Romani", "name_gr": "Πρὸς Ῥωμαίους"},
    {"slug": "1-corinthians", "file": "67-1Co-morphgnt.txt", "name_it": "1 Corinzi", "name_gr": "Πρὸς Κορινθίους Α"},
    {"slug": "2-corinthians", "file": "68-2Co-morphgnt.txt", "name_it": "2 Corinzi", "name_gr": "Πρὸς Κορινθίους Β"},
    {"slug": "galatians", "file": "69-Ga-morphgnt.txt", "name_it": "Galati", "name_gr": "Πρὸς Γαλάτας"},
    {"slug": "ephesians", "file": "70-Eph-morphgnt.txt", "name_it": "Efesini", "name_gr": "Πρὸς Ἐφεσίους"},
    {"slug": "philippians", "file": "71-Php-morphgnt.txt", "name_it": "Filippesi", "name_gr": "Πρὸς Φιλιππησίους"},
    {"slug": "colossians", "file": "72-Col-morphgnt.txt", "name_it": "Colossesi", "name_gr": "Πρὸς Κολοσσαεῖς"},
    {"slug": "1-thessalonians", "file": "73-1Th-morphgnt.txt", "name_it": "1 Tessalonicesi", "name_gr": "Πρὸς Θεσσαλονικεῖς Α"},
    {"slug": "2-thessalonians", "file": "74-2Th-morphgnt.txt", "name_it": "2 Tessalonicesi", "name_gr": "Πρὸς Θεσσαλονικεῖς Β"},
    {"slug": "1-timothy", "file": "75-1Ti-morphgnt.txt", "name_it": "1 Timoteo", "name_gr": "Πρὸς Τιμόθεον Α"},
    {"slug": "2-timothy", "file": "76-2Ti-morphgnt.txt", "name_it": "2 Timoteo", "name_gr": "Πρὸς Τιμόθεον Β"},
    {"slug": "titus", "file": "77-Tit-morphgnt.txt", "name_it": "Tito", "name_gr": "Πρὸς Τίτον"},
    {"slug": "philemon", "file": "78-Phm-morphgnt.txt", "name_it": "Filemone", "name_gr": "Πρὸς Φιλήμονα"},
    {"slug": "hebrews", "file": "79-Heb-morphgnt.txt", "name_it": "Ebrei", "name_gr": "Πρὸς Ἑβραίους"},
    {"slug": "james", "file": "80-Jas-morphgnt.txt", "name_it": "Giacomo", "name_gr": "Ἰακώβου"},
    {"slug": "1-peter", "file": "81-1Pe-morphgnt.txt", "name_it": "1 Pietro", "name_gr": "Πέτρου Α"},
    {"slug": "2-peter", "file": "82-2Pe-morphgnt.txt", "name_it": "2 Pietro", "name_gr": "Πέτρου Β"},
    {"slug": "1-john", "file": "83-1Jn-morphgnt.txt", "name_it": "1 Giovanni", "name_gr": "Ἰωάννου Α"},
    {"slug": "2-john", "file": "84-2Jn-morphgnt.txt", "name_it": "2 Giovanni", "name_gr": "Ἰωάννου Β"},
    {"slug": "3-john", "file": "85-3Jn-morphgnt.txt", "name_it": "3 Giovanni", "name_gr": "Ἰωάννου Γ"},
    {"slug": "jude", "file": "86-Jud-morphgnt.txt", "name_it": "Giuda", "name_gr": "Ἰούδα"},
    {"slug": "revelation", "file": "87-Re-morphgnt.txt", "name_it": "Apocalisse", "name_gr": "Ἀποκάλυψις"},
]

MORPHGNT_BASE = "https://raw.githubusercontent.com/morphgnt/sblgnt/master"

POS_MAP = {
    "A-": "aggettivo",
    "C-": "congiunzione",
    "D-": "avverbio",
    "I-": "interiezione",
    "N-": "sostantivo",
    "P-": "preposizione",
    "RA": "articolo",
    "RD": "pronome dimostrativo",
    "RI": "pronome interrogativo/indefinito",
    "RP": "pronome personale",
    "RR": "pronome relativo",
    "V-": "verbo",
    "X-": "particella",
}

PERSON_MAP = {"1": "prima", "2": "seconda", "3": "terza"}
TENSE_MAP = {
    "P": "presente",
    "I": "imperfetto",
    "F": "futuro",
    "A": "aoristo",
    "X": "perfetto",
    "Y": "piuccheperfetto",
}
VOICE_MAP = {"A": "attiva", "M": "media", "P": "passiva"}
MOOD_MAP = {
    "I": "indicativo",
    "D": "imperativo",
    "S": "congiuntivo",
    "O": "ottativo",
    "N": "infinito",
    "P": "participio",
}
CASE_MAP = {"N": "nominativo", "G": "genitivo", "D": "dativo", "A": "accusativo"}
NUMBER_MAP = {"S": "singolare", "P": "plurale"}
GENDER_MAP = {"M": "maschile", "F": "femminile", "N": "neutro"}
DEGREE_MAP = {"C": "comparativo", "S": "superlativo"}

TRANSLIT_MAP = {
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


def normalize(value: str) -> str:
    accents = {
        "ά": "α",
        "έ": "ε",
        "ή": "η",
        "ί": "ι",
        "ό": "ο",
        "ύ": "υ",
        "ώ": "ω",
        "ὰ": "α",
        "ὲ": "ε",
        "ὴ": "η",
        "ὶ": "ι",
        "ὸ": "ο",
        "ὺ": "υ",
        "ὼ": "ω",
        "ᾶ": "α",
        "ῖ": "ι",
        "ῦ": "υ",
        "ῶ": "ω",
        "ἀ": "α",
        "ἁ": "α",
        "ἂ": "α",
        "ἃ": "α",
        "ἄ": "α",
        "ἅ": "α",
        "ἆ": "α",
        "ἇ": "α",
        "ἐ": "ε",
        "ἑ": "ε",
        "ἒ": "ε",
        "ἓ": "ε",
        "ἔ": "ε",
        "ἕ": "ε",
        "ἠ": "η",
        "ἡ": "η",
        "ἢ": "η",
        "ἣ": "η",
        "ἤ": "η",
        "ἥ": "η",
        "ἦ": "η",
        "ἧ": "η",
        "ἰ": "ι",
        "ἱ": "ι",
        "ἲ": "ι",
        "ἳ": "ι",
        "ἴ": "ι",
        "ἵ": "ι",
        "ἶ": "ι",
        "ἷ": "ι",
        "ὀ": "ο",
        "ὁ": "ο",
        "ὂ": "ο",
        "ὃ": "ο",
        "ὄ": "ο",
        "ὅ": "ο",
        "ὐ": "υ",
        "ὑ": "υ",
        "ὒ": "υ",
        "ὓ": "υ",
        "ὔ": "υ",
        "ὕ": "υ",
        "ὖ": "υ",
        "ὗ": "υ",
        "ὠ": "ω",
        "ὡ": "ω",
        "ὢ": "ω",
        "ὣ": "ω",
        "ὤ": "ω",
        "ὥ": "ω",
        "ὦ": "ω",
        "ὧ": "ω",
        "ϊ": "ι",
        "ΐ": "ι",
        "ϋ": "υ",
        "ΰ": "υ",
        "ῃ": "η",
        "ῇ": "η",
        "ῆ": "η",
        "ῳ": "ω",
        "ῷ": "ω",
        "ῴ": "ω",
        "ῤ": "ρ",
        "ῥ": "ρ",
    }
    return "".join(accents.get(char, char.lower()) for char in value.strip())


def pronounce(value: str) -> str:
    normalized = normalize(value)
    output = []
    index = 0
    while index < len(normalized):
        pair = normalized[index : index + 2]
        if pair in {"αι", "ει", "οι", "ου", "αυ", "ευ"}:
            output.append(pair)
            index += 2
            continue
        if pair == "γγ":
            output.append("ng")
            index += 2
            continue
        if pair == "γκ":
            output.append("nk")
            index += 2
            continue
        output.append(TRANSLIT_MAP.get(normalized[index], normalized[index]))
        index += 1
    return "".join(output)


def decode_parse(parse_code: str) -> dict[str, str]:
    if len(parse_code) != 8:
        return {}

    fields = [
        ("person", parse_code[0], PERSON_MAP),
        ("tense", parse_code[1], TENSE_MAP),
        ("voice", parse_code[2], VOICE_MAP),
        ("mood", parse_code[3], MOOD_MAP),
        ("case", parse_code[4], CASE_MAP),
        ("number", parse_code[5], NUMBER_MAP),
        ("gender", parse_code[6], GENDER_MAP),
        ("degree", parse_code[7], DEGREE_MAP),
    ]

    decoded = {}
    for name, code, mapping in fields:
        if code != "-":
            decoded[name] = mapping.get(code, code)
    return decoded


def summarize_morphology(pos_code: str, parse_code: str) -> str:
    parts = [POS_MAP.get(pos_code, pos_code)]
    decoded = decode_parse(parse_code)
    ordered = ["person", "tense", "voice", "mood", "case", "number", "gender", "degree"]
    for field in ordered:
      value = decoded.get(field)
      if value:
        parts.append(value)
    return ", ".join(parts)


def parse_line(line: str) -> list[dict[str, object]]:
    items = line.strip().split()
    if len(items) % 7 != 0:
        raise ValueError(f"Formato MorphGNT inatteso: {line[:80]}...")

    tokens = []
    for index in range(0, len(items), 7):
        bcv, pos_code, parse_code, text, word, normalized_word, lemma = items[index : index + 7]
        tokens.append(
            {
                "bcv": bcv,
                "surface": text,
                "word": word,
                "normalizedWord": normalized_word,
                "lemma": normalize(lemma),
                "greekLemma": lemma,
                "gloss": "",
                "pronunciation": pronounce(text),
                "partOfSpeech": POS_MAP.get(pos_code, pos_code),
                "posCode": pos_code,
                "parsingCode": parse_code,
                "morphology": decode_parse(parse_code),
                "morphologyLabel": summarize_morphology(pos_code, parse_code),
            }
        )
    return tokens


def read_json_map(path: Path | None) -> dict[str, object]:
    if not path or not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))

def download_text(url: str) -> str:
    with urllib.request.urlopen(url) as response:
        return response.read().decode("utf-8")


def load_source(book: dict[str, str], source_dir: Path | None) -> str:
    if source_dir:
        path = source_dir / book["file"]
        return path.read_text(encoding="utf-8")

    url = f"{MORPHGNT_BASE}/{book['file']}"
    return download_text(url)


def build_gospels(
    source_dir: Path | None,
    private_lexicon: dict[str, object],
    contextual_glosses: dict[str, object],
) -> tuple[dict[str, list[dict[str, object]]], dict[str, Counter]]:
    gospels = {}
    lemma_pos_counter: dict[str, Counter] = defaultdict(Counter)

    for book in BOOKS:
        verses: list[dict[str, object]] = []
        verse_buckets: dict[tuple[int, int], list[dict[str, object]]] = defaultdict(list)
        raw_text = load_source(book, source_dir)

        for line in raw_text.splitlines():
            if not line.strip():
                continue
            parsed_tokens = parse_line(line)
            for token in parsed_tokens:
                chapter = int(str(token["bcv"])[2:4])
                verse = int(str(token["bcv"])[4:6])
                verse_token_index = len(verse_buckets[(chapter, verse)])
                lemma = str(token["lemma"])
                private_entry = private_lexicon.get(lemma, {})
                token["gloss"] = str(private_entry.get("gloss_it", ""))
                contextual_key = f"{token['bcv']}:{verse_token_index}"
                contextual_entry = contextual_glosses.get(contextual_key, {})
                if contextual_entry.get("gloss_it"):
                    token["gloss"] = str(contextual_entry["gloss_it"])
                    token["glossSource"] = str(contextual_entry.get("source", "contextual"))
                if private_entry.get("notes_it"):
                    token["lexiconNotesIt"] = str(private_entry["notes_it"])
                verse_buckets[(chapter, verse)].append(token)
                lemma_pos_counter[str(token["lemma"])][str(token["partOfSpeech"])] += 1

        for (chapter, verse) in sorted(verse_buckets):
            verse_tokens = verse_buckets[(chapter, verse)]
            verses.append(
                {
                    "reference": f"{book['name_it']} {chapter}:{verse}",
                    "greek": " ".join(str(token["surface"]) for token in verse_tokens),
                    "tokens": verse_tokens,
                }
            )

        gospels[book["slug"]] = verses

    return gospels, lemma_pos_counter


def build_lexicon(
    gospels: dict[str, list[dict[str, object]]],
    lemma_pos_counter: dict[str, Counter],
    existing_lexicon: list[dict[str, object]],
    private_lexicon: dict[str, object],
) -> list[dict[str, object]]:
    existing_by_lemma = {normalize(str(entry["lemma"])): entry for entry in existing_lexicon}
    index: dict[str, dict[str, object]] = {}
    occurrences_counter: Counter = Counter()

    for verses in gospels.values():
        for verse in verses:
            for token in verse["tokens"]:
                lemma = str(token["lemma"])
                occurrences_counter[lemma] += 1
                if lemma not in index:
                    part_of_speech = lemma_pos_counter[lemma].most_common(1)[0][0]
                    existing = existing_by_lemma.get(lemma, {})
                    private_entry = private_lexicon.get(lemma, {})
                    index[lemma] = {
                        "lemma": lemma,
                        "greek": existing.get("greek", token["greekLemma"]),
                        "partOfSpeech": existing.get("partOfSpeech", part_of_speech),
                        "glossIt": private_entry.get("gloss_it", existing.get("glossIt", "")),
                        "notes": existing.get(
                            "notes",
                            "Voce importata da MorphGNT. Aggiungi gloss italiano e note didattiche.",
                        ),
                        "notesIt": private_entry.get("notes_it", ""),
                        "occurrences": 0,
                    }

    for lemma, entry in index.items():
        entry["occurrences"] = occurrences_counter[lemma]

    return sorted(index.values(), key=lambda entry: str(entry["lemma"]))


def read_existing_lexicon(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_gospels_split(path: Path, gospels: dict[str, list[dict[str, object]]]) -> None:
    path.mkdir(parents=True, exist_ok=True)
    for slug, verses in gospels.items():
        write_json(path / f"{slug}.json", verses)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Importa il Nuovo Testamento da MorphGNT e genera JSON statici."
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path("source/morphgnt"),
        help="Directory locale contenente i file MorphGNT già scaricati.",
    )
    parser.add_argument(
        "--gospels-out",
        type=Path,
        default=Path("assets/data/nt"),
        help="Directory output per i file del Nuovo Testamento separati per libro.",
    )
    parser.add_argument(
        "--lexicon-out",
        type=Path,
        default=Path("assets/data/lexicon.json"),
        help="Percorso output per lexicon.json",
    )
    parser.add_argument(
        "--private-lexicon",
        type=Path,
        default=Path("private_data/lexicon_it.json"),
        help="Glossario italiano privato per lemma.",
    )
    parser.add_argument(
        "--contextual-glosses",
        type=Path,
        default=Path("private_data/contextual_glosses_it.json"),
        help="Glossario italiano contestuale privato per token.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.source_dir and not args.source_dir.exists():
        print(
            f"Directory sorgente non trovata: {args.source_dir}. "
            "Scarica prima i file MorphGNT oppure passa --source-dir.",
            file=sys.stderr,
        )
        return 1
    existing_lexicon = read_existing_lexicon(args.lexicon_out)
    private_lexicon = read_json_map(args.private_lexicon)
    contextual_glosses = read_json_map(args.contextual_glosses)
    gospels, lemma_pos_counter = build_gospels(
        args.source_dir,
        private_lexicon,
        contextual_glosses,
    )
    lexicon = build_lexicon(gospels, lemma_pos_counter, existing_lexicon, private_lexicon)
    write_gospels_split(args.gospels_out, gospels)
    write_json(args.lexicon_out, lexicon)
    print(
        f"Import completato: {sum(len(v) for v in gospels.values())} versetti, "
        f"{len(lexicon)} lemmi."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
