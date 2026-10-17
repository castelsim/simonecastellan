// La regia: sezioni, avvisi, tasti. Il concerto vive in concerto.js.

import { apriArchivio } from './archivio.js';
import { creaConcerto } from './concerto.js';
import { comandoDaTasto } from './tasti.js';
import { creaLibreria } from './libreria.js';
import { creaScalette } from './scalette.js';
import { creaImpostazioni } from './impostazioni.js';
import { apriTv as apriTvSuSchermo, tieniAcceso, registraFuoriLinea } from './schermo.js';
import { creaCopia } from './copia.js';

// ——— avvisi fissi in cima (rossi = problema, ambra = informazione) ————————

function creaAvvisi(box) {
  return {
    mostra(id, testo, { tipo = 'errore', classe = '', azione = null } = {}) {
      let el = box.querySelector(`[data-id="${id}"]`);
      if (!el) { el = document.createElement('div'); el.dataset.id = id; box.append(el); }
      el.className = `avviso ${tipo === 'info' ? 'info' : ''} ${classe}`.trim();
      el.textContent = testo;
      if (azione) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pulsante chiudi';
        b.textContent = azione.etichetta;
        b.addEventListener('click', azione.fai);
        el.append(b);
      }
    },
    togli(id) { box.querySelector(`[data-id="${id}"]`)?.remove(); },
  };
}

const avvisi = creaAvvisi(document.getElementById('avvisi'));
const spiaTv = document.getElementById('spia-tv');

let archivio;
try {
  archivio = await apriArchivio();
} catch (e) {
  avvisi.mostra('archivio', e.message);
}

// ——— copia automatica in una cartella (01/10/2026) ————————————————————————
// Ogni cambiamento vero della libreria (non i tasti del concerto) ne fa
// partire una copia nella cartella scelta in Impostazioni.
const copia = creaCopia({ archivio, avvisi, suCambio: () => moduli.impostazioni?.aggiornaCartella?.() });
archivio?.alCambio(() => copia.segnala());

// ——— sezioni ——————————————————————————————————————————————————————————

const sezioni = ['concerto', 'libreria', 'scalette', 'impostazioni'];
let vistaAttuale = 'concerto';
const moduli = {};   // libreria, scalette, impostazioni: si aggiungono nei compiti 8-10

