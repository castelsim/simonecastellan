// La regia durante il concerto: lo stato, il collegamento con la TV, la
// schermata con scaletta, testo intero e anteprima.
//
// Una regia sola comanda. Una seconda finestra di regia se ne accorge entro
// un secondo e resta in sola lettura (mostra cosa succede, non comanda).
// All'avvio la regia ascolta per 700 ms prima di parlare: se la TV è andata
// avanti da sola, riparte dalla riga della TV.

import { prepara, statoIniziale, applica, vista, riallinea } from './navigazione.js';
import { disegnaVista, riempiRiga } from './resa.js';
import { sostituisciRiga } from './testo.js';
import { cerca as cercaBrani, creaIndice } from './cerca.js';
import { caratterePerBrano, misuratoreCanvas } from './misura.js';
import { apriCanale, sorveglia } from './canale.js';
import { IMPOSTAZIONI_TV } from './impostazioni-tv.js';
import { ESEMPI } from './esempi.js';
import { leggiSchermi, tvSulMac, tvNonIntera } from './schermo.js';

const ASCOLTO_INIZIALE = 700;

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
      const piuVecchia = m.nato < canale.nato || (m.nato === canale.nato && m.id < canale.id);
      if (!solaLettura && piuVecchia) diventaSolaLettura();
      if (solaLettura && (m.tipo === 'concerto' || m.tipo === 'stato')) specchia(m);
      return;
    }
    if (m.da !== 'tv') return;
    sorvTv.visto();
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
  }

  // La regia in sola lettura mostra ciò che manda la regia attiva.
  function specchia(m) {
    if (m.tipo === 'concerto') { concerto = m.concerto; prep = prepara(concerto); }
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

  function diventaSolaLettura() {
    solaLettura = true;
    attiva = false;
    radice.classList.add('solo-lettura');
    avvisi.mostra('sola-lettura', "C'è già un'altra finestra di regia aperta: questa è in sola lettura. Chiudila e usa l'altra.", { classe: 'sola-lettura' });
    suCambio();
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
            <kbd>N</kbd> <kbd>P</kbd> brano · <kbd>B</kbd> nero · <kbd>/</kbd> vai al brano<br>
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
      box.className = 'stato-tv attenzione';
      box.textContent = 'La finestra della TV è sullo schermo del Mac, non sulla TV: trovala (⌘` passa da una finestra all\'altra), trascinala sulla TV e premi F.';
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

  document.body.insertAdjacentHTML('beforeend', `
    <div id="dialogo-vai" class="pannello-vai" role="dialog" aria-modal="true" aria-label="Vai al brano">
      <div class="sfondo-vai" data-chiudi></div>
      <div class="dialogo largo">
        <input id="vai-cerca" class="campo grande" placeholder="Vai al brano: titolo, artista o parole del testo…" autocomplete="off" spellcheck="false">
        <ul id="vai-risultati" class="risultati grandi"></ul>
        <p id="vai-conferma" class="avviso info" hidden></p>
        <p class="guida">↑ ↓ per scegliere · Invio per andare · Esc per chiudere. Prima la scaletta; un brano fuori scaletta chiede un secondo Invio.</p>
      </div>
    </div>
    <dialog id="dialogo-fine" class="dialogo">
      <p>Terminare il concerto? La TV torna «in attesa». La scaletta resta salvata.</p>
      <div class="pulsanti"><button type="button" class="pulsante" data-annulla>Annulla</button><button type="button" class="pulsante pericolo" data-conferma>Termina il concerto</button></div>
    </dialog>`);
  const dVai = document.getElementById('dialogo-vai');
  const campoVai = document.getElementById('vai-cerca');
  const listaVai = document.getElementById('vai-risultati');
  let trovati = [];
  let scelto = 0;
  let daConfermare = null;   // id del brano fuori scaletta in attesa del secondo Invio

  // Sotto pressione due tasti sbagliati non devono mettere in onda un testo
  // estraneo (revisione 01/10/2026, I5): a ricerca vuota solo la scaletta col
  // brano dopo già scelto; con una ricerca prima la scaletta, poi la libreria;
  // un brano fuori scaletta va in onda solo con un secondo Invio.
  function cercaNelConcerto() {
    const q = campoVai.value;
    const inScaletta = concerto.brani.map((b, i) => ({ ...b, posto: i }));
    if (!q.trim()) {
      trovati = inScaletta;
      scelto = Math.min(stato.b + 1, trovati.length - 1);
    } else {
      const ids = new Set(concerto.brani.map(b => b.id));
      const fuori = braniLibreria().filter(b => !ids.has(b.id)).map(b => ({ ...b, posto: -1 }));
      trovati = [
        ...cercaBrani(creaIndice(inScaletta), q, 12).map(x => x.brano),
        ...cercaBrani(creaIndice(fuori), q, 8).map(x => x.brano),
      ];
      scelto = 0;
    }
    chiediConferma(null);
    disegnaTrovati();
  }

  function chiediConferma(b) {
    daConfermare = b?.id ?? null;
    const p = document.getElementById('vai-conferma');
    p.hidden = !b;
    if (b) p.textContent = `«${b.titolo}» non è in scaletta. Invio di nuovo per aggiungerlo dopo il brano in corso e mandarlo in onda; Esc per annullare.`;
  }

  function disegnaTrovati() {
    listaVai.replaceChildren(...trovati.map((b, i) => {
      const li = document.createElement('li');
      li.dataset.i = i;
      if (i === scelto) li.className = 'scelto';
      li.innerHTML = '<span class="titolo"></span><span class="dove"></span>';
      li.querySelector('.titolo').textContent = b.titolo;
      li.querySelector('.dove').textContent = b.posto >= 0 ? `n. ${b.posto + 1} in scaletta` : 'fuori scaletta';
      return li;
    }));
  }

  // Un pannello normale, non un <dialog>: in Chrome la chiusura di un dialog
  // (e la restituzione della tastiera) arriva in ritardo quando arrivano tasti,
  // e una ricerca riaperta subito perdeva la tastiera — le lettere battute
  // diventavano comandi (trovato dalla prova, 01/10/2026). Qui apertura,
  // chiusura e tastiera sono immediate.
  const ricercaAperta = () => dVai.hasAttribute('open');
  function apriRicerca() {
    campoVai.value = '';
    cercaNelConcerto();
    dVai.setAttribute('open', '');
    campoVai.focus();
  }
  function chiudiRicerca() {
    dVai.removeAttribute('open');
    campoVai.blur();
  }
  dVai.addEventListener('click', e => { if (e.target.closest('[data-chiudi]')) chiudiRicerca(); });

  function vaiA_(b) {
    if (!b) { chiudiRicerca(); return; }
    if (b.posto < 0 && daConfermare !== b.id) { chiediConferma(b); return; }
    chiudiRicerca();
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

  async function avvia({ demo = false } = {}) {
    try {
      const s = await archivio.leggi('concerto');
      if (s?.concerto) { concerto = s.concerto; prep = prepara(concerto); stato = s.stato ?? statoIniziale(); }
      const t = await archivio.leggi('tv');
      if (t) imp = { ...IMPOSTAZIONI_TV, ...t };
    } catch (e) { avvisi.mostra('archivio', e.message); }
    disegna();
    aggiornaSpia();
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
    correggi: () => correggi(),
    chiediFine() { if (concerto && !solaLettura) dFine.showModal(); },
    inCorso: () => !!concerto,
    solaLettura: () => solaLettura,
    tvCollegata: () => sorvTv.collegato(),
    concerto: () => concerto,
    stato: () => stato,
    prep: () => prep,
    get correzione() { return correzione; },
    set correzione(c) { correzione = c; },
    disegna,
  };
  return api;
}
