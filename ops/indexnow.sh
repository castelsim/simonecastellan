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
PAGINE=(
  "/profilo/"
  "/"
  "/cv/"
  "/en/profile/"
  "/tools/"
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
ELENCO=$(printf '"https://%s%s",' "$SITO" "${PAGINE[@]}" | sed 's/,$//')
CORPO=$(cat <<FINE
{
  "host": "$SITO",
  "key": "$CHIAVE",
  "keyLocation": "https://$SITO/$CHIAVE.txt",
  "urlList": [$ELENCO]
}
FINE
)

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
