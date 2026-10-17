// Il testo di un brano: da testo semplice a strofe, righe e pezzi.
//
// Come si scrive (lo stesso che dice la specifica, §4):
//   riga vuota          = nuova strofa
//   **parola**          = grassetto
//   {colore}…{/}        = colore (giallo, azzurro, verde, arancio, rosa)
//   # all'inizio riga   = nota per la regia: la TV non la mostra mai
// Grassetto e colore valgono fino a fine riga anche se non chiusi: un segno
// dimenticato non può colorare mezzo brano.

// Gli stessi valori di css/comune.css: tutti sopra 7:1 sul nero.
export const COLORI = {
  giallo: '#ffd23f',
  azzurro: '#5ec8f2',
  verde: '#7ee08a',
  arancio: '#ffa94d',
  rosa: '#ff9ccf',
};

const SEGNO = /\*\*|\{\/\}|\{([a-z]+)\}/g;

// Oltre agli a capo normali valgono quelli «morbidi» che arrivano da Pages
// (Maiusc+Invio = U+2028), Word e PDF (VT, FF, NEL); U+2029 separa paragrafi,
// cioè strofe. Senza, una strofa incollata diventa una riga sola e il
// carattere di tutto il brano scende al minimo (revisione 01/10/2026).
const A_CAPO = /\r\n|[\r\n\u000b\u000c\u0085\u2028]/;

export function righeDi(testo) {
  return String(testo ?? '').replace(/\u2029/g, '\n\n').split(A_CAPO);
}

function pezziDi(riga) {
  const pezzi = [];
  let grassetto = false;
  let colore = null;
  let da = 0;
  const aggiungi = (testo) => {
    if (!testo) return;
    const ultimo = pezzi[pezzi.length - 1];
    if (ultimo && ultimo.grassetto === grassetto && ultimo.colore === colore) ultimo.testo += testo;
    else pezzi.push({ testo, grassetto, colore });
  };
  for (const m of riga.matchAll(SEGNO)) {
    const segno = m[0];
    if (segno.startsWith('{') && segno !== '{/}' && !(m[1] in COLORI)) continue; // colore sconosciuto: resta testo
    aggiungi(riga.slice(da, m.index));
    da = m.index + segno.length;
    if (segno === '**') grassetto = !grassetto;
    else if (segno === '{/}') colore = null;
    else colore = m[1];
  }
  aggiungi(riga.slice(da));
  return pezzi;
}

// → { strofe: [ { righe: [ Riga ] } ] }
// Riga = { tipo: 'canto' | 'nota', pezzi, testo, sorgente, linea }
//   testo     = ciò che si legge (senza segni)
//   sorgente  = la riga com'è scritta
//   linea     = indice della riga nel testo intero (per correggerla al volo)
export function analizza(testo) {
  const strofe = [];
  let corrente = null;
  righeDi(testo).forEach((sorgente, linea) => {
    if (!sorgente.trim()) { corrente = null; return; }
    if (!corrente) { corrente = { righe: [] }; strofe.push(corrente); }
    const pulita = sorgente.trim();
    if (pulita.startsWith('#')) {
      const nota = pulita.replace(/^#+\s*/, '');
      corrente.righe.push({ tipo: 'nota', pezzi: nota ? [{ testo: nota, grassetto: false, colore: null }] : [], testo: nota, sorgente, linea });
      return;
    }
    const pezzi = pezziDi(pulita);
    corrente.righe.push({ tipo: 'canto', pezzi, testo: pezzi.map(p => p.testo).join(''), sorgente, linea });
  });
  return { strofe };
}

// Le righe su cui l'operatore si ferma, in ordine: le note no.
// → [{ s, r }]   s = indice della strofa, r = indice in strofa.righe
export function righeCantate(analisi) {
  const fuori = [];
  analisi.strofe.forEach((strofa, s) => strofa.righe.forEach((riga, r) => {
    if (riga.tipo === 'canto') fuori.push({ s, r });
  }));
  return fuori;
}

// Avvolge la selezione [inizio, fine) con grassetto o colore, una riga alla
// volta (i segni valgono fino a fine riga). Se la selezione è già avvolta
// proprio con quel segno, lo toglie: G premuto due volte non fa danni.
// → { testo, inizio, fine } con la nuova selezione
export function avvolgi(testo, inizio, fine, segno) {
  const apri = segno === 'grassetto' ? '**' : `{${segno}}`;
  const chiudi = segno === 'grassetto' ? '**' : '{/}';
  const scelto = testo.slice(inizio, fine);

  if (scelto.length > apri.length + chiudi.length && !scelto.includes('\n')
      && scelto.startsWith(apri) && scelto.endsWith(chiudi)) {
    const dentro = scelto.slice(apri.length, scelto.length - chiudi.length);
    return { testo: testo.slice(0, inizio) + dentro + testo.slice(fine), inizio, fine: inizio + dentro.length };
  }

  if (inizio === fine) {
    const nuovo = testo.slice(0, inizio) + apri + chiudi + testo.slice(fine);
    return { testo: nuovo, inizio: inizio + apri.length, fine: inizio + apri.length };
  }

  const avvolto = scelto.split('\n')
    .map(pezzo => pezzo.trim() ? apri + pezzo + chiudi : pezzo)
    .join('\n');
  return { testo: testo.slice(0, inizio) + avvolto + testo.slice(fine), inizio, fine: inizio + avvolto.length };
}

// Sostituisce la riga numero `linea` (contando da 0) con `nuova`.
export function sostituisciRiga(testo, linea, nuova) {
  const righe = righeDi(testo);
  if (linea < 0 || linea >= righe.length) return righe.join('\n');
  righe[linea] = nuova;
  return righe.join('\n');
}

// Ripulisce ciò che arriva da Word, PDF, siti e messaggi: a capo di Windows,
// spazi non separabili, tabulazioni, caratteri invisibili. Sulla TV un
// carattere invisibile diventa un quadratino o uno spazio fuori posto.
export function pulisci(testo) {
  return String(testo ?? '')
    .replace(/[\ufeff\u200b-\u200f\u2060\u00ad\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u2029/g, '\n\n')
    .replace(/\r\n?|[\u000b\u000c\u0085\u2028]/g, '\n')
    .replace(/[\t\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .split('\n')
    .map(riga => riga.replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');
}
