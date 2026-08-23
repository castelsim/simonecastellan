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
  6. JSON-LD rotto o hreflang che non si rimandano fra loro;
  7. uno strumento che esce dalla voce comune: titolo che non dice cosa fa, sottotitolo
     sparito, descrizione che Google taglia a metà, piede senza la via di ritorno.

Esce con codice 1 se un controllo fallisce.
"""
import html
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

# Gli strumenti, in un elenco solo: qui sotto servono tre volte (link in entrata,
# sitemap, intestazioni) e tenerne tre copie significa dimenticarne una.
TOOL = ["tara-impianto", "audio-mp3", "bpm", "tonalita", "qrcode", "posso-pubblicarlo", "fotogramma",
        "comprimi-immagini", "comprimi-pdf", "comprimi-video",
        "rumore-rosa", "ritardo-diffusori", "link-utm", "conta-caratteri", "link-whatsapp",
        "da-comunicato-a-post", "semplifica-testo", "alt-text", "trasporta-accordi"]

# Strumenti tolti dalla vetrina ma ancora vivi: la pagina funziona per chi ha il
# link, non compare in /tools/ né nella sitemap né nelle ricerche.  Restano qui
# perché la voce comune vale anche per loro — e perché se una cella tornasse in
# vetrina per distrazione, qualcuno deve accorgersene.
NASCOSTI = ["metriche-social", "bando-in-chiaro"]

# Google mostra ~155-160 caratteri di descrizione: oltre, taglia a metà frase.
MAX_DESCRIZIONE = 160

# E ~60 di titolo. Questo controllo mancava, e il 13/08/2026 due strumenti erano
# già oltre da giorni: «Posso pubblicarlo?» a 63 e «Semplifica un testo» a 64.
# Il titolo si tronca DALLA FINE, cioè proprio dove è scritto cosa fa lo
# strumento — resta il nome, che da solo non convince nessuno a entrare.
MAX_TITOLO = 60


def leggi(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def errore(msg):
    ERRORI.append(msg)


def controlla_prompt_breve(home):
    """Il prompt è scritto su più righe, concatenato con la versione del profilo:

        var PROMPT = "Apri …?v=" + V + " e segui …" + " Se non puoi …";

    Prima si cercava tutto su una riga sola. Dal 15/08/2026 il prompt ha tre
    strade (aprire, cercare, dirlo) e su una riga sarebbe illeggibile nel
    sorgente: si prende l'espressione intera fino al punto e virgola e si
    rimettono insieme i pezzi.
    """
    m = re.search(r"var PROMPT =(.*?);\s*$", home, re.S | re.M)
    v = re.search(r'var V = "(\d+)"', home)
    if not m:
        return errore("non trovo «var PROMPT» in index.html")
    # i pezzi fra virgolette, più la versione dove compare « + V + »
    espressione = m.group(1)
    testo = ""
    for pezzo in re.finditer(r'"([^"]*)"|(\+\s*V\s*\+?)', espressione):
        if pezzo.group(1) is not None:
            testo += pezzo.group(1)
        elif v:
            testo += v.group(1)
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

    # Il prompt deve reggere anche quando l'assistente NON sa navigare — è il
    # caso del piano gratuito di ChatGPT. Fino al 15/08/2026 diceva «non
    # cercarla sul web», e a chi non poteva aprire pagine non restava altro che
    # rispondere a memoria, cioè inventare. Qui si parla dei titoli e dei
    # crediti di una persona: il vuoto non va riempito con parole plausibili.
    basso = testo.lower()
    if "non cercar" in basso or "non cercarla" in basso:
        errore("il prompt vieta di cercare sul web: a un assistente che non sa aprire pagine "
               "(piano gratuito) non resta nessuna strada, tranne rispondere a memoria")
    if "cerca" not in basso:
        errore("il prompt non offre un ripiego a chi non può aprire pagine: serve una seconda "
               "strada, altrimenti chi non naviga inventa")
    if "dimmelo" not in basso and "dillo" not in basso:
        errore("il prompt non chiede all'assistente di DIRLO quando non riesce ad accedere: "
               "senza quella riga, il caso peggiore è una risposta inventata che sembra vera")


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
    else:
        # Un link dentro <noscript> è un link di riserva, non un link. Google lo
        # legge, ma vale meno di uno visibile, e un assistente che guarda la
        # pagina come la vede un umano non lo incontra mai.
        # Successo il 15/08/2026: togliendo «Profilo» dal menu è rimasto solo
        # quello nel noscript, e la guardia diceva che andava bene perché
        # cercava la stringa senza guardare DOVE stava.
        fuori_noscript = re.sub(r"<noscript>.*?</noscript>", "", corpo, flags=re.S)
        if 'href="/profilo/"' not in fuori_noscript:
            AVVISI.append(
                "la home raggiunge /profilo/ SOLO da dentro <noscript>: è la pagina che le AI "
                "devono leggere e quella che porta il peso dei contenuti, e ci si arriva solo "
                "passando da /cv/. Da valutare un link visibile.")


def controlla_collegamenti_interni():
    attese = {
        "/profilo/": ["index.html", "cv/index.html", "en/profile/index.html"],
        "/cv/": ["index.html", "profilo/index.html", "en/profile/index.html"],
        "/en/profile/": ["index.html", "profilo/index.html", "cv/index.html"],
        "/privacy/": ["index.html", "profilo/index.html", "cv/index.html"],
        "/tienimi-presente/": ["index.html", "profilo/index.html"],
        # Dal 09/08/2026 gli strumenti stanno tutti in /tools/ e la home ci arriva
        # con una parola sola: se salta quel link, sette pagine diventano fantasmi.
        "/tools/": ["index.html"],
    }
    for t in TOOL:
        attese[f"/{t}/"] = ["tools/index.html"]
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


def controlla_uscita_leggera():
    """«Tienimi presente» è l'unica traccia che resta delle conversazioni che non arrivano
    a WhatsApp: se sparisce dal protocollo o si rompe il modulo, il cerchio torna aperto."""
    url = "https://simonecastellan.com/tienimi-presente/"
    for f in ("profilo/index.html", "llms.txt", "en/profile/index.html"):
        if url not in leggi(f):
            errore(f"{f} non offre più l'uscita leggera {url}: le conversazioni senza "
                   f"WhatsApp tornano a non lasciare traccia")
    pagina = leggi("tienimi-presente/index.html")
    if 'id="sito"' not in pagina:
        errore("tienimi-presente: manca il campo-esca anti-bot (id=\"sito\")")
    if "track.send" not in pagina:
        errore("tienimi-presente: il modulo non usa track.send — l'invio non arriverebbe al foglio")
    if "track.send" not in leggi("track.js"):
        errore("track.js non espone più track.send: il modulo Tienimi presente non può inviare")


def controlla_intestazioni_tool():
    """L'11/08/2026 i quindici strumenti sono stati riportati a una voce sola: titolo
    «Nome — cosa fa», sottotitolo minuscolo che finisce la frase, descrizione che sta
    dentro il riquadro dei risultati di Google, piede che rimanda all'attrezzo accanto.
    Quel giro ha lasciato indietro quattro descrizioni troppo lunghe, e me ne sono
    accorto solo interrogando il dominio: da qui in poi se ne accorge lo script."""
    lunghe = []
    for t in TOOL + NASCOSTI:
        pagina = leggi(f"{t}/index.html")

        titolo = re.search(r"<title>(.*?)</title>", pagina, re.S)
        if not titolo:
            errore(f"{t}: manca il <title>")
        elif "—" not in titolo.group(1):
            errore(f"{t}: il titolo «{titolo.group(1).strip()}» non dice cosa fa lo strumento "
                   f"(gli altri sono «Nome — cosa fa»)")
        elif len(titolo.group(1).strip()) > MAX_TITOLO:
            n = len(titolo.group(1).strip())
            errore(f"{t}: titolo di {n} caratteri (massimo {MAX_TITOLO}): Google lo tronca "
                   f"con i puntini, e a sparire è proprio la parte che dice cosa fa")

        d = re.search(r'<meta name="description" content="(.*?)"', pagina, re.S)
        if not d:
            errore(f"{t}: manca la meta description")
        elif len(d.group(1).strip()) > MAX_DESCRIZIONE:
            n = len(d.group(1).strip())
            errore(f"{t}: descrizione di {n} caratteri (massimo {MAX_DESCRIZIONE}): "
                   f"Google la taglia a metà frase")
        else:
            lunghe.append(len(d.group(1).strip()))

        # Dal 12/08/2026 il nome può essere seguito in due modi, e vale lo stesso
        # patto: subito sotto il nome deve esserci scritto cosa fa lo strumento.
        #   forma vecchia — <p class="subtitle">frammento minuscolo</p>
        #   voce comune   — <h1 class="titolone">Nome.<span class="eco">Frase.</span></h1>
        # Nella voce comune l'eco è una frase intera (maiuscola e punto): è la
        # figura di stageplot.it, dove la seconda riga completa la prima.
        sub = re.search(r'<p class="subtitle">(.*?)</p>', pagina, re.S)
        eco = re.search(r'<span class="eco">(.*?)</span>', pagina, re.S)
        if not sub and not eco:
            errore(f"{t}: sotto il nome non c'è scritto cosa fa "
                   f"(né sottotitolo né seconda riga del titolo)")
        elif sub:
            testo = re.sub(r"\s+", " ", sub.group(1)).strip()
            # Frammento minuscolo che finisce la frase cominciata dal nome: niente
            # maiuscola, niente punto.  Solo un avviso: un nome proprio o una sigla
            # («PNG o SVG…») sarebbe un falso allarme.
            if testo[:1].isupper() or testo.endswith("."):
                AVVISI.append(f"{t}: il sottotitolo «{testo}» non è un frammento minuscolo")
        else:
            testo = re.sub(r"\s+", " ", eco.group(1)).strip()
            if not testo.endswith("."):
                AVVISI.append(f"{t}: la seconda riga del titolo «{testo}» non chiude la frase")

        if "simonecastellan.com/tools/" not in pagina.split("<footer", 1)[-1]:
            errore(f"{t}: dal piede non si torna agli altri strumenti")

        # Il piede diceva «Designed and built by» su diciotto pagine italiane:
        # una firma in inglese sotto uno strumento scritto in italiano.
        if "Designed and built" in pagina:
            errore(f"{t}: il piede è in inglese («Designed and built by»); "
                   f"le pagine italiane dicono «Fatto da»")

    if lunghe:
        quanti = f"{len(NASCOSTI)} nascosto" if len(NASCOSTI) == 1 else f"{len(NASCOSTI)} nascosti"
        print(f"  strumenti: {len(TOOL)} in vetrina + {quanti}, "
              f"tutti con titolo e sottotitolo, descrizioni fino a {max(lunghe)} caratteri")


def controlla_nascosti():
    """Nascosto vuol dire tre cose insieme, e basta che ne salti una perché la
    pagina torni a farsi trovare senza che nessuno l'abbia deciso: niente cella
    in /tools/, niente riga in sitemap, noindex sulla pagina.  La pagina però
    deve continuare a esistere e a rimandare agli altri strumenti: chi ci arriva
    da un vecchio link non deve trovare un vicolo cieco.

    Quello che NON vuol dire è «irraggiungibile».  Fino al 15/08/2026 questi
    strumenti non erano linkati da nessuna pagina del sito: si poteva arrivarci
    solo sapendo l'indirizzo a memoria.  Nascondere da Google e togliere ogni
    strada per arrivarci sono due decisioni diverse, e solo la prima era stata
    presa.  Perciò il divieto è sulla CELLA della vetrina, non su ogni link:
    una riga in fondo, che dice quello che sono, è quello che serve."""
    vetrina = leggi("tools/index.html")
    xml = leggi("sitemap.xml")
    for t in NASCOSTI:
        if re.search(rf'class="cella"[^>]*href="/{re.escape(t)}/"', vetrina):
            errore(f"/{t}/ è fra i nascosti ma ha di nuovo una cella nella vetrina di /tools/")
        if f'href="/{t}/"' not in vetrina:
            errore(f"/{t}/ è fra i nascosti e non lo raggiunge nessun link da /tools/: "
                   f"nascondere da Google non vuol dire rendere irraggiungibile")
        if f"/{t}/" in xml:
            errore(f"/{t}/ è fra i nascosti ma è ancora nella sitemap: Google continuerebbe "
                   f"a proporlo")
        pagina = leggi(f"{t}/index.html")
        # Si cerca il meta vero, non la parola: «noindex» compare anche nel commento
        # che spiega come rimettere lo strumento in vetrina, e cercare la parola
        # nuda faceva passare il controllo pure con il meta tolto (provato).
        robots = re.search(r'<meta\s+name="robots"\s+content="([^"]*)"', pagina)
        if not robots or "noindex" not in robots.group(1):
            errore(f"/{t}/ è fra i nascosti ma non ha il meta robots noindex: resterebbe nei "
                   f"risultati di ricerca senza più un link che ci porta")
        if not os.path.exists(os.path.join(ROOT, t, "index.html")):
            errore(f"/{t}/ è sparito: nascondere non è cancellare, i link vecchi devono "
                   f"continuare ad arrivare da qualche parte")
    if NASCOSTI:
        print(f"  nascosti: {', '.join(NASCOSTI)} — fuori da vetrina, sitemap e ricerche, "
              f"pagina ancora viva")


def controlla_rimandi():
    """Uno strumento che si trasferisce lascia una pagina che rimanda, non un 404:
    i link e i segnalibri di prima devono continuare ad arrivare da qualche parte.
    L'11/08/2026 «Immagini social» è entrato dentro «Posso pubblicarlo?»."""
    rimandi = {"immagini-social": "/posso-pubblicarlo/"}
    for vecchio, nuovo in rimandi.items():
        pagina = leggi(f"{vecchio}/index.html")
        if nuovo not in pagina:
            errore(f"/{vecchio}/ non rimanda più a {nuovo}: i link vecchi finiscono nel vuoto")
        if 'rel="canonical"' not in pagina or f'canonical" href="https://simonecastellan.com{nuovo}"' not in pagina:
            errore(f"/{vecchio}/ non dichiara come canonical {nuovo}")
        if "noindex" not in pagina:
            errore(f"/{vecchio}/ non è noindex: due indirizzi per la stessa cosa si fanno concorrenza")


