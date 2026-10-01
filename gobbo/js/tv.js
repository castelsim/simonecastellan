// La finestra sulla TV.
//
// Regola d'oro: la TV non si svuota mai da sola. Tiene sempre l'ultimo testo
// ricevuto; se la regia sparisce, sa andare avanti da sola con gli stessi tasti
// («autonomia»); se si ricarica, riparte dall'ultimo concerto salvato.
//
// Con ?prova=1 (o ?prova=lunga) gira senza regia, sui testi d'esempio.

import { prepara, statoIniziale, applica, vista } from './navigazione.js';
import { comandoDaTasto } from './tasti.js';
import { disegnaVista } from './resa.js';
import { caratterePerBrano, misuratoreCanvas } from './misura.js';
import { ESEMPI, branoLungo } from './esempi.js';
import { apriCanale, sorveglia } from './canale.js';
import { apriArchivio } from './archivio.js';
import { IMPOSTAZIONI_TV } from './impostazioni-tv.js';
import { tieniAcceso, registraFuoriLinea } from './schermo.js';

const radice = document.getElementById('tv');
const spia = document.getElementById('spia');
const avviso = document.getElementById('avviso');
const pulsanteSchermo = document.getElementById('schermo-intero');

const tv = {
  concerto: null,                 // { id, nome, versione, brani }
  prep: prepara({ brani: [] }),
  stato: statoIniziale(),
  imp: { ...IMPOSTAZIONI_TV },
};

const misura = misuratoreCanvas('"Atkinson Hyperlegible"');
const memoria = new Map();

function caratterePer(brano) {
  if (!brano) return tv.imp.massimo;
  const chiave = [brano.id, brano.testo, innerWidth, innerHeight, tv.imp.massimo, tv.imp.interlinea, tv.imp.margine, tv.imp.mostraStato].join('|');
  if (!memoria.has(chiave)) {
    if (memoria.size > 200) memoria.clear();
    memoria.set(chiave, caratterePerBrano({ brano, larghezza: innerWidth, altezza: innerHeight, imp: tv.imp, misura }));
  }
  return memoria.get(chiave);
}

function disegna() {
  const v = vista(tv.prep, tv.stato);
  radice.style.setProperty('--interlinea', tv.imp.interlinea);
  radice.style.setProperty('--margine', tv.imp.margine + '%');
  radice.classList.toggle('specchio', !!tv.imp.specchio);
  disegnaVista(radice, v, { mostraStato: tv.imp.mostraStato, carattere: caratterePer(v.brano) });
  aggiornaAvviso();
}

function aggiornaAvviso() {
  const vuota = !tv.concerto;
  pulsanteSchermo.hidden = !!document.fullscreenElement;
  avviso.hidden = !vuota;
}

function impostaConcerto(concerto, stato) {
  tv.concerto = concerto;
  tv.prep = prepara(concerto);
  tv.stato = stato ?? tv.stato;
  disegna();
}

function impostaStato(stato) {
  tv.stato = stato;
  disegna();
}

// ——— prova senza regia ———————————————————————————————————————————————

function avviaProva(tipo) {
  spia.classList.add('prova');
  const brani = tipo === 'lunga' ? [branoLungo(), ESEMPI[0]] : ESEMPI;
  impostaConcerto({ id: 'prova', nome: 'prova', versione: 1, brani }, statoIniziale());
  tastiera(comando => {
    const nuovo = applica(tv.prep, tv.stato, comando);
    if (nuovo !== tv.stato) impostaStato(nuovo);
  });
}

// ——— collegata alla regia ————————————————————————————————————————————

