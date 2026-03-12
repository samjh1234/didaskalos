# Koine Gospel Study

Web app statica per lo studio del greco koine del Nuovo Testamento.

Obiettivo attuale:
- interlineare affidabile
- vocabolario locale
- schede parola
- morfologia con dataset verbali, nominali e pronominali locali

Il progetto non usa backend runtime. Tutto il sito gira in browser con file statici.

## Stack

- `HTML`
- `CSS`
- `JavaScript`
- `JSON`

## Avvio locale

```bash
python3 -m http.server 8000
```

Poi apri `http://localhost:8000`.

## Struttura generale

- `index.html`: shell della single-page app
- `word.html`: pagina dedicata al lemma
- `assets/css/styles.css`: stile
- `assets/js/app.js`: routing e rendering principale
- `assets/js/word-page.js`: rendering della pagina parola
- `assets/js/data-loader.js`: caricamento dataset
- `assets/js/morphology.js`: fallback morfologico minimale
- `assets/data/`: dataset runtime usati dal browser
- `scripts/`: script di import e build
- `source/`: sorgenti locali e file di supporto alla build
- `private_data/`: dati locali privati opzionali

## Logica del progetto

Il progetto è separato in livelli:

1. `testo greco`
- base: `MorphGNT`
- file principali: `assets/data/nt/*.json`

2. `interlineare`
- base: `LaParola`
- file principale: `assets/data/token_glosses_fixed.json`
- serve solo alla pagina interlineare

3. `lessico`
- file principale: `assets/data/lexicon.json`
- serve a vocabolario e `word.html`
- lavora a livello di `lemma`, non di token

4. `morfologia`
- paradigmi nominali, pronominali e verbali locali
- usati da `word.html` e dalla pagina Morfologia

Regola importante:
- `interlineare` e `lessico` sono separati
- il significato di un token nel versetto non coincide sempre con il significato base del lemma

## Dataset runtime

Questi file sono letti direttamente dal browser:

- `assets/data/books.json`
- `assets/data/grammar.json`
- `assets/data/lexicon.json`
- `assets/data/nt/*.json`
- `assets/data/token_glosses_fixed.json`
- `assets/data/function_glosses.json`
- `assets/data/function_form_glosses.json`
- `assets/data/noun_paradigms.json`
- `assets/data/pronoun_paradigms.json`
- `assets/data/verb_lemmas.json`
- `assets/data/verb_metadata.json`
- `assets/data/verb_non_finite.json`
- `assets/data/verb_paradigms.json`
- `assets/data/fixed_lexicon.json`

Nota:
- `fixed_lexicon.json` è ancora usato come supporto lessicale locale comune
- in futuro può essere accorpato in `lexicon.json` se il progetto viene semplificato ancora

## File build-support

Questi file non servono al browser, ma servono per rigenerare i dataset:

- `source/laparola_interlinear/interlineare.sql`
- `source/laparola_vocab/unpacked/Vocabolario del NT.rtf`
- `source/build_support/lexicon_laparola.json`
- `source/build_support/token_glosses_manual_it.json`
- `source/build_support/lemma_gloss_overrides.json`
- `source/morphgnt/*.txt`

## Dataset verbale centrale

I verbi sono organizzati in piu file collegati dallo stesso lemma normalizzato:

- `assets/data/verb_lemmas.json`
  - identita del verbo
  - significato base
  - classe
  - parti principali
  - note

- `assets/data/verb_paradigms.json`
  - paradigmi finiti
  - tempi, modi, voci
  - forme per persona
  - significati italiani fissi per persona

- `assets/data/verb_non_finite.json`
  - infiniti
  - participi guida

- `assets/data/verb_metadata.json`
  - occorrenze
  - stato di verifica
  - flag come `irregolare`, `deponente`, `-μι`

Questo dataset è pensato come base unica per:
- `Vocabolario`
- `Morfologia`
- `word.html`
- funzioni future come quiz, ricerca per forma, flashcard

## Script principali

### 1. Import MorphGNT

Genera il testo base del NT e rigenera il lessico locale.

```bash
python3 scripts/import_morphgnt.py
```

Input:
- `source/morphgnt`
- opzionalmente `private_data/lexicon_it.json`
- opzionalmente `private_data/contextual_glosses_it.json`

Output:
- `assets/data/nt/*.json`
- `assets/data/lexicon.json`

### 2. Build interlineare LaParola

Rigenera il mapping token-per-token dell’interlineare.

```bash
python3 scripts/build_laparola_token_glosses.py
```

Input:
- `source/laparola_interlinear/interlineare.sql`
- `source/build_support/token_glosses_manual_it.json`

Output:
- `assets/data/token_glosses_fixed.json`

### 3. Import vocabolario LaParola

Importa e abbina il vocabolario greco-italiano di LaParola ai lemmi locali.

```bash
python3 scripts/import_laparola_vocab.py
```

Input:
- `source/laparola_vocab/unpacked/Vocabolario del NT.rtf`

Output:
- `source/build_support/lexicon_laparola.json`
- aggiornamento di `assets/data/lexicon.json`

### 4. Build lessico fisso

Rigenera il lessico fisso di supporto.

```bash
python3 scripts/build_fixed_lexicon.py
```

Input:
- `assets/data/lexicon.json`
- `source/build_support/lemma_gloss_overrides.json`

Output:
- `assets/data/fixed_lexicon.json`

### 5. Build dataset verbale centrale

Rigenera i file verbali derivati.

```bash
python3 scripts/build_verb_dataset.py
```

Output:
- `assets/data/verb_lemmas.json`
- `assets/data/verb_metadata.json`
- `assets/data/verb_non_finite.json`

## Dati privati opzionali

Cartella:
- `private_data/`

Uso principale:
- gloss italiani privati per lemma
- gloss contestuali privati per token
- testo CEI 2008 locale

File:
- `private_data/lexicon_it.example.json`
- `private_data/contextual_glosses_it.example.json`
- `private_data/lexicon_it.json`
- `private_data/cei2008/nt_verses.json`

Workflow minimo:

```bash
python3 scripts/build_private_lexicon.py
python3 scripts/import_morphgnt.py
```

Per il testo CEI locale:

```bash
python3 scripts/download_cei2008_nt.py
python3 scripts/parse_cei2008_nt.py
```

## Stato del lavoro

Situazione attuale:
- interlineare separato dal lessico
- vocabolario locale integrato con LaParola
- dataset verbale centrale avviato
- molti verbi frequenti del NT gia in paradigmi fissi locali

Da continuare:
- completare tutti i paradigmi verbali restanti
- estendere meglio i paradigmi nominali
- raffinare ancora il lessico italiano
- migliorare le note didattiche

## Fonti principali

- `MorphGNT SBLGNT`: [github.com/morphgnt/sblgnt](https://github.com/morphgnt/sblgnt)
- `SBLGNT`: [github.com/LogosBible/SBLGNT](https://github.com/LogosBible/SBLGNT)
- `LaParola interlineare`: [laparola.net/interlineare](https://www.laparola.net/interlineare/)
- `LaParola vocabolario`: [laparola.net/vocab](https://www.laparola.net/vocab/)

## Nota pratica

Questo README descrive la struttura di lavoro attuale del progetto, non una versione finale definitiva. Serve come riferimento operativo mentre il dataset e le pagine continuano a evolvere.