def controlla_sitemap():
    xml = leggi("sitemap.xml")
    urls = re.findall(r"<loc>https://simonecastellan\.com/(.*?)</loc>", xml)
    for u in urls:
        percorso = os.path.join(ROOT, u, "index.html") if u else os.path.join(ROOT, "index.html")
        if not os.path.exists(percorso):
            errore(f"la sitemap elenca /{u} ma il file non esiste")
    pubblicate = {"", "profilo/", "cv/", "en/profile/", "privacy/", "tienimi-presente/", "BDG2029/",
                  "tools/"} | {t + "/" for t in TOOL}
    mancanti = pubblicate - set(urls)
    if mancanti:
        errore("pagine pubblicate ma assenti dalla sitemap: " + ", ".join(sorted(mancanti)))

    orfane = trova_orfane(urls)
    if orfane:
        errore("dichiarate a Google nella sitemap ma senza nessun link interno che ci porti: "
               + ", ".join("/" + u for u in sorted(orfane))
               + " — una pagina che si raggiunge solo sapendone l'indirizzo non la trova "
                 "nessuno, e Google la considera meno importante di quanto sia")

    print(f"  sitemap: {len(urls)} indirizzi, tutti esistenti e tutti raggiungibili")


def trova_orfane(urls):
    """Quali pagine della sitemap non sono linkate da nessun'altra pagina del sito.

    Nato il 15/08/2026: /BDG2029/ era dichiarata a Google e non la raggiungeva
    nessun link — una pagina che esiste, che i motori conoscono, e a cui dal
    sito non si arriva.  Nessun controllo poteva accorgersene perché la sitemap
    veniva confrontata solo con l'elenco dei file esistenti.

    Si guardano tutti gli .html del sito, escluse le prove in tools/casi/ e la
    pagina stessa (una pagina che linka sé stessa resta orfana)."""
    testi = {}
    for cartella, _, file in os.walk(ROOT):
        if os.sep + ".git" in cartella or os.sep + "casi" in cartella:
            continue
        for nome in file:
            if nome.endswith(".html"):
                p = os.path.join(cartella, nome)
                testi[os.path.relpath(p, ROOT)] = open(p, encoding="utf-8").read()

    orfane = set()
    for u in urls:
        if not u:
            continue                                   # la home è la radice: ci si arriva sempre
        mia = os.path.join(u, "index.html").replace(os.sep, "/")
        # sia «/BDG2029/» sia «BDG2029/index.html», e sia con le virgolette doppie sia con le singole
        forme = (f'href="/{u}"', f"href='/{u}'", f'href="/{u}index.html"')
        if not any(f in testo for altra, testo in testi.items() if altra != mia for f in forme):
            orfane.add(u)
    return orfane


