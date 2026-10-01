// Disegna una vista (da navigazione.vista) dentro un elemento.
// La TV e l'anteprima in regia usano questa stessa funzione: quello che
// l'operatore vede in piccolo è esattamente quello che vede il cantante.

function pezzo(p) {
  const el = document.createElement('span');
  el.textContent = p.testo;
  if (p.grassetto) el.classList.add('grassetto');
  if (p.colore) el.classList.add('c-' + p.colore);
  return el;
}

export function riempiRiga(el, riga) {
  if (riga.pezzi.length) el.append(...riga.pezzi.map(pezzo));
  else el.textContent = '\u00a0';
  return el;
}
const riempi = riempiRiga;

// L'altezza della barra di stato dipende dallo schermo della TV (non dalla
// finestra in cui si disegna): così l'anteprima in regia è fedele.
export const altezzaStato = altezza => Math.min(64, Math.max(28, altezza * 0.06));

// opzioni: { mostraStato, regia (mostra le note #), carattere (px), altezza (px dello schermo) }
export function disegnaVista(radice, vista, { mostraStato = true, regia = false, carattere = null, altezza = innerHeight } = {}) {
  radice.classList.add('gobbo-vista');
  radice.classList.toggle('nero', !!vista.nero);
  if (carattere) radice.style.setProperty('--carattere', carattere + 'px');
  radice.style.setProperty('--alto-stato', altezzaStato(altezza) + 'px');

  const parti = [];
  if (mostraStato && vista.brano) {
    const stato = document.createElement('div');
    stato.className = 'stato';
    const pos = document.createElement('span');
    pos.textContent = `${vista.numero}/${vista.totale} · ${vista.brano.titolo}`;
    const dopo = document.createElement('span');
    dopo.textContent = vista.titoloDopo ? `poi: ${vista.titoloDopo}` : '';
    stato.append(pos, dopo);
    parti.push(stato);
  }
  radice.classList.toggle('senza-stato', !(mostraStato && vista.brano));

  const area = document.createElement('div');
  area.className = 'area';
  const scorre = document.createElement('div');
  scorre.className = 'scorre';
  const strofa = document.createElement('div');
  strofa.className = 'strofa';
  scorre.append(strofa);
  area.append(scorre);
  parti.push(area);

  if (vista.brano && vista.s === null) {
    // Brano senza testo: solo il titolo, nessun errore.
    const t = document.createElement('div');
    t.className = 'riga titolo-solo';
    t.textContent = vista.brano.titolo;
    strofa.append(t);
  } else if (vista.brano) {
    const accesa = vista.rigaAccesa;
    vista.analisi.strofe[vista.s].righe.forEach((riga, r) => {
      if (riga.tipo === 'nota' && !regia) return;
      const el = document.createElement('div');
      let stato = 'futura';
      if (riga.tipo === 'nota') stato = 'nota';
      else if (accesa && r < accesa.r) stato = 'passata';
      else if (accesa && r === accesa.r) stato = 'accesa';
      el.className = 'riga ' + stato;
      strofa.append(riempi(el, riga));
    });
    if (vista.prossima) {
      const p = document.createElement('div');
      p.className = 'prossima';
      scorre.append(riempi(p, vista.prossima));
    }
  }

  radice.replaceChildren(...parti);
  tieniVisibile(radice);
}

// Se la strofa non sta nello schermo (carattere già al minimo), la fa
// scorrere quanto basta perché la riga accesa resti a un terzo dall'alto.
// Niente requestAnimationFrame: in una finestra nascosta è fermo.
export function tieniVisibile(radice) {
  const area = radice.querySelector('.area');
  const scorre = radice.querySelector('.scorre');
  const accesa = radice.querySelector('.riga.accesa');
  if (!area || !scorre) return;
  scorre.style.transform = '';
  const lunga = scorre.offsetHeight > area.clientHeight;
  area.classList.toggle('lunga', lunga);
  if (!lunga || !accesa) return;
  const voluto = area.clientHeight * 0.3;
  const massimo = scorre.offsetHeight - area.clientHeight;
  const spost = Math.max(0, Math.min(massimo, accesa.offsetTop - voluto));
  scorre.style.transform = `translateY(${-spost}px)`;
}
