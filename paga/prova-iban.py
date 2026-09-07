#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prova che la pagina /paga non possa mentire sull'IBAN.

    python3 paga/prova-iban.py

── PERCHÉ ESISTE ──────────────────────────────────────────────────────────
In questa pagina il numero di conto è scritto tre volte: a video spezzato in
due righe, dentro il JavaScript che lo mette negli appunti, e nella tabella
dei dati in fondo. È esattamente la forma in cui nasce l'errore peggiore che
questa pagina possa fare: chi paga LEGGE un conto e INCOLLA un altro conto,
e non se ne accorge nessuno finché i soldi non arrivano — semmai arrivano.

Cambiare banca un domani vuol dire cambiare tre stringhe: questo controllo
esiste perché non se ne dimentichi una.

Il checksum ISO 13616 è in più: prende gli errori di battitura anche quando
le tre copie sono coerenti fra loro perché sono state sbagliate tutte e tre.
"""
import os
import re
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
PAGINA = os.path.join(QUI, "index.html")


def senza_tag(frammento):
    return re.sub(r"<[^>]+>", "", frammento)


def checksum_valido(iban):
    """ISO 13616: si sposta la testa in coda, le lettere diventano numeri, mod 97 = 1."""
    riordinato = iban[4:] + iban[:4]
    return int("".join(str(int(c, 36)) for c in riordinato)) % 97 == 1


def main():
    pagina = open(PAGINA, encoding="utf-8").read()
    problemi = []
    trovati = {}

    # 1. Quello che si LEGGE, ripulito dai tag e dagli spazi di impaginazione.
    m = re.search(r'<p class="iban"[^>]*>(.*?)</p>', pagina, re.S)
    if not m:
        problemi.append("non trovo l'IBAN a video (elemento .iban)")
    else:
        trovati["a video"] = re.sub(r"\s+", "", senza_tag(m.group(1)))

    # 2. Quello che il tasto COPIA.
    m = re.search(r"var IBAN\s*=\s*'([^']+)'", pagina)
    if not m:
        problemi.append("non trovo la costante IBAN nel JavaScript")
    else:
        copiato = m.group(1)
        trovati["copiato dal tasto"] = copiato
        if " " in copiato:
            problemi.append("l'IBAN copiato contiene spazi: le app lo vogliono unito")

    # 3. Quello della tabella dei dati in fondo.
    m = re.search(r"<span>IBAN</span><span>([^<]+)</span>", pagina)
    if not m:
        problemi.append("non trovo l'IBAN nella tabella dei dati")
    else:
        trovati["tabella dati"] = m.group(1).replace(" ", "")

    for dove, valore in trovati.items():
        print(f"  {dove:20s} {valore}")

    # 4. Le tre copie devono essere lo stesso conto.
    distinti = set(trovati.values())
    if len(distinti) > 1:
        problemi.append(f"la pagina dichiara {len(distinti)} conti diversi: {sorted(distinti)}")
    elif distinti:
        iban = distinti.pop()
        if not re.fullmatch(r"IT\d{2}[A-Z]\d{22}", iban):
            problemi.append(f"«{iban}» non ha la forma di un IBAN italiano (IT + 2 cifre + 1 lettera + 22 cifre)")
        elif not checksum_valido(iban):
            problemi.append(f"«{iban}» non supera il checksum ISO 13616: c'è un carattere sbagliato")
        else:
            print(f"  un solo conto, checksum ISO 13616 valido")

    if problemi:
        for p in problemi:
            print(f"ERRORE: {p}")
        return 1
    print("Tutto a posto.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
