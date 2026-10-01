// La regia: sezioni, avvisi, tasti. Il concerto vive in concerto.js.

import { apriArchivio } from './archivio.js';
import { creaConcerto } from './concerto.js';
import { comandoDaTasto } from './tasti.js';
import { creaLibreria } from './libreria.js';
import { creaScalette } from './scalette.js';
import { creaImpostazioni } from './impostazioni.js';
import { apriTv as apriTvSuSchermo, tieniAcceso, registraFuoriLinea } from './schermo.js';

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
  // Una TV collegata non si riapre: riaprirla la ricaricherebbe (nero breve).
  if (concerto.tvCollegata()) {
    avvisi.mostra('schermo', 'La TV è già aperta e collegata.', { tipo: 'info' });
    setTimeout(() => avvisi.togli('schermo'), 4000);
    return;
  }
  const { esterno } = await apriTvSuSchermo();
  // La TV, appena aperta, saluta sul canale: se in 3 secondi non lo fa, la
  // finestra non si è aperta (Chrome può bloccarla la prima volta).
  for (let i = 0; i < 30 && !concerto.tvCollegata(); i++) await new Promise(r => setTimeout(r, 100));
  if (!concerto.tvCollegata()) {
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

const impostazioni = creaImpostazioni({ archivio, radice: document.getElementById('vista-impostazioni'), avvisi, concerto });
moduli.impostazioni = { mostra: () => impostazioni.mostra() };

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
impostazioni.promemoria(libreria.brani().length);

export { archivio, avvisi, concerto, moduli };
