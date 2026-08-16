#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# Segnala ai motori che alcune pagine sono cambiate — protocollo IndexNow.
#
#   ./ops/indexnow.sh                 → invia l'elenco qui sotto
#   ./ops/indexnow.sh /cv/ /profilo/  → invia solo quelle
#
# ── A COSA SERVE DAVVERO ─────────────────────────────────────────────────
# Non è SEO generica: è il pezzo che manca al sistema «Chiedi di più su
# Simone». Il prompt della home dice all'assistente di aprire /profilo/ e, se
# non può aprire pagine, di CERCARE. Ma il 15/08/2026 cercando i contenuti del
# profilo non usciva niente: del sito si trovava solo la home, con un testo
# vecchio di anni. La seconda strada del prompt portava a materiale obsoleto.
#
# La ricerca web di ChatGPT passa da Bing, e Bing fa parte di IndexNow: questo
# è quindi il canale che conta per il sistema, non un dettaglio tecnico.
#
# ── COSA NON FA ──────────────────────────────────────────────────────────
# GOOGLE NON PARTECIPA a IndexNow. Per Google serve Search Console, con
# l'account di Simone: Controllo URL → «Richiedi indicizzazione», una pagina
# alla volta. Nessuno script può farlo al posto suo.
#
# ── LA CHIAVE ────────────────────────────────────────────────────────────
# Il file `<chiave>.txt` nella radice del sito dimostra che chi invia gli URL
# controlla il dominio. Se sparisce, gli invii vengono rifiutati e il motivo
# non è ovvio: il comando qui sotto lo controlla PRIMA di inviare.
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

CHIAVE="4da17fecac16b469583e89c2959fb0c1"
SITO="simonecastellan.com"

# Le pagine che il sistema usa davvero, in ordine di importanza:
#  · /profilo/    la pagina che l'assistente deve leggere — la più importante
#  · /            il punto d'ingresso, e l'unica che oggi risulta indicizzata
#  · /cv/         il curriculum, rifatto il 15/08
#  · /en/profile/ la versione inglese del profilo
#  · /tools/      la vetrina, che porta a diciotto pagine
#  · /llms.txt    il file che gli assistenti leggono per convenzione. Non sta
#                 nella sitemap — quella dichiara pagine fatte per le persone —
#                 ma qui ci va: se un assistente cerca invece di aprire, questo
#                 è il documento che gli serve, ed era l'unico pezzo del
#                 sistema che nessuno aveva mai segnalato a nessun motore.
PAGINE=(
  "/profilo/"
  "/"
  "/cv/"
  "/en/profile/"
  "/tools/"
  "/llms.txt"
)

if [ $# -gt 0 ]; then PAGINE=("$@"); fi

echo "IndexNow — $SITO"
echo

# 1. La chiave dev'essere raggiungibile, o l'invio viene rifiutato in silenzio
printf 'chiave sul sito… '
STATO=$(curl -s -o /dev/null -w '%{http_code}' "https://$SITO/$CHIAVE.txt")
if [ "$STATO" != "200" ]; then
  echo "NO (HTTP $STATO)"
  echo
  echo "Il file https://$SITO/$CHIAVE.txt non risponde."
  echo "Senza, i motori rifiutano gli invii. Controlla che sia stato pubblicato."
  exit 1
fi
CONTENUTO=$(curl -s "https://$SITO/$CHIAVE.txt" | tr -d '[:space:]')
if [ "$CONTENUTO" != "$CHIAVE" ]; then
  echo "NO (contiene «$CONTENUTO» invece della chiave)"
  exit 1
fi
echo "ok"

# 2. Le pagine devono esistere: segnalare un 404 è peggio che non segnalare
printf 'pagine raggiungibili… '
for p in "${PAGINE[@]}"; do
  S=$(curl -s -o /dev/null -w '%{http_code}' "https://$SITO$p")
  if [ "$S" != "200" ]; then
    echo "NO"
    echo "  https://$SITO$p risponde $S — non la segnalo"
    exit 1
  fi
done
echo "ok (${#PAGINE[@]})"

# 3. L'invio vero
# Un ciclo, non printf. Il formato «"https://%s%s",» consuma DUE argomenti a
# ogni giro: passandogli il dominio una volta sola e poi tutte le pagine, dal
# secondo URL in avanti accoppiava le pagine FRA LORO e usciva «https:////cv/».
# Il primo URL era giusto, e infatti a occhio sembrava funzionare: il motore ha
# risposto 400 senza dire quale URL fosse rotto.
ELENCO=""
for p in "${PAGINE[@]}"; do
  ELENCO+="\"https://$SITO$p\","
done
ELENCO="${ELENCO%,}"
CORPO=$(cat <<FINE
{
  "host": "$SITO",
  "key": "$CHIAVE",
  "keyLocation": "https://$SITO/$CHIAVE.txt",
  "urlList": [$ELENCO]
}
FINE
)

# Il corpo si controlla PRIMA di spedirlo: un JSON malformato torna indietro
# come 400 secco, senza dire quale URL fosse rotto — e sono venti minuti persi
# a indovinare. Se python3 non c'è, si spedisce lo stesso.
if command -v python3 >/dev/null 2>&1; then
  printf 'corpo della richiesta… '
  if ! echo "$CORPO" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert all(u.startswith("https://"+d["host"]+"/") for u in d["urlList"]), "un URL non appartiene al dominio"' 2>/dev/null; then
    echo "NO"
    echo "$CORPO"
    exit 1
  fi
  echo "ok"
fi

printf 'invio a IndexNow… '
RISPOSTA=$(curl -s -o /dev/null -w '%{http_code}' -X POST "https://api.indexnow.org/IndexNow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "$CORPO")

case "$RISPOSTA" in
  200) echo "ok — accettate ${#PAGINE[@]} pagine" ;;
  202) echo "accettato, chiave in verifica (202)" ;;
  400) echo "NO — richiesta malformata (400)"; exit 1 ;;
  403) echo "NO — chiave rifiutata (403): il file sul sito non corrisponde"; exit 1 ;;
  422) echo "NO — URL non appartenenti al dominio, o chiave incoerente (422)"; exit 1 ;;
  429) echo "NO — troppi invii (429): aspetta prima di riprovare"; exit 1 ;;
  *)   echo "risposta inattesa: $RISPOSTA"; exit 1 ;;
esac

echo
echo "Fatto. Ricorda che GOOGLE non partecipa a IndexNow:"
echo "per Google servono Search Console e l'account di Simone —"
echo "Controllo URL → «Richiedi indicizzazione», una pagina alla volta."
