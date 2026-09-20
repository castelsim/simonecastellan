/* Scrive dentro index.html il contenuto che prima esisteva solo in JavaScript.
   Prima: nell'HTML servito c'era il 12% del testo e 5 fonti su 30 — per un
   motore di ricerca la pagina era un guscio vuoto, e senza JS due sezioni
   restavano bianche. Ora le tappe sono una sezione leggibile anche da fermi.

   Si rilancia dopo ogni modifica a dati.js:
       node satoshi/ops/prerender.mjs
   © 2026 Simone Castellan */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const qui = dirname(fileURLToPath(import.meta.url));
const cartella = join(qui, '..');
const { NODI, TRACCE, CANDIDATI, CHIUSE } = await import(join(cartella, 'dati.js'))
  .then(m => m.default || m)
  .catch(async () => {
    const src = readFileSync(join(cartella, 'dati.js'), 'utf8');
    const f = new Function(src + '\nreturn { NODI, TRACCE, CANDIDATI, CHIUSE };');
    return f();
  });

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ordinati = NODI.map((n, i) => ({ ...n, _i: i }))
                     .sort((a, b) => a.anno - b.anno || a._i - b._i);
const nomeStrada = id => (TRACCE.find(t => t.id === id) || { nome: 'Bitcoin' }).nome;

/* ── le 27 tappe, in ordine ─────────────────────────────────────────── */
const tappe = ordinati.map(n => `      <article class="tappa${n.traccia === 'tronco' ? ' tronco' : ''}" id="t-${esc(n.id)}">
        <p class="quando"><time>${esc(n.data || n.anno)}</time> · <span class="strada">${esc(nomeStrada(n.traccia))}</span></p>
        <h3>${esc(n.titolo)}</h3>${n.chi ? `
        <p class="chi">${esc(n.chi)}</p>` : ''}
        <p class="dice">${esc(n.testo)}</p>${n.perche ? `
        <p class="conta"><b>Perché conta</b> ${esc(n.perche)}</p>` : ''}${n.fonte ? `
        <p class="dove"><a href="${esc(n.fonte.url)}" target="_blank" rel="noopener">${esc(n.fonte.testo)}</a></p>` : ''}
      </article>`).join('\n');

/* ── i cinque nomi che ricorrono ────────────────────────────────────── */
const schede = CANDIDATI.map(k => `      <article class="scheda">
        <h3>${esc(k.nome)} <span>${esc(k.vissuto)}</span></h3>
        <p class="cosa">${esc(k.cosa)}</p>
        <div class="bilancia">
          <div class="pro">${esc(k.a_favore)}</div>
          <div class="contro">${esc(k.contro)}</div>
        </div>${k.fonte ? `
        <p><a class="fonte-s" href="${esc(k.fonte.url)}" target="_blank" rel="noopener">${esc(k.fonte.testo)}</a></p>` : ''}
      </article>`).join('\n');

/* ── le attribuzioni smentite ───────────────────────────────────────── */
const chiuse = CHIUSE.map(k => `      <div class="chiusa">
        <h3>${esc(k.nome)} <span>${esc(k.anno)}</span></h3>
        <p>${esc(k.testo)}</p>
      </div>`).join('\n');

const pezzi = { TAPPE: tappe, SCHEDE: schede, CHIUSE: chiuse };

const f = join(cartella, 'index.html');
let html = readFileSync(f, 'utf8');
let scritti = 0;
for (const [nome, corpo] of Object.entries(pezzi)) {
  const re = new RegExp(`(<!-- ${nome}:inizio -->)[\\s\\S]*?(<!-- ${nome}:fine -->)`);
  if (!re.test(html)) { console.error(`  ⚠ marcatori ${nome} assenti in index.html`); continue; }
  html = html.replace(re, `$1\n${corpo}\n      $2`);
  scritti++;
}
writeFileSync(f, html);

const parole = t => t.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const corpo = html.slice(html.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>/g, '');
console.log(`prerender: ${scritti}/3 blocchi, ${ordinati.length} tappe, ${CANDIDATI.length} profili, ${CHIUSE.length} attribuzioni`);
console.log(`index.html contiene ora ${parole(corpo)} parole e ${(html.match(/<a /g) || []).length} link`);
