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
        <p class="guida">Tutto vive in questo Chrome, su questo Mac. Un backup è un file da tenere altrove (chiavetta, cloud, mail a te stesso): con quello la libreria si ricarica su qualsiasi Mac.</p>
        <div class="riga-pulsanti">
          <button type="button" class="pulsante giallo" data-azione="esporta">Esporta tutto</button>
          <label class="pulsante">Importa un backup<input id="importa-backup" type="file" accept=".json,application/json" hidden></label>
          <label class="spunta"><input type="radio" name="modo-import" value="unisci" checked> aggiungi alla libreria</label>
          <label class="spunta"><input type="radio" name="modo-import" value="sostituisci"> sostituisci tutto</label>
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
          <tr><td><kbd>/</kbd></td><td>vai al brano (anche fuori scaletta)</td></tr>
          <tr><td><kbd>Invio</kbd> · doppio clic · ✎</td><td>correggi una riga al volo</td></tr>
          <tr><td>sulla TV: <kbd>F</kbd> o doppio clic</td><td>schermo intero</td></tr>
        </table>
        <p class="guida">I pedali «volta-pagina» Bluetooth mandano PagGiù/PagSu: funzionano senza impostare niente.</p>
      </section>
    </div>
    <dialog id="dialogo-sostituisci-tutto" class="dialogo">
      <p>Sostituire <b>tutta</b> la libreria e le scalette con quelle del backup? Ciò che non è nel backup sparisce.</p>
      <p>Prima scarico una copia di quello che c'è adesso (nei Download): se serve, si reimporta.</p>
      <div class="pulsanti"><button type="button" class="pulsante" data-annulla>Annulla</button><button type="button" class="pulsante pericolo" data-conferma>Sostituisci tutto</button></div>
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

  async function esporta() {
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
      await archivio.scrivi('ultimoBackup', new Date().toISOString());
      avvisi.togli('backup');
      await scriviUltimo();
      return true;
    } catch (e) { avvisi.mostra('backup', 'Backup non riuscito: ' + e.message); return false; }
  }

  let daImportare = null;
  async function importa(dati, modo) {
    try {
      const n = await archivio.importa(dati, modo);
      avvisi.mostra('importato', `Backup importato: ${n.brani} brani, ${n.scalette} scalette.`, { tipo: 'info' });
      setTimeout(() => avvisi.togli('importato'), 6000);
    } catch (e) { avvisi.mostra('importato', e.message); }
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
      esporta().then(fatta => {
        if (fatta) importa(dati, 'sostituisci');
        else avvisi.mostra('importato', 'Non sono riuscito a scaricare la copia di sicurezza: niente è stato sostituito.');
      });
    }
  });
  radice.addEventListener('click', e => {
    const az = e.target.closest('[data-azione]')?.dataset.azione;
    if (az === 'esporta') esporta();
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
        { tipo: 'info', azione: { etichetta: 'Esporta ora', fai: esporta } });
    },
  };
}