# Le pagine che portano dati strutturati. Serve a due controlli — la validità
# del JSON e l'unicità del nodo Person — e tenerne due copie significa che
# prima o poi una pagina nuova entra in uno solo dei due elenchi.
PAGINE_JSONLD = ("index.html", "profilo/index.html", "cv/index.html",
                 "en/profile/index.html", "tools/index.html")


def controlla_json_ld():
    for f in PAGINE_JSONLD:
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


def controlla_intestazioni_altre_pagine():
    """Titolo e descrizione delle pagine che NON sono strumenti.

    Il controllo di sopra guarda solo i diciannove strumenti, e per mesi
    nessuno ha guardato le altre: il 15/08/2026 il titolo di `/tools/` stava a
    82 caratteri e quattro descrizioni fra 168 e 271. Google mostra ~60 e ~160,
    e il titolo si tronca dalla fine — cioè dove è scritto cosa c'è dentro.

    Le pagine sono elencate a mano e non trovate frugando nelle cartelle: così
    aggiungerne una nuova obbliga a passare di qui, invece di lasciarla fuori
    dai controlli senza che nessuno se ne accorga."""
    ALTRE = ["index.html", "tools/index.html", "profilo/index.html", "cv/index.html",
             "privacy/index.html", "tienimi-presente/index.html",
             "en/profile/index.html", "bando-in-chiaro/index.html",
             "BDG2029/index.html"]
    for rel in ALTRE:
        percorso = os.path.join(ROOT, rel)
        if not os.path.exists(percorso):
            continue
        pagina = leggi(rel)

        t = re.search(r"<title>(.*?)</title>", pagina, re.S)
        if not t:
            errore(f"{rel}: manca il <title>")
        else:
            # gli apostrofi tipografici e le entità vanno sciolti prima di
            # contare, o il conto si ferma dove non deve
            testo = html.unescape(re.sub(r"\s+", " ", t.group(1)).strip())
            if len(testo) > MAX_TITOLO:
                errore(f"{rel}: titolo di {len(testo)} caratteri (massimo {MAX_TITOLO}): "
                       f"Google lo tronca, e a sparire è la fine")

        d = re.search(r'<meta\s+name="description"\s+content="(.*?)"\s*/?>', pagina, re.S)
        if not d:
            errore(f"{rel}: manca la meta description")
        else:
            testo = html.unescape(re.sub(r"\s+", " ", d.group(1)).strip())
            if len(testo) > MAX_DESCRIZIONE:
                errore(f"{rel}: descrizione di {len(testo)} caratteri "
                       f"(massimo {MAX_DESCRIZIONE}): Google la taglia a metà frase")


