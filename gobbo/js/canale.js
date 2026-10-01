// Regia ↔ TV: due finestre dello stesso Chrome, nessuna rete.
//
// Messaggi (tutti portano { tipo, da, id, nato }):
//   regia → TV  concerto {concerto, stato}   l'intera scaletta coi testi + dove siamo
//               stato {stato}                solo la posizione
//               impostazioni {tv}
//               battito
//               chiedi                       «TV, dove sei arrivata?»
//   TV → regia  ciao {larghezza, altezza}
//               battito {larghezza, altezza}
//               tasto {comando}
//               statoTv {stato, concertoId, versione}
//
// Qualunque messaggio dell'altro vale come battito: un timer rallentato da
// Chrome (finestra coperta) non deve far credere morta una regia che parla.

const NOME = 'gobbo';

export const OGNI = 500;
export const PERSO = 2000;

export function apriCanale(ruolo, suMessaggio) {
  const bc = new BroadcastChannel(NOME);
  const id = crypto.randomUUID();
  const nato = Date.now();
  bc.onmessage = e => {
    const m = e.data;
    if (!m || typeof m !== 'object' || m.id === id) return;
    suMessaggio(m);
  };
  return {
    id,
    nato,
    manda(msg) { bc.postMessage({ ...msg, da: ruolo, id, nato }); },
    chiudi() { bc.close(); },
  };
}

// Tiene il conto dell'ultimo segno di vita dell'altro.
// battito(): si chiama a ogni giro (per mandare il proprio).
// suPerso / suRitrovato: cambi di stato del collegamento.
export function sorveglia({ ogni = OGNI, perso = PERSO, battito, suPerso, suRitrovato }) {
  let ultimo = 0;
  let collegato = false;
  const giro = setInterval(() => {
    battito?.();
    if (collegato && Date.now() - ultimo > perso) {
      collegato = false;
      suPerso?.();
    }
  }, ogni);
  return {
    visto() {
      ultimo = Date.now();
      if (!collegato) { collegato = true; suRitrovato?.(); }
    },
    collegato: () => collegato,
    ferma() { clearInterval(giro); },
  };
}