export function vaiA(nome) {
  if (nome !== vistaAttuale) moduli[vistaAttuale]?.nascondi?.();
  vistaAttuale = nome;
  for (const s of sezioni) document.getElementById('vista-' + s).hidden = s !== nome;
  for (const b of document.querySelectorAll('.schede button')) {
    if (b.dataset.vista === nome) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  moduli[nome]?.mostra?.();
}
document.querySelector('.schede').addEventListener('click', e => {
  const b = e.target.closest('[data-vista]');
  if (b) vaiA(b.dataset.vista);
});

// ——— TV ————————————————————————————————————————————————————————————————

async function apriTv() {
  // Una regia in sola lettura non apre TV: due TV collegate si darebbero il
  // cambio a ogni battito (revisione 06/10/2026). La TV la apre chi comanda.
  if (concerto.solaLettura()) {
    avvisi.mostra('schermo', 'Questa regia è in sola lettura: la TV si apre dalla regia che comanda.', { tipo: 'info' });
    setTimeout(() => avvisi.togli('schermo'), 4000);
    return;
  }
  // Una TV collegata non si riapre: riaprirla la ricaricherebbe (nero breve).
  // Tranne se la sua finestra è finita sullo schermo del Mac (HDMI staccato e
  // riattaccato; verifica 06/10, avvio-04): lì il cantante non la vede, quindi
  // si chiude e se ne apre una nuova sulla TV, che riparte dalla stessa riga.
  const riapri = concerto.tvCollegata() && concerto.tvFinitaSulMac();
  if (concerto.tvCollegata() && !riapri) {
    avvisi.mostra('schermo', 'La TV è già aperta e collegata.', { tipo: 'info' });
    setTimeout(() => avvisi.togli('schermo'), 4000);
    return;
  }
  if (riapri) {
    concerto.chiudiTvSulMac();
    await new Promise(r => setTimeout(r, 300));
  }
  const aperta = Date.now();
  const { esterno } = await apriTvSuSchermo();
  // La TV, appena aperta, saluta sul canale: se in 3 secondi non lo fa, la
  // finestra non si è aperta (Chrome può bloccarla la prima volta).
  const arrivata = () => (riapri ? concerto.tvSalutata(aperta) : concerto.tvCollegata());
  for (let i = 0; i < 30 && !arrivata(); i++) await new Promise(r => setTimeout(r, 100));
  if (!arrivata()) {
    avvisi.mostra('schermo', 'La finestra della TV non si è aperta: premi di nuovo «Apri TV».', { tipo: 'info' });
  } else if (!esterno) {
    avvisi.mostra('schermo', 'Nessun secondo schermo trovato: la TV si apre in una finestra. Collega la TV in HDMI e in Impostazioni di Sistema → Monitor scegli «Estendi» (non «Duplica»); poi trascina la finestra sulla TV e premi F.', { tipo: 'info' });
  } else {
    avvisi.togli('schermo');
  }
}
document.getElementById('apri-tv').addEventListener('click', apriTv);
registraFuoriLinea();
tieniAcceso();

// Durante il concerto, se la tastiera non è sulla regia (per esempio è
// rimasta sulla finestra della TV) lo si dice in grande: sulla TV valgono
// solo frecce, Spazio e pedale (revisione 01/10/2026, I1).
addEventListener('blur', () => {
  if (concerto?.inCorso() && !concerto.solaLettura()) {
    avvisi.mostra('fuoco', 'La tastiera non è sulla regia: clicca qui per comandare. Sulla TV funzionano solo frecce, Spazio e pedale.', { tipo: 'info' });
  }
});
addEventListener('focus', () => avvisi.togli('fuoco'));

// ——— concerto ———————————————————————————————————————————————————————————

const concerto = creaConcerto({
  archivio,
  radice: document.getElementById('vista-concerto'),
  avvisi,
  spiaTv,
  apriTv,
  vaiA,
  braniLibreria: () => libreria?.brani() ?? [],
  suCambio() {
    document.querySelector('[data-vista="concerto"]').classList.toggle('in-corso', concerto.inCorso());
    document.getElementById('apri-tv').classList.toggle('giallo', !concerto.tvCollegata());
  },
});

// I tasti del concerto valgono solo nella schermata del concerto e mai mentre
// si scrive: una freccia in un campo di testo non deve muovere il cantante.
addEventListener('keydown', e => {
  if (vistaAttuale !== 'concerto') return;
  if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (document.querySelector('dialog[open], .pannello-vai[open]')) return;
  const c = comandoDaTasto(e);
  if (!c) return;
  e.preventDefault();
  if (c.tipo === 'cerca') concerto.cerca();
  else if (c.tipo === 'correggi') concerto.correggi();
  else concerto.comando(c);
});

// ——— libreria ———————————————————————————————————————————————————————————

const libreria = creaLibreria({
  archivio,
  radice: document.getElementById('vista-libreria'),
  avvisi,
  spiaSalvato: document.getElementById('spia-salvato'),
  concerto,
});
moduli.libreria = { mostra: () => libreria.mostra(), nascondi: () => libreria.salva() };
moduli.concerto = { mostra: () => concerto.disegna() };

const scalette = creaScalette({ archivio, radice: document.getElementById('vista-scalette'), avvisi, concerto, libreria, vaiA });
moduli.scalette = { mostra: () => scalette.mostra() };

const impostazioni = creaImpostazioni({ archivio, radice: document.getElementById('vista-impostazioni'), avvisi, concerto, copia });
moduli.impostazioni = { mostra: () => impostazioni.mostra(), aggiornaCartella: () => impostazioni.aggiornaCartella() };

// Chiudere o ricaricare la regia durante un concerto chiede conferma. Anche
// confermando non succede niente di grave: la TV tiene il testo e la regia,
// riaperta, riparte dalla stessa riga.
addEventListener('beforeunload', e => {
  if (concerto.inCorso() && !concerto.solaLettura()) { e.preventDefault(); e.returnValue = ''; }
});

const parametri = new URLSearchParams(location.search);
vaiA('concerto');
await libreria.avvia();
await concerto.avvia({ demo: parametri.has('demo') });
// Senza concerto in corso si parte dalla libreria.
if (!concerto.inCorso()) vaiA('libreria');
archivio?.protetta().catch(() => {});
await copia.avvia();
if (copia.stato() !== 'attiva') impostazioni.promemoria(libreria.brani().length);

export { archivio, avvisi, concerto, moduli, copia };