def controlla_cv_allineato():
    """I fatti del curriculum stanno in DUE posti, ed è un rischio noto.

    `cv/dati.js` alimenta il PDF; `cv/index.html` porta gli stessi fatti scritti
    a mano, perché le intelligenze artificiali non eseguono JavaScript e quella
    pagina serve anche a loro. Due copie divergono sempre, prima o poi — a meno
    che qualcuno non le confronti a ogni giro.

    Qui si confrontano i dati che, se sbagliati, mandano a monte una
    candidatura: le votazioni dei titoli e i livelli di lingua. Non tutto il
    testo: la pagina è una sintesi e deve poter dire meno del PDF, ma non
    può dire una cosa DIVERSA.
    """
    dati = leggi("cv/dati.js")
    pagina = leggi("cv/index.html")

    # I voti dei titoli, come sono scritti in dati.js
    voti = re.findall(r"voto:\s*'([^']+)'", dati)
    for v in voti:
        atteso = v.replace("’", "'")
        if atteso.replace("'", "’") not in pagina and atteso not in pagina:
            errore(f"cv: la votazione «{v}» sta in dati.js (e quindi nel PDF) "
                   f"ma non nella pagina: i due documenti direbbero cose diverse")

    # I livelli di lingua: se il PDF dice B2 e la pagina C1, uno dei due mente
    # «{ lingua:» e non «lingua:»: senza la graffa il pattern cattura anche
    # «madrelingua», e la lingua madre nella tabella NON c'è — giustamente,
    # perché la scala del Quadro europeo descrive chi una lingua la impara.
    ABILITA = ("ascolto", "lettura", "interazione", "produzione", "scritto")
    for m in re.finditer(r"\{\s*lingua:\s*'([^']+)'(.*?)certificazione", dati, re.S):
        lingua, blocco = m.group(1), m.group(2)
        riga = re.search(r"<td[^>]*>" + re.escape(lingua) + r"</td>(.*?)</tr>", pagina, re.S)
        if not riga:
            errore(f"cv: la lingua «{lingua}» è in dati.js ma non nella tabella della pagina")
            continue
        # Si confrontano TUTTE E CINQUE le abilità, in ordine. Cercare se il
        # livello «compare» nella riga non serviva a niente: con cinque celle
        # uguali, cambiarne una lasciava le altre quattro a far passare il
        # controllo. Provato mettendo C1 al posto di un B2: passava.
        attesi = [re.search(a + r":\s*'([^']+)'", blocco) for a in ABILITA]
        attesi = [x.group(1) for x in attesi if x]
        nella_pagina = re.findall(r"<td[^>]*>([ABC][12])</td>", riga.group(1))
        if len(attesi) == 5 and attesi != nella_pagina:
            errore(f"cv: «{lingua}» ha livelli diversi fra la pagina e il PDF — "
                   f"dati.js dice {attesi}, la pagina dice {nella_pagina}")

    # La qualifica che apre il CV
    q = re.search(r"qualifica:\s*'([^']+)'", dati)
    if q:
        # la pagina la può spezzare su più righe: si confrontano le parole
        parole = [p for p in re.split(r"[^\wàèéìòùÀÈÉÌÒÙ]+", q.group(1)) if len(p) > 4]
        mancanti = [p for p in parole if p not in pagina]
        if mancanti:
            errore("cv: la qualifica di dati.js non si ritrova nella pagina "
                   f"(mancano: {', '.join(mancanti)})")

    print(f"  curriculum: pagina e dati allineati su {len(voti)} votazioni e "
          f"{len(re.findall(chr(123) + chr(92) + 's*lingua:', dati))} lingue straniere")


