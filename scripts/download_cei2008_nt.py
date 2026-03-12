#!/usr/bin/env python3
"""Scarica localmente le pagine CEI 2008 del Nuovo Testamento per uso privato."""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path


BOOKS = [
    ("matthew", "Mt", 28),
    ("mark", "Mc", 16),
    ("luke", "Lc", 24),
    ("john", "Gv", 21),
    ("acts", "At", 28),
    ("romans", "Rm", 16),
    ("1-corinthians", "1Cor", 16),
    ("2-corinthians", "2Cor", 13),
    ("galatians", "Gal", 6),
    ("ephesians", "Ef", 6),
    ("philippians", "Fil", 4),
    ("colossians", "Col", 4),
    ("1-thessalonians", "1Ts", 5),
    ("2-thessalonians", "2Ts", 3),
    ("1-timothy", "1Tm", 6),
    ("2-timothy", "2Tm", 4),
    ("titus", "Tt", 3),
    ("philemon", "Fm", 1),
    ("hebrews", "Eb", 13),
    ("james", "Gc", 5),
    ("1-peter", "1Pt", 5),
    ("2-peter", "2Pt", 3),
    ("1-john", "1Gv", 5),
    ("2-john", "2Gv", 1),
    ("3-john", "3Gv", 1),
    ("jude", "Gd", 1),
    ("revelation", "Ap", 22),
]

BASE_URL = "https://www.bibbiaedu.it/CEI2008/nt/{abbr}/{chapter}/"


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", "ignore")


def main(argv: list[str]) -> int:
    out_dir = Path(argv[0]) if argv else Path("private_data/cei2008/html")
    out_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    skipped = 0
    for slug, abbr, chapters in BOOKS:
        book_dir = out_dir / slug
        book_dir.mkdir(parents=True, exist_ok=True)
        for chapter in range(1, chapters + 1):
            target = book_dir / f"{chapter}.html"
            if target.exists() and target.stat().st_size > 0:
                skipped += 1
                continue
            url = BASE_URL.format(abbr=abbr, chapter=chapter)
            html = fetch(url)
            target.write_text(html, encoding="utf-8")
            total += 1
            print(f"{slug} {chapter}")

    print(f"Download completato: {total} capitoli nuovi, {skipped} saltati.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
