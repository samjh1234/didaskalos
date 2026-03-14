# Private Data

Questa cartella contiene dati locali privati non pensati per la pubblicazione.

File supportati:

- `lexicon_it.json`: glossario italiano per lemma
- `contextual_glosses_it.json`: resa italiana contestuale per singolo token
- `cei2008/nt_verses.json`: versetti CEI 2008 estratti localmente

## lexicon_it.json

Chiave: lemma greco normalizzato.

Esempio:

```json
{
  "λογος": {
    "gloss_it": "parola, discorso, verbo",
    "notes_it": "In Giovanni 1 spesso va reso come Verbo."
  }
}
```

## contextual_glosses_it.json

Chiave: `BCV:indice-token`, dove:

- `BCV` usa il formato MorphGNT, ad esempio `04001001`
- `indice-token` parte da `0`

Esempio:

```json
{
  "04001001:4": {
    "gloss_it": "Verbo",
    "source": "allineamento personale"
  }
}
```

L'ordine dei token corrisponde all'ordine in cui le parole compaiono nel versetto importato.

## CEI 2008 locale

Per uso privato locale puoi scaricare e parsare il Nuovo Testamento CEI 2008 con:

```bash
python3 scripts/download_cei2008_nt.py
python3 scripts/parse_cei2008_nt.py
```

Il risultato viene salvato in:

- Il file CEI usato dal sito a runtime viene pubblicato in `assets/data/cei2008_verses.json`

Il sito usa `nt_verses.json` come contesto italiano del versetto quando disponibile.