def controlla_formule_smentite():
    """Le formule che i documenti smentiscono non devono tornare.

    Il 12 e il 15/08/2026 otto affermazioni pubblicate sono risultate smentite
    dai loro stessi allegati, e tre erano già passate in domande inviate. Le
    versioni sbagliate erano rimaste in circolazione per mesi perché nessuno le
    cercava.

    ── PERCHÉ NON BASTA CERCARE LA PAROLA ──────────────────────────────────
    In `llms.txt` e in `/profilo/` quelle stesse parole compaiono di proposito,
    dentro le istruzioni che le VIETANO: «"ammessa e presentata" non è
    "finalista"», «non usare "finalista"». Un controllo che cerca la parola e
    basta segnala tre negazioni su quattro e fa perdere fiducia in sé stesso —
    provato. Qui si guarda la riga: se contiene una negazione, è un'istruzione
    e va bene.
    """
    # Le negazioni sono in due lingue, perché la versione inglese del profilo
    # spiega agli assistenti la stessa cosa in inglese: «Leading a course is
    # NOT a tenured post». Con le sole forme italiane il controllo segnalava
    # come errori tre righe che dicono esattamente il contrario.
    NEGAZIONI = (
        # italiano
        "non è", "non usare", "non ha", "non sono", "non vale", "niente «",
        "invece di", "al posto di", "non «", "cosa diversa", "non attribuir",
        # inglese
        "is not", "isn't", "not a tenured", "rather than", "instead of",
        "no «", "never «",
    )
    VIETATE = [
        ("docente titolare", "è titolare DELL'INSEGNAMENTO, non di un posto di ruolo"),
        ("tenured", "in inglese afferma un posto permanente che non esiste"),
        ("graduatorie nazionali", "non esistono: le idoneità sono di singoli conservatori"),
        ("sony music (", "Sony è la distribuzione, l'editore è Fenix"),
    ]
    # «finalista» da solo è legittimo — a Seeyousound 2020 lo era davvero. Lo
    # diventa quando sta accanto al Premio Nazionale delle Arti, dove
    # l'attestato dice opera ammessa e presentata: si guarda la coppia, non la
    # parola. Con la parola nuda il controllo avrebbe bocciato un premio vero.
    COPPIE_VIETATE = [
        (("finalista", "premio nazionale delle arti"),
         "l'attestato dice opera ammessa e presentata, non «finalista»"),
    ]
    # index.html c'è dal 22/08/2026, e non è un'aggiunta di scrupolo: la home
    # pubblicava «Finalista al Premio Nazionale delle Arti» nel JSON-LD, cioè
    # nel dato che i motori leggono per primo, mentre le altre tre fonti erano
    # già corrette da una settimana. Nessun controllo la guardava.
    for f in ("llms.txt", "profilo/index.html", "en/profile/index.html", "cv/index.html",
              "index.html"):
        if not os.path.exists(os.path.join(ROOT, f)):
            continue
        righe = leggi(f).splitlines()
        for numero, riga in enumerate(righe, 1):
            basso = riga.lower()
            if any(n in basso for n in NEGAZIONI):
                continue          # è un'istruzione che vieta la formula
            for formula, perche in VIETATE:
                if formula in basso:
                    errore(f"{f}:{numero} usa «{formula}»: {perche}")
            # Le coppie si cercano anche a cavallo di due righe. Il 22/08/2026
            # un commento appena scritto — quello che SPIEGA questo difetto —
            # citava «Finalista al Premio Nazionale / delle Arti» spezzato dal
            # ritorno a capo, e passava indisturbato: la formula sbagliata era
            # tornata in pagina dentro la nota che racconta come toglierla.
            dopo = righe[numero].lower() if numero < len(righe) else ""
            if any(n in dopo for n in NEGAZIONI):
                continue
            # Gli spazi si normalizzano PRIMA di cercare: unendo due righe
            # rimane in mezzo l'indentazione della seconda, e «premio
            # nazionale␣␣␣␣delle arti» non contiene «premio nazionale delle
            # arti». Provato rimettendo il commento spezzato: senza questa
            # riga il controllo passava verde senza guardare niente.
            coppia = re.sub(r"\s+", " ", basso + " " + dopo)
            for parole, perche in COPPIE_VIETATE:
                if all(x in coppia for x in parole):
                    errore(f"{f}:{numero} mette insieme {' + '.join(parole)}: {perche}")
    print("  formule: nessuna delle versioni smentite dai documenti è tornata")


