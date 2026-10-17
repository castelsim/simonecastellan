// Ricerca istantanea nella libreria, mentre si scrive.
//
// Ogni confronto si fa due volte: con gli spazi e senza, così «albachiara»,
// «alba chiara» e «Alba-Chiara» trovano lo stesso brano. Accenti, maiuscole e
// punteggiatura non contano. L'ordine premia il titolo, poi l'artista, poi il
// testo; un refuso nel titolo si perdona se le lettere sono nell'ordine giusto.
//
// Durante il concerto «Vai al brano» cerca anche le RIGHE dei testi (prova
// con il cantante del 06/10/2026: l'operatore cercava la riga scorrendo,
// «più avanti, più avanti…»). Una riga va bene se ogni parola scritta è
// l'inizio di una sua parola, in qualsiasi ordine («santa luc», «lucia
// santa»), oppure se le lettere scritte, senza spazi, partono dall'inizio di
// una sua parola («sullali» per «sull'ali»). Le note # e i segni di colore e
// grassetto non contano: si cerca ciò che il cantante legge.

import { analizza, righeCantate } from './testo.js';

export function normalizza(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const senzaSpazi = s => s.replace(/ /g, '');

// I segni di grassetto e colore non sono parole del brano.
const senzaSegni = s => String(s ?? '').replace(/\*\*|\{\/\}|\{[a-z]+\}/g, '');

export function creaIndice(brani) {
  return brani.map(brano => {
    const t = normalizza(brano.titolo);
    const a = normalizza(brano.artista);
    const x = normalizza(senzaSegni(brano.testo));
    return { brano, t, tc: senzaSpazi(t), a, ac: senzaSpazi(a), x, xc: senzaSpazi(x) };
  });
}

function inOrdine(ago, pagliaio) {
  let i = 0;
  for (const c of pagliaio) if (c === ago[i] && ++i === ago.length) return true;
  return false;
}

function punteggio(v, q, qc, parole) {
  if (v.tc === qc) return [100, 'titolo'];
  if (v.tc.startsWith(qc)) return [90, 'titolo'];
  if ((' ' + v.t).includes(' ' + q)) return [80, 'titolo'];
  if (v.tc.includes(qc)) return [70, 'titolo'];
  if (v.ac && v.ac.includes(qc)) return [50, 'artista'];
  const ta = v.t + ' ' + v.a;
  if (parole.every(p => ta.includes(p))) return [45, 'titolo'];
  if (v.x.includes(q) || v.xc.includes(qc)) return [30, 'testo'];
  if (qc.length >= 4 && inOrdine(qc, v.tc)) return [20, 'titolo'];
  return [0, null];
}

const perTitolo = (x, y) => x.brano.titolo.localeCompare(y.brano.titolo, 'it', { sensitivity: 'base' });

// → [{ brano, punteggio, dove }], i migliori per primi
export function cerca(indice, domanda, limite = 50) {
  const q = normalizza(domanda);
  if (!q) {
    return indice.map(v => ({ brano: v.brano, punteggio: 0, dove: null }))
      .sort(perTitolo).slice(0, limite);
  }
  const qc = senzaSpazi(q);
  const parole = q.split(' ');
  const trovati = [];
  for (const v of indice) {
    const [p, dove] = punteggio(v, q, qc, parole);
    if (p > 0) trovati.push({ brano: v.brano, punteggio: p, dove });
  }
  return trovati.sort((x, y) => y.punteggio - x.punteggio || perTitolo(x, y)).slice(0, limite);
}

// ——— righe dei testi ————————————————————————————————————————————————————

const MINIMO_RIGHE = 3;   // lettere: con meno, troppe righe e nessuna utile

// → [{ brano, righe: [{ i, s, n, testo, parole, xc }] }]
//   i = indice fra le righe da cantare (lo stesso di navigazione.js),
//   s = strofa (da 0), n = quale riga da cantare della strofa (da 1)
export function creaIndiceRighe(brani) {
  return brani.map(brano => {
    const analisi = analizza(brano.testo);
    let n = 0;
    const righe = righeCantate(analisi).map(({ s, r }, i, tutte) => {
      n = i > 0 && tutte[i - 1].s === s ? n + 1 : 1;
      const testo = analisi.strofe[s].righe[r].testo;
      const parole = normalizza(testo).split(' ').filter(Boolean);
      return { i, s, n, testo, parole, xc: parole.join('') };
    });
    return { brano, righe };
  });
}

function rigaTrovata(riga, qc, parole) {
  if (parole.every(p => riga.parole.some(w => w.startsWith(p)))) return true;
  if (!riga.xc.includes(qc)) return false;
  for (let k = 0; k < riga.parole.length; k++) {
    if (riga.parole.slice(k).join('').startsWith(qc)) return true;
  }
  return false;
}

// → [{ brano, i, s, n, testo }] nell'ordine dei brani e delle righe
export function cercaRighe(indice, domanda, limite = 50) {
  const q = normalizza(domanda);
  const qc = senzaSpazi(q);
  if (qc.length < MINIMO_RIGHE) return [];
  const parole = q.split(' ');
  const fuori = [];
  for (const { brano, righe } of indice) {
    for (const riga of righe) {
      if (!rigaTrovata(riga, qc, parole)) continue;
      fuori.push({ brano, i: riga.i, s: riga.s, n: riga.n, testo: riga.testo });
      if (fuori.length >= limite) return fuori;
    }
  }
  return fuori;
}

// La riga in pezzi, con le parole cercate segnate: → [{ testo, trovato }]
export function pezziTrovati(testo, domanda) {
  const parole = normalizza(domanda).split(' ').filter(Boolean);
  const pezzi = [];
  const aggiungi = (t, trovato) => {
    if (!t) return;
    const ultimo = pezzi[pezzi.length - 1];
    if (ultimo && ultimo.trovato === trovato) ultimo.testo += t;
    else pezzi.push({ testo: t, trovato });
  };
  let da = 0;
  for (const m of String(testo).matchAll(/[\p{L}\p{N}\p{M}]+/gu)) {
    const w = normalizza(m[0]);
    if (!parole.some(p => w.startsWith(p))) continue;
    aggiungi(testo.slice(da, m.index), false);
    aggiungi(m[0], true);
    da = m.index + m[0].length;
  }
  aggiungi(String(testo).slice(da), false);
  return pezzi;
}
