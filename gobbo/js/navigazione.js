// Dove siamo nel concerto, e i comandi che lo cambiano.
//
// Concerto = { nome, versione, brani: [{ id, titolo, artista, testo }] }
//   è una COPIA FISSA della scaletta, presa a «Inizia il concerto»: modificare
//   la libreria non sposta niente sotto gli occhi del cantante.
// Stato = { n, b, r, nero }
//   n    progressivo: cresce a ogni cambio; regia e TV tengono lo stato con n più alto
//   b    indice del brano nel concerto
//   r    indice in righeCantate(analisi) — le sole righe da cantare, note escluse
//        (attenzione: vista().rigaAccesa.r è invece l'indice in strofa.righe)
//   nero la TV mostra solo nero
//
// Ogni azione — tasto, clic, pulsante, domani MIDI o pedale — passa da applica():
// un comando, un posto.

import { analizza, righeCantate, righeDi } from './testo.js';

const limita = (x, min, max) => Math.max(min, Math.min(max, x));

export function prepara(concerto) {
  const brani = (concerto?.brani ?? []).map(brano => {
    const analisi = analizza(brano.testo);
    return { ...brano, analisi, cantate: righeCantate(analisi) };
  });
  return { concerto, brani };
}

export function statoIniziale() {
  return { n: 0, b: 0, r: 0, nero: false };
}

function primaDellaStrofa(cantate, s) {
  return cantate.findIndex(p => p.s === s);
}

export function applica(prep, stato, comando) {
  const nb = prep.brani.length;
  if (!nb) return stato;
  let b = limita(stato.b, 0, nb - 1);
  let r = stato.r;
  let nero = stato.nero;
  const cantate = prep.brani[b].cantate;
  const qui = cantate[r];

  switch (comando?.tipo) {
    case 'riga+':
      if (r < cantate.length - 1) r += 1;
      break;
    case 'riga-':
      if (r > 0) r -= 1;
      break;
    case 'strofa+': {
      if (!qui) break;
      const j = cantate.findIndex((p, i) => i > r && p.s > qui.s);
      if (j >= 0) r = j;
      break;
    }
    case 'strofa-': {
      if (!qui) break;
      const inizio = primaDellaStrofa(cantate, qui.s);
      if (r > inizio) r = inizio;
      else if (r > 0) r = primaDellaStrofa(cantate, cantate[r - 1].s);
      break;
    }
    case 'brano+':
      if (b < nb - 1) { b += 1; r = 0; nero = false; }
      break;
    case 'brano-':
      if (b > 0) { b -= 1; r = 0; nero = false; }
      break;
    case 'nero':
      nero = !nero;
      break;
    case 'vaiBrano':
      b = limita(comando.b | 0, 0, nb - 1); r = 0; nero = false;
      break;
    case 'vaiRiga':
      b = limita(comando.b | 0, 0, nb - 1);
      r = limita(comando.r | 0, 0, Math.max(0, prep.brani[b].cantate.length - 1));
      nero = false;
      break;
    default:
      return stato;
  }
  if (b === stato.b && r === stato.r && nero === stato.nero) return stato;
  return { n: stato.n + 1, b, r, nero };
}

function rigaDi(brano, pos) {
  return pos ? brano.analisi.strofe[pos.s].righe[pos.r] : null;
}

// Tutto ciò che serve per disegnare la TV e la regia.
export function vista(prep, stato) {
  const nb = prep.brani.length;
  if (!nb) {
    return { brano: null, analisi: { strofe: [] }, s: null, rigaAccesa: null, prossima: null,
             numero: 0, totale: 0, titoloDopo: null, nero: !!stato.nero };
  }
  const b = limita(stato.b, 0, nb - 1);
  const brano = prep.brani[b];
  const pos = brano.cantate[limita(stato.r, 0, Math.max(0, brano.cantate.length - 1))] ?? null;
  const dopo = prep.brani[b + 1] ?? null;

  let prossima = null;
  if (pos) prossima = rigaDi(brano, brano.cantate.find(p => p.s > pos.s));
  if (!prossima && dopo) prossima = rigaDi(dopo, dopo.cantate[0]);

  return {
    brano,
    analisi: brano.analisi,
    // Senza righe da cantare (brano vuoto o di sole note) la TV mostra il titolo.
    s: pos ? pos.s : null,
    rigaAccesa: pos ? { s: pos.s, r: pos.r } : null,
    prossima,
    numero: b + 1,
    totale: nb,
    titoloDopo: dopo ? dopo.titolo : null,
    nero: !!stato.nero,
  };
}

// Stesso numero di righe e al massimo una diversa, confrontate una per una.
function unaRigaCambiata(primo, secondo) {
  const a = righeDi(primo), b = righeDi(secondo);
  return a.length === b.length && a.filter((x, i) => x !== b[i]).length <= 1;
}

// Dopo una correzione (o un brano aggiunto al volo) il concerto cambia: la
// riga accesa deve restare LA STESSA RIGA DI TESTO, non lo stesso numero —
// altrimenti una riga aggiunta più su sposterebbe il cantante.
export function riallinea(prepVecchio, prepNuovo, stato) {
  const nb = prepNuovo.brani.length;
  if (!nb) return { ...stato, n: stato.n + 1, b: 0, r: 0 };

  const vecchio = prepVecchio.brani[stato.b];
  let b = limita(stato.b, 0, nb - 1);
  if (vecchio) {
    let migliore = -1;
    prepNuovo.brani.forEach((x, i) => {
      if (x.id === vecchio.id && (migliore < 0 || Math.abs(i - stato.b) < Math.abs(migliore - stato.b))) migliore = i;
    });
    if (migliore >= 0) b = migliore;
  }

  const nuovo = prepNuovo.brani[b];
  let r = limita(stato.r, 0, Math.max(0, nuovo.cantate.length - 1));
  const prima = vecchio ? rigaDi(vecchio, vecchio.cantate[stato.r]) : null;
  if (prima && vecchio.id === nuovo.id && unaRigaCambiata(vecchio.testo, nuovo.testo)) {
    // Cambia una riga sola (la correzione al volo): resta la stessa riga del
    // testo, anche se un'altra uguale (ritornello) è più vicina per contenuto.
    // Se la riga è diventata vuota o una nota, la dopo. (Verifica del
    // 06/10/2026, sincronia-1.) Righe spostate a parità di numero (modifica
    // dalla Libreria) seguono invece il contenuto, qui sotto (revisione 06/10).
    const j = nuovo.cantate.findIndex(p => rigaDi(nuovo, p).linea >= prima.linea);
    r = j >= 0 ? j : Math.max(0, nuovo.cantate.length - 1);
  } else if (prima && vecchio.id === nuovo.id) {
    let migliore = -1;
    nuovo.cantate.forEach((p, i) => {
      if (rigaDi(nuovo, p).sorgente === prima.sorgente
          && (migliore < 0 || Math.abs(i - stato.r) < Math.abs(migliore - stato.r))) migliore = i;
    });
    if (migliore >= 0) r = migliore;
  }
  return { n: stato.n + 1, b, r, nero: stato.nero };
}