def controlla_pagine_del_sistema():
    """Le pagine su cui poggia «Chiedi di più su Simone» devono essere fra
    quelle che si segnalano ai motori.

    Il 15/08/2026 `llms.txt` non stava né nella sitemap né nell'elenco di
    IndexNow: risponde 200, è linkato dal profilo, e nessun motore ne aveva
    mai saputo niente. È il documento che un assistente legge per convenzione,
    quindi è esattamente il pezzo che serve quando l'assistente CERCA invece di
    aprire — cioè il caso del piano gratuito, quello per cui il prompt ha una
    seconda strada.
    """
    percorso = os.path.join(ROOT, "ops", "indexnow.sh")
    if not os.path.exists(percorso):
        return errore("manca ops/indexnow.sh: non c'è più il modo di segnalare "
                      "le pagine ai motori")
    script = leggi("ops/indexnow.sh")
    blocco = re.search(r"PAGINE=\((.*?)\)", script, re.S)
    if not blocco:
        return errore("ops/indexnow.sh non ha più l'elenco PAGINE")
    elenco = blocco.group(1)
    for pagina, perche in [
        ("/profilo/", "è la pagina che l'assistente deve leggere"),
        ("/llms.txt", "è il documento che gli assistenti leggono per convenzione"),
        ("/en/profile/", "è il profilo per chi non parla italiano"),
        ("/", "è il punto d'ingresso e porta il prompt"),
    ]:
        if f'"{pagina}"' not in elenco:
            errore(f"ops/indexnow.sh non segnala più {pagina}, che {perche}")
    print("  sistema AI: profilo, llms.txt, versione inglese e home fra le pagine segnalate")


def controlla_mappa_agganci():
    """La mappa «Dove può nascere un incontro» deve stare in TUTTE E TRE le fonti.

    È il pezzo che fa il lavoro del sistema: dice quale aggancio usare con chi.
    Fino al 22/08/2026 esisteva solo in `llms.txt` — il file che nessuna pagina
    linka e dove il pulsante della home non manda nessuno — mentre `/profilo/`,
    cioè la pagina che l'assistente apre davvero, non ce l'aveva.

    Non è una mancanza teorica: chiesto a un modello, con /profilo/ davanti e
    senza mappa, «sono un fonico di un service, cosa c'entra Simone con me?»,
    la risposta è stata che il service potrebbe FORNIRE Simone — pescata dalla
    riga «con chi lavora». L'aggancio giusto è la misura. I dati c'erano tutti;
    mancava quale usare con chi.

    Si contano anche le voci: se una fonte ne perde per strada, le tre versioni
    ricominciano a divergere, che è esattamente come sono nati i guai passati.
    """
    # Si aggancia il TITOLO della sezione, non il nome: «Dove può nascere un
    # incontro» compare anche dentro le istruzioni, che a quella sezione
    # rimandano. Cercando il nome nudo, il conteggio partiva da lì e trovava
    # zero voci in llms.txt e quattro nel profilo — provato.
    FONTI = [
        ("llms.txt", "Dove può nascere un incontro",
         r"^## Dove può nascere un incontro\s*$", r"^- \*\*(.+?)\*\*"),
        ("profilo/index.html", "Dove può nascere un incontro",
         r"<h2>Dove può nascere un incontro</h2>", r"<li><strong>(.+?)</strong>"),
        ("en/profile/index.html", "Where a connection can start",
         r"<h2>Where a connection can start</h2>", r"<li><strong>(.+?)</strong>"),
    ]
    conteggi = {}
    for percorso, titolo, ancora, riga_voce in FONTI:
        testo = leggi(percorso)
        inizio = re.search(ancora, testo, re.M)
        if not inizio:
            errore(f"{percorso} non ha più la sezione «{titolo}»: è il pezzo che dice "
                   f"quale aggancio usare con chi, e senza di esso l'assistente lo inventa")
            continue
        dopo = testo[inizio.end():]
        fine = re.search(r"\n## |<h2", dopo)
        blocco = dopo[:fine.start()] if fine else dopo
        conteggi[percorso] = len(re.findall(riga_voce, blocco, re.M))

    if len(conteggi) == 3 and len(set(conteggi.values())) > 1:
        errore("la mappa degli agganci ha un numero diverso di voci nelle tre fonti "
               + ", ".join(f"{k}: {v}" for k, v in conteggi.items())
               + " — una delle tre ha perso per strada un interlocutore")
    if conteggi:
        print(f"  mappa degli agganci: presente in {len(conteggi)} fonti su 3, "
              f"{min(conteggi.values())} interlocutori")


