// La regia durante il concerto: lo stato, il collegamento con la TV, la
// schermata con scaletta, testo intero e anteprima.
//
// Una regia sola comanda: quella che tiene il lucchetto «gobbo-regia» (Web
// Locks). Lo prende la prima finestra di regia che si apre; le altre restano
// in sola lettura (mostrano cosa succede, non comandano) e lo prendono da sole
// quando quella si chiude o va in crash. Una regia che comanda non lo perde
// mai (verifica del 06/10/2026: col battito una scheda nascosta, coi timer
// rallentati, si faceva sentire tardi e toglieva la regia all'operatore).
// Unica eccezione: F5 sulla regia che comandava. Chi ricarica lo chiede
// indietro e l'altra, se nessuno l'ha ancora usata, lo cede.
// All'avvio la regia ascolta per 700 ms prima di parlare: se la TV è andata
// avanti da sola, riparte dalla riga della TV.

import { prepara, statoIniziale, applica, vista, riallinea } from './navigazione.js';
import { disegnaVista, riempiRiga } from './resa.js';
import { sostituisciRiga } from './testo.js';
import { cerca as cercaBrani, creaIndice, creaIndiceRighe, cercaRighe, pezziTrovati, normalizza } from './cerca.js';
import { caratterePerBrano, misuratoreCanvas } from './misura.js';
import { apriCanale, sorveglia } from './canale.js';
import { IMPOSTAZIONI_TV } from './impostazioni-tv.js';
import { ESEMPI } from './esempi.js';
import { leggiSchermi, tvSulMac, tvNonIntera } from './schermo.js';

const ASCOLTO_INIZIALE = 700;
const LUCCHETTO = 'gobbo-regia';
const SEGNO = 'gobbo-regia-al-comando';   // in sessionStorage: questa scheda comandava
const CEDE_ENTRO = 20000;                 // una regia cede il comando solo appena preso
const ATTESA_CONTROLLO = 800;             // testi del concerto contro libreria: a cose ferme
const conLucchetto = !!globalThis.navigator?.locks;

