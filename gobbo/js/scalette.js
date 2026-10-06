// Le scalette: si preparano prima, si avviano con «Inizia il concerto».
// Avviare un concerto ne fa una COPIA: cambiare la scaletta dopo non sposta
// niente sotto gli occhi del cantante.

import { cerca, creaIndice } from './cerca.js';

export function creaScalette({ archivio, radice, avvisi, concerto, libreria, vaiA }) {
  let scalette = [];
  let aperta = null;
  let trascinato = null;

  radice.innerHTML = `
    <div class="libreria">
      <aside class="elenco">
        <div class="barra-elenco">
          <button type="button" class="pulsante giallo" data-azione="nuova-scaletta">+ Nuova scaletta</button>
        </div>
        <ul id="elenco-scalette" class="elenco-brani"></ul>
      </aside>
      <section class="editor" id="scaletta"></section>
    </div>
    <dialog id="dialogo-sostituisci" class="dialogo">
      <p>C'è già un concerto in corso. Iniziare questo al suo posto?</p>
      <div class="pulsanti"><button type="button" class="pulsante" data-annulla>Annulla</button><button type="button" class="pulsante giallo" data-conferma>Sì, inizia questo</button></div>
    </dialog>
    <dialog id="dialogo-elimina-scaletta" class="dialogo">
      <p>Eliminare la scaletta <b id="elimina-scaletta-nome"></b>? I brani restano in libreria.</p>
      <div class="pulsanti"><button type="button" class="pulsante" data-annulla>Annulla</button><button type="button" class="pulsante pericolo" data-conferma>Elimina la scaletta</button></div>
    </dialog>`;

  const $ = s => radice.querySelector(s);
  const pannello = $('#scaletta');
  const braniPerId = () => new Map(libreria.brani().map(b => [b.id, b]));

  async function ricarica() {
    scalette = (await archivio.scalette()).sort((a, b) => b.aggiornata.localeCompare(a.aggiornata));
    if (aperta) aperta = scalette.find(s => s.id === aperta.id) ?? null;
    disegnaElenco();
  }

  function disegnaElenco() {
    const ul = $('#elenco-scalette');
    ul.replaceChildren(...scalette.map(s => {
      const li = document.createElement('li');
      li.dataset.id = s.id;
      if (aperta?.id === s.id) li.className = 'scelto';
      li.innerHTML = '<span class="titolo"></span><span class="artista"></span>';
      li.querySelector('.titolo').textContent = s.nome;
      li.querySelector('.artista').textContent = `${s.brani.length} brani`;
      return li;
    }));
    if (!scalette.length) ul.innerHTML = '<li class="nessuna">Nessuna scaletta.</li>';
  }

  $('#elenco-scalette').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    aperta = scalette.find(s => s.id === li.dataset.id);
    disegnaElenco();
    disegnaScaletta();
  });

  // Il pannello si costruisce una volta per scaletta aperta; dopo un
  // salvataggio si aggiornano solo l'elenco e il pulsante, mai i campi in cui
  // si sta scrivendo (altrimenti il testo appena battuto sparirebbe).
  function disegnaScaletta() {
    if (!aperta) {
      pannello.innerHTML = '<div class="vuoto"><h2>Nessuna scaletta aperta</h2><p>Creane una nuova o sceglila a sinistra.</p></div>';
      delete pannello.dataset.id;
      return;
    }
    if (pannello.dataset.id !== aperta.id) costruisciPannello();
    disegnaBrani();
  }

  function costruisciPannello() {
    pannello.dataset.id = aperta.id;
    pannello.innerHTML = `
      <div class="editor-testa scaletta-testa">
        <input id="sc-nome" class="campo titolo" placeholder="Nome della scaletta" spellcheck="false">
        <div class="editor-azioni">
          <button type="button" class="pulsante" data-azione="duplica-scaletta">Duplica</button>
          <button type="button" class="pulsante pericolo" data-azione="elimina-scaletta">Elimina</button>
        </div>
        <button type="button" class="pulsante giallo inizia" data-azione="inizia">▶ Inizia il concerto</button>
      </div>
      <div class="aggiungi">
        <input id="sc-aggiungi" class="campo" type="search" placeholder="Aggiungi un brano: scrivi e premi Invio" autocomplete="off" spellcheck="false">
        <ul id="sc-risultati" class="risultati"></ul>
      </div>
      <ol id="sc-brani" class="sc-brani"></ol>
      <p class="guida">Trascina per riordinare, oppure usa ↑ ↓. Il concerto usa una copia della scaletta: cambiarla dopo non tocca il concerto in corso.</p>`;
    $('#sc-nome').value = aperta.nome;
  }

  function disegnaBrani() {
    const perId = braniPerId();
    if (document.activeElement !== $('#sc-nome')) $('#sc-nome').value = aperta.nome;
    const ol = $('#sc-brani');
    ol.replaceChildren(...aperta.brani.filter(id => perId.has(id)).map((id, i) => {
      const b = perId.get(id);
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.i = i;
      li.innerHTML = `<span class="maniglia" aria-hidden="true">⋮⋮</span><span class="num">${i + 1}</span>
        <span class="voce"><span class="titolo"></span><span class="artista"></span></span>
        <button type="button" class="pulsante piccolo" data-su title="Sposta su">↑</button>
        <button type="button" class="pulsante piccolo" data-giu title="Sposta giù">↓</button>
        <button type="button" class="pulsante piccolo" data-togli title="Togli dalla scaletta">✕</button>`;
      li.querySelector('.titolo').textContent = b.titolo;
      li.querySelector('.artista').textContent = b.artista;
      return li;
    }));
    if (!aperta.brani.length) ol.innerHTML = '<li class="nessuna">Scaletta vuota: aggiungi i brani qui sopra.</li>';
    $('[data-azione="inizia"]').disabled = !aperta.brani.some(id => perId.has(id));
  }

  // I salvataggi vanno in fila e ogni modifica si calcola sulla scaletta già
  // aggiornata: il nome salvato uscendo dal campo e un brano aggiunto subito
  // dopo non si cancellano a vicenda (trovato dalla prova, 01/10/2026).
  let fila = Promise.resolve();
  function salvaScaletta(cambi) {
    fila = fila.then(async () => {
      if (!aperta) return;
      const c = typeof cambi === 'function' ? cambi(aperta) : cambi;
      if (!c) return;
      try {
        aperta = await archivio.salvaScaletta({ ...aperta, ...c });
        scalette = scalette.map(s => (s.id === aperta.id ? aperta : s));
        disegnaElenco();
        disegnaScaletta();
      } catch (e) { avvisi.mostra('scaletta', 'La scaletta non si salva: ' + e.message); }
    });
    return fila;
  }

  function sposta(da, a) {
    salvaScaletta(s => {
      if (a < 0 || a >= s.brani.length) return null;
      const brani = [...s.brani];
      const [x] = brani.splice(da, 1);
      brani.splice(a, 0, x);
      return { brani };
    });
  }

  function risultati() {
    const q = $('#sc-aggiungi').value;
    const ul = $('#sc-risultati');
    if (!q.trim()) { ul.replaceChildren(); return []; }
    const r = cerca(creaIndice(libreria.brani()), q, 8);
    ul.replaceChildren(...r.map(({ brano }) => {
      const li = document.createElement('li');
      li.dataset.id = brano.id;
      li.innerHTML = '<span class="titolo"></span> <span class="artista"></span>';
      li.querySelector('.titolo').textContent = brano.titolo;
      li.querySelector('.artista').textContent = brano.artista;
      return li;
    }));
    return r;
  }

  function aggiungi(id) {
    salvaScaletta(s => ({ brani: [...s.brani, id] })).then(() => $('#sc-aggiungi')?.focus());
  }

  pannello.addEventListener('input', e => {
    if (e.target.id === 'sc-aggiungi') risultati();
  });
  pannello.addEventListener('change', e => {
    if (e.target.id === 'sc-nome') salvaScaletta({ nome: e.target.value });
  });
  pannello.addEventListener('keydown', e => {
    if (e.target.id === 'sc-aggiungi' && e.key === 'Enter') {
      const r = risultati();
      if (r.length) aggiungi(r[0].brano.id);
    }
    if (e.target.id === 'sc-nome' && e.key === 'Enter') e.target.blur();
  });
  pannello.addEventListener('click', e => {
    const ris = e.target.closest('#sc-risultati li');
    if (ris) { aggiungi(ris.dataset.id); return; }
    const li = e.target.closest('#sc-brani li[data-i]');
    if (li) {
      const i = +li.dataset.i;
      if (e.target.closest('[data-su]')) sposta(i, i - 1);
      else if (e.target.closest('[data-giu]')) sposta(i, i + 1);
      else if (e.target.closest('[data-togli]')) salvaScaletta(s => ({ brani: s.brani.filter((_, j) => j !== i) }));
      return;
    }
    const az = e.target.closest('[data-azione]')?.dataset.azione;
    if (az === 'inizia') chiediInizio();
    else if (az === 'duplica-scaletta') duplica();
    else if (az === 'elimina-scaletta') { $('#elimina-scaletta-nome').textContent = `«${aperta.nome}»`; $('#dialogo-elimina-scaletta').showModal(); }
  });

  // Trascinare per riordinare.
  pannello.addEventListener('dragstart', e => { const li = e.target.closest('#sc-brani li[data-i]'); if (li) { trascinato = +li.dataset.i; e.dataTransfer.effectAllowed = 'move'; } });
  pannello.addEventListener('dragover', e => { if (trascinato !== null && e.target.closest('#sc-brani li[data-i]')) e.preventDefault(); });
  pannello.addEventListener('drop', e => {
    const li = e.target.closest('#sc-brani li[data-i]');
    if (trascinato === null || !li) return;
    e.preventDefault();
    sposta(trascinato, +li.dataset.i);
    trascinato = null;
  });
  pannello.addEventListener('dragend', () => { trascinato = null; });

  async function nuova() {
    aperta = await archivio.salvaScaletta({ nome: 'Nuova scaletta', brani: [] });
    await ricarica();
    disegnaScaletta();
    $('#sc-nome').select();
  }

  async function duplica() {
    aperta = await archivio.salvaScaletta({ nome: `${aperta.nome} (copia)`, brani: aperta.brani });
    await ricarica();
    disegnaScaletta();
  }

  function chiediInizio() {
    if (concerto.inCorso()) $('#dialogo-sostituisci').showModal();
    else inizia();
  }

  function inizia() {
    const perId = braniPerId();
    const brani = aperta.brani.filter(id => perId.has(id)).map(id => perId.get(id));
    if (!brani.length) return;
    concerto.inizia({ nome: aperta.nome, brani });
    avvisi.togli('concerto-vecchio');   // il concerto nuovo prende i testi della libreria
    vaiA('concerto');
  }

  $('#dialogo-sostituisci').addEventListener('click', e => {
    if (e.target.closest('[data-annulla]')) $('#dialogo-sostituisci').close();
    if (e.target.closest('[data-conferma]')) { $('#dialogo-sostituisci').close(); inizia(); }
  });
  $('#dialogo-elimina-scaletta').addEventListener('click', async e => {
    const d = $('#dialogo-elimina-scaletta');
    if (e.target.closest('[data-annulla]')) { d.close(); return; }
    if (!e.target.closest('[data-conferma]')) return;
    d.close();
    await archivio.eliminaScaletta(aperta.id);
    aperta = null;
    await ricarica();
    disegnaScaletta();
  });
  $('[data-azione="nuova-scaletta"]').addEventListener('click', nuova);

  return {
    async mostra() {
      await libreria.ricarica();
      await ricarica();
      if (!aperta && scalette.length) aperta = scalette[0];
      disegnaElenco();
      disegnaScaletta();
    },
  };
}