def controlla_fatti_allineati():
    """I cinque fatti che l'assistente ripete più spesso devono coincidere
    fra profilo italiano, profilo inglese e llms.txt.

    È già successo: «inglese C1 di qua e B2 di là», tre `jobTitle` diversi per
    lo stesso `@id`, l'ordine dei dischi cambiato. Il curriculum ha già la sua
    guardia (`controlla_cv_allineato`); queste tre fonti non ne avevano
    nessuna, e sono quelle che un'intelligenza artificiale legge per prime.

    Si confrontano i numeri, non le frasi: le tre pagine dicono le stesse cose
    con parole diverse, e va bene così — ma l'anno in cui è nato, i canali
    della sala e il livello d'inglese o sono uguali dappertutto o uno mente.
    """
    FATTI = [
        ("anno di nascita", [r"\b1991\b"], [r"\b1991\b"]),
        ("canali della sala", [r"7\.1\.4"], [r"7\.1\.4"]),
        ("sala Atmos dal", [r"[Dd]al (\d{4})[^.]{0,60}(?:sala|Atmos)"],
                           [r"[Ss]ince (\d{4})[^.]{0,80}Atmos"]),
        ("Civica dal", [r"[Dd]al (\d{4})[^.]{0,80}Civica"],
                       [r"[Ss]ince (\d{4})[^.]{0,80}Civica"]),
        ("livello d'inglese", [r"inglese\s+([ABC][12])"], [r"English\s*\(?([ABC][12])"]),
    ]
    ITALIANE = ["profilo/index.html", "llms.txt"]
    INGLESE = "en/profile/index.html"

    def valore(testo, schemi):
        for s in schemi:
            m = re.search(s, testo)
            if m:
                # se il pattern cattura un gruppo (l'anno, il livello) vale quello,
                # altrimenti vale la stringa intera trovata
                return m.group(1) if m.groups() else m.group(0)
        return None

    # I commenti HTML raccontano le correzioni passate e contengono di proposito
    # le versioni sbagliate («inglese C1 di qua»): confrontarli farebbe fallire
    # il controllo su una frase che nessuno legge come un fatto.
    def senza_commenti(percorso):
        return re.sub(r"<!--.*?-->", "", leggi(percorso), flags=re.S)

    contati = 0
    for nome, schemi_it, schemi_en in FATTI:
        trovati = {}
        for f in ITALIANE:
            v = valore(senza_commenti(f), schemi_it)
            if v:
                trovati[f] = v
        v = valore(senza_commenti(INGLESE), schemi_en)
        if v:
            trovati[INGLESE] = v
        if len(trovati) < 2:
            continue          # il fatto sta in una fonte sola: niente da confrontare
        if len(set(trovati.values())) > 1:
            errore(f"«{nome}» non coincide fra le fonti che l'assistente legge: "
                   + ", ".join(f"{k} dice {v}" for k, v in trovati.items()))
        else:
            contati += 1
    print(f"  fatti del profilo: {contati} dati chiave uguali in italiano, inglese e llms.txt")


