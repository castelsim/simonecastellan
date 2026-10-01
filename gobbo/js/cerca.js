// Ricerca istantanea nella libreria, mentre si scrive.
//
// Ogni confronto si fa due volte: con gli spazi e senza, così «albachiara»,
// «alba chiara» e «Alba-Chiara» trovano lo stesso brano. Accenti, maiuscole e
// punteggiatura non contano. L'ordine premia il titolo, poi l'artista, poi il
// testo; un refuso nel titolo si perdona se le lettere sono nell'ordine giusto.

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