export function creaConcerto({ archivio, radice, avvisi, spiaTv, apriTv, vaiA, braniLibreria = () => [], suCambio = () => {} }) {
  let concerto = null;            // { id, nome, versione, brani }
  let prep = prepara({ brani: [] });
  let stato = statoIniziale();
  let imp = { ...IMPOSTAZIONI_TV };
  let attiva = false;
  let solaLettura = false;
  let tvDim = { larghezza: 1920, altezza: 1080 };
  let schermi = null;             // schermi collegati, se Chrome ha il permesso di vederli
  let tvAllAvvio = null;         // statoTv ricevuto mentre la regia ascoltava
  let concertoDellaTv = null;     // concerto mandato dalla TV su richiesta, all'avvio
  let correzione = null;          // { s, r, input } mentre si corregge una riga
  let ultimoCiao = 0;             // quando una TV appena aperta ha salutato
  let hoLucchetto = false;        // questa finestra tiene il lucchetto «gobbo-regia»
  let presoAlle = 0;              // quando lo ha preso
  let toccata = false;            // l'operatore l'ha usata da quando lo ha preso
  let ceduto = null;              // in attesa che un'altra regia ceda il comando
  addEventListener('keydown', () => { toccata = true; }, true);
  addEventListener('pointerdown', () => { toccata = true; }, true);
  const misura = misuratoreCanvas('"Atkinson Hyperlegible"');

  const canale = apriCanale('regia', ricevi);
  const sorvTv = sorveglia({
    battito: () => { if (attiva && !solaLettura) canale.manda({ tipo: 'battito' }); },
    suPerso: () => { aggiornaSpia(); },
    suRitrovato: () => { if (!schermi) aggiornaSchermi(); aggiornaSpia(); },
  });

  // Gli schermi servono a capire se la finestra della TV è finita sul Mac.
  // Senza permesso restano null (nessun avviso): si riprova quando la TV si collega.
  function aggiornaSchermi() {
    leggiSchermi(nuovi => { schermi = nuovi; if (concerto) disegnaStatoTv(); })
      .then(s => { if (s) { schermi = s; if (concerto) disegnaStatoTv(); } });
  }
  aggiornaSchermi();

  // ——— messaggi ———————————————————————————————————————————————————————

  function ricevi(m) {
    if (m.da === 'regia') {
      // Senza lucchetti (Chrome vecchio) vale la regola di prima: vince la più vecchia.
      const piuVecchia = m.nato < canale.nato || (m.nato === canale.nato && m.id < canale.id);
      if (!conLucchetto && !solaLettura && piuVecchia) diventaSolaLettura();
      // Una regia ricaricata che comandava rivuole il comando: lo cede solo
      // chi lo ha appena preso e non è ancora stata usata.
      if (m.tipo === 'rivoglio' && hoLucchetto && !toccata && Date.now() - presoAlle < CEDE_ENTRO) canale.manda({ tipo: 'cedo', a: m.id });
      if (m.tipo === 'cedo' && m.a === canale.id) ceduto?.();
      if (solaLettura && (m.tipo === 'concerto' || m.tipo === 'stato')) specchia(m);
      return;
    }
    if (m.da !== 'tv') return;
    sorvTv.visto();
    if (m.tipo === 'ciao') ultimoCiao = Date.now();
    if (m.larghezza && m.altezza && (m.larghezza !== tvDim.larghezza || m.altezza !== tvDim.altezza)) {
      tvDim = { larghezza: m.larghezza, altezza: m.altezza };
      if (concerto) disegnaLato();
    }
    if (!attiva) {
      if (m.tipo === 'statoTv') tvAllAvvio = m;
      if (m.tipo === 'concertoTv') concertoDellaTv = m;
      return;
    }
    if (solaLettura) return;
    if (m.tipo === 'ciao') { if (concerto) mandaConcerto(); }
    else if (m.tipo === 'tasto') comando(m.comando);
    else if (m.tipo === 'statoTv') confronta(m);
  }

  function confronta(m) {
    if (!concerto) return;   // mai svuotare la TV per un concerto che la regia non ha
    if (m.concertoId !== concerto.id || m.versione < concerto.versione) { mandaConcerto(); return; }
    if (m.stato.n > stato.n) { stato = { ...m.stato }; salva(); disegna(); mandaStato(); }
    else if (m.stato.n < stato.n) mandaStato();
    // Stesso n ma righe diverse (regia bloccata mentre la TV andava da sola,
    // verifica 06/10, stress-01): vince la TV, è lei che il cantante guarda.
    else if (m.stato.b !== stato.b || m.stato.r !== stato.r || !!m.stato.nero !== !!stato.nero) {
      stato = { ...m.stato }; salva(); disegna();
    }
  }

  // La regia in sola lettura mostra ciò che manda la regia attiva.
  function specchia(m) {
    if (m.tipo === 'concerto') { concerto = m.concerto; prep = prepara(concerto); controllaPoi(); }
    stato = m.stato;
    disegna();
  }

  function mandaConcerto() {
    canale.manda({ tipo: 'concerto', concerto, stato });
    canale.manda({ tipo: 'impostazioni', tv: imp });
  }
  const mandaStato = () => canale.manda({ tipo: 'stato', stato });

  function salva() {
    archivio.scrivi('concerto', concerto ? { concerto, stato } : null)
      .then(() => avvisi.togli('posizione'))
      .catch(e => avvisi.mostra('posizione', 'La posizione non si salva: ' + e.message));
  }

  // Il concerto è una copia fissa della libreria. Se un suo brano ha in
  // libreria un testo (o un titolo) diverso (import, modifica in Libreria), lo
  // si dice in un avviso fisso coi titoli: il 09/10 la regia riaperta
  // riprendeva il concerto salvato coi testi vecchi senza dire niente
  // (revisione 06/10/2026, dati0910-1). Si controlla alla ripresa, dopo un
  // import (subito) e a ogni cambiamento della libreria o del concerto.
  // «Ho capito» lo nasconde finché non cambia qualcosa di vero: un altro brano
  // diverso o un testo nuovo in libreria.
  // Una correzione al volo (prima il concerto, poi la libreria) e una modifica
  // in Libreria (prima la libreria, poi il concerto quando si esce dal campo)
  // passano per un attimo da testi diversi: per non dare falsi allarmi si
  // aspetta che tutto sia fermo, e non si decide mentre si scrive in Libreria.
  let giroControllo = 0;
  let avvisoTesti = false;
  let controlloDopo = null;
  let capito = null;              // i testi diversi su cui l'operatore ha detto «Ho capito»
  function controllaPoi() {
    clearTimeout(controlloDopo);
    controlloDopo = setTimeout(controllaLibreria, ATTESA_CONTROLLO);
  }
  async function controllaLibreria() {
    clearTimeout(controlloDopo);
    if (document.activeElement?.closest?.('#vista-libreria input, #vista-libreria textarea')) { controllaPoi(); return; }
    const giro = ++giroControllo;
    const c = concerto;
    let lib = [];
    if (c && archivio) {
      try { lib = await archivio.brani(); } catch { return; }
    }
    if (giro !== giroControllo) return;
    if (c !== concerto) { controllaPoi(); return; }   // cambiato intanto: di nuovo, a cose ferme
    const perId = new Map(lib.map(b => [b.id, b]));
    const diversi = [];
    for (const b of c?.brani ?? []) {
      const l = perId.get(b.id);
      if (l && (l.testo !== b.testo || l.titolo !== b.titolo) && !diversi.some(d => d.id === b.id)) diversi.push({ id: b.id, titolo: b.titolo, libreria: [l.titolo, l.testo] });
    }
    const firma = JSON.stringify(diversi.map(d => [d.id, d.libreria]));
    if (!diversi.length) capito = null;
    if (!diversi.length || firma === capito) {
      if (avvisoTesti) avvisi.togli('concerto-vecchio');
      avvisoTesti = false;
      return;
    }
    avvisoTesti = true;
    avvisi.mostra('concerto-vecchio', `Il concerto in corso usa ancora i testi di prima per ${diversi.map(d => `«${d.titolo}»`).join(', ')}. Per avere quelli nuovi sulla TV: «Termina il concerto», poi Scalette → «Inizia il concerto». Fino ad allora la TV continua con quelli di prima.`,
      { tipo: 'info', azione: { etichetta: 'Ho capito', fai: () => { capito = firma; avvisoTesti = false; avvisi.togli('concerto-vecchio'); } } });
  }
  archivio?.alCambio?.(controllaPoi);

  function diventaSolaLettura() {
    solaLettura = true;
    attiva = false;
    segnaAlComando(false);
    delete document.body.dataset.regia;
    radice.classList.add('solo-lettura');
    avvisi.mostra('sola-lettura', conLucchetto
      ? "C'è già un'altra finestra di regia aperta: comanda quella, questa è in sola lettura. Se chiudi l'altra, questa prende il comando da sola."
      : "C'è già un'altra finestra di regia aperta: questa è in sola lettura. Chiudila e usa l'altra.", { classe: 'sola-lettura' });
    suCambio();
  }

  function esciDaSolaLettura() {
    solaLettura = false;
    radice.classList.remove('solo-lettura');
    avvisi.togli('sola-lettura');
  }

  // ——— comandi ————————————————————————————————————————————————————————

  // Tasti premuti nei 700 ms in cui la regia ascolta: non si perdono, si
  // applicano appena la regia comanda.
  const inFila = [];

  function comando(c) {
    if (solaLettura) return;
    if (!attiva) { inFila.push(c); return; }
    if (!concerto) return;
    const nuovo = applica(prep, stato, c);
    if (nuovo === stato) return;
    stato = nuovo;
    mandaStato();          // prima la TV: è lei che il cantante guarda
    salva();
    disegna();
  }

  function inizia(dati) {
    if (solaLettura) return;
    concerto = {
      id: crypto.randomUUID(),
      nome: dati.nome,
      versione: 1,
      iniziato: Date.now(),
      brani: dati.brani.map(({ id, titolo, artista, testo }) => ({ id, titolo, artista, testo })),
    };
    prep = prepara(concerto);
    stato = { n: stato.n + 1, b: 0, r: 0, nero: false };
    salva();
    mandaConcerto();
    disegna();
    suCambio();
    controllaLibreria();
  }

  // Il concerto cambia (correzione al volo, brano aggiunto): la riga accesa resta la stessa.
  function aggiorna(brani) {
    if (!concerto || solaLettura) return;
    const nuovo = { ...concerto, versione: concerto.versione + 1, brani };
    const prepNuovo = prepara(nuovo);
    stato = riallinea(prep, prepNuovo, stato);
    concerto = nuovo;
    prep = prepNuovo;
    mandaConcerto();
    salva();
    disegna();
    controllaPoi();
  }

  function finisci() {
    if (solaLettura) return;
    const finito = concerto?.id ?? null;
    concerto = null;
    prep = prepara({ brani: [] });
    stato = { ...statoIniziale(), n: stato.n + 1 };
    salva();
    canale.manda({ tipo: 'fine', concertoId: finito });
    disegna();
    suCambio();
    controllaLibreria();
  }

  function impostazioni(nuove) {
    imp = { ...IMPOSTAZIONI_TV, ...nuove };
    if (!solaLettura) canale.manda({ tipo: 'impostazioni', tv: imp });
    if (concerto) disegnaLato();
  }

  // ——— schermata ——————————————————————————————————————————————————————

  function aggiornaSpia() {
    const ok = sorvTv.collegato();
    spiaTv.textContent = ok ? 'TV collegata' : 'TV non collegata';
    spiaTv.className = 'spia-tv-regia ' + (ok ? 'ok' : 'perso');
    if (concerto) disegnaStatoTv();
    suCambio();
  }

  function costruisci() {
    radice.innerHTML = `
      <div class="concerto">
        <aside class="scaletta-live">
          <h2 id="nome-concerto"></h2>
          <ol id="scaletta-live"></ol>
          <button type="button" class="pulsante cerca-brano" data-azione="cerca">Vai al brano… <kbd>/</kbd></button>
        </aside>
        <section class="testo-live" id="testo-live" aria-label="Testo del brano"></section>
        <aside class="lato-live">
          <div>
            <p class="etichetta">Sulla TV</p>
            <div class="anteprima" id="anteprima"><div class="schermo" id="schermo"></div></div>
          </div>
          <div id="stato-tv" class="stato-tv"></div>
          <div class="comandi">
            <button type="button" class="pulsante avanti" data-cmd="riga+">Riga ▶</button>
            <button type="button" class="pulsante" data-cmd="riga-">◀ Riga</button>
            <button type="button" class="pulsante" data-cmd="strofa+">Strofa ▶</button>
            <button type="button" class="pulsante" data-cmd="brano-">◀ Brano</button>
            <button type="button" class="pulsante" data-cmd="brano+">Brano ▶</button>
            <button type="button" class="pulsante nero" data-cmd="nero" aria-pressed="false">Nero</button>
          </div>
          <div class="legenda">
            <kbd>→</kbd> <kbd>Spazio</kbd> riga · <kbd>←</kbd> indietro · <kbd>↓</kbd> <kbd>↑</kbd> strofa<br>
            <kbd>N</kbd> <kbd>P</kbd> brano · <kbd>B</kbd> nero · <kbd>/</kbd> vai al brano o a una riga<br>
            <kbd>Invio</kbd> o doppio clic: correggi la riga
          </div>
          <button type="button" class="pulsante pericolo" data-azione="fine">Termina il concerto</button>
        </aside>
      </div>`;
  }

  function disegna() {
    if (!concerto) {
      radice.innerHTML = `
        <div class="vuoto">
          <h2>Nessun concerto in corso</h2>
          <p>Prepara una scaletta e premi «Inizia il concerto». Oppure prova subito con i testi d'esempio.</p>
          <div class="pulsanti">
            <button type="button" class="pulsante giallo" data-azione="scalette">Vai alle scalette</button>
            <button type="button" class="pulsante" data-azione="demo">Prova con i testi d'esempio</button>
          </div>
        </div>`;
      return;
    }
    if (!radice.querySelector('.concerto')) {
      costruisci();
      new ResizeObserver(() => { if (concerto) disegnaLato(); }).observe(radice.querySelector('#anteprima'));
    }
    disegnaScaletta();
    disegnaTesto();
    disegnaLato();
  }

  function disegnaScaletta() {
    radice.querySelector('#nome-concerto').textContent = concerto.nome;
    const ol = radice.querySelector('#scaletta-live');
    ol.replaceChildren(...concerto.brani.map((b, i) => {
      const li = document.createElement('li');
      if (i === stato.b) li.className = 'corrente';
      li.innerHTML = '<button type="button"><span class="num"></span><span class="titolo"></span></button>';
      li.querySelector('button').dataset.brano = i;
      li.querySelector('.num').textContent = i + 1;
      li.querySelector('.titolo').textContent = b.titolo;
      return li;
    }));
    ol.querySelector('.corrente')?.scrollIntoView({ block: 'nearest' });
  }

  function disegnaTesto() {
    const box = radice.querySelector('#testo-live');
    const v = vista(prep, stato);
    if (correzione) return;   // non si ridisegna sotto le dita di chi corregge
    const fuori = [];
    const h1 = document.createElement('h1');
    h1.textContent = v.brano.titolo;
    const artista = document.createElement('p');
    artista.className = 'artista';
    artista.textContent = v.brano.artista || '\u00a0';
    fuori.push(h1, artista);
    const acc = v.rigaAccesa;
    v.analisi.strofe.forEach((strofa, s) => {
      const div = document.createElement('div');
      div.className = 'strofa-live' + (s === v.s ? ' corrente' : '');
      strofa.righe.forEach((riga, r) => {
        const el = document.createElement('div');
        let cls = 'futura';
        if (riga.tipo === 'nota') cls = 'nota';
        else if (acc && (s < acc.s || (s === acc.s && r < acc.r))) cls = 'passata';
        else if (acc && s === acc.s && r === acc.r) cls = 'accesa';
        el.className = 'riga-live riga ' + cls;
        el.dataset.s = s;
        el.dataset.r = r;
        riempiRiga(el, riga);
        // La matita corregge una riga senza spostarci la TV.
        const matita = document.createElement('button');
        matita.type = 'button';
        matita.className = 'matita';
        matita.title = 'Correggi questa riga (senza spostare la TV)';
        matita.setAttribute('aria-label', 'Correggi questa riga');
        el.append(matita);
        div.append(el);
      });
      fuori.push(div);
    });
    if (!v.analisi.strofe.length) {
      const p = document.createElement('p');
      p.className = 'artista';
      p.textContent = 'Questo brano non ha testo: sulla TV compare solo il titolo.';
      fuori.push(p);
    }
    box.replaceChildren(...fuori);
    const accesa = box.querySelector('.riga-live.accesa');
    if (accesa) {
      const a = accesa.getBoundingClientRect(), c = box.getBoundingClientRect();
      if (a.top < c.top + c.height * 0.15 || a.bottom > c.top + c.height * 0.7) accesa.scrollIntoView({ block: 'center' });
    }
  }

  function disegnaLato() {
    const v = vista(prep, stato);
    const anteprima = radice.querySelector('#anteprima');
    const schermo = radice.querySelector('#schermo');
    // La TV può mandare misure nuove mentre la regia si avvia: il concerto è
    // già letto ma la schermata non c'è ancora (revisione 06/10, TypeError).
    if (!anteprima || !schermo) return;
    anteprima.style.aspectRatio = `${tvDim.larghezza} / ${tvDim.altezza}`;
    schermo.style.width = tvDim.larghezza + 'px';
    schermo.style.height = tvDim.altezza + 'px';
    // Con la schermata nascosta il riquadro misura 0: ci pensa l'osservatore
    // qui sotto a ridisegnare quando torna visibile (revisione 01/10/2026, I6).
    schermo.style.transform = `scale(${anteprima.clientWidth / tvDim.larghezza})`;
    schermo.style.setProperty('--interlinea', imp.interlinea);
    schermo.style.setProperty('--margine', imp.margine + '%');
    schermo.classList.toggle('specchio', !!imp.specchio);
    const carattere = v.brano ? caratterePerBrano({ brano: v.brano, larghezza: tvDim.larghezza, altezza: tvDim.altezza, imp, misura }) : imp.massimo;
    disegnaVista(schermo, v, { mostraStato: imp.mostraStato, carattere, altezza: tvDim.altezza });
    radice.querySelector('[data-cmd="nero"]').setAttribute('aria-pressed', String(!!stato.nero));
    disegnaStatoTv();
  }

  function disegnaStatoTv() {
    const box = radice.querySelector('#stato-tv');
    if (!box) return;
    if (sorvTv.collegato() && tvSulMac(tvDim, schermi)) {
      // Il pulsante chiude la finestra finita sul Mac e ne apre una sulla TV
      // (verifica 06/10, avvio-04: a schermo intero non si trascina).
      box.className = 'stato-tv attenzione';
      box.innerHTML = '<span>La finestra della TV è sullo schermo del Mac, non sulla TV.</span> <button type="button" class="pulsante giallo" data-azione="apri-tv">Rimetti sulla TV</button>';
    } else if (sorvTv.collegato() && tvNonIntera(tvDim, schermi)) {
      box.className = 'stato-tv attenzione';
      box.textContent = 'La TV non è a schermo intero: doppio clic sul testo della TV (o tasto F sulla finestra della TV).';
    } else if (sorvTv.collegato()) {
      box.className = 'stato-tv ok';
      box.textContent = `TV collegata · ${tvDim.larghezza}×${tvDim.altezza}`;
    } else {
      box.className = 'stato-tv perso';
      box.innerHTML = '<span>TV non collegata</span><button type="button" class="pulsante giallo" data-azione="apri-tv">Riapri TV</button>';
    }
  }

  radice.addEventListener('click', e => {
    if (e.target.closest('input.correzione')) return;
    const matita = e.target.closest('.matita');
    if (matita) { const r = matita.closest('.riga-live'); correggi(+r.dataset.s, +r.dataset.r); return; }
    const el = e.target.closest('[data-cmd], [data-brano], [data-azione], .riga-live');
    if (!el) return;
    if (el.dataset.cmd) { comando({ tipo: el.dataset.cmd }); el.blur(); return; }
    if (el.dataset.brano !== undefined) { comando({ tipo: 'vaiBrano', b: +el.dataset.brano }); el.blur(); return; }
    if (el.dataset.azione === 'demo') { inizia({ nome: "Testi d'esempio", brani: ESEMPI }); return; }
    if (el.dataset.azione === 'apri-tv') { apriTv(); return; }
    if (el.dataset.azione === 'scalette') { vaiA('scalette'); return; }
    if (el.dataset.azione === 'cerca') { api.cerca(); return; }
    if (el.dataset.azione === 'fine') { api.chiediFine(); return; }
    if (el.classList.contains('riga-live') && !el.classList.contains('nota') && !correzione) {
      const s = +el.dataset.s, r = +el.dataset.r;
      const i = prep.brani[stato.b].cantate.findIndex(p => p.s === s && p.r === r);
      if (i >= 0) comando({ tipo: 'vaiRiga', b: stato.b, r: i });
    }
  });

  radice.addEventListener('dblclick', e => {
    const el = e.target.closest('.riga-live');
    if (el && !el.classList.contains('nota') && !correzione) correggi(+el.dataset.s, +el.dataset.r);
  });

  addEventListener('resize', () => { if (concerto) disegnaLato(); });

  // ——— correzione al volo ————————————————————————————————————————————————
  // Invio (riga accesa), matita o doppio clic: la riga diventa un campo.
  // Invio o uscire dal campo = salva; Esc = annulla. La correzione vale per
  // il concerto e, se la riga in libreria è ancora quella, anche in libreria.

  function correggi(s, r) {
    if (!concerto || solaLettura || correzione) return;
    const v = vista(prep, stato);
    if (s === undefined) {
      if (!v.rigaAccesa) return;
      ({ s, r } = v.rigaAccesa);
    }
    const riga = v.analisi.strofe[s]?.righe[r];
    const el = radice.querySelector(`.riga-live[data-s="${s}"][data-r="${r}"]`);
    if (!riga || !el) return;
    const input = document.createElement('input');
    input.className = 'correzione';
    input.value = riga.sorgente;
    input.spellcheck = false;
    correzione = { linea: riga.linea, brano: v.brano, prima: riga.sorgente, input };
    el.replaceChildren(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); chiudiCorrezione(true); }
      else if (e.key === 'Escape') { e.preventDefault(); chiudiCorrezione(false); }
    });
    input.addEventListener('blur', () => chiudiCorrezione(true));
  }

  async function chiudiCorrezione(salvare) {
    const c = correzione;
    if (!c) return;
    correzione = null;
    const nuovo = c.input.value;
    if (!salvare || nuovo === c.prima) { disegna(); return; }
    aggiorna(concerto.brani.map(b => (b.id === c.brano.id && b.testo === c.brano.testo
      ? { ...b, testo: sostituisciRiga(b.testo, c.linea, nuovo) } : b)));
    try {
      const lib = await archivio.brano(c.brano.id);
      if (!lib) return;
      if (lib.testo.split(/\r\n|\r|\n/)[c.linea] === c.prima) {
        await archivio.salvaBrano({ ...lib, testo: sostituisciRiga(lib.testo, c.linea, nuovo) });
      } else {
        avvisi.mostra('correzione', 'Corretto nel concerto. In libreria quel brano era già cambiato: controlla lì la stessa riga.', { tipo: 'info' });
      }
    } catch (e) {
      avvisi.mostra('correzione', 'Corretto nel concerto, ma non salvato in libreria: ' + e.message);
    }
  }

  // ——— vai al brano ——————————————————————————————————————————————————————
  // Cerca in scaletta e in tutta la libreria. Un brano fuori scaletta entra
  // nella copia del concerto subito dopo quello in corso.
  // Le parole del testo trovano le RIGHE (prova con il cantante del
  // 06/10/2026: l'operatore cercava la riga scorrendo, «più avanti, più
  // avanti…»): Invio porta la TV dritta a quella riga. Prima le righe del
  // brano in corso, poi i brani della scaletta per titolo, le righe degli
  // altri brani della scaletta, i brani fuori scaletta e le loro righe.

  document.body.insertAdjacentHTML('beforeend', `
    <div id="dialogo-vai" class="pannello-vai" role="dialog" aria-modal="true" aria-label="Vai al brano">
      <div class="sfondo-vai" data-chiudi></div>
      <div class="dialogo largo">
        <input id="vai-cerca" class="campo grande" placeholder="Vai al brano: titolo, artista o parole del testo…" autocomplete="off" spellcheck="false">
        <ul id="vai-risultati" class="risultati grandi"></ul>
        <p id="vai-conferma" class="avviso info" hidden></p>
        <p class="guida">↑ ↓ per scegliere · Invio per andare · Esc per chiudere. Scrivi un titolo o delle parole del testo: con una riga la TV va dritta lì. Prima il brano in corso e la scaletta; fuori scaletta serve un secondo Invio.</p>
      </div>
    </div>
    <dialog id="dialogo-fine" class="dialogo">
      <p>Terminare il concerto? La TV torna «in attesa». La scaletta resta salvata.</p>
      <div class="pulsanti"><button type="button" class="pulsante" data-annulla>Annulla</button><button type="button" class="pulsante pericolo" data-conferma>Termina il concerto</button></div>
    </dialog>`);
  const dVai = document.getElementById('dialogo-vai');
  const campoVai = document.getElementById('vai-cerca');
  const listaVai = document.getElementById('vai-risultati');
  let trovati = [];          // brani { ...brano, posto } e righe { ...brano, posto, riga: { i, s, n, testo } }
  let scelto = 0;
  let daConfermare = null;   // brano (o riga) fuori scaletta in attesa del secondo Invio
  let indici = null;         // preparati all'apertura: la scaletta non cambia a pannello aperto
  const RIGHE_IN_CORSO = 8, RIGHE_SCALETTA = 8, RIGHE_FUORI = 6;

  function preparaIndici() {
    const inScaletta = concerto.brani.map((b, i) => ({ ...b, posto: i }));
    const ids = new Set(concerto.brani.map(b => b.id));
    const fuori = braniLibreria().filter(b => !ids.has(b.id)).map(b => ({ ...b, posto: -1 }));
    indici = {
      inScaletta,
      braniScaletta: creaIndice(inScaletta),
      braniFuori: creaIndice(fuori),
      righeScaletta: creaIndiceRighe(inScaletta),
      righeFuori: creaIndiceRighe(fuori),
    };
  }

  // Sotto pressione due tasti sbagliati non devono mettere in onda un testo
  // estraneo (revisione 01/10/2026, I5): a ricerca vuota solo la scaletta col
  // brano dopo già scelto; con una ricerca prima la scaletta, poi la libreria;
  // un brano fuori scaletta va in onda solo con un secondo Invio.
  function cercaNelConcerto() {
    const q = campoVai.value;
    if (!q.trim()) {
      trovati = indici.inScaletta;
      scelto = Math.min(stato.b + 1, trovati.length - 1);
    } else {
      // I brani per titolo o artista; le parole del testo diventano righe.
      // Prima i titoli della scaletta: scrivere il titolo del brano dopo deve
      // portare a quel brano, non a una riga del brano in corso che contiene le
      // stesse parole (revisione finale 06/10: da Cirano a «Dio è morto»).
      const perTitolo = (indice, quanti) => cercaBrani(indice, q, quanti).filter(x => x.dove !== 'testo').map(x => x.brano);
      const riga = x => ({ ...x.brano, riga: { i: x.i, s: x.s, n: x.n, testo: x.testo } });
      const righeScaletta = cercaRighe(indici.righeScaletta, q, 500);
      trovati = [
        ...perTitolo(indici.braniScaletta, 12),
        ...righeScaletta.filter(x => x.brano.posto === stato.b).slice(0, RIGHE_IN_CORSO).map(riga),
        ...righeScaletta.filter(x => x.brano.posto !== stato.b).slice(0, RIGHE_SCALETTA).map(riga),
        ...perTitolo(indici.braniFuori, 8),
        ...cercaRighe(indici.righeFuori, q, RIGHE_FUORI).map(riga),
      ];
      scelto = 0;
    }
    chiediConferma(null);
    disegnaTrovati();
  }

  const chiaveDi = b => (b.riga ? `${b.id}\u0000${b.riga.i}` : b.id);

  function chiediConferma(b) {
    daConfermare = b ? chiaveDi(b) : null;
    const p = document.getElementById('vai-conferma');
    p.hidden = !b;
    if (b) {
      p.textContent = b.riga
        ? `«${b.titolo}» non è in scaletta. Invio di nuovo per aggiungerlo dopo il brano in corso e mandare in onda la riga «${b.riga.testo}»; Esc per annullare.`
        : `«${b.titolo}» non è in scaletta. Invio di nuovo per aggiungerlo dopo il brano in corso e mandarlo in onda; Esc per annullare.`;
    }
  }

  function disegnaTrovati() {
    // Una riga ripetuta nello stesso brano (ritornello) dice anche dov'è.
    const quante = new Map();
    for (const b of trovati) if (b.riga) { const k = b.id + '\u0000' + normalizza(b.riga.testo); quante.set(k, (quante.get(k) ?? 0) + 1); }
    listaVai.replaceChildren(...trovati.map((b, i) => {
      const li = document.createElement('li');
      li.dataset.i = i;
      if (i === scelto) li.className = 'scelto';
      const dove = b.posto < 0 ? 'fuori scaletta' : b.riga && b.posto === stato.b ? 'in corso' : `n. ${b.posto + 1} in scaletta`;
      if (b.riga) {
        li.classList.add('riga');
        li.innerHTML = '<span class="riga-trovata"></span><span class="dove"></span>';
        const testo = li.querySelector('.riga-trovata');
        for (const p of pezziTrovati(b.riga.testo, campoVai.value)) {
          if (!p.trovato) { testo.append(p.testo); continue; }
          const m = document.createElement('mark');
          m.textContent = p.testo;
          testo.append(m);
        }
        const ripetuta = quante.get(b.id + '\u0000' + normalizza(b.riga.testo)) > 1;
        li.querySelector('.dove').textContent = `«${b.titolo}» · ${dove}${ripetuta ? ` · strofa ${b.riga.s + 1}, riga ${b.riga.n}` : ''}`;
      } else {
        li.innerHTML = '<span class="titolo"></span><span class="dove"></span>';
        li.querySelector('.titolo').textContent = b.titolo;
        li.querySelector('.dove').textContent = dove;
      }
      return li;
    }));
    listaVai.querySelector('.scelto')?.scrollIntoView({ block: 'nearest' });
  }

  // Un pannello normale, non un <dialog>: in Chrome la chiusura di un dialog
  // (e la restituzione della tastiera) arriva in ritardo quando arrivano tasti,
  // e una ricerca riaperta subito perdeva la tastiera — le lettere battute
  // diventavano comandi (trovato dalla prova, 01/10/2026). Qui apertura,
  // chiusura e tastiera sono immediate.
  const ricercaAperta = () => dVai.hasAttribute('open');
  function apriRicerca() {
    campoVai.value = '';
    preparaIndici();
    cercaNelConcerto();
    dVai.setAttribute('open', '');
    campoVai.focus();
  }
  function chiudiRicerca() {
    dVai.removeAttribute('open');
    campoVai.blur();
  }
  dVai.addEventListener('click', e => { if (e.target.closest('[data-chiudi]')) chiudiRicerca(); });
  // Un clic dentro il pannello non toglie la tastiera al campo: senza, Esc,
  // frecce e Invio restavano senza nessuno che li ascolti (verifica 06/10, sincronia-5).
  dVai.addEventListener('mousedown', e => { if (e.target !== campoVai) e.preventDefault(); });

  function vaiA_(b) {
    if (!b) { chiudiRicerca(); return; }
    if (b.posto < 0 && daConfermare !== chiaveDi(b)) { chiediConferma(b); return; }
    chiudiRicerca();
    // Una riga: la TV va dritta lì (anche nel brano in corso).
    if (b.riga && b.posto >= 0) { comando({ tipo: 'vaiRiga', b: b.posto, r: b.riga.i }); return; }
    if (b.riga) {
      const brani = [...concerto.brani];
      brani.splice(stato.b + 1, 0, { id: b.id, titolo: b.titolo, artista: b.artista, testo: b.testo });
      aggiorna(brani);
      comando({ tipo: 'vaiRiga', b: stato.b + 1, r: b.riga.i });
      return;
    }
    // Il brano in corso: solo chiudere. Andarci azzererebbe la riga a metà
    // canzone (sull'ultimo brano è quello già scelto; verifica 06/10, sincronia-4).
    if (b.posto === stato.b) return;
    if (b.posto >= 0) { comando({ tipo: 'vaiBrano', b: b.posto }); return; }
    const brani = [...concerto.brani];
    brani.splice(stato.b + 1, 0, { id: b.id, titolo: b.titolo, artista: b.artista, testo: b.testo });
    aggiorna(brani);
    comando({ tipo: 'vaiBrano', b: stato.b + 1 });
  }

  campoVai.addEventListener('input', cercaNelConcerto);
  campoVai.addEventListener('keydown', e => {
    if (!ricercaAperta()) return;
    // I tasti battuti nella ricerca sono della ricerca: l'Invio che la chiude
    // non deve arrivare alla regia come «correggi la riga».
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); chiudiRicerca(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); scelto = Math.min(trovati.length - 1, scelto + 1); chiediConferma(null); disegnaTrovati(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); scelto = Math.max(0, scelto - 1); chiediConferma(null); disegnaTrovati(); }
    else if (e.key === 'Enter') { e.preventDefault(); vaiA_(trovati[scelto]); }
  });
  listaVai.addEventListener('click', e => { const li = e.target.closest('li'); if (li) vaiA_(trovati[+li.dataset.i]); });

  const dFine = document.getElementById('dialogo-fine');
  dFine.addEventListener('click', e => {
    if (e.target.closest('[data-annulla]')) dFine.close();
    if (e.target.closest('[data-conferma]')) { dFine.close(); finisci(); }
  });

  // ——— avvio ——————————————————————————————————————————————————————————

  async function leggiArchivio() {
    try {
      const s = await archivio.leggi('concerto');
      if (s?.concerto) { concerto = s.concerto; prep = prepara(concerto); stato = s.stato ?? statoIniziale(); }
      const t = await archivio.leggi('tv');
      if (t) imp = { ...IMPOSTAZIONI_TV, ...t };
    } catch (e) { avvisi.mostra('archivio', e.message); }
  }

  // Chiede il lucchetto e lo tiene finché la finestra vive. → promessa: true
  // quando arriva, false se la richiesta viene annullata. Se poi una regia
  // ricaricata se lo riprende (steal), si passa in sola lettura e ci si
  // rimette in coda.
  function chiediLucchetto(opzioni = {}) {
    return new Promise(risolvi => {
      let mio = false;
      navigator.locks.request(LUCCHETTO, opzioni, () => {
        mio = true;
        hoLucchetto = true;
        presoAlle = Date.now();
        toccata = false;
        risolvi(true);
        return new Promise(() => {});
      }).catch(() => {
        if (!mio) { risolvi(false); return; }
        hoLucchetto = false;
        diventaSolaLettura();
        chiediLucchetto().then(ok => { if (ok) riprendi(); });
      });
    });
  }

  // L'altra regia si è chiusa (o ha ceduto): si riparte da dove era arrivata
  // (archivio e TV). Se intanto una regia ricaricata si è ripresa il
  // lucchetto, si resta in sola lettura (revisione 06/10/2026: con l'archivio
  // lento comandavano in due).
  async function riprendi() {
    await leggiArchivio();
    if (!hoLucchetto) return;
    esciDaSolaLettura();
    await comanda({ demo: false });
    controllaLibreria();
  }

  // F5 sulla regia che comandava, con un'altra regia aperta: la vecchia pagina
  // lascia il lucchetto e lo prende l'altra, che era in coda. Chi ha ricaricato
  // è l'operatore: chiede il comando indietro, e l'altra lo cede se nessuno
  // l'ha ancora usata (revisione 06/10/2026).
  function eraAlComando() {
    try {
      return performance.getEntriesByType('navigation')[0]?.type === 'reload' && sessionStorage.getItem(SEGNO) === '1';
    } catch { return false; }
  }
  function segnaAlComando(si) {
    try { if (si) sessionStorage.setItem(SEGNO, '1'); else sessionStorage.removeItem(SEGNO); } catch { /* niente */ }
  }
  function chiediDiRiaverlo() {
    return new Promise(risolvi => {
      const basta = setTimeout(() => { ceduto = null; risolvi(false); }, 800);
      ceduto = () => { clearTimeout(basta); ceduto = null; risolvi(true); };
      canale.manda({ tipo: 'rivoglio' });
    });
  }

  async function avvia({ demo = false } = {}) {
    await leggiArchivio();
    disegna();
    aggiornaSpia();
    if (conLucchetto) {
      const annulla = new AbortController();
      const arrivato = chiediLucchetto({ signal: annulla.signal });
      // Entro 300 ms: chi ricarica la pagina lo ritrova appena la vecchia lo lascia.
      let preso = await Promise.race([arrivato, new Promise(r => setTimeout(() => r(false), 300))]);
      if (!preso && eraAlComando() && (await chiediDiRiaverlo()) && !hoLucchetto) {
        annulla.abort();
        preso = await chiediLucchetto({ steal: true });
      }
      if (!preso && !hoLucchetto) {
        diventaSolaLettura();
        controllaLibreria();
        arrivato.then(ok => { if (ok) riprendi(); });
        return;
      }
    }
    await comanda({ demo });
    controllaLibreria();
  }

  async function comanda({ demo }) {
    tvAllAvvio = null;
    concertoDellaTv = null;
    canale.manda({ tipo: 'chiedi' });
    await new Promise(r => setTimeout(r, ASCOLTO_INIZIALE));
    if (solaLettura) return;
    const t = tvAllAvvio;
    // La TV ha un concerto più recente di quello in archivio (o una versione
    // più nuova dello stesso): la posizione o le correzioni non erano arrivate
    // in archivio. Si prende quello della TV invece di imporle il vecchio.
    const tvPiuNuova = t?.concertoId && (!concerto
      || (t.concertoId !== concerto.id && (t.iniziato ?? 0) > (concerto.iniziato ?? 0))
      || (t.concertoId === concerto.id && t.versione > concerto.versione));
    if (tvPiuNuova) {
      canale.manda({ tipo: 'dammiConcerto' });
      for (let i = 0; i < 25 && !concertoDellaTv; i++) await new Promise(r => setTimeout(r, 40));
      if (concertoDellaTv?.concerto) {
        concerto = concertoDellaTv.concerto;
        prep = prepara(concerto);
        stato = { ...concertoDellaTv.stato };
        salva();
      }
    } else if (t && concerto && t.concertoId === concerto.id && t.versione === concerto.versione && t.stato.n > stato.n) {
      stato = { ...t.stato };
      salva();
    }
    if (solaLettura) return;
    attiva = true;
    segnaAlComando(true);
    if (!concerto && demo) inizia({ nome: "Testi d'esempio", brani: ESEMPI });
    else if (concerto) mandaConcerto();
    disegna();
    document.body.dataset.regia = 'attiva';
    for (const c of inFila.splice(0)) comando(c);
    suCambio();
  }

  const api = {
    avvia,
    comando,
    inizia,
    aggiorna,
    finisci,
    impostazioni,
    cerca() {
      if (!concerto || solaLettura) return;
      apriRicerca();
    },
    ricercaAperta,
    controllaTesti: () => controllaLibreria(),
    correggi: () => correggi(),
    chiediFine() { if (concerto && !solaLettura) dFine.showModal(); },
    inCorso: () => !!concerto,
    solaLettura: () => solaLettura,
    tvCollegata: () => sorvTv.collegato(),
    tvFinitaSulMac: () => sorvTv.collegato() && tvSulMac(tvDim, schermi),
    tvSalutata: dopo => ultimoCiao >= dopo,
    // Chiede alla finestra della TV finita sul Mac di chiudersi: solo a quella
    // grande così, non a una TV giusta sullo schermo esterno.
    chiudiTvSulMac() { if (!solaLettura) canale.manda({ tipo: 'chiudi', larghezza: tvDim.larghezza, altezza: tvDim.altezza }); },
    concerto: () => concerto,
    stato: () => stato,
    prep: () => prep,
    get correzione() { return correzione; },
    set correzione(c) { correzione = c; },
    disegna,
  };
  return api;
}
