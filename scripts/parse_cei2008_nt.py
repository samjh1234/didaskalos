#!/usr/bin/env python3
"""Estrae i versetti CEI 2008 dai file HTML salvati localmente."""

from __future__ import annotations

import json
import re
import sys
from html import unescape
from pathlib import Path


BOOKS = [
    ("matthew", "Matteo"),
    ("mark", "Marco"),
    ("luke", "Luca"),
    ("john", "Giovanni"),
    ("acts", "Atti"),
    ("romans", "Romani"),
    ("1-corinthians", "1 Corinzi"),
    ("2-corinthians", "2 Corinzi"),
    ("galatians", "Galati"),
    ("ephesians", "Efesini"),
    ("philippians", "Filippesi"),
    ("colossians", "Colossesi"),
    ("1-thessalonians", "1 Tessalonicesi"),
    ("2-thessalonians", "2 Tessalonicesi"),
    ("1-timothy", "1 Timoteo"),
    ("2-timothy", "2 Timoteo"),
    ("titus", "Tito"),
    ("philemon", "Filemone"),
    ("hebrews", "Ebrei"),
    ("james", "Giacomo"),
    ("1-peter", "1 Pietro"),
    ("2-peter", "2 Pietro"),
    ("1-john", "1 Giovanni"),
    ("2-john", "2 Giovanni"),
    ("3-john", "3 Giovanni"),
    ("jude", "Giuda"),
    ("revelation", "Apocalisse"),
]

VERSE_RE = re.compile(
    r'<span data-verses-id="[^"]+" class="verse[^"]*" id="verse_[^"]+">(.+?)</span>\s*</span>',
    re.DOTALL,
)
BUTTON_RE = re.compile(r"<button[^>]*>(\d+)</button>")
VERSE_NUMBER_RE = re.compile(r'<sup>\s*<span class="verse_number">(\d+)</span>\s*</sup>')
TAG_RE = re.compile(r"<[^>]+>")
SPACE_RE = re.compile(r"\s+")


def clean_html_text(fragment: str) -> str:
    fragment = fragment.replace("<br>", " ").replace("<br/>", " ").replace("<br />", " ")
    fragment = TAG_RE.sub(" ", fragment)
    fragment = unescape(fragment)
    fragment = SPACE_RE.sub(" ", fragment).strip()
    return fragment


def parse_chapter(html: str) -> dict[int, str]:
    verses: dict[int, str] = {}
    for block in VERSE_RE.findall(html):
        number_match = BUTTON_RE.search(block)
        if not number_match:
            number_match = VERSE_NUMBER_RE.search(block)
        if not number_match:
            continue
        verse_number = int(number_match.group(1))
        text = BUTTON_RE.sub("", block, count=1)
        text = VERSE_NUMBER_RE.sub("", text, count=1)
        text = clean_html_text(text)
        verses[verse_number] = text
    return verses


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str]) -> int:
    source_dir = Path(argv[0]) if len(argv) > 0 else Path("private_data/cei2008/html")
    out_path = Path(argv[1]) if len(argv) > 1 else Path("private_data/cei2008/nt_verses.json")

    if not source_dir.exists():
        print(f"Directory non trovata: {source_dir}", file=sys.stderr)
        return 1

    output = {}
    total = 0
    for slug, book_name in BOOKS:
        book_dir = source_dir / slug
        chapters = {}
        for chapter_file in sorted(book_dir.glob("*.html"), key=lambda path: int(path.stem)):
            chapter_num = int(chapter_file.stem)
            verses = parse_chapter(chapter_file.read_text(encoding="utf-8"))
            chapters[str(chapter_num)] = {str(number): text for number, text in sorted(verses.items())}
            total += len(verses)
        output[slug] = {
            "name_it": book_name,
            "chapters": chapters,
        }

    write_json(out_path, output)
    print(f"Parsing completato: {total} versetti in {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
