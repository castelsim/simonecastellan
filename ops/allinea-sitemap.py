#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Rimette le date della sitemap in linea con quello che è successo davvero.

    python3 ops/allinea-sitemap.py           mostra cosa cambierebbe
    python3 ops/allinea-sitemap.py --scrivi  scrive

── PERCHÉ ESISTE ──────────────────────────────────────────────────────────
Il 15/08/2026 home, profilo e curriculum sono stati riscritti da capo, e la
sitemap continuava a dichiarare `<lastmod>2026-07-28</lastmod>`. Un lastmod
vecchio dice ai motori «qui non è cambiato niente, non passare»: è il contrario
di quello che serve quando si chiede l'indicizzazione, e nessuno se ne accorge
perché la sitemap resta formalmente valida.

── DA DOVE VIENE LA DATA ──────────────────────────────────────────────────
Dall'ultimo commit che ha toccato quel file. Non da `date`, non scritta a mano:
una data messa a mano è vera per un giorno e poi mente per mesi, e una data di
oggi su una pagina non toccata è una bugia detta ai motori — che se ne
accorgono e smettono di fidarsi del lastmod.
"""
import os
import re
import subprocess
import sys

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = os.path.join(RADICE, "sitemap.xml")
DOMINIO = "https://simonecastellan.com/"


def file_di(loc):
    """Da <loc> al file che lo produce."""
    percorso = loc[len(DOMINIO):]
    if percorso == "" or percorso.endswith("/"):
        return os.path.join(RADICE, percorso, "index.html")
    return os.path.join(RADICE, percorso)


def data_ultimo_commit(percorso):
    """La data dell'ultimo commit che ha toccato il file, in ISO."""
    if not os.path.exists(percorso):
        return None
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", percorso],
            cwd=RADICE, capture_output=True, text=True, check=True)
        return out.stdout.strip() or None
    except subprocess.CalledProcessError:
        return None


def main():
    scrivi = "--scrivi" in sys.argv
    xml = open(SITEMAP, encoding="utf-8").read()

    # Ogni blocco <url>…</url> con il suo <loc> e il suo <lastmod>
    blocchi = list(re.finditer(r"<url>(.*?)</url>", xml, re.S))
    cambi, invariati, senza_file = [], 0, []

    nuovo_xml = xml
    for b in blocchi:
        blocco = b.group(1)
        loc = re.search(r"<loc>(.*?)</loc>", blocco)
        lastmod = re.search(r"<lastmod>(.*?)</lastmod>", blocco)
        if not loc or not lastmod:
            continue
        f = file_di(loc.group(1))
        data = data_ultimo_commit(f)
        if data is None:
            senza_file.append(loc.group(1))
            continue
        if data == lastmod.group(1):
            invariati += 1
            continue
        cambi.append((loc.group(1), lastmod.group(1), data))
        blocco_nuovo = blocco.replace(
            f"<lastmod>{lastmod.group(1)}</lastmod>", f"<lastmod>{data}</lastmod>")
        nuovo_xml = nuovo_xml.replace(blocco, blocco_nuovo, 1)

    if senza_file:
        print("⚠  Indirizzi senza un file corrispondente (non toccati):")
        for s in senza_file:
            print(f"     {s}")
        print()

    if not cambi:
        print(f"Le date sono già allineate ({invariati} indirizzi).")
        return 0

    print(f"{len(cambi)} date da correggere, {invariati} già giuste:\n")
    for loc, vecchia, nuova in cambi:
        print(f"  {loc}")
        print(f"     {vecchia}  →  {nuova}")
    print()

    if not scrivi:
        print("Non ho scritto niente. Per scrivere: --scrivi")
        return 0

    open(SITEMAP, "w", encoding="utf-8").write(nuovo_xml)
    print(f"Scritte {len(cambi)} date in sitemap.xml.")
    print("Ora vale la pena rilanciare ./ops/indexnow.sh: le pagine cambiate")
    print("hanno finalmente una data che lo dice.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
