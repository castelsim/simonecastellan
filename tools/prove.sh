#!/usr/bin/env bash
# Tutte le prove che girano da riga di comando, in fila, con un verdetto solo.
#
#     tools/prove.sh          (da qualunque cartella: ./prove.sh, ~/…/tools/prove.sh)
#
# Esiste perché tre comandi da ricordare sono tre comandi che non si lanciano.
# Esce 1 se anche una sola prova fallisce, così può stare dentro un alias, un
# hook di git o un LaunchAgent senza altre righe intorno.
#
# Quello che NON gira qui: i controlli del browser (tools/regressione.html, si
# apre da un server locale) e le prove fisiche (tools/PROVE-A-MANO.md: iPhone,
# microfono, rotazione, Safari, Firefox, Edge, Android).

set -u

# La cartella dello script, non quella da cui è stato lanciato: così funziona
# anche chiamandolo per intero da un'altra parte, e anche se è un collegamento.
QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RADICE="$(dirname "$QUI")"

VERDE=""; ROSSO=""; TENUE=""; FINE=""
if [ -t 1 ]; then VERDE=$'\033[32m'; ROSSO=$'\033[31m'; TENUE=$'\033[2m'; FINE=$'\033[0m'; fi

FALLITE=0
NOMI=()
ESITI=()
TEMPI=()

manca() {
  printf '%s\n' "${ROSSO}manca $1: la prova non può girare${FINE}"
  FALLITE=$((FALLITE + 1))
  NOMI+=("$2"); ESITI+=("MANCA"); TEMPI+=("-")
}

prova() {   # prova <nome leggibile> <comando…>
  local nome="$1"; shift
  printf '\n%s\n' "${TENUE}——— $nome ———${FINE}"
  local t0=$SECONDS
  if "$@"; then
    local esito="ok"
  else
    local esito="FALLITA"
    FALLITE=$((FALLITE + 1))
  fi
  NOMI+=("$nome"); ESITI+=("$esito"); TEMPI+=("$((SECONDS - t0))s")
}

command -v python3 >/dev/null 2>&1 || { echo "${ROSSO}serve python3${FINE}"; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "${ROSSO}serve node${FINE}"; exit 1; }

if [ -f "$QUI/verifica.py" ]; then
  prova "verifica del sito" python3 "$QUI/verifica.py"
else
  manca "$QUI/verifica.py" "verifica del sito"
fi

if [ -f "$QUI/prova-dsp.js" ]; then
  prova "motore di misura (DSP)" node "$QUI/prova-dsp.js"
else
  manca "$QUI/prova-dsp.js" "motore di misura (DSP)"
fi

if [ -f "$QUI/prova-tonalita.js" ]; then
  prova "riconoscimento tonalità" node "$QUI/prova-tonalita.js"
else
  manca "$QUI/prova-tonalita.js" "riconoscimento tonalità"
fi

if [ -f "$QUI/prova-accordi.js" ]; then
  prova "trasporto degli accordi" node "$QUI/prova-accordi.js"
else
  manca "$QUI/prova-accordi.js" "trasporto degli accordi"
fi

if [ -f "$QUI/prova-peso-x.js" ]; then
  prova "quanto pesa per X" node "$QUI/prova-peso-x.js"
else
  manca "$QUI/prova-peso-x.js" "quanto pesa per X"
fi

if [ -f "$QUI/prova-leggibilita.js" ]; then
  prova "leggibilità (Gulpease)" node "$QUI/prova-leggibilita.js"
else
  manca "$QUI/prova-leggibilita.js" "leggibilità (Gulpease)"
fi

if [ -f "$QUI/prova-segnali.js" ]; then
  prova "segnali di prova (clip)" node "$QUI/prova-segnali.js"
else
  manca "$QUI/prova-segnali.js" "segnali di prova (clip)"
fi

printf '\n%s\n' "${TENUE}——— riassunto ———${FINE}"
for i in "${!NOMI[@]}"; do
  if [ "${ESITI[$i]}" = "ok" ]; then
    printf '  %s  %-26s %s\n' "${VERDE}ok${FINE}" "${NOMI[$i]}" "${TENUE}${TEMPI[$i]}${FINE}"
  else
    printf '  %s   %-26s %s\n' "${ROSSO}✗${FINE}" "${NOMI[$i]}" "${ROSSO}${ESITI[$i]}${FINE}"
  fi
done

if [ "$FALLITE" -gt 0 ]; then
  if [ "$FALLITE" -eq 1 ]; then QUANTE="una prova fallita"; else QUANTE="$FALLITE prove fallite"; fi
  printf '\n%s\n' "${ROSSO}$QUANTE: non si pubblica.${FINE}"
  exit 1
fi

PORTA=$((8000 + RANDOM % 1000))
printf '\n%s\n' "${VERDE}Tutte le prove da riga di comando sono passate.${FINE}"
cat <<FINEMESSAGGIO
${TENUE}Restano quelle che vogliono un browser e quelle che vogliono le mani:

  python3 -c "from http.server import SimpleHTTPRequestHandler as H, ThreadingHTTPServer as S; from functools import partial; S(('127.0.0.1',$PORTA), partial(H, directory='$RADICE')).serve_forever()"
  → http://localhost:$PORTA/tools/regressione.html   (risposta, JavaScript, sbordo,
    bersagli, contrasto, intestazioni — su ogni pagina, con i casi rotti apposta)
  → http://localhost:$PORTA/tools/banco.html         (errori JavaScript su ogni
    strumento; la PRIMA riga dice se la spia sta guardando davvero)
  → $QUI/PROVE-A-MANO.md   (iPhone, microfono, rotazione, Safari, Firefox, Edge, Android)

  Il server è a più thread, non «python3 -m http.server»: quello a thread
  singolo si impicca a metà: le pagine chiedono altre risorse mentre la loro
  richiesta è ancora aperta, e uno strumento sano sembra rotto.

  La porta cambia a ogni giro apposta: il browser serve JavaScript e CSS dalla
  cache anche quando sono cambiati, e su una porta nuova non ce li ha.${FINE}
FINEMESSAGGIO
exit 0
