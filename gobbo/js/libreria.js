// Libreria ed editor dei brani.
//
// L'editor è un'area di testo semplice: il testo si vede com'è scritto, segni
// compresi, e niente formattazione nascosta può rompersi. G e i colori
// avvolgono la selezione; ⌘Z annulla come in qualsiasi campo (le modifiche
// passano da execCommand('insertText'), che il browser mette nella cronologia).
// Salvataggio automatico dopo 300 ms di pausa.

import { cerca, creaIndice } from './cerca.js';
import { avvolgi, pulisci } from './testo.js';
import { prepara, vista } from './navigazione.js';
import { disegnaVista } from './resa.js';
import { caratterePerBrano, misuratoreCanvas } from './misura.js';
import { ESEMPI } from './esempi.js';
import { IMPOSTAZIONI_TV } from './impostazioni-tv.js';

const PAUSA_SALVATAGGIO = 300;
// Il salvataggio automatico tiene una versione all'apertura del brano e poi al
// massimo una ogni 2 minuti di battitura (prima: una ogni 300 ms di pausa).
const INTERVALLO_VERSIONI = 2 * 60 * 1000;
const TV = { larghezza: 1920, altezza: 1080 };
const COLORI = ['giallo', 'azzurro', 'verde', 'arancio', 'rosa'];

