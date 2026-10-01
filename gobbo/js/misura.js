// Quanto grande può essere il carattere sulla TV.
//
// Una misura per BRANO, non per strofa: il carattere non deve cambiare sotto
// gli occhi del cantante a ogni strofa. Decide la riga più larga (in larghezza)
// e la strofa più lunga (in altezza). Si misura in grassetto, il caso peggiore:
// qualunque riga può contenere parole in grassetto.

// Oltre alle righe della strofa servono: la riga «prossima» (al 60%) e lo stacco.
const RIGHE_IN_PIU = 1.6;

export function dimensioneCarattere({ strofe, larghezza, altezza, interlinea, massimo, minimo = 28, misura }) {
  const righe = strofe.flat();
  if (!righe.length) return Math.round(massimo);

  const larghezzaA100 = Math.max(...righe.map(t => misura(t, 100)));
  const perLarghezza = larghezzaA100 > 0 ? larghezza * 100 / larghezzaA100 : Infinity;
  const piuLunga = Math.max(...strofe.map(s => s.length));
  const perAltezza = altezza / (interlinea * (piuLunga + RIGHE_IN_PIU));

  return Math.max(minimo, Math.floor(Math.min(massimo, perLarghezza, perAltezza)));
}

// Il carattere per un brano intero in uno schermo larghezza × altezza, con le
// impostazioni della TV { massimo, interlinea, margine (%), mostraStato }.
// Lo usano la TV e l'anteprima in regia: stesso conto, stessa resa.
export function caratterePerBrano({ brano, larghezza, altezza, imp, misura }) {
  let strofe = brano.analisi.strofe
    .map(s => s.righe.filter(r => r.tipo === 'canto').map(r => r.testo))
    .filter(s => s.length);
  if (!strofe.length) strofe = [[brano.titolo || ' ']];
  const lati = larghezza * imp.margine / 100 * 2;
  // Stessa formula di resa.altezzaStato (qui senza DOM, per le prove in Node).
  const altoStato = imp.mostraStato ? Math.min(64, Math.max(28, altezza * 0.06)) : 0;
  const base = { strofe, altezza: altezza - altoStato, interlinea: imp.interlinea, massimo: imp.massimo, misura };
  // La barra gialla occupa 0,4 caratteri a sinistra: due passate bastano.
  const f = dimensioneCarattere({ ...base, larghezza: larghezza - lati });
  return dimensioneCarattere({ ...base, larghezza: larghezza - lati - f * 0.4 });
}

// La misura vera, con un canvas: la stessa famiglia e lo stesso peso della TV.
export function misuratoreCanvas(famiglia) {
  const ctx = document.createElement('canvas').getContext('2d');
  return (testo, px) => {
    ctx.font = `700 ${px}px ${famiglia}`;
    return ctx.measureText(testo).width;
  };
}
