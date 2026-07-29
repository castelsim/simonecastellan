#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Controlli sul sito prima di pubblicare.  Uso:  python3 tools/verifica.py

Esiste per impedire il ritorno di problemi già capitati davvero:
  1. il prompt che ricresce finché il visitatore si vede comparire davanti le
     istruzioni interne del sito (era arrivato a 5.000 caratteri);
  2. il profilo incorporato dentro la home invece che in /profilo e llms.txt;
  3. /profilo che torna a essere una pagina senza un solo link in entrata;
  4. Perplexity riacceso: con questo meccanismo porta a una pagina di errore;
  5. sitemap che elenca pagine inesistenti o dimentica quelle pubblicate;
  6. JSON-LD rotto o hreflang che non si rimandano fra loro.

Esce con codice 1 se un controllo fallisce.
"""
import json
import os
import re
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ERRORI, AVVISI = [], []

# encodeURIComponent di JavaScript: non codifica  A-Z a-z 0-9 - _ . ! ~ * ' ( )
SAFE_JS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()"

# Il prompt finisce SOTTO GLI OCCHI di chi arriva, nella casella dell'assistente:
# deve restare una riga leggibile in un secondo.
MAX_PROMPT = 300

# Frasi che, lette da un estraneo nel primo secondo, fanno sembrare il sito un trucco.
# Il loro posto è /profilo, dove sono istruzioni dichiarate — non dentro l'URL.
FRASI_DA_NON_METTERE_NEL_PROMPT = ("ignora l'errore", "non dire mai")


def leggi(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def errore(msg):
    ERRORI.append(msg)


def controlla_prompt_breve(home):
    # in index.html il prompt è una stringa concatenata alla versione:  "…?v=" + V;
    m = re.search(r'var PROMPT = "([^"]*)"\s*\+\s*V;', home)
    v = re.search(r'var V = "(\d+)"', home)
    if not m:
        return errore("non trovo «var PROMPT» in index.html")
    testo = m.group(1) + (v.group(1) if v else "")
    n_url = len("https://chatgpt.com/?q=") + len(urllib.parse.quote(testo, safe=SAFE_JS))
    if len(testo) > MAX_PROMPT:
        errore(f"il prompt è lungo {len(testo)} caratteri (massimo {MAX_PROMPT}): il visitatore "
               f"se lo vede comparire davanti, deve restare una riga")
    else:
        print(f"  prompt: {len(testo)} caratteri → URL di {n_url}")
    for frase in FRASI_DA_NON_METTERE_NEL_PROMPT:
        if frase in testo.lower():
            errore(f"il prompt contiene «{frase}»: istruzioni del genere, lette da chi arriva, "
                   f"fanno sembrare il sito un trucco. Vanno in /profilo, non nell'URL.")


def controlla_profilo_non_incorporato(home):
    """La home passa un link; il contenuto vive in /profilo e llms.txt."""
    if "PPLX_URL" in home or "perplexity.ai/search?q=%" in home:
        errore("in index.html è tornata una copia incorporata del profilo: "
               "la home deve passare solo il link a /profilo")
    if len(home) > 40000:
        errore(f"index.html è cresciuto a {len(home)} byte: probabile ritorno di contenuto "
               f"che dovrebbe stare in /profilo o in llms.txt")


def controlla_perplexity_spento(home):
    """Con il profilo nell'URL Perplexity risponde «414 Request-URI Too Large» (verificato il
    29/07/2026, URL di 25.393 caratteri); con l'URL corto non aprirebbe comunque il link."""
    m = re.search(r"AIS_VISIBLE = AIS\.filter\((.*?)\);", home, re.S)
    if m and "Perplexity" in m.group(1):
        errore("Perplexity è fra i pulsanti visibili: porta a una pagina di errore 414")