const ora = () => new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const quando = iso => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function creaLibreria({ archivio, radice, avvisi, spiaSalvato, concerto }) {
  let brani = [];
  let indice = creaIndice([]);
  let aperto = null;
  let idAperto = null;
  let inCorsoSalva = Promise.resolve();
  let sporco = false;
  let timer = null;
  // L'«aggiornato» del brano da cui partono i campi dell'editor: se in archivio
  // è cambiato (correzione al volo, import, altra finestra) l'editor non lo
  // riscrive col suo testo vecchio (verifica 06/10/2026, correzione persa).
  let base = null;
  let versioneTenuta = 0;
  // Brani salvati dall'editor e non ancora portati al concerto: solo questi
  // vanno alla TV, non qualsiasi differenza fra libreria e concerto.
  const modificati = new Set();
  // Ricerca nel testo del brano aperto: righe trovate (posizioni nel testo), quella
  // mostrata e l'ultima selezionata (per non lasciare una riga intera selezionata
  // sotto la tastiera). Non scrive mai: solo selezione, scorrimento ed evidenziazione.
  let ricerca = { righe: [], corrente: -1, ultima: null, nulla: true };
  let imp = { ...IMPOSTAZIONI_TV };
  const misura = misuratoreCanvas('"Atkinson Hyperlegible"');

  radice.innerHTML = `
    <div class="libreria">
      <aside class="elenco">
        <div class="barra-elenco">
          <input id="cerca-brani" class="campo" type="search" placeholder="Cerca titolo, artista o parole…" autocomplete="off" spellcheck="false">
          <div class="azioni-elenco">
            <button type="button" class="pulsante giallo" data-azione="nuovo-brano">+ Nuovo brano</button>
            <label class="pulsante">Importa .txt<input id="importa-txt" type="file" accept=".txt,text/plain" multiple hidden></label>
          </div>
        </div>
        <ul id="elenco-brani" class="elenco-brani"></ul>
        <p class="conta" id="conta-brani"></p>
      </aside>
      <section class="editor" id="editor"></section>
    </div>
    <dialog id="dialogo-elimina" class="dialogo">
      <p>Per eliminare <b id="elimina-titolo"></b> scrivi <b>elimina</b> qui sotto. Le sue versioni spariscono con lui.</p>
      <input id="conferma-elimina" class="campo" autocomplete="off" spellcheck="false">
      <div class="pulsanti"><button type="button" class="pulsante" data-annulla>Annulla</button><button type="button" class="pulsante pericolo" data-conferma>Elimina</button></div>
    </dialog>
    <dialog id="dialogo-versioni" class="dialogo largo">
      <h3>Versioni precedenti</h3>
      <ul class="versioni"></ul>
      <div class="pulsanti"><button type="button" class="pulsante" data-annulla>Chiudi</button></div>
    </dialog>`;

  const $ = s => radice.querySelector(s);
  const campoCerca = $('#cerca-brani');
  const elenco = $('#elenco-brani');
  const editor = $('#editor');

  // ——— elenco ————————————————————————————————————————————————————————————

  async function ricarica() {
    brani = await archivio.brani();
    indice = creaIndice(brani);
    disegnaElenco();
  }

  function disegnaElenco() {
    const risultati = cerca(indice, campoCerca.value, 1000);
    elenco.replaceChildren(...risultati.map(({ brano }) => {
      const li = document.createElement('li');
      li.dataset.id = brano.id;
      if (idAperto === brano.id) li.className = 'scelto';
      li.innerHTML = '<span class="titolo"></span><span class="artista"></span>';
      li.querySelector('.titolo').textContent = brano.titolo;
      li.querySelector('.artista').textContent = brano.artista;
      return li;
    }));
    $('#conta-brani').textContent = campoCerca.value
      ? `${risultati.length} di ${brani.length} brani`
      : `${brani.length} brani`;
  }

  campoCerca.addEventListener('input', disegnaElenco);
  campoCerca.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const primo = elenco.querySelector('li'); if (primo) apri(primo.dataset.id); }
  });
  elenco.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (li) apri(li.dataset.id);
  });

  // ——— editor ————————————————————————————————————————————————————————————

  function disegnaEditore() {
    if (!aperto) {
      editor.innerHTML = '<div class="vuoto"><h2>Nessun brano aperto</h2><p>Scegli un brano a sinistra, creane uno nuovo o trascina qui dei file .txt.</p></div>';
      return;
    }
    ricerca = { righe: [], corrente: -1, ultima: null, nulla: true };
    editor.innerHTML = `
      <div class="editor-testa">
        <input id="ed-titolo" class="campo titolo" placeholder="Titolo" spellcheck="false">
        <input id="ed-artista" class="campo" placeholder="Artista" spellcheck="false">
        <div class="editor-azioni">
          <button type="button" class="pulsante" data-azione="duplica">Duplica</button>
          <button type="button" class="pulsante" data-azione="versioni">Versioni</button>
          <button type="button" class="pulsante pericolo" data-azione="elimina">Elimina</button>
        </div>
      </div>
      <p class="nel-concerto" hidden>Questo brano è nel concerto in corso: le modifiche arrivano alla TV quando esci dal campo. Per una correzione al volo usa la schermata Concerto (doppio clic sulla riga).</p>
      <div class="editor-corpo">
        <div class="colonna-testo">
          <div class="strumenti" role="toolbar" aria-label="Formattazione">
            <button type="button" class="strumento" data-segno="grassetto" title="Grassetto (⌘B)"><b>G</b></button>
            ${COLORI.map(c => `<button type="button" class="strumento colore" data-segno="${c}" title="${c}"><span class="pallino c-${c}"></span>${c}</button>`).join('')}
            <button type="button" class="strumento" data-azione="nota" title="Nota per la regia: la TV non la mostra"># nota regia</button>
          </div>
          <div class="cerca-testo">
            <input id="ed-cerca" class="campo-cerca" type="text" placeholder="Cerca nel testo (⌘F) · Invio = successiva, Maiusc+Invio = precedente" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Cerca nel testo">
            <span id="ed-cerca-conta" class="cerca-conta" role="status" aria-live="polite"></span>
          </div>
          <div class="testo-cerca">
            <textarea id="ed-testo" spellcheck="false" placeholder="Incolla o scrivi il testo. Riga vuota = nuova strofa."></textarea>
            <div class="cerca-sopra" id="ed-cerca-sopra" aria-hidden="true"></div>
          </div>
          <p class="guida">Riga vuota = nuova strofa · <code>**parola**</code> grassetto · <code>{azzurro}…{/}</code> colore · <code>#</code> a inizio riga = nota per la regia</p>
          <input id="ed-note" class="campo" placeholder="Note (tonalità, attacco, chi canta…)" spellcheck="false">
        </div>
        <div class="colonna-anteprima">
          <p class="etichetta">Anteprima TV · riga del cursore</p>
          <div class="anteprima" id="ed-anteprima-box"><div class="schermo" id="ed-anteprima"></div></div>
        </div>
      </div>`;
    $('#ed-titolo').value = aperto.titolo;
    $('#ed-artista').value = aperto.artista ?? '';
    $('#ed-note').value = aperto.note ?? '';
    $('#ed-testo').value = aperto.testo ?? '';
    $('#ed-testo').addEventListener('scroll', riposizionaEvidenza);
    aggiornaStatoConcerto();
    disegnaAnteprima();
  }

  function aggiornaStatoConcerto() {
    if (!aperto || !$('#ed-titolo')) return;
    const inCorso = concerto.inCorso();
    const elimina = $('[data-azione="elimina"]');
    elimina.disabled = inCorso;
    elimina.title = inCorso ? 'Durante il concerto non si elimina niente' : '';
    $('.nel-concerto').hidden = !(inCorso && concerto.concerto().brani.some(b => b.id === idAperto));
  }

  // L'id del brano nei campi si fissa all'apertura (idAperto) e i salvataggi
  // vanno in fila: chi cambia brano aspetta quello in corso, e un salvataggio
  // che finisce dopo non può riportare l'editor sul brano di prima. Senza,
  // un clic rapido (tocco del trackpad) scriveva un brano dentro un altro
  // (revisione 01/10/2026, difetto C1).
  async function apri(id) {
    await salva();
    await portaAlConcerto(idAperto);
    // Dalla cache (fresca a ogni ingresso in Libreria): se fosse vecchia, il
    // primo salvataggio se ne accorge (atteso) e non riscrive niente.
    aperto = brani.find(b => b.id === id) ?? null;
    idAperto = aperto?.id ?? null;
    base = aperto?.aggiornato ?? null;
    versioneTenuta = 0;
    disegnaEditore();
    disegnaElenco();
  }

  // Il brano aperto è cambiato altrove: l'editor riparte dal testo nuovo
  // (o si chiude, se il brano non c'è più).
  function ricaricaAperto(fresco) {
    aperto = fresco;
    idAperto = fresco?.id ?? null;
    base = fresco?.aggiornato ?? null;
    versioneTenuta = 0;
    sporco = false;
    disegnaEditore();
    disegnaElenco();
  }

  function datiEditor() {
    return {
      id: idAperto,
      titolo: $('#ed-titolo').value,
      artista: $('#ed-artista').value,
      note: $('#ed-note').value,
      testo: $('#ed-testo').value,
    };
  }

  function segnaModifica() {
    sporco = true;
    spiaSalvato.textContent = 'In modifica…';
    spiaSalvato.className = 'spia-salvato';
    clearTimeout(timer);
    timer = setTimeout(salva, PAUSA_SALVATAGGIO);
    disegnaAnteprima();
  }

  function salva() {
    clearTimeout(timer);
    if (!idAperto || !sporco || !$('#ed-testo')) return inCorsoSalva;
    sporco = false;
    const dati = datiEditor();
    let versione = false;
    inCorsoSalva = inCorsoSalva.then(() => {
      versione = Date.now() - versioneTenuta > INTERVALLO_VERSIONI;
      return archivio.salvaBrano(dati, { atteso: base, versione });
    }).then(salvato => {
      if (salvato.conflitto) {
        avvisi.mostra('salvataggio', salvato.attuale
          ? `«${dati.titolo}» è cambiato altrove (correzione al volo, import o un'altra finestra) mentre era aperto qui: ricarico il testo nuovo. Quello che avevi scritto è in «Versioni».`
          : `«${dati.titolo}» non c'è più in libreria (cancellato altrove): non l'ho ricreato.`, { tipo: 'info' });
        spiaSalvato.textContent = 'Ricaricato';
        spiaSalvato.className = 'spia-salvato';
        brani = salvato.attuale ? brani.map(b => (b.id === dati.id ? salvato.attuale : b)) : brani.filter(b => b.id !== dati.id);
        indice = creaIndice(brani);
        if (dati.id === idAperto) ricaricaAperto(salvato.attuale);
        else disegnaElenco();
        return;
      }
      if (salvato.aggiornato !== base) {
        modificati.add(salvato.id);
        if (versione) versioneTenuta = Date.now();
      }
      base = salvato.aggiornato;
      brani = brani.map(b => (b.id === salvato.id ? salvato : b));
      indice = creaIndice(brani);
      if (salvato.id === idAperto) aperto = salvato;
      spiaSalvato.textContent = `Salvato alle ${ora()}`;
      spiaSalvato.className = 'spia-salvato';
      avvisi.togli('salvataggio');
      disegnaElenco();
    }, e => {
      if (dati.id === idAperto) sporco = true;
      spiaSalvato.textContent = 'NON SALVATO';
      spiaSalvato.className = 'spia-salvato errore';
      avvisi.mostra('salvataggio', `«${dati.titolo}» non si salva: ${e.message}`);
    });
    return inCorsoSalva;
  }

  // Le modifiche a un brano del concerto in corso arrivano alla TV quando si
  // esce dal campo, non a ogni lettera: il cantante non deve veder comparire
  // mezze parole.
  async function portaAlConcerto(id = idAperto) {
    if (!modificati.delete(id)) return;
    const fonte = brani.find(b => b.id === id);
    if (!fonte || !concerto.inCorso()) return;
    const c = concerto.concerto();
    if (!c.brani.some(b => b.id === id)) return;
    const nuovi = c.brani.map(b => (b.id === id ? { id: b.id, titolo: fonte.titolo, artista: fonte.artista, testo: fonte.testo } : b));
    if (nuovi.some((b, i) => b.testo !== c.brani[i].testo || b.titolo !== c.brani[i].titolo)) concerto.aggiorna(nuovi);
  }

  function disegnaAnteprima() {
    const box = $('#ed-anteprima-box');
    const schermo = $('#ed-anteprima');
    const ta = $('#ed-testo');
    if (!box || !ta) return;
    const brano = { id: idAperto, titolo: $('#ed-titolo').value || '…', artista: '', testo: ta.value };
    const prep = prepara({ brani: [brano] });
    const b = prep.brani[0];
    const linea = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
    let r = 0;
    b.cantate.forEach((p, i) => { if (b.analisi.strofe[p.s].righe[p.r].linea <= linea) r = i; });
    const v = vista(prep, { n: 0, b: 0, r, nero: false });
    schermo.style.width = TV.larghezza + 'px';
    schermo.style.height = TV.altezza + 'px';
    schermo.style.transform = `scale(${box.clientWidth / TV.larghezza})`;
    schermo.style.setProperty('--interlinea', imp.interlinea);
    schermo.style.setProperty('--margine', imp.margine + '%');
    disegnaVista(schermo, v, { mostraStato: imp.mostraStato, altezza: TV.altezza,
      carattere: caratterePerBrano({ brano: b, larghezza: TV.larghezza, altezza: TV.altezza, imp, misura }) });
  }

  // Sostituisce [i, f) con `nuovo` passando dal browser, così ⌘Z funziona.
  function inserisci(ta, i, f, nuovo) {
    ta.focus();
    ta.setSelectionRange(i, f);
    const fatto = nuovo === '' ? document.execCommand('delete') : document.execCommand('insertText', false, nuovo);
    if (!fatto) { ta.setRangeText(nuovo, i, f, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  function applicaSegno(segno) {
    const ta = $('#ed-testo');
    const { selectionStart: i, selectionEnd: f, value } = ta;
    const r = avvolgi(value, i, f, segno);
    inserisci(ta, i, f, r.testo.slice(i, r.testo.length - (value.length - f)));
    ta.setSelectionRange(r.inizio, r.fine);
    disegnaAnteprima();
  }

  function notaRegia() {
    const ta = $('#ed-testo');
    const inizio = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    if (ta.value.startsWith('# ', inizio)) inserisci(ta, inizio, inizio + 2, '');
    else inserisci(ta, inizio, inizio, '# ');
  }

  editor.addEventListener('input', e => { if (e.target.matches('#ed-titolo, #ed-artista, #ed-note, #ed-testo')) segnaModifica(); });
  editor.addEventListener('change', e => { if (e.target.matches('.campo, #ed-testo')) salva().then(portaAlConcerto); });
  editor.addEventListener('focusout', e => { if (e.target.matches('#ed-testo')) salva().then(portaAlConcerto); });
  for (const tipo of ['keyup', 'click', 'select']) {
    editor.addEventListener(tipo, e => { if (e.target.id === 'ed-testo') disegnaAnteprima(); });
  }
  editor.addEventListener('paste', e => {
    if (e.target.id !== 'ed-testo') return;
    e.preventDefault();
    const ta = e.target;
    inserisci(ta, ta.selectionStart, ta.selectionEnd, pulisci(e.clipboardData.getData('text/plain')));
  });
  editor.addEventListener('keydown', e => {
    if (e.target.id === 'ed-testo' && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); applicaSegno('grassetto'); }
  });
  // Il clic sugli strumenti non deve togliere la selezione dal testo.
  editor.addEventListener('mousedown', e => { if (e.target.closest('.strumento')) e.preventDefault(); });
  editor.addEventListener('click', e => {
    const el = e.target.closest('[data-segno], [data-azione]');
    if (!el) return;
    if (el.dataset.segno) applicaSegno(el.dataset.segno);
    else if (el.dataset.azione === 'nota') notaRegia();
    else if (el.dataset.azione === 'duplica') duplica();
    else if (el.dataset.azione === 'versioni') mostraVersioni();
    else if (el.dataset.azione === 'elimina') chiediElimina();
  });

  // ——— cerca nel testo ————————————————————————————————————————————————————

  // Maiuscole, accenti, apostrofi e punteggiatura non contano; i segni di
  // grassetto e colore non sono parole del brano.
  const norma = t => String(t ?? '')
    .replace(/\*\*|\{\/\}|\{[a-z]+\}/g, '')
    .normalize('NFD').replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  // Le righe che contengono tutte le parole cercate (in qualsiasi ordine) o la
  // frase senza spazi: «lamore» trova «l'amore». null = niente da cercare.
  function trovaRighe(testo, domanda) {
    const n = norma(domanda);
    if (!n) return null;
    const parole = n.split(' ');
    const nc = n.replace(/ /g, '');
    const trovate = [];
    let pos = 0;
    for (const riga of testo.split('\n')) {
      const l = norma(riga);
      if (l && (parole.every(w => l.includes(w)) || l.replace(/ /g, '').includes(nc))) trovate.push({ inizio: pos, fine: pos + riga.length });
      pos += riga.length + 1;
    }
    return trovate;
  }

  // Dove cade il testo [inizio, fine) dentro l'area di testo (in pixel dal suo
  // inizio, con righe a capo comprese): lo misura una copia invisibile con gli
  // stessi caratteri e la stessa larghezza.
  function rettangoliTesto(ta, inizio, fine) {
    const stile = getComputedStyle(ta);
    const m = document.createElement('div');
    Object.assign(m.style, {
      position: 'absolute', visibility: 'hidden', pointerEvents: 'none', top: '0', left: '0',
      boxSizing: 'border-box', width: ta.clientWidth + 'px', padding: stile.padding, border: '0',
      font: stile.font, letterSpacing: stile.letterSpacing, lineHeight: stile.lineHeight, tabSize: stile.tabSize,
      whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
    });
    const segno = document.createElement('span');
    segno.textContent = ta.value.slice(inizio, fine);
    m.append(ta.value.slice(0, inizio), segno, ta.value.slice(fine));
    ta.parentNode.append(m);
    const cima = m.getBoundingClientRect().top;
    const rett = [...segno.getClientRects()].map(r => ({ top: r.top - cima, altezza: r.height }));
    m.remove();
    return rett;
  }

  function scriviConta() {
    const c = $('#ed-cerca-conta');
    if (!c) return;
    const n = ricerca.righe.length;
    if (!$('#ed-cerca').value.trim() || ricerca.nulla) c.textContent = '';
    else if (!n) c.textContent = 'Nessuna riga';
    else if (ricerca.corrente < 0) c.textContent = n === 1 ? '1 riga' : `${n} righe`;
    else c.textContent = `${ricerca.corrente + 1} di ${n}`;
  }

  function riposizionaEvidenza() {
    const dentro = $('#ed-cerca-sopra .cerca-scorri');
    const ta = $('#ed-testo');
    if (dentro && ta) dentro.style.transform = `translateY(${-ta.scrollTop}px)`;
  }

  function disegnaEvidenza() {
    const sopra = $('#ed-cerca-sopra');
    const ta = $('#ed-testo');
    if (!sopra || !ta) return;
    const r = ricerca.corrente >= 0 ? ricerca.righe[ricerca.corrente] : null;
    if (!r) { sopra.replaceChildren(); return; }
    const dentro = document.createElement('div');
    dentro.className = 'cerca-scorri';
    for (const q of rettangoliTesto(ta, r.inizio, r.fine)) {
      const d = document.createElement('div');
      d.className = 'cerca-evidenza';
      d.style.top = q.top + 'px';
      d.style.height = q.altezza + 'px';
      dentro.append(d);
    }
    sopra.replaceChildren(dentro);
    riposizionaEvidenza();
  }

  // Seleziona la riga n fra quelle trovate e la porta in vista senza togliere il
  // cursore dal campo di ricerca.
  function vaiAllaRiga(n) {
    const ta = $('#ed-testo');
    const r = ricerca.righe[n];
    if (!ta || !r) return;
    ricerca.corrente = n;
    ricerca.ultima = r;
    ta.setSelectionRange(r.inizio, r.fine);
    const rett = rettangoliTesto(ta, r.inizio, r.fine);
    if (rett.length) {
      const alto = rett[0].top;
      const basso = rett[rett.length - 1].top + rett[rett.length - 1].altezza;
      if (alto < ta.scrollTop + 24 || basso > ta.scrollTop + ta.clientHeight - 24) ta.scrollTop = Math.max(0, alto - ta.clientHeight / 3);
    }
    disegnaEvidenza();
    scriviConta();
    disegnaAnteprima();
  }

  // Si è scritto nel campo: ricalcola e va alla prima riga che contiene le parole.
  function cercaOra() {
    const ta = $('#ed-testo');
    if (!ta) return;
    const trovate = trovaRighe(ta.value, $('#ed-cerca').value);
    ricerca.nulla = trovate === null;
    ricerca.righe = trovate ?? [];
    ricerca.corrente = -1;
    if (ricerca.righe.length) vaiAllaRiga(0);
    else { disegnaEvidenza(); scriviConta(); }
  }

  function passa(verso) {
    if (!ricerca.righe.length) return;
    const n = ricerca.righe.length;
    vaiAllaRiga(ricerca.corrente < 0 ? (verso > 0 ? 0 : n - 1) : (ricerca.corrente + verso + n) % n);
  }

  function chiudiCerca() {
    const campo = $('#ed-cerca');
    if (campo.value) {
      campo.value = '';
      cercaOra();
      return;
    }
    const ta = $('#ed-testo');
    // Il cursore torna nel testo all'inizio della riga, non con la riga selezionata:
    // un tasto battuto lì la sostituirebbe.
    if (ricerca.ultima) ta.setSelectionRange(ricerca.ultima.inizio, ricerca.ultima.inizio);
    ta.focus({ preventScroll: true });
  }

  function mettiAFuocoCerca() {
    const campo = $('#ed-cerca');
    if (!campo) return;
    campo.focus();
    campo.select();
  }

  // I tasti battuti nel campo di ricerca si fermano lì: niente scorciatoie
  // del resto dell'app (stessa regola di «Vai al brano»).
  editor.addEventListener('keydown', e => {
    if (e.target.id !== 'ed-cerca') return;
    e.stopPropagation();
    if (e.isComposing) return;
    if (e.key === 'Enter') { e.preventDefault(); passa(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); chiudiCerca(); }
    else if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); $('#ed-cerca').select(); }
  });
  editor.addEventListener('input', e => { if (e.target.id === 'ed-cerca') cercaOra(); });
  // Il testo è cambiato (si scrive): le posizioni trovate non valgono più. Resta il conteggio.
  editor.addEventListener('input', e => {
    if (e.target.id !== 'ed-testo') return;
    ricerca.ultima = null;
    if ($('#ed-cerca').value.trim()) {
      const trovate = trovaRighe(e.target.value, $('#ed-cerca').value);
      ricerca.nulla = trovate === null;
      ricerca.righe = trovate ?? [];
      ricerca.corrente = -1;
      disegnaEvidenza();
      scriviConta();
    }
  });
  // Entrando nel testo con una riga trovata ancora selezionata (Tab, Esc), la selezione si chiude.
  editor.addEventListener('focusin', e => {
    const u = ricerca.ultima;
    const ta = e.target;
    if (ta.id === 'ed-testo' && u && ta.selectionStart === u.inizio && ta.selectionEnd === u.fine) ta.setSelectionRange(u.inizio, u.inizio);
  });
  // ⌘F (Ctrl+F) con l'editor aperto porta nel campo di ricerca invece che nella ricerca di Chrome.
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'f') return;
    if (radice.hidden || !$('#ed-cerca') || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    mettiAFuocoCerca();
  });
  addEventListener('resize', () => { if (ricerca.corrente >= 0) disegnaEvidenza(); });

  // ——— azioni ————————————————————————————————————————————————————————————

  async function nuovo() {
    await salva();
    await portaAlConcerto();
    try {
      const b = await archivio.salvaBrano({ titolo: 'Nuovo brano', testo: '' });
      campoCerca.value = '';
      await ricarica();
      await apri(b.id);
      $('#ed-titolo').select();
    } catch (e) { avvisi.mostra('salvataggio', e.message); }
  }

  async function duplica() {
    await salva();
    const b = await archivio.salvaBrano({ ...datiEditor(), id: undefined, titolo: `${$('#ed-titolo').value} (copia)` });
    await ricarica();
    await apri(b.id);
  }

  async function mostraVersioni() {
    await salva();
    const d = $('#dialogo-versioni');
    const vv = await archivio.versioni(idAperto);
    const ul = d.querySelector('.versioni');
    if (!vv.length) ul.innerHTML = '<li class="nessuna">Nessuna versione precedente.</li>';
    else ul.replaceChildren(...vv.map((v, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="quando"></span><span class="anteprima-testo"></span><button type="button" class="pulsante">Ripristina</button>';
      li.querySelector('.quando').textContent = quando(v.salvato);
      li.querySelector('.anteprima-testo').textContent = `${v.titolo} — ${(v.testo.split('\n')[0] || '(vuoto)')}`;
      li.querySelector('button').dataset.ripristina = i;
      return li;
    }));
    ul.onclick = e => {
      const b = e.target.closest('[data-ripristina]');
      if (!b) return;
      const v = vv[+b.dataset.ripristina];
      $('#ed-titolo').value = v.titolo;
      $('#ed-artista').value = v.artista ?? '';
      $('#ed-note').value = v.note ?? '';
      $('#ed-testo').value = v.testo;
      d.close();
      segnaModifica();
    };
    d.showModal();
  }

  function chiediElimina() {
    if (concerto.inCorso()) return;
    const d = $('#dialogo-elimina');
    $('#elimina-titolo').textContent = `«${$('#ed-titolo').value}»`;
    $('#conferma-elimina').value = '';
    d.showModal();
    $('#conferma-elimina').focus();
  }
  $('#dialogo-elimina').addEventListener('click', async e => {
    const d = $('#dialogo-elimina');
    if (e.target.closest('[data-annulla]')) { d.close(); return; }
    if (!e.target.closest('[data-conferma]')) return;
    d.close();
    if ($('#conferma-elimina').value.trim().toLowerCase() !== 'elimina') {
      avvisi.mostra('elimina', 'Non eliminato: per confermare bisogna scrivere «elimina».', { tipo: 'info' });
      setTimeout(() => avvisi.togli('elimina'), 5000);
      return;
    }
    clearTimeout(timer);
    sporco = false;
    await inCorsoSalva;
    await archivio.eliminaBrano(idAperto);
    aperto = null;
    idAperto = null;
    await ricarica();
    disegnaEditore();
  });
  $('#dialogo-versioni').addEventListener('click', e => { if (e.target.closest('[data-annulla]')) $('#dialogo-versioni').close(); });

  async function importa(file) {
    const testi = [...file].filter(f => /\.txt$/i.test(f.name) || f.type === 'text/plain');
    let n = 0;
    for (const f of testi) {
      try {
        await archivio.salvaBrano({ titolo: f.name.replace(/\.[^.]+$/, ''), testo: pulisci(await f.text()) });
        n++;
      } catch (e) { avvisi.mostra('importa', `«${f.name}» non importato: ${e.message}`); }
    }
    await ricarica();
    avvisi.mostra('importati', `Importati ${n} brani.`, { tipo: 'info' });
    setTimeout(() => avvisi.togli('importati'), 4000);
  }
  $('#importa-txt').addEventListener('change', async e => { await importa(e.target.files); e.target.value = ''; });
  radice.addEventListener('dragover', e => { e.preventDefault(); });
  radice.addEventListener('drop', e => { e.preventDefault(); importa(e.dataTransfer.files); });
  radice.querySelector('[data-azione="nuovo-brano"]').addEventListener('click', nuovo);

  // Chiudendo la finestra, ciò che è in sospeso si salva subito.
  addEventListener('pagehide', () => { salva(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) salva(); });

  // ——— avvio ——————————————————————————————————————————————————————————————

  async function avvia() {
    try {
      if (!(await archivio.leggi('esempiInseriti'))) {
        if (!(await archivio.brani()).length) for (const e of ESEMPI) await archivio.salvaBrano(e);
        await archivio.scrivi('esempiInseriti', true);
      }
      await ricarica();
    } catch (e) { avvisi.mostra('archivio', e.message); }
    disegnaEditore();
  }

  return {
    avvia,
    async mostra() {
      const t = await archivio.leggi('tv').catch(() => null);
      imp = { ...IMPOSTAZIONI_TV, ...(t ?? {}) };
      await ricarica();
      // Il brano aperto può essere cambiato mentre si era altrove (correzione al
      // volo, import, Ricomincia da zero): senza modifiche in sospeso, l'editor
      // riparte dal testo dell'archivio.
      await inCorsoSalva;
      if (idAperto && !sporco) {
        const fresco = await archivio.brano(idAperto).then(b => b ?? null, () => undefined);   // undefined = archivio non leggibile
        if (fresco !== undefined && !sporco && (fresco?.aggiornato ?? null) !== base) ricaricaAperto(fresco);
      }
      aggiornaStatoConcerto();
      disegnaAnteprima();
    },
    salva,
    brani: () => brani,
    ricarica,
  };
}