async function avviaCollegata() {
  let archivio = null;
  try { archivio = await apriArchivio(); } catch { /* senza archivio la TV vive dei messaggi */ }

  const canale = apriCanale('tv', ricevi);
  const statoTv = () => canale.manda({ tipo: 'statoTv', stato: tv.stato, concertoId: tv.concerto?.id ?? null,
    versione: tv.concerto?.versione ?? -1, iniziato: tv.concerto?.iniziato ?? 0 });

  const sorv = sorveglia({
    battito: () => canale.manda({ tipo: 'battito', larghezza: innerWidth, altezza: innerHeight }),
    suPerso: () => spia.classList.add('autonoma'),
    suRitrovato: () => { spia.classList.remove('autonoma'); statoTv(); },
  });
  spia.classList.add('autonoma');

  let inAttesa = null;   // tasto mandato alla regia, in attesa di risposta

  function ricevi(m) {
    if (m.da !== 'regia') return;
    sorv.visto();
    switch (m.tipo) {
      case 'concerto': {
        const nuovo = !tv.concerto || m.concerto.id !== tv.concerto.id;
        if (nuovo || m.concerto.versione >= tv.concerto.versione) {
          // Stesso concerto e la TV è più avanti (è andata da sola): tiene la sua riga.
          const tieniMia = !nuovo && m.stato.n < tv.stato.n;
          impostaConcerto(m.concerto, tieniMia ? tv.stato : m.stato);
          if (tieniMia) statoTv();
        }
        break;
      }
      case 'stato':
        clearTimeout(inAttesa); inAttesa = null;
        if (m.stato.n > tv.stato.n) impostaStato(m.stato);
        else if (m.stato.n < tv.stato.n) statoTv();
        break;
      case 'impostazioni':
        tv.imp = { ...IMPOSTAZIONI_TV, ...m.tv };
        memoria.clear();
        disegna();
        break;
      case 'chiedi':
        statoTv();
        break;
      case 'dammiConcerto':
        if (tv.concerto) canale.manda({ tipo: 'concertoTv', concerto: tv.concerto, stato: tv.stato });
        break;
      case 'fine':
        // Concerto finito dalla regia: la TV torna «in attesa». Solo se è il
        // suo concerto: una regia che non lo conosce non può svuotarla.
        if (!tv.concerto || m.concertoId !== tv.concerto.id) break;
        tv.concerto = null;
        tv.prep = prepara({ brani: [] });
        tv.stato = { ...statoIniziale(), n: tv.stato.n };
        disegna();
        break;
    }
  }

  // In autonomia la TV comanda se stessa e salva dove è arrivata.
  function daSola(comando) {
    const nuovo = applica(tv.prep, tv.stato, comando);
    if (nuovo === tv.stato) return;
    impostaStato(nuovo);
    statoTv();
    archivio?.scrivi('concerto', { concerto: tv.concerto, stato: tv.stato }).catch(() => {});
  }

  // Con la regia collegata la TV accetta solo frecce e PagSu/PagGiù (il
  // pedale): se la tastiera le resta addosso e l'operatore scrive un titolo,
  // né le lettere (nero, cambio brano) né gli spazi devono muovere il testo
  // (revisione 01/10/2026, I1). Da sola, in autonomia, accetta tutti i tasti.
  const TASTI_DA_COLLEGATA = new Set(['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp']);
  tastiera((comando, tasto) => {
    if (!sorv.collegato()) { daSola(comando); return; }
    if (!TASTI_DA_COLLEGATA.has(tasto)) return;
    canale.manda({ tipo: 'tasto', comando });
    clearTimeout(inAttesa);
    // La regia risponde in pochi millisecondi; se tace, il tasto non va perso.
    inAttesa = setTimeout(() => { inAttesa = null; daSola(comando); }, 300);
  });

  // Riparte dall'ultimo concerto salvato, finché la regia non dice altro.
  try {
    const salvato = await archivio?.leggi('concerto');
    const imp = await archivio?.leggi('tv');
    if (imp) tv.imp = { ...IMPOSTAZIONI_TV, ...imp };
    if (salvato?.concerto && !tv.concerto) impostaConcerto(salvato.concerto, salvato.stato);
  } catch { /* niente di salvato */ }

  disegna();
  canale.manda({ tipo: 'ciao', larghezza: innerWidth, altezza: innerHeight });
}

// ——— tasti, schermo, puntatore ——————————————————————————————————————————

function tastiera(gestisci) {
  addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') { schermoIntero(); return; }
    const comando = comandoDaTasto(e);
    if (!comando || comando.tipo === 'cerca' || comando.tipo === 'correggi') return;
    e.preventDefault();
    gestisci(comando, e.key);
  });
}

// F e doppio clic portano a tutto schermo e basta: una «f» battuta per
// sbaglio o un doppio clic non devono farne uscire (si esce con Esc).
function schermoIntero() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
}
pulsanteSchermo.addEventListener('click', schermoIntero);
addEventListener('dblclick', schermoIntero);
document.addEventListener('fullscreenchange', aggiornaAvviso);
addEventListener('resize', () => disegna());

// Il puntatore sparisce dopo 2 secondi fermo.
let fermo;
addEventListener('pointermove', () => {
  document.documentElement.classList.remove('mouse-fermo');
  clearTimeout(fermo);
  fermo = setTimeout(() => document.documentElement.classList.add('mouse-fermo'), 2000);
});

async function avvia() {
  // Prima il carattere, poi le misure: misurare col carattere di riserva darebbe
  // un testo che, a carattere caricato, esce dallo schermo.
  try { await document.fonts.load('700 100px "Atkinson Hyperlegible"'); } catch { /* si misura col disponibile */ }
  const prova = new URLSearchParams(location.search).get('prova');
  tieniAcceso();
  if (prova) avviaProva(prova);
  else { registraFuoriLinea(); await avviaCollegata(); }
}

avvia();
