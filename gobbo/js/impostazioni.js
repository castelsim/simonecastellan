// Impostazioni: resa sulla TV, backup, memoria, tasti.

import { IMPOSTAZIONI_TV } from './impostazioni-tv.js';
import { prepara, vista } from './navigazione.js';
import { disegnaVista } from './resa.js';
import { caratterePerBrano, misuratoreCanvas } from './misura.js';
import { ESEMPI } from './esempi.js';

const TV = { larghezza: 1920, altezza: 1080 };
const SETTE_GIORNI = 7 * 24 * 3600 * 1000;

const giorno = d => d.toISOString().slice(0, 10);
function quandoBackup(iso) {
  if (!iso) return 'mai';
  const d = new Date(iso);
  const ore = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (giorno(d) === giorno(new Date())) return `oggi alle ${ore}`;
  return `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} alle ${ore}`;
}

export function creaImpostazioni({ archivio, radice, avvisi, concerto, copia }) {
  let imp = { ...IMPOSTAZIONI_TV };
  const misura = misuratoreCanvas('"Atkinson Hyperlegible"');

  radice.innerHTML = `
    <div class="impostazioni">
      <section class="blocco">
        <h2>Testo sulla TV</h2>
        <div class="imp-corpo">
          <div class="imp-campi">
            <label>Carattere massimo (px)<input id="imp-massimo" class="campo" type="number" min="30" max="300" step="5"></label>
            <p class="guida">Il gobbo usa il carattere più grande che fa stare la strofa più lunga del brano; questo è il tetto.</p>
            <label>Interlinea<input id="imp-interlinea" class="campo" type="number" min="1" max="2" step="0.02"></label>
            <label>Margini ai lati (%)<input id="imp-margine" class="campo" type="number" min="0" max="20" step="1"></label>
            <label class="spunta"><input id="imp-stato" type="checkbox"> In alto: numero, titolo e brano dopo</label>
            <label class="spunta"><input id="imp-specchio" type="checkbox"> Testo specchiato (gobbo a vetro)</label>
            <button type="button" class="pulsante" data-azione="valori-partenza">Valori di partenza</button>
          </div>
          <div>
            <p class="etichetta">Anteprima</p>
            <div class="anteprima" id="imp-anteprima-box"><div class="schermo" id="imp-anteprima"></div></div>
          </div>
        </div>
      </section>

      <section class="blocco">
        <h2>Copia automatica in una cartella</h2>
        <p id="cartella-stato" class="ultimo-backup"></p>
        <p class="guida">Scegli una volta una cartella (Documenti, o iCloud Drive per averla anche su altri apparecchi): a ogni modifica di brani, scalette o impostazioni il gobbo ci scrive <code>gobbo-libreria.json</code> e una copia al giorno in <code>storico/</code> (ultime 30). Durante il concerto i tasti non scrivono niente sul disco. Su un altro Mac: «Importa un backup» e scegli <code>gobbo-libreria.json</code>.</p>
        <div class="riga-pulsanti">
          <button type="button" class="pulsante giallo" data-azione="scegli-cartella">Scegli la cartella…</button>
          <button type="button" class="pulsante" data-azione="copia-ora">Copia adesso</button>
          <button type="button" class="pulsante pericolo" data-azione="smetti-cartella">Smetti di copiare</button>
        </div>
      </section>

      <section class="blocco">
        <h2>Backup</h2>
        <p id="ultimo-backup" class="ultimo-backup"></p>
        <p id="libreria-prima" class="ultimo-backup" hidden><span id="libreria-prima-testo"></span> <button type="button" class="pulsante" data-azione="ripristina-prima">Ripristina</button></p>
        <p class="guida">Tutto vive in questo Chrome, su questo Mac. Un backup è un file da tenere altrove (chiavetta, cloud, mail a te stesso): con quello la libreria si ricarica su qualsiasi Mac.</p>
        <div class="riga-pulsanti">
          <button type="button" class="pulsante giallo" data-azione="esporta">Esporta tutto</button>
          <label class="pulsante">Importa un backup<input id="importa-backup" type="file" accept=".json,application/json" hidden></label>
          <label class="spunta"><input type="radio" name="modo-import" value="unisci" checked> aggiungi alla libreria</label>
          <label class="spunta"><input type="radio" name="modo-import" value="sostituisci"> sostituisci tutto</label>
        </div>
        <p class="guida">Per un cantante nuovo: «Ricomincia da zero» cancella brani e scalette (prima ne fa una copia). Le impostazioni della TV restano.</p>
        <div class="riga-pulsanti">
          <button type="button" class="pulsante pericolo" data-azione="ricomincia">Ricomincia da zero</button>
        </div>
      </section>

      <section class="blocco">
        <h2>Memoria</h2>
        <p id="memoria-protetta" class="guida"></p>
      </section>

      <section class="blocco">
        <h2>Tasti durante il concerto</h2>
        <table class="tasti">
          <tr><td><kbd>→</kbd> <kbd>Spazio</kbd> <kbd>PagGiù</kbd></td><td>riga successiva</td></tr>
          <tr><td><kbd>←</kbd> <kbd>PagSu</kbd></td><td>riga precedente</td></tr>
          <tr><td><kbd>↓</kbd> / <kbd>↑</kbd></td><td>strofa successiva / precedente</td></tr>
          <tr><td><kbd>N</kbd> / <kbd>P</kbd></td><td>brano successivo / precedente</td></tr>
          <tr><td><kbd>B</kbd> o <kbd>.</kbd></td><td>nero sulla TV (di nuovo: torna il testo)</td></tr>
          <tr><td><kbd>/</kbd></td><td>vai al brano (anche fuori scaletta) o a una riga: scrivi delle parole del testo</td></tr>
          <tr><td><kbd>Invio</kbd> · doppio clic · ✎</td><td>correggi una riga al volo</td></tr>
          <tr><td>sulla TV: <kbd>F</kbd> o doppio clic</td><td>schermo intero</td></tr>
        </table>
        <p class="guida">I pedali «volta-pagina» Bluetooth mandano PagGiù/PagSu: funzionano senza impostare niente.</p>
      </section>
    </div>
    <dialog id="dialogo-sostituisci-tutto" class="dialogo">
      <p>Sostituire <b>tutta</b> la libreria e le scalette con quelle del backup? Ciò che non è nel backup sparisce.</p>
      <p>Prima ne faccio una copia: dentro il gobbo (resta qui sotto, in «Backup»: «Ripristina»), nella cartella della copia automatica, se è attiva, e nei Download. Se serve, si torna indietro.</p>
      <div class="pulsanti"><button type="button" class="pulsante" data-annulla>Annulla</button><button type="button" class="pulsante pericolo" data-conferma>Sostituisci tutto</button></div>
    </dialog>
    <dialog id="dialogo-ripristina" class="dialogo">
      <p>Ripristinare la libreria di prima? Brani e scalette di adesso vengono <b>sostituiti</b> da quelli di quella copia.</p>
      <p>Prima metto da parte la libreria di adesso, sempre dentro il gobbo: se serve, «Ripristina» riporta com'è ora.</p>
      <p>Le Versioni dei brani di adesso non si conservano: la copia contiene brani, scalette e impostazioni, non le Versioni.</p>
      <div class="pulsanti"><button type="button" class="pulsante" data-annulla>Annulla</button><button type="button" class="pulsante pericolo" data-conferma>Ripristina</button></div>
    </dialog>
    <dialog id="dialogo-ricomincia" class="dialogo">
      <p>Ricominciare da zero? Si cancellano <b>tutti</b> i brani, le scalette e le loro versioni. Le impostazioni della TV restano.</p>
      <p>Prima ne faccio una copia: dentro il gobbo (resta qui sotto, in «Backup»: «Ripristina»), nella cartella della copia automatica, se è attiva, e nei Download. Se serve, si torna indietro.</p>
      <div class="pulsanti"><button type="button" class="pulsante" data-annulla>Annulla</button><button type="button" class="pulsante pericolo" data-conferma>Ricomincia da zero</button></div>
    </dialog>`;

  const $ = s => radice.querySelector(s);

  function riempi() {
    $('#imp-massimo').value = imp.massimo;
    $('#imp-interlinea').value = imp.interlinea;
    $('#imp-margine').value = imp.margine;
    $('#imp-stato').checked = imp.mostraStato;
    $('#imp-specchio').checked = imp.specchio;
  }

  function leggiCampi() {
    const num = (id, min, max, riserva) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : riserva; };
    return {
      massimo: num('#imp-massimo', 30, 300, IMPOSTAZIONI_TV.massimo),
      interlinea: num('#imp-interlinea', 1, 2, IMPOSTAZIONI_TV.interlinea),
      margine: num('#imp-margine', 0, 20, IMPOSTAZIONI_TV.margine),
      mostraStato: $('#imp-stato').checked,
      specchio: $('#imp-specchio').checked,
    };
  }

  async function applica(nuove) {
    imp = nuove;
    concerto.impostazioni(imp);
    disegnaAnteprima();
    try { await archivio.scrivi('tv', imp); } catch (e) { avvisi.mostra('impostazioni', 'Impostazioni non salvate: ' + e.message); }
  }

  function disegnaAnteprima() {
    const box = $('#imp-anteprima-box');
    const schermo = $('#imp-anteprima');
    const c = concerto.inCorso() ? concerto.concerto() : { brani: [ESEMPI[0]] };
    const prep = concerto.inCorso() ? concerto.prep() : prepara(c);
    const v = vista(prep, concerto.inCorso() ? concerto.stato() : { n: 0, b: 0, r: 1, nero: false });
    schermo.style.width = TV.larghezza + 'px';
    schermo.style.height = TV.altezza + 'px';
    schermo.style.transform = `scale(${box.clientWidth / TV.larghezza})`;
    schermo.style.setProperty('--interlinea', imp.interlinea);
    schermo.style.setProperty('--margine', imp.margine + '%');
    schermo.classList.toggle('specchio', !!imp.specchio);
    disegnaVista(schermo, { ...v, nero: false }, { mostraStato: imp.mostraStato, altezza: TV.altezza,
      carattere: v.brano ? caratterePerBrano({ brano: v.brano, larghezza: TV.larghezza, altezza: TV.altezza, imp, misura }) : imp.massimo });
  }

  radice.addEventListener('change', e => {
    if (e.target.closest('.imp-campi')) applica(leggiCampi());
  });
  radice.addEventListener('input', e => {
    if (e.target.matches('.imp-campi input[type="number"]')) { imp = leggiCampi(); disegnaAnteprima(); }
  });

  // ——— backup ——————————————————————————————————————————————————————————

  async function scriviUltimo() {
    const ultimo = await archivio.leggi('ultimoBackup').catch(() => null);
    $('#ultimo-backup').textContent = `Ultimo backup: ${quandoBackup(ultimo)}`;
    return ultimo;
  }

  // Con { aggiornaData: false } (le copie automatiche prima di cancellare) il
  // download non vale come backup fatto: il promemoria resta com'è.
  async function esporta({ aggiornaData = true } = {}) {
    try {
      const dati = await archivio.esporta();
      const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 1)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `gobbo-backup-${giorno(new Date())}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      if (aggiornaData) {
        await archivio.scrivi('ultimoBackup', new Date().toISOString());
        avvisi.togli('backup');
        await scriviUltimo();
      }
      return true;
    } catch (e) { avvisi.mostra('backup', 'Backup non riuscito: ' + e.message); return false; }
  }

  let daImportare = null;
  const elenca = nomi => nomi.map(t => `«${t}»`).join(', ');
  const brani = n => `${n} ${n === 1 ? 'brano' : 'brani'}`;
  const scalette = n => `${n} ${n === 1 ? 'scaletta' : 'scalette'}`;
  // L'avviso dice quanti brani sono entrati e quali NO (modificati qui dopo la
  // data del file): prima diceva sempre il numero dei brani nel file.
  async function importa(dati, modo, dopo = '') {
    try {
      const n = await archivio.importa(dati, modo);
      let testo = `Backup importato: ${brani(n.brani)}, ${scalette(n.scalette)}.`;
      if (n.tenuti.length) testo += ` ${brani(n.tenuti.length)} NON ${n.tenuti.length === 1 ? 'importato' : 'importati'} perché ${n.tenuti.length === 1 ? 'modificato' : 'modificati'} su questo Mac dopo il file: ${elenca(n.tenuti)}.`;
      if (n.scaletteTenute.length) testo += ` ${scalette(n.scaletteTenute.length)} NON ${n.scaletteTenute.length === 1 ? 'importata' : 'importate'} per lo stesso motivo: ${elenca(n.scaletteTenute)}.`;
      if (dopo) testo += ` ${dopo}`;
      const fisso = n.tenuti.length || n.scaletteTenute.length || dopo;
      avvisi.mostra('importato', testo, { tipo: 'info', azione: fisso ? { etichetta: 'Ho capito', fai: () => avvisi.togli('importato') } : null });
      if (!fisso) setTimeout(() => avvisi.togli('importato'), 6000);
      avvisaConcerto(n.scritti);
      return true;
    } catch (e) { avvisi.mostra('importato', e.message); return false; }
  }

  // Il concerto in corso è una copia fissa: un import non lo cambia. Se ha
  // toccato un suo brano lo dice subito l'avviso del concerto (concerto.js):
  // uno solo, coi titoli e «Ho capito» (verifica 06/10/2026: il 09/10 la TV
  // avrebbe mostrato i testi vecchi senza nessun avviso; revisione 06/10: due
  // avvisi con lo stesso posto si cancellavano a vicenda).
  function avvisaConcerto() {
    if (concerto.inCorso()) concerto.controllaTesti();
  }

  // ——— la libreria di prima, dentro il gobbo ————————————————————————————
  // Una sola, l'ultima, in IndexedDB (chiave 'primaDiSostituire'). Non viaggia
  // nei backup e non è un cambiamento per la copia in cartella (archivio.js).

  const quando = iso => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}, ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  };

  async function mostraPrima() {
    const c = await archivio.leggi('primaDiSostituire').catch(() => null);
    const ok = c && c.quando && Array.isArray(c.dati?.brani);
    $('#libreria-prima').hidden = !ok;
    if (ok) $('#libreria-prima-testo').textContent = `Libreria di prima del ${quando(c.quando)} (${brani(c.dati.brani.length)}, ${scalette(c.dati.scalette?.length ?? 0)}):`;
  }

  // Mette da parte la libreria di adesso al posto della copia precedente.
  async function tieniPrima() {
    await archivio.scrivi('primaDiSostituire', { quando: new Date().toISOString(), dati: await archivio.esporta() });
    await mostraPrima();
  }

  // Prima di «Ricomincia da zero», «sostituisci tutto» e «Ripristina»: SEMPRE
  // una copia dentro il gobbo (il download da solo non dice se Chrome l'ha
  // salvato: verifica 06/10/2026). Poi, con la copia automatica attiva, una
  // copia datata nella cartella (scritta e chiusa prima di cancellare), e il
  // download. Risponde dove sta la copia, o null = fermarsi.
  async function copiaDiSicurezza() {
    try { await tieniPrima(); }
    catch (e) { avvisi.mostra('importato', `Non sono riuscito a mettere da parte la libreria di prima dentro il gobbo (${e.message}): niente è stato cancellato.`); return null; }
    const dentro = 'Una copia è dentro il gobbo (Impostazioni → Backup → «Ripristina»)';
    let nellaCartella = null;
    try { nellaCartella = await copia.copiaDatata(); }
    catch (e) { avvisi.mostra('importato', `Non sono riuscito a scrivere la copia di sicurezza nella cartella (${e.message}): niente è stato cancellato.`); return null; }
    const scaricata = await esporta({ aggiornaData: false });
    if (nellaCartella) return `La copia di prima è nella cartella ${nellaCartella}${scaricata ? ' (e ne ho scaricata una)' : ''}. ${dentro}.`;
    if (scaricata) return `Ho scaricato una copia di prima: controlla che sia nei Download. ${dentro}.`;
    return `${dentro}; il download non è riuscito.`;
  }

  $('#importa-backup').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    let dati;
    try { dati = JSON.parse(await f.text()); } catch { avvisi.mostra('importato', 'Questo file non è un backup del gobbo: niente è stato cambiato.'); return; }
    const modo = radice.querySelector('input[name="modo-import"]:checked').value;
    if (modo === 'sostituisci') { daImportare = dati; $('#dialogo-sostituisci-tutto').showModal(); }
    else importa(dati, 'unisci');
  });
  $('#dialogo-sostituisci-tutto').addEventListener('click', e => {
    const d = $('#dialogo-sostituisci-tutto');
    if (e.target.closest('[data-annulla]')) { d.close(); daImportare = null; }
    if (e.target.closest('[data-conferma]')) {
      d.close();
      const dati = daImportare;
      daImportare = null;
      // Prima la copia di ciò che c'è: senza, niente viene sostituito.
      copiaDiSicurezza().then(dove => { if (dove) importa(dati, 'sostituisci', dove); });
    }
  });
  $('#dialogo-ripristina').addEventListener('click', async e => {
    const d = $('#dialogo-ripristina');
    if (e.target.closest('[data-annulla]')) d.close();
    if (!e.target.closest('[data-conferma]')) return;
    d.close();
    const c = await archivio.leggi('primaDiSostituire').catch(() => null);
    if (!c?.dati) { avvisi.mostra('importato', 'Non trovo più la libreria di prima: niente è stato cambiato.'); mostraPrima(); return; }
    // La libreria di adesso diventa la nuova copia: «Ripristina» due volte riporta com'era.
    try { await tieniPrima(); }
    catch (err) { avvisi.mostra('importato', `Non sono riuscito a mettere da parte la libreria di adesso (${err.message}): niente è stato cambiato.`); return; }
    // Se l'importazione non riesce, la libreria da ripristinare torna nella copia
    // interna (tieniPrima l'ha appena sostituita): non va persa proprio lei.
    if (!(await importa(c.dati, 'sostituisci', 'La libreria di adesso è stata messa da parte: «Ripristina» la riporta.'))) {
      await archivio.scrivi('primaDiSostituire', c).catch(() => {});
      mostraPrima();
    }
  });
  $('#dialogo-ricomincia').addEventListener('click', e => {
    const d = $('#dialogo-ricomincia');
    if (e.target.closest('[data-annulla]')) d.close();
    if (e.target.closest('[data-conferma]')) {
      d.close();
      // Come «sostituisci tutto» con un backup vuoto: prima la copia, poi si svuota.
      copiaDiSicurezza().then(async dove => {
        if (!dove) return;
        try {
          await archivio.importa({ formato: 'gobbo', versione: 1, brani: [], scalette: [], impostazioni: {} }, 'sostituisci');
          avvisi.mostra('importato', `Libreria vuota: si riparte da zero. ${dove}`, { tipo: 'info', azione: { etichetta: 'Ho capito', fai: () => avvisi.togli('importato') } });
        } catch (err) { avvisi.mostra('importato', err.message); }
      });
    }
  });
  radice.addEventListener('click', e => {
    const az = e.target.closest('[data-azione]')?.dataset.azione;
    if (az === 'ricomincia') {
      if (concerto.inCorso()) avvisi.mostra('importato', 'Durante il concerto non si ricomincia da zero: prima «Termina il concerto».', { tipo: 'info' });
      else $('#dialogo-ricomincia').showModal();
    }
    if (az === 'esporta') esporta();
    if (az === 'ripristina-prima') $('#dialogo-ripristina').showModal();
    if (az === 'scegli-cartella') copia.scegli();
    if (az === 'copia-ora') copia.copiaOra();
    if (az === 'smetti-cartella') copia.smetti();
    if (az === 'valori-partenza') { imp = { ...IMPOSTAZIONI_TV }; riempi(); applica(imp); }
  });

  function aggiornaCartella() {
    const el = $('#cartella-stato');
    const nome = copia.nome() ? `«${copia.nome() || 'cartella'}»` : '';
    const ora = copia.ultima()?.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const stato = copia.stato();
    el.textContent = stato === 'attiva' ? `Attiva nella cartella ${nome}${ora ? ` · ultima copia alle ${ora}` : ''}`
      : stato === 'in-pausa' ? `In pausa: Chrome chiede di riconfermare la cartella ${nome} (avviso in alto, «Riattiva»)`
      : stato === 'errore' ? `Non riesce a scrivere nella cartella ${nome}`
      : 'Non attiva: nessuna cartella scelta';
    $('[data-azione="copia-ora"]').disabled = stato !== 'attiva';
    $('[data-azione="smetti-cartella"]').disabled = stato === 'spenta';
    scriviUltimo();   // una copia nella cartella vale come backup
  }

  return {
    aggiornaCartella,
    async mostra() {
      aggiornaCartella();
      const t = await archivio.leggi('tv').catch(() => null);
      imp = { ...IMPOSTAZIONI_TV, ...(t ?? {}) };
      riempi();
      disegnaAnteprima();
      await scriviUltimo();
      await mostraPrima();
      const protetta = await archivio.protetta().catch(() => false);
      $('#memoria-protetta').textContent = protetta
        ? 'Memoria protetta: Chrome non cancellerà da solo la libreria.'
        : 'Memoria NON protetta: se il disco si riempie, Chrome potrebbe cancellare la libreria. Installa il gobbo come app (menu di Chrome → «Installa») e tieni un backup recente.';
    },
    esporta,
    // Ricorda il backup se l'ultimo è più vecchio di 7 giorni (e c'è più degli esempi).
    async promemoria(numeroBrani) {
      const ultimo = await archivio.leggi('ultimoBackup').catch(() => null);
      if (numeroBrani <= 2) return;
      if (ultimo && Date.now() - Date.parse(ultimo) < SETTE_GIORNI) return;
      avvisi.mostra('backup', `Ultimo backup: ${quandoBackup(ultimo)}. Conviene esportarne uno adesso.`,
        { tipo: 'info', azione: { etichetta: 'Esporta ora', fai: () => esporta() } });
    },
  };
}