def controlla_person_definita_una_volta():
    """Le proprietà di MERITO della persona devono stare in una pagina sola.

    `award`, `hasCredential` e `alumniOf` dicono cosa ha vinto e cosa ha
    studiato: sono le prime a essere corrette quando un documento smentisce una
    formula, e le ultime a essere ricontrollate dappertutto. Tutte le pagine
    del sito dichiarano lo stesso `@id` per la persona, e i motori fondono i
    nodi con lo stesso `@id`: due elenchi di premi non si sostituiscono, si
    SOMMANO. Chi legge il risultato vede la versione corretta e quella vecchia
    una accanto all'altra.

    Successo davvero: il riordino del 15/08/2026 unificò /profilo/ e la pagina
    inglese e saltò la home, che ha continuato a pubblicare «Finalista al
    Premio Nazionale delle Arti» — la formula smentita dall'attestato — dentro
    il JSON-LD della pagina più visitata, per una settimana, senza che nessun
    controllo la guardasse.

    La definizione piena vive in /profilo/. Le altre pagine possono nominare la
    persona quanto vogliono, ma non ridichiarare cosa ha vinto.
    """
    MERITO = ("award", "hasCredential", "alumniOf")
    CASA = "profilo/index.html"
    for percorso in PAGINE_JSONLD:
        if percorso == CASA:
            continue
        for blocco in re.findall(r'<script type="application/ld\+json">(.*?)</script>',
                                 leggi(percorso), re.S):
            try:
                dato = json.loads(blocco)
            except ValueError:
                continue          # la validità del JSON la controlla già controlla_json_ld
            nodi = dato.get("@graph", [dato]) if isinstance(dato, dict) else dato
            for nodo in nodi:
                if not isinstance(nodo, dict) or nodo.get("@type") != "Person":
                    continue
                doppie = [k for k in MERITO if k in nodo]
                if doppie:
                    errore(f"{percorso}: il nodo Person ridichiara {', '.join(doppie)} — "
                           f"i motori li sommano a quelli di {CASA} invece di sostituirli, "
                           f"e la versione vecchia resta pubblicata accanto a quella corretta")
    print(f"  dati strutturati: premi, titoli e scuole dichiarati solo in {CASA}")


def controlla_agganci_css():
    """Le classi che il codice cerca devono esistere: in pagina o create dal
    codice stesso.

    Il 23/08/2026 `/comprimi-video/` era rotto per TUTTI: `script.js` chiamava
    `document.querySelector('.claims').classList.add(...)`, ma in quella pagina
    il paragrafo ha `class="privacy"` — `.claims` è di un altro strumento. La
    chiamata restituiva `null`, la riga esplodeva, e siccome stava dentro un
    `then()` abbracciato da un `catch` largo, l'errore veniva riscritto così:
    «Non riesco ad aprire questo video: dentro non c'è un filmato, oppure è
    rovinato». Lo strumento dava la colpa al file di chi lo usava, con
    qualunque video. Verificato in produzione con un MP4 valido di 21 KB.

    Perché nessuno se n'era accorto: il banco di prova apre le pagine e ascolta
    gli errori, ma questo errore arriva solo DOPO che si carica un file. Una
    pagina che si apre bene e si rompe al primo gesto è verde per il banco.

    ── DUE COSE DA NON DIMENTICARE, IMPARATE SCRIVENDO QUESTO CONTROLLO ─────
    1. Metà delle classi cercate non stanno nell'HTML perché le crea il codice
       (`b.className = 'f-dl'`): cercarle solo in pagina dava cinque falsi
       allarmi su sei, e un controllo che grida al lupo viene spento.
    2. La prima versione segnalava anche la classe nominata dentro il commento
       qui sopra — cioè si accusava da sola. I commenti vanno tolti prima di
       guardare il codice.
    """
    def senza_commenti(js):
        js = re.sub(r"/\*.*?\*/", " ", js, flags=re.S)
        return re.sub(r"(^|[^:])//.*$", r"\1", js, flags=re.M)

    trovati = 0
    for nome in TOOL + NASCOSTI:
        js = os.path.join(ROOT, nome, "script.js")
        html = os.path.join(ROOT, nome, "index.html")
        if not (os.path.exists(js) and os.path.exists(html)):
            continue
        pagina = leggi(os.path.join(nome, "index.html"))
        codice = senza_commenti(leggi(os.path.join(nome, "script.js")))
        for m in re.finditer(r"""querySelector(?:All)?\(\s*['"]\.([a-zA-Z0-9_-]+)['"]\s*\)""", codice):
            classe = m.group(1)
            trovati += 1
            in_pagina = re.search(r'class\s*=\s*["\'][^"\']*\b' + re.escape(classe) + r'\b', pagina)
            # oppure è il codice stesso a metterla: className = 'x',
            # classList.add('x'), o dentro un pezzo di HTML che costruisce
            creata = re.search(r"""(className\s*=\s*['"][^'"]*\b|classList\.add\(\s*['"]|class=\\?["'][^"']*\b)"""
                               + re.escape(classe) + r"\b", codice)
            if not (in_pagina or creata):
                riga = codice[:m.start()].count("\n") + 1
                errore(f"{nome}/script.js:{riga} cerca «.{classe}», che non esiste né in "
                       f"{nome}/index.html né fra le classi che il codice assegna: "
                       f"querySelector torna null e la riga dopo esplode")
    print(f"  agganci CSS: {trovati} classi cercate dal codice, tutte esistenti")


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
    controlla_uscita_leggera()
    controlla_intestazioni_tool()
    controlla_intestazioni_altre_pagine()
    controlla_nascosti()
    controlla_rimandi()
    controlla_sitemap()
    controlla_json_ld()
    controlla_hreflang()
    controlla_cv_allineato()
    controlla_pagine_del_sistema()
    controlla_formule_smentite()
    controlla_mappa_agganci()
    controlla_fatti_allineati()
    controlla_person_definita_una_volta()
    controlla_agganci_css()

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