def controlla_home_porta_al_profilo(home):
    """Senza JavaScript la home deve comunque portare al profilo: è il solo appiglio per i
    crawler e per le AI che non eseguono script. La home resta minimale per scelta."""
    corpo = home.split("<body>", 1)[-1]
    if "<h1" not in corpo:
        errore("la home non ha un <h1>")
    if 'href="/profilo/"' not in corpo:
        errore("la home non ha un link statico a /profilo/ (la pagina tornerebbe orfana)")


def controlla_collegamenti_interni():
    attese = {
        "/profilo/": ["index.html", "cv/index.html", "en/profile/index.html"],
        "/cv/": ["index.html", "profilo/index.html", "en/profile/index.html"],
        "/en/profile/": ["index.html", "profilo/index.html", "cv/index.html"],
        "/privacy/": ["index.html", "profilo/index.html", "cv/index.html"],
    }
    for meta, sorgenti in attese.items():
        if not any(f'href="{meta}"' in leggi(s) for s in sorgenti):
            errore(f"nessuna pagina rimanda a {meta}")


def controlla_firma_contatto():
    """La firma nel messaggio WhatsApp è l'unico modo per sapere quali contatti nascono qui."""
    firma = "dal profilo AI di simonecastellan.com"
    for f in ("profilo/index.html", "llms.txt", "en/profile/index.html"):
        if firma not in leggi(f):
            errore(f"{f} non chiede più di firmare il messaggio con «{firma}»: "
                   f"senza quella riga non si distingue un contatto arrivato dal sistema")


def controlla_sitemap():
    xml = leggi("sitemap.xml")
    urls = re.findall(r"<loc>https://simonecastellan\.com/(.*?)</loc>", xml)
    for u in urls:
        percorso = os.path.join(ROOT, u, "index.html") if u else os.path.join(ROOT, "index.html")
        if not os.path.exists(percorso):
            errore(f"la sitemap elenca /{u} ma il file non esiste")
    pubblicate = {"", "profilo/", "cv/", "en/profile/", "privacy/", "BDG2029/"}
    mancanti = pubblicate - set(urls)
    if mancanti:
        errore("pagine pubblicate ma assenti dalla sitemap: " + ", ".join(sorted(mancanti)))
    print(f"  sitemap: {len(urls)} indirizzi, tutti esistenti")


def controlla_json_ld():
    for f in ("index.html", "profilo/index.html", "cv/index.html", "en/profile/index.html"):
        for blocco in re.findall(r'<script type="application/ld\+json">(.*?)</script>', leggi(f), re.S):
            try:
                json.loads(blocco)
            except json.JSONDecodeError as e:
                errore(f"JSON-LD non valido in {f}: {e}")
    print("  JSON-LD: valido su tutte le pagine")


def controlla_hreflang():
    coppie = [("profilo/index.html", "https://simonecastellan.com/en/profile/"),
              ("en/profile/index.html", "https://simonecastellan.com/profilo/")]
    for f, atteso in coppie:
        if atteso not in leggi(f):
            errore(f"{f} non dichiara l'hreflang verso {atteso}")


def controlla_versione_profilo(home):
    """Il ?v= nel prompt serve a bustare la cache delle AI quando il profilo cambia."""
    v = re.search(r'var V = "(\d+)"', home)
    if not v:
        return errore("manca «var V» in index.html: il prompt non potrebbe bustare la cache")
    if f"?v=" not in home:
        errore(f"la versione V={v.group(1)} non compare nel prompt")


def main():
    print("Verifica del sito…")
    home = leggi("index.html")
    controlla_prompt_breve(home)
    controlla_profilo_non_incorporato(home)
    controlla_perplexity_spento(home)
    controlla_home_porta_al_profilo(home)
    controlla_versione_profilo(home)
    controlla_collegamenti_interni()
    controlla_firma_contatto()
    controlla_sitemap()
    controlla_json_ld()
    controlla_hreflang()

    for a in AVVISI:
        print("  AVVISO: " + a)
    if ERRORI:
        print("\nFALLITO:")
        for e in ERRORI:
            print("  - " + e)
        return 1
    print("\nTutto a posto.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
