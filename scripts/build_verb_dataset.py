#!/usr/bin/env python3
"""Build the central local verb dataset from the current paradigm source."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "assets" / "data"
SCHEMA_PATH = ROOT / "source" / "build_support" / "verb_dataset_schema.json"


PRINCIPAL_PARTS = {
    "ειμι": ["εἰμί", "ἔσομαι", "-", "-", "-", "-"],
    "λεγω": ["λέγω", "ἐρῶ", "εἶπον", "εἴρηκα", "εἴρημαι", "ἐρρέθην"],
    "γινομαι": ["γίνομαι", "γενήσομαι", "ἐγενόμην", "γέγονα", "-", "-"],
    "ερχομαι": ["ἔρχομαι", "ἐλεύσομαι", "ἦλθον", "ἐλήλυθα", "-", "-"],
    "διδωμι": ["δίδωμι", "δώσω", "ἔδωκα", "δέδωκα", "δέδομαι", "ἐδόθην"],
    "ιστημι": ["ἵστημι", "στήσω", "ἔστησα", "ἕστηκα", "ἕσταμαι", "ἐστάθην"],
    "τιθημι": ["τίθημι", "θήσω", "ἔθηκα", "τέθεικα", "τέθειμαι", "ἐτέθην"],
    "ευλογεω": ["εὐλογέω", "εὐλογήσω", "εὐλόγησα", "-", "εὐλόγημαι", "εὐλογήθην"],
    "οιδα": ["οἶδα", "-", "-", "-", "-", "-"],
    "αποκρινομαι": ["ἀποκρίνομαι", "ἀποκρινοῦμαι", "ἀπεκρίθην", "-", "-", "-"],
    "δυναμαι": ["δύναμαι", "δυνήσομαι", "-", "-", "-", "-"],
    "αφιημι": ["ἀφίημι", "ἀφήσω", "ἀφῆκα", "ἀφέωκα", "ἀφέωμαι", "ἀφέθην"],
    "παραδιδωμι": ["παραδίδωμι", "παραδώσω", "παρέδωκα", "παραδέδωκα", "παραδέδομαι", "παρεδόθην"],
    "ανιστημι": ["ἀνίστημι", "ἀναστήσω", "ἀνέστησα", "ἀνέστηκα", "ἀνάσταμαι", "ἀνεστάθην"],
    "εξερχομαι": ["ἐξέρχομαι", "ἐξελεύσομαι", "ἐξῆλθον", "-", "-", "-"],
    "εισερχομαι": ["εἰσέρχομαι", "εἰσελεύσομαι", "εἰσῆλθον", "-", "-", "-"],
    "απερχομαι": ["ἀπέρχομαι", "ἀπελεύσομαι", "ἀπῆλθον", "-", "-", "-"],
    "οραω": ["ὁράω", "ὄψομαι", "εἶδον", "ἑώρακα", "ἑώραμαι", "ὤφθην"],
    "εχω": ["ἔχω", "ἕξω", "ἔσχον", "ἔσχηκα", "-", "-"],
    "ποιεω": ["ποιέω", "ποιήσω", "ἐποίησα", "πεποίηκα", "πεποίημαι", "ἐποιήθην"],
    "ακουω": ["ἀκούω", "ἀκούσω", "ἤκουσα", "ἀκήκοα", "ἤκουσμαι", "ἠκούσθην"],
    "λαλεω": ["λαλέω", "λαλήσω", "ἐλάλησα", "λελάληκα", "λελάλημαι", "ἐλαλήθην"],
    "λαμβανω": ["λαμβάνω", "λήμψομαι", "ἔλαβον", "εἴληφα", "εἴλημμαι", "ἐλήμφθην"],
    "πιστευω": ["πιστεύω", "πιστεύσω", "ἐπίστευσα", "πεπίστευκα", "πεπίστευμαι", "ἐπιστεύθην"],
    "γινωσκω": ["γινώσκω", "γνώσομαι", "ἔγνων", "ἔγνωκα", "ἔγνωσμαι", "ἐγνώσθην"],
    "θελω": ["θέλω", "θελήσω", "ἠθέλησα", "-", "-", "-"],
    "γραφω": ["γράφω", "γράψω", "ἔγραψα", "γέγραφα", "γέγραμμαι", "ἐγράφην"],
    "ευρισκω": ["εὑρίσκω", "εὑρήσω", "εὗρον", "ηὕρηκα", "ηὕρημαι", "εὑρέθην"],
    "εσθιω": ["ἐσθίω", "φάγομαι", "ἔφαγον", "-", "-", "-"],
    "πορευομαι": ["πορεύομαι", "πορεύσομαι", "ἐπορεύθην", "-", "-", "-"],
    "καλεω": ["καλέω", "καλέσω", "ἐκάλεσα", "κέκληκα", "κέκλημαι", "ἐκλήθην"],
    "αγαπαω": ["ἀγαπάω", "ἀγαπήσω", "ἠγάπησα", "ἠγάπηκα", "ἠγάπημαι", "ἠγαπήθην"],
    "εγειρω": ["ἐγείρω", "ἐγερῶ", "ἤγειρα", "ἐγήγερκα", "ἐγήγερμαι", "ἠγέρθην"],
    "βλεπω": ["βλέπω", "βλέψω", "ἔβλεψα", "-", "-", "-"],
    "αποστελλω": ["ἀποστέλλω", "ἀποστελῶ", "ἀπέστειλα", "ἀπέσταλκα", "ἀπέσταλμαι", "ἀπεστάλην"],
    "βαλλω": ["βάλλω", "βαλῶ", "ἔβαλον", "βέβληκα", "βέβλημαι", "ἐβλήθην"],
    "μενω": ["μένω", "μενῶ", "ἔμεινα", "μεμένηκα", "-", "-"],
    "ζητεω": ["ζητέω", "ζητήσω", "ἐζήτησα", "ἐζήτηκα", "ἐζήτημαι", "ἐζητήθην"],
    "κρινω": ["κρίνω", "κρινῶ", "ἔκρινα", "κέκρικα", "κέκριμαι", "ἐκρίθην"],
    "σωζω": ["σῴζω", "σώσω", "ἔσωσα", "σέσωκα", "σέσωσμαι", "ἐσώθην"],
    "διδασκω": ["διδάσκω", "διδάξω", "ἐδίδαξα", "δεδίδαχα", "δεδίδαγμαι", "ἐδιδάχθην"],
    "δεω": ["δέω", "δήσω", "ἔδησα", "δέδεκα", "δέδεμαι", "ἐδέθην"],
    "ζαω": ["ζάω", "ζήσω", "-", "-", "-", "-"],
    "αποθνῄσκω": ["ἀποθνῄσκω", "ἀποθανοῦμαι", "ἀπέθανον", "τέθνηκα", "-", "-"],
    "μελλω": ["μέλλω", "μελλήσω", "-", "-", "-", "-"],
    "παρακαλεω": ["παρακαλέω", "παρακαλέσω", "παρεκάλεσα", "παρακέκληκα", "παρακέκλημαι", "παρεκλήθην"],
    "αιρω": ["αἴρω", "ἀρῶ", "ἦρα", "ἦρκα", "ἦρμαι", "ἤρθην"],
    "γενναω": ["γεννάω", "γεννήσω", "ἐγέννησα", "γεγέννηκα", "γεγέννημαι", "ἐγεννήθην"],
    "περιπατεω": ["περιπατέω", "περιπατήσω", "περιεπάτησα", "-", "-", "-"],
    "φοβεομαι": ["φοβέομαι", "φοβηθήσομαι", "ἐφοβήθην", "-", "-", "-"],
    "καθημαι": ["κάθημαι", "καθήσομαι", "-", "-", "-", "-"],
    "απολλυμι": ["ἀπόλλυμι", "ἀπολῶ", "ἀπώλεσα", "ἀπολώλεκα", "ἀπόλωλα", "ἀπωλέσθην"],
    "πιπτω": ["πίπτω", "πεσοῦμαι", "ἔπεσον", "πέπτωκα", "-", "-"],
    "ακολουθεω": ["ἀκολουθέω", "ἀκολουθήσω", "ἠκολούθησα", "-", "-", "-"],
    "αρχω": ["ἄρχω", "ἄρξω", "ἦρξα", "-", "-", "-"],
    "πληροω": ["πληρόω", "πληρώσω", "ἐπλήρωσα", "πεπλήρωκα", "πεπλήρωμαι", "ἐπληρώθην"],
    "προσερχομαι": ["προσέρχομαι", "προσελεύσομαι", "προσῆλθον", "-", "-", "-"],
    "προσευχομαι": ["προσεύχομαι", "προσεύξομαι", "προσηυξάμην", "-", "-", "-"],
    "αναβαινω": ["ἀναβαίνω", "ἀναβήσομαι", "ἀνέβην", "ἀναβέβηκα", "-", "-"],
    "εκβαλλω": ["ἐκβάλλω", "ἐκβαλῶ", "ἐξέβαλον", "ἐκβέβληκα", "ἐκβέβλημαι", "ἐξεβλήθην"],
    "καταβαινω": ["καταβαίνω", "καταβήσομαι", "κατέβην", "καταβέβηκα", "-", "-"],
    "πεμπω": ["πέμπω", "πέμψω", "ἔπεμψα", "πέπομφα", "πέπεμμαι", "ἐπέμφθην"],
    "υπαγω": ["ὑπάγω", "ὑπάξω", "ὑπῆγον", "-", "-", "-"],
    "ανοιγω": ["ἀνοίγω", "ἀνοίξω", "ἤνοιξα", "ἀνέῳγα", "ἀνέῳγμαι", "ἠνεῴχθην"],
    "βαπτιζω": ["βαπτίζω", "βαπτίσω", "ἐβάπτισα", "βεβάπτικα", "βεβάπτισμαι", "ἐβαπτίσθην"],
    "μαρτυρεω": ["μαρτυρέω", "μαρτυρήσω", "ἐμαρτύρησα", "μεμαρτύρηκα", "μεμαρτύρημαι", "ἐμαρτυρήθην"],
    "αποκτεινω": ["ἀποκτείνω", "ἀποκτενῶ", "ἀπέκτεινα", "-", "-", "-"],
    "χαιρω": ["χαίρω", "χαρήσομαι", "ἐχάρην", "κέχαρα", "-", "-"],
    "πινω": ["πίνω", "πίομαι", "ἔπιον", "πέπωκα", "-", "-"],
    "τηρεω": ["τηρέω", "τηρήσω", "ἐτήρησα", "τετήρηκα", "τετήρημαι", "ἐτηρήθην"],
    "αιτεω": ["αἰτέω", "αἰτήσω", "ᾔτησα", "ᾔτηκα", "-", "ᾐτήθην"],
    "αγω": ["ἄγω", "ἄξω", "ἤγαγον", "ἦχα", "ἦγμαι", "ἤχθην"],
    "απολυω": ["ἀπολύω", "ἀπολύσω", "ἀπέλυσα", "ἀπολέλυκα", "ἀπολέλυμαι", "ἀπελύθην"],
    "φερω": ["φέρω", "οἴσω", "ἤνεγκον", "ἐνήνοχα", "ἐνήνεγμαι", "ἠνέχθην"],
    "φημι": ["φημί", "-", "-", "-", "-", "-"],
    "δοκεω": ["δοκέω", "δόξω", "ἔδοξα", "-", "-", "-"],
    "ερωταω": ["ἐρωτάω", "ἐρωτήσω", "ἠρώτησα", "ἠρώτηκα", "-", "ἠρωτήθην"],
    "δοξαζω": ["δοξάζω", "δοξάσω", "ἐδόξασα", "δεδόξακα", "δεδόξασμαι", "ἐδοξάσθην"],
    "κηρυσσω": ["κηρύσσω", "κηρύξω", "ἐκήρυξα", "κεκήρυχα", "κεκήρυγμαι", "ἐκηρύχθην"],
    "προσκυνεω": ["προσκυνέω", "προσκυνήσω", "προσεκύνησα", "προσκυνήκα", "-", "προσεκυνήθην"],
    "υπαρχω": ["ὑπάρχω", "ὑπάρξω", "ὑπῆρξα", "-", "-", "-"],
    "ασπαζομαι": ["ἀσπάζομαι", "ἀσπάσομαι", "ἠσπασάμην", "-", "-", "-"],
    "συναγω": ["συνάγω", "συνάξω", "συνήγαγον", "συνῆχα", "συνῆγμαι", "συνήχθην"],
    "θεωρεω": ["θεωρέω", "θεωρήσω", "ἐθεώρησα", "τεθεώρηκα", "τεθεώρημαι", "ἐθεωρήθην"],
    "δεχομαι": ["δέχομαι", "δέξομαι", "ἐδεξάμην", "δέδεγμαι", "-", "-"],
    "επερωταω": ["ἐπερωτάω", "ἐπερωτήσω", "ἐπηρώτησα", "-", "-", "-"],
    "κραζω": ["κράζω", "κράξω", "ἔκραξα", "κέκραγα", "-", "-"],
    "ευαγγελιζω": ["εὐαγγελίζω", "εὐαγγελίσω", "εὐηγγέλισα", "εὐηγγέλικα", "εὐηγγέλισμαι", "εὐηγγελίσθην"],
    "πειθω": ["πείθω", "πείσω", "ἔπεισα", "πέποιθα", "πέπεισμαι", "ἐπείσθην"],
    "σπειρω": ["σπείρω", "σπερῶ", "ἔσπειρα", "ἔσπαρκα", "ἔσπαρμαι", "ἐσπάρην"],
    "παραλαμβανω": ["παραλαμβάνω", "παραλήμψομαι", "παρέλαβον", "παρείληφα", "παρείλημμαι", "παρελήμφθην"],
    "αποδιδωμι": ["ἀποδίδωμι", "ἀποδώσω", "ἀπέδωκα", "ἀποδέδωκα", "ἀποδέδομαι", "ἀπεδόθην"],
}


NON_FINITE = {
    "ειμι": {
        "Infinito presente": {"form": "εἶναι", "meaning_it": "essere"},
        "Participio presente attivo": {
            "maschile nominativo singolare": "ὤν",
            "femminile nominativo singolare": "οὖσα",
            "neutro nominativo singolare": "ὄν",
            "meaning_it": "essendo",
        },
    },
    "λεγω": {
        "Infinito presente attivo": {"form": "λέγειν", "meaning_it": "dire"},
        "Infinito aoristo attivo": {"form": "εἰπεῖν", "meaning_it": "dire"},
        "Participio presente attivo": {
            "maschile nominativo singolare": "λέγων",
            "femminile nominativo singolare": "λέγουσα",
            "neutro nominativo singolare": "λέγον",
            "meaning_it": "dicendo",
        },
        "Participio aoristo attivo": {
            "maschile nominativo singolare": "εἰπών",
            "femminile nominativo singolare": "εἰποῦσα",
            "neutro nominativo singolare": "εἰπόν",
            "meaning_it": "avendo detto",
        },
    },
    "γινομαι": {
        "Infinito presente medio": {"form": "γίνεσθαι", "meaning_it": "divenire"},
        "Infinito aoristo medio": {"form": "γενέσθαι", "meaning_it": "divenire"},
        "Participio presente medio": {
            "maschile nominativo singolare": "γινόμενος",
            "femminile nominativo singolare": "γινομένη",
            "neutro nominativo singolare": "γινόμενον",
            "meaning_it": "divenendo",
        },
        "Participio aoristo medio": {
            "maschile nominativo singolare": "γενόμενος",
            "femminile nominativo singolare": "γενομένη",
            "neutro nominativo singolare": "γενόμενον",
            "meaning_it": "divenuto, avendo avuto luogo",
        },
    },
    "ερχομαι": {
        "Infinito presente medio": {"form": "ἔρχεσθαι", "meaning_it": "venire"},
        "Infinito futuro medio": {"form": "ἐλεύσεσθαι", "meaning_it": "venire"},
    },
    "διδωμι": {
        "Infinito presente attivo": {"form": "διδόναι", "meaning_it": "dare"},
        "Infinito aoristo attivo": {"form": "δοῦναι", "meaning_it": "dare"},
    },
    "ιστημι": {
        "Infinito presente attivo": {"form": "ἱστάναι", "meaning_it": "porre, far stare"},
        "Infinito aoristo attivo": {"form": "στῆσαι", "meaning_it": "porre, far stare"},
    },
    "τιθημι": {
        "Infinito presente attivo": {"form": "τιθέναι", "meaning_it": "porre, mettere"},
        "Infinito aoristo attivo": {"form": "θεῖναι", "meaning_it": "porre, mettere"},
    },
    "ευλογεω": {
        "Infinito presente attivo": {"form": "εὐλογεῖν", "meaning_it": "benedire"},
        "Infinito aoristo attivo": {"form": "εὐλογῆσαι", "meaning_it": "benedire"},
    },
    "οιδα": {
        "Infinito perfetto": {"form": "εἰδέναι", "meaning_it": "sapere, conoscere"},
    },
    "αποκρινομαι": {
        "Infinito presente medio": {"form": "ἀποκρίνεσθαι", "meaning_it": "rispondere"},
        "Infinito aoristo passivo deponente": {"form": "ἀποκριθῆναι", "meaning_it": "rispondere"},
    },
    "δυναμαι": {
        "Infinito presente medio": {"form": "δύνασθαι", "meaning_it": "potere"},
    },
    "αφιημι": {
        "Infinito presente attivo": {"form": "ἀφιέναι", "meaning_it": "lasciare, perdonare"},
        "Infinito aoristo attivo": {"form": "ἀφεῖναι", "meaning_it": "lasciare, perdonare"},
    },
    "παραδιδωμι": {
        "Infinito presente attivo": {"form": "παραδιδόναι", "meaning_it": "consegnare"},
        "Infinito aoristo attivo": {"form": "παραδοῦναι", "meaning_it": "consegnare"},
    },
    "ανιστημι": {
        "Infinito presente attivo": {"form": "ἀνιστάναι", "meaning_it": "alzare, far sorgere"},
        "Infinito aoristo attivo": {"form": "ἀναστῆσαι", "meaning_it": "alzare, far sorgere"},
    },
    "εξερχομαι": {
        "Infinito presente medio": {"form": "ἐξέρχεσθαι", "meaning_it": "uscire"},
        "Infinito aoristo attivo": {"form": "ἐξελθεῖν", "meaning_it": "uscire"},
    },
    "εισερχομαι": {
        "Infinito presente medio": {"form": "εἰσέρχεσθαι", "meaning_it": "entrare"},
        "Infinito aoristo attivo": {"form": "εἰσελθεῖν", "meaning_it": "entrare"},
    },
    "απερχομαι": {
        "Infinito presente medio": {"form": "ἀπέρχεσθαι", "meaning_it": "andare via"},
        "Infinito aoristo attivo": {"form": "ἀπελθεῖν", "meaning_it": "andare via"},
    },
    "οραω": {
        "Infinito presente attivo": {"form": "ὁρᾶν", "meaning_it": "vedere"},
        "Infinito aoristo attivo": {"form": "ἰδεῖν", "meaning_it": "vedere"},
    },
    "εχω": {
        "Infinito presente attivo": {"form": "ἔχειν", "meaning_it": "avere"},
        "Infinito aoristo attivo": {"form": "σχεῖν", "meaning_it": "avere"},
    },
    "ποιεω": {
        "Infinito presente attivo": {"form": "ποιεῖν", "meaning_it": "fare"},
        "Infinito aoristo attivo": {"form": "ποιῆσαι", "meaning_it": "fare"},
        "Infinito perfetto attivo": {"form": "πεποιηκέναι", "meaning_it": "avere fatto"},
        "Infinito presente medio/passivo": {"form": "ποιεῖσθαι", "meaning_it": "farsi, essere fatto"},
        "Infinito aoristo passivo": {"form": "ποιηθῆναι", "meaning_it": "essere fatto"},
        "Participio presente attivo": {
            "maschile nominativo singolare": "ποιῶν",
            "femminile nominativo singolare": "ποιοῦσα",
            "neutro nominativo singolare": "ποιοῦν",
            "meaning_it": "facendo",
        },
        "Participio aoristo attivo": {
            "maschile nominativo singolare": "ποιήσας",
            "femminile nominativo singolare": "ποιήσασα",
            "neutro nominativo singolare": "ποιῆσαν",
            "meaning_it": "avendo fatto",
        },
        "Participio presente medio/passivo": {
            "maschile nominativo singolare": "ποιούμενος",
            "femminile nominativo singolare": "ποιουμένη",
            "neutro nominativo singolare": "ποιούμενον",
            "meaning_it": "facendosi, essendo fatto",
        },
        "Participio aoristo passivo": {
            "maschile nominativo singolare": "ποιηθείς",
            "femminile nominativo singolare": "ποιηθεῖσα",
            "neutro nominativo singolare": "ποιηθέν",
            "meaning_it": "essendo stato fatto",
        },
        "Participio perfetto medio/passivo": {
            "maschile nominativo singolare": "πεποιημένος",
            "femminile nominativo singolare": "πεποιημένη",
            "neutro nominativo singolare": "πεποιημένον",
            "meaning_it": "fatto",
        },
    },
    "ακουω": {
        "Infinito presente attivo": {"form": "ἀκούειν", "meaning_it": "udire, ascoltare"},
        "Infinito aoristo attivo": {"form": "ἀκοῦσαι", "meaning_it": "udire, ascoltare"},
    },
    "λαλεω": {
        "Infinito presente attivo": {"form": "λαλεῖν", "meaning_it": "parlare"},
        "Infinito aoristo attivo": {"form": "λαλῆσαι", "meaning_it": "parlare"},
        "Participio presente attivo": {
            "maschile nominativo singolare": "λαλῶν",
            "femminile nominativo singolare": "λαλοῦσα",
            "neutro nominativo singolare": "λαλοῦν",
            "meaning_it": "parlando",
        },
        "Participio aoristo attivo": {
            "maschile nominativo singolare": "λαλήσας",
            "femminile nominativo singolare": "λαλήσασα",
            "neutro nominativo singolare": "λαλῆσαν",
            "meaning_it": "avendo parlato",
        },
    },
    "λαμβανω": {
        "Infinito presente attivo": {"form": "λαμβάνειν", "meaning_it": "prendere, ricevere"},
        "Infinito aoristo attivo": {"form": "λαβεῖν", "meaning_it": "prendere, ricevere"},
    },
    "πιστευω": {
        "Infinito presente attivo": {"form": "πιστεύειν", "meaning_it": "credere"},
        "Infinito aoristo attivo": {"form": "πιστεῦσαι", "meaning_it": "credere"},
        "Infinito perfetto attivo": {"form": "πεπιστευκέναι", "meaning_it": "avere creduto"},
        "Infinito aoristo passivo": {"form": "πιστευθῆναι", "meaning_it": "essere creduto, essere affidato"},
        "Participio presente attivo": {
            "maschile nominativo singolare": "πιστεύων",
            "femminile nominativo singolare": "πιστεύουσα",
            "neutro nominativo singolare": "πιστεῦον",
            "meaning_it": "credendo",
        },
        "Participio aoristo attivo": {
            "maschile nominativo singolare": "πιστεύσας",
            "femminile nominativo singolare": "πιστεύσασα",
            "neutro nominativo singolare": "πιστεῦσαν",
            "meaning_it": "avendo creduto",
        },
        "Participio aoristo passivo": {
            "maschile nominativo singolare": "πιστευθείς",
            "femminile nominativo singolare": "πιστευθεῖσα",
            "neutro nominativo singolare": "πιστευθέν",
            "meaning_it": "essendo stato creduto, affidato",
        },
        "Participio perfetto attivo": {
            "maschile nominativo singolare": "πεπιστευκώς",
            "femminile nominativo singolare": "πεπιστευκυῖα",
            "neutro nominativo singolare": "πεπιστευκός",
            "meaning_it": "avendo creduto stabilmente",
        },
    },
    "γινωσκω": {
        "Infinito presente attivo": {"form": "γινώσκειν", "meaning_it": "conoscere"},
        "Infinito aoristo attivo": {"form": "γνῶναι", "meaning_it": "conoscere"},
    },
    "θελω": {
        "Infinito presente attivo": {"form": "θέλειν", "meaning_it": "volere"},
        "Infinito aoristo attivo": {"form": "θελῆσαι", "meaning_it": "volere"},
    },
    "γραφω": {
        "Infinito presente attivo": {"form": "γράφειν", "meaning_it": "scrivere"},
        "Infinito aoristo attivo": {"form": "γράψαι", "meaning_it": "scrivere"},
    },
    "ευρισκω": {
        "Infinito presente attivo": {"form": "εὑρίσκειν", "meaning_it": "trovare"},
        "Infinito aoristo attivo": {"form": "εὑρεῖν", "meaning_it": "trovare"},
    },
    "εσθιω": {
        "Infinito presente attivo": {"form": "ἐσθίειν", "meaning_it": "mangiare"},
        "Infinito aoristo attivo": {"form": "φαγεῖν", "meaning_it": "mangiare"},
    },
    "πορευομαι": {
        "Infinito presente medio": {"form": "πορεύεσθαι", "meaning_it": "andare, mettersi in cammino"},
        "Infinito futuro medio": {"form": "πορεύσεσθαι", "meaning_it": "andare, mettersi in cammino"},
    },
    "καλεω": {
        "Infinito presente attivo": {"form": "καλεῖν", "meaning_it": "chiamare"},
        "Infinito aoristo attivo": {"form": "καλέσαι", "meaning_it": "chiamare"},
        "Participio presente attivo": {
            "maschile nominativo singolare": "καλῶν",
            "femminile nominativo singolare": "καλοῦσα",
            "neutro nominativo singolare": "καλοῦν",
            "meaning_it": "chiamando",
        },
        "Participio aoristo attivo": {
            "maschile nominativo singolare": "καλέσας",
            "femminile nominativo singolare": "καλέσασα",
            "neutro nominativo singolare": "καλέσαν",
            "meaning_it": "avendo chiamato",
        },
    },
    "αγαπαω": {
        "Infinito presente attivo": {"form": "ἀγαπᾶν", "meaning_it": "amare"},
        "Infinito aoristo attivo": {"form": "ἀγαπῆσαι", "meaning_it": "amare"},
        "Participio presente attivo": {
            "maschile nominativo singolare": "ἀγαπῶν",
            "femminile nominativo singolare": "ἀγαπῶσα",
            "neutro nominativo singolare": "ἀγαπῶν",
            "meaning_it": "amando",
        },
        "Participio aoristo attivo": {
            "maschile nominativo singolare": "ἀγαπήσας",
            "femminile nominativo singolare": "ἀγαπήσασα",
            "neutro nominativo singolare": "ἀγαπῆσαν",
            "meaning_it": "avendo amato",
        },
    },
    "εγειρω": {
        "Infinito presente attivo": {"form": "ἐγείρειν", "meaning_it": "svegliare, risuscitare"},
        "Infinito aoristo attivo": {"form": "ἐγεῖραι", "meaning_it": "svegliare, risuscitare"},
    },
    "βλεπω": {
        "Infinito presente attivo": {"form": "βλέπειν", "meaning_it": "guardare, vedere"},
    },
    "αποστελλω": {
        "Infinito presente attivo": {"form": "ἀποστέλλειν", "meaning_it": "mandare"},
        "Infinito aoristo attivo": {"form": "ἀποστεῖλαι", "meaning_it": "mandare"},
    },
    "βαλλω": {
        "Infinito presente attivo": {"form": "βάλλειν", "meaning_it": "gettare"},
        "Infinito aoristo attivo": {"form": "βαλεῖν", "meaning_it": "gettare"},
    },
    "μενω": {
        "Infinito presente attivo": {"form": "μένειν", "meaning_it": "rimanere"},
        "Infinito aoristo attivo": {"form": "μεῖναι", "meaning_it": "rimanere"},
    },
    "ζητεω": {
        "Infinito presente attivo": {"form": "ζητεῖν", "meaning_it": "cercare"},
        "Infinito aoristo attivo": {"form": "ζητῆσαι", "meaning_it": "cercare"},
        "Participio presente attivo": {
            "maschile nominativo singolare": "ζητῶν",
            "femminile nominativo singolare": "ζητοῦσα",
            "neutro nominativo singolare": "ζητοῦν",
            "meaning_it": "cercando",
        },
        "Participio aoristo attivo": {
            "maschile nominativo singolare": "ζητήσας",
            "femminile nominativo singolare": "ζητήσασα",
            "neutro nominativo singolare": "ζητῆσαν",
            "meaning_it": "avendo cercato",
        },
    },
    "κρινω": {
        "Infinito presente attivo": {"form": "κρίνειν", "meaning_it": "giudicare"},
        "Infinito aoristo attivo": {"form": "κρῖναι", "meaning_it": "giudicare"},
    },
    "σωζω": {
        "Infinito presente attivo": {"form": "σῴζειν", "meaning_it": "salvare"},
        "Infinito aoristo attivo": {"form": "σῶσαι", "meaning_it": "salvare"},
    },
    "διδασκω": {
        "Infinito presente attivo": {"form": "διδάσκειν", "meaning_it": "insegnare"},
        "Infinito aoristo attivo": {"form": "διδάξαι", "meaning_it": "insegnare"},
    },
    "δεω": {
        "Infinito presente attivo": {"form": "δεῖν", "meaning_it": "legare"},
        "Infinito aoristo attivo": {"form": "δῆσαι", "meaning_it": "legare"},
    },
    "ζαω": {
        "Infinito presente attivo": {"form": "ζῆν", "meaning_it": "vivere"},
    },
    "αποθνῄσκω": {
        "Infinito presente attivo": {"form": "ἀποθνῄσκειν", "meaning_it": "morire"},
        "Infinito aoristo attivo": {"form": "ἀποθανεῖν", "meaning_it": "morire"},
    },
    "μελλω": {
        "Infinito presente attivo": {"form": "μέλλειν", "meaning_it": "stare per, essere sul punto di"},
    },
    "παρακαλεω": {
        "Infinito presente attivo": {"form": "παρακαλεῖν", "meaning_it": "esortare, incoraggiare"},
        "Infinito aoristo attivo": {"form": "παρακαλέσαι", "meaning_it": "esortare, incoraggiare"},
    },
    "αιρω": {
        "Infinito presente attivo": {"form": "αἴρειν", "meaning_it": "alzare, togliere"},
        "Infinito aoristo attivo": {"form": "ἆραι", "meaning_it": "alzare, togliere"},
    },
    "γενναω": {
        "Infinito presente attivo": {"form": "γεννᾶν", "meaning_it": "generare"},
        "Infinito aoristo attivo": {"form": "γεννῆσαι", "meaning_it": "generare"},
    },
    "περιπατεω": {
        "Infinito presente attivo": {"form": "περιπατεῖν", "meaning_it": "camminare"},
    },
    "φοβεομαι": {
        "Infinito presente medio": {"form": "φοβεῖσθαι", "meaning_it": "temere"},
    },
    "καθημαι": {
        "Infinito presente medio": {"form": "καθῆσθαι", "meaning_it": "sedere, stare seduto"},
    },
    "απολλυμι": {
        "Infinito presente attivo": {"form": "ἀπολλύναι", "meaning_it": "distruggere, perire"},
        "Infinito aoristo attivo": {"form": "ἀπολέσαι", "meaning_it": "distruggere, perire"},
    },
    "πιπτω": {
        "Infinito presente attivo": {"form": "πίπτειν", "meaning_it": "cadere"},
        "Infinito aoristo attivo": {"form": "πεσεῖν", "meaning_it": "cadere"},
    },
    "ακολουθεω": {
        "Infinito presente attivo": {"form": "ἀκολουθεῖν", "meaning_it": "seguire"},
    },
    "αρχω": {
        "Infinito presente attivo": {"form": "ἄρχειν", "meaning_it": "cominciare, governare"},
    },
    "πληροω": {
        "Infinito presente attivo": {"form": "πληροῦν", "meaning_it": "compiere, riempire"},
        "Infinito aoristo attivo": {"form": "πληρῶσαι", "meaning_it": "compiere, riempire"},
        "Infinito perfetto attivo": {"form": "πεπληρωκέναι", "meaning_it": "avere compiuto, avere riempito"},
        "Infinito presente medio/passivo": {"form": "πληροῦσθαι", "meaning_it": "essere compiuto, essere riempito"},
        "Infinito aoristo passivo": {"form": "πληρωθῆναι", "meaning_it": "essere compiuto, essere riempito"},
        "Participio presente attivo": {
            "maschile nominativo singolare": "πληρῶν",
            "femminile nominativo singolare": "πληροῦσα",
            "neutro nominativo singolare": "πληροῦν",
            "meaning_it": "compiendo, riempiendo",
        },
        "Participio aoristo attivo": {
            "maschile nominativo singolare": "πληρώσας",
            "femminile nominativo singolare": "πληρώσασα",
            "neutro nominativo singolare": "πληρῶσαν",
            "meaning_it": "avendo compiuto, avendo riempito",
        },
        "Participio aoristo passivo": {
            "maschile nominativo singolare": "πληρωθείς",
            "femminile nominativo singolare": "πληρωθεῖσα",
            "neutro nominativo singolare": "πληρωθέν",
            "meaning_it": "essendo stato compiuto, essendo stato riempito",
        },
        "Participio perfetto medio/passivo": {
            "maschile nominativo singolare": "πεπληρωμένος",
            "femminile nominativo singolare": "πεπληρωμένη",
            "neutro nominativo singolare": "πεπληρωμένον",
            "meaning_it": "compiuto, riempito",
        },
    },
    "προσερχομαι": {
        "Infinito presente medio": {"form": "προσέρχεσθαι", "meaning_it": "avvicinarsi, venire a"},
        "Infinito aoristo attivo": {"form": "προσελθεῖν", "meaning_it": "avvicinarsi, venire a"},
    },
    "προσευχομαι": {
        "Infinito presente medio": {"form": "προσεύχεσθαι", "meaning_it": "pregare"},
        "Infinito aoristo medio": {"form": "προσεύξασθαι", "meaning_it": "pregare"},
    },
    "αναβαινω": {
        "Infinito presente attivo": {"form": "ἀναβαίνειν", "meaning_it": "salire"},
        "Infinito aoristo attivo": {"form": "ἀναβῆναι", "meaning_it": "salire"},
    },
    "εκβαλλω": {
        "Infinito presente attivo": {"form": "ἐκβάλλειν", "meaning_it": "scacciare, gettare fuori"},
        "Infinito aoristo attivo": {"form": "ἐκβαλεῖν", "meaning_it": "scacciare, gettare fuori"},
    },
    "καταβαινω": {
        "Infinito presente attivo": {"form": "καταβαίνειν", "meaning_it": "scendere"},
        "Infinito aoristo attivo": {"form": "καταβῆναι", "meaning_it": "scendere"},
    },
    "πεμπω": {
        "Infinito presente attivo": {"form": "πέμπειν", "meaning_it": "mandare"},
        "Infinito aoristo attivo": {"form": "πέμψαι", "meaning_it": "mandare"},
    },
    "υπαγω": {
        "Infinito presente attivo": {"form": "ὑπάγειν", "meaning_it": "andare via"},
    },
    "ανοιγω": {
        "Infinito presente attivo": {"form": "ἀνοίγειν", "meaning_it": "aprire"},
        "Infinito aoristo attivo": {"form": "ἀνοῖξαι", "meaning_it": "aprire"},
    },
    "βαπτιζω": {
        "Infinito presente attivo": {"form": "βαπτίζειν", "meaning_it": "battezzare"},
        "Infinito aoristo attivo": {"form": "βαπτίσαι", "meaning_it": "battezzare"},
    },
    "μαρτυρεω": {
        "Infinito presente attivo": {"form": "μαρτυρεῖν", "meaning_it": "testimoniare"},
        "Infinito aoristo attivo": {"form": "μαρτυρῆσαι", "meaning_it": "testimoniare"},
    },
    "αποκτεινω": {
        "Infinito presente attivo": {"form": "ἀποκτείνειν", "meaning_it": "uccidere"},
        "Infinito aoristo attivo": {"form": "ἀποκτεῖναι", "meaning_it": "uccidere"},
    },
    "χαιρω": {
        "Infinito presente attivo": {"form": "χαίρειν", "meaning_it": "rallegrarsi, gioire"},
    },
    "πινω": {
        "Infinito presente attivo": {"form": "πίνειν", "meaning_it": "bere"},
        "Infinito aoristo attivo": {"form": "πιεῖν", "meaning_it": "bere"},
    },
    "τηρεω": {
        "Infinito presente attivo": {"form": "τηρεῖν", "meaning_it": "custodire, osservare"},
        "Infinito aoristo attivo": {"form": "τηρῆσαι", "meaning_it": "custodire, osservare"},
    },
    "αιτεω": {
        "Infinito presente attivo": {"form": "αἰτεῖν", "meaning_it": "chiedere"},
        "Infinito aoristo attivo": {"form": "αἰτῆσαι", "meaning_it": "chiedere"},
    },
    "αγω": {
        "Infinito presente attivo": {"form": "ἄγειν", "meaning_it": "condurre"},
        "Infinito aoristo attivo": {"form": "ἀγαγεῖν", "meaning_it": "condurre"},
    },
    "απολυω": {
        "Infinito presente attivo": {"form": "ἀπολύειν", "meaning_it": "mandare via, sciogliere"},
        "Infinito aoristo attivo": {"form": "ἀπολῦσαι", "meaning_it": "mandare via, sciogliere"},
    },
    "φερω": {
        "Infinito presente attivo": {"form": "φέρειν", "meaning_it": "portare"},
        "Infinito aoristo attivo": {"form": "ἐνεγκεῖν", "meaning_it": "portare"},
    },
    "φημι": {
        "Infinito presente attivo": {"form": "φάναι", "meaning_it": "dire, affermare"},
    },
    "δοκεω": {
        "Infinito presente attivo": {"form": "δοκεῖν", "meaning_it": "sembrare, parere"},
    },
    "ερωταω": {
        "Infinito presente attivo": {"form": "ἐρωτᾶν", "meaning_it": "chiedere, domandare"},
        "Infinito aoristo attivo": {"form": "ἐρωτῆσαι", "meaning_it": "chiedere, domandare"},
    },
    "δοξαζω": {
        "Infinito presente attivo": {"form": "δοξάζειν", "meaning_it": "glorificare"},
        "Infinito aoristo attivo": {"form": "δοξάσαι", "meaning_it": "glorificare"},
    },
    "κηρυσσω": {
        "Infinito presente attivo": {"form": "κηρύσσειν", "meaning_it": "proclamare, predicare"},
        "Infinito aoristo attivo": {"form": "κηρῦξαι", "meaning_it": "proclamare, predicare"},
    },
    "προσκυνεω": {
        "Infinito presente attivo": {"form": "προσκυνεῖν", "meaning_it": "adorare, prosternarsi"},
        "Infinito aoristo attivo": {"form": "προσκυνῆσαι", "meaning_it": "adorare, prosternarsi"},
    },
    "υπαρχω": {
        "Infinito presente attivo": {"form": "ὑπάρχειν", "meaning_it": "essere, trovarsi, appartenere"},
    },
    "ασπαζομαι": {
        "Infinito presente medio": {"form": "ἀσπάζεσθαι", "meaning_it": "salutare"},
    },
    "συναγω": {
        "Infinito presente attivo": {"form": "συνάγειν", "meaning_it": "radunare"},
        "Infinito aoristo attivo": {"form": "συναγαγεῖν", "meaning_it": "radunare"},
    },
    "θεωρεω": {
        "Infinito presente attivo": {"form": "θεωρεῖν", "meaning_it": "osservare, contemplare"},
        "Infinito aoristo attivo": {"form": "θεωρῆσαι", "meaning_it": "osservare, contemplare"},
    },
    "δεχομαι": {
        "Infinito presente medio": {"form": "δέχεσθαι", "meaning_it": "ricevere, accogliere"},
        "Infinito aoristo medio": {"form": "δέξασθαι", "meaning_it": "ricevere, accogliere"},
    },
    "επερωταω": {
        "Infinito presente attivo": {"form": "ἐπερωτᾶν", "meaning_it": "interrogare, chiedere"},
    },
    "κραζω": {
        "Infinito presente attivo": {"form": "κράζειν", "meaning_it": "gridare"},
    },
    "ευαγγελιζω": {
        "Infinito presente attivo": {"form": "εὐαγγελίζειν", "meaning_it": "annunciare la buona notizia, evangelizzare"},
        "Infinito aoristo attivo": {"form": "εὐαγγελίσαι", "meaning_it": "annunciare la buona notizia, evangelizzare"},
    },
    "πειθω": {
        "Infinito presente attivo": {"form": "πείθειν", "meaning_it": "persuadere, convincere"},
        "Infinito aoristo attivo": {"form": "πεῖσαι", "meaning_it": "persuadere, convincere"},
    },
    "σπειρω": {
        "Infinito presente attivo": {"form": "σπείρειν", "meaning_it": "seminare"},
        "Infinito aoristo attivo": {"form": "σπεῖραι", "meaning_it": "seminare"},
    },
    "παραλαμβανω": {
        "Infinito presente attivo": {"form": "παραλαμβάνειν", "meaning_it": "prendere con sé, ricevere"},
        "Infinito aoristo attivo": {"form": "παραλαβεῖν", "meaning_it": "prendere con sé, ricevere"},
    },
    "αποδιδωμι": {
        "Infinito presente attivo": {"form": "ἀποδιδόναι", "meaning_it": "restituire, rendere"},
        "Infinito aoristo attivo": {"form": "ἀποδοῦναι", "meaning_it": "restituire, rendere"},
    },
}

FINITE_COVERAGE_TEMPLATE = {
    "indicative": {
        "present": False,
        "imperfect": False,
        "future": False,
        "aorist": False,
        "perfect": False,
        "pluperfect": False,
    },
    "subjunctive": {
        "present": False,
        "aorist": False,
        "perfect": False,
    },
    "optative": {
        "present": False,
        "aorist": False,
    },
    "imperative": {
        "present": False,
        "aorist": False,
        "perfect": False,
    },
}

NON_FINITE_COVERAGE_TEMPLATE = {
    "infinitive_present": False,
    "infinitive_aorist": False,
    "infinitive_perfect": False,
    "participle_present": False,
    "participle_aorist": False,
    "participle_perfect": False,
}

MINIMUM_PROFILE = {
    "finite": {
        "indicative": ["present", "imperfect", "future", "aorist", "perfect"],
        "subjunctive": ["present", "aorist"],
        "imperative": ["present", "aorist"],
    },
    "non_finite": [
        "infinitive_present",
        "infinitive_aorist",
        "participle_present",
        "participle_aorist",
    ],
}


def blank_coverage():
    return {
        "finite": json.loads(json.dumps(FINITE_COVERAGE_TEMPLATE)),
        "non_finite": dict(NON_FINITE_COVERAGE_TEMPLATE),
    }


def update_finite_coverage(coverage: dict[str, object], section_name: str) -> None:
    lowered = section_name.lower()
    mood = None
    if "indicativo" in lowered:
        mood = "indicative"
    elif "congiuntivo" in lowered:
        mood = "subjunctive"
    elif "ottativo" in lowered:
        mood = "optative"
    elif "imperativo" in lowered:
        mood = "imperative"
    if not mood:
        return

    tense = None
    if "presente" in lowered:
        tense = "present"
    elif "imperfetto" in lowered:
        tense = "imperfect"
    elif "futuro" in lowered:
        tense = "future"
    elif "aoristo" in lowered:
        tense = "aorist"
    elif "perfetto" in lowered and "piuccheperfetto" not in lowered:
        tense = "perfect"
    elif "piuccheperfetto" in lowered:
        tense = "pluperfect"
    if tense and tense in coverage["finite"][mood]:
        coverage["finite"][mood][tense] = True


def update_non_finite_coverage(coverage: dict[str, object], non_finite_entry: dict[str, object]) -> None:
    for section_name in non_finite_entry:
        lowered = section_name.lower()
        if "infinito" in lowered and "presente" in lowered:
            coverage["non_finite"]["infinitive_present"] = True
        if "infinito" in lowered and "aoristo" in lowered:
            coverage["non_finite"]["infinitive_aorist"] = True
        if "infinito" in lowered and "perfetto" in lowered:
            coverage["non_finite"]["infinitive_perfect"] = True
        if "participio" in lowered and "presente" in lowered:
            coverage["non_finite"]["participle_present"] = True
        if "participio" in lowered and "aoristo" in lowered:
            coverage["non_finite"]["participle_aorist"] = True
        if "participio" in lowered and "perfetto" in lowered:
            coverage["non_finite"]["participle_perfect"] = True


def evaluate_minimum_profile(coverage: dict[str, object]) -> tuple[bool, list[str]]:
    missing = []
    for mood, tenses in MINIMUM_PROFILE["finite"].items():
        for tense in tenses:
            if not coverage["finite"][mood][tense]:
                missing.append(f"finite.{mood}.{tense}")
    for item in MINIMUM_PROFILE["non_finite"]:
        if not coverage["non_finite"][item]:
            missing.append(f"non_finite.{item}")
    return (len(missing) == 0, missing)


def load_json(path: Path):
    return json.loads(path.read_text())


def main() -> None:
    verb_paradigms = load_json(DATA_DIR / "verb_paradigms.json")
    lexicon = load_json(DATA_DIR / "lexicon.json")
    lexicon_map = {entry["lemma"]: entry for entry in lexicon}

    verb_lemmas = {}
    verb_metadata = {}
    verb_non_finite = {}

    for lemma_key, entry in verb_paradigms.items():
        lex_entry = lexicon_map.get(lemma_key, {})
        verb_lemmas[lemma_key] = {
            "lemma": entry.get("lemma", lex_entry.get("greek", lemma_key)),
            "normalized_lemma": lemma_key,
            "greek": entry.get("lemma", lex_entry.get("greek", lemma_key)),
            "pronunciation": lex_entry.get("greek", entry.get("lemma", lemma_key)),
            "meaning_it": entry.get("meaning_it") or lex_entry.get("glossIt", ""),
            "class": entry.get("class", "pending"),
            "principal_parts": PRINCIPAL_PARTS.get(lemma_key, []),
            "notes": entry.get("notes", ""),
        }
        coverage = blank_coverage()
        for section_name in entry.get("paradigms", {}):
            update_finite_coverage(coverage, section_name)
        if lemma_key in NON_FINITE:
            verb_non_finite[lemma_key] = NON_FINITE[lemma_key]
            update_non_finite_coverage(coverage, NON_FINITE[lemma_key])
        minimum_complete, missing_sections = evaluate_minimum_profile(coverage)
        verb_metadata[lemma_key] = {
            "occurrences": entry.get("occurrences", 0),
            "status": entry.get("status", "pending"),
            "has_paradigms": bool(entry.get("paradigms")),
            "is_irregular": "irregolare" in (entry.get("class", "").lower()),
            "is_deponent": "deponente" in (entry.get("class", "").lower()),
            "is_mi_verb": "-μι" in entry.get("class", ""),
            "coverage": coverage,
            "completion": {
                "minimum_profile_name": "core_full_verb",
                "meets_minimum_profile": minimum_complete,
                "missing_sections": missing_sections,
            },
        }

    (DATA_DIR / "verb_lemmas.json").write_text(
        json.dumps(verb_lemmas, ensure_ascii=False, indent=2) + "\n"
    )
    (DATA_DIR / "verb_metadata.json").write_text(
        json.dumps(verb_metadata, ensure_ascii=False, indent=2) + "\n"
    )
    (DATA_DIR / "verb_non_finite.json").write_text(
        json.dumps(verb_non_finite, ensure_ascii=False, indent=2) + "\n"
    )
    SCHEMA_PATH.write_text(
        json.dumps(load_json(SCHEMA_PATH), ensure_ascii=False, indent=2) + "\n"
    )

    print(
        f"Built verb dataset: {len(verb_lemmas)} lemmas, "
        f"{len(verb_non_finite)} non-finite bundles."
    )


if __name__ == "__main__":
    main()
