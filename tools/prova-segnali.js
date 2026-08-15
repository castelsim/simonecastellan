'use strict';
/* Prove sui segnali di test — si lancia con `node tools/prova-segnali.js`.
 *
 * Qui si controlla una cosa sola, ma è quella che conta: il rumore rosa
 * normalizzato al valore efficace ha una PUNTA molto più alta del valore
 * efficace, e se si chiede un livello troppo alto la punta esce oltre l'uno.
 * Il segnale distorce prima di entrare nell'impianto, e chi misura attribuisce
 * la distorsione alle casse. Era il caso di «forte» (−12 dBFS) sia in
 * «Rumore rosa» sia in «Tara un impianto»: picco 1,175, cioè 1,4 dB oltre.
 *
 * `comune/segnali.js` usa le API audio del browser: qui gliene diamo una
 * imitazione minima, quel tanto che basta a farlo girare fuori dal browser.
 */

const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');

// Un contesto audio finto: di createBuffer serve solo un contenitore di campioni.
function ctxFinto(sampleRate) {
  return {
    sampleRate: sampleRate,
    createBuffer: function (canali, lunghezza, sr) {
      const dati = new Float32Array(lunghezza);
      return {
        length: lunghezza,
        sampleRate: sr,
        copyToChannel: function (sorgente) { dati.set(sorgente); },
        getChannelData: function () { return dati; }
      };
    }
  };
}

// Carica comune/segnali.js e restituisce l'oggetto SEGNALI.
function caricaSegnali() {
  const codice = fs.readFileSync(path.join(RADICE, 'comune', 'segnali.js'), 'utf8');
  const fabbrica = new Function(codice + '\nreturn SEGNALI;');
  return fabbrica();
}

let passate = 0, fallite = 0;
function prova(nome, fn) {
  try {
    fn();
    passate++;
    console.log('  ok   ' + nome);
  } catch (e) {
    fallite++;
    console.log('  NO   ' + nome + '\n         ' + e.message);
  }
}
function esigi(cond, msg) { if (!cond) throw new Error(msg); }

const SEGNALI = caricaSegnali();

console.log('\nSegnali di prova\n');

/* Alla frequenza vera, non a una più bassa per andare in fretta.
   Provato: a 8 kHz il buffer ha 80.000 campioni invece di 480.000, la punta
   più alta arriva a 3,8 invece che a 4,6, e a −12 dBFS NON supera l'uno. La
   prova girava, dava verde, e stava guardando un caso che il difetto non ce
   l'ha. Dieci secondi a 48 kHz costano qualche secondo: si pagano. */
const SR = 48000;

prova('il rumore rosa esce normalizzato a valore efficace 1', function () {
  const buf = SEGNALI.rosa(ctxFinto(SR));
  const d = buf.getChannelData(0);
  let somma = 0;
  for (let i = 0; i < d.length; i++) somma += d[i] * d[i];
  const rms = Math.sqrt(somma / d.length);
  esigi(Math.abs(rms - 1) < 0.02, 'valore efficace ' + rms.toFixed(4) + ', atteso 1,00');
});

prova('il generatore dichiara la punta del segnale', function () {
  const buf = SEGNALI.rosa(ctxFinto(SR));
  esigi(typeof buf.__picco === 'number', 'la punta non è dichiarata');
  esigi(buf.__picco > 1, 'punta ' + buf.__picco + ': non può essere sotto il valore efficace');
});

prova('la punta dichiarata è quella vera dei campioni', function () {
  const buf = SEGNALI.rosa(ctxFinto(SR));
  const d = buf.getChannelData(0);
  let max = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > max) max = a; }
  esigi(Math.abs(max - buf.__picco) < 1e-6,
        'dichiarata ' + buf.__picco.toFixed(4) + ', misurata ' + max.toFixed(4));
});

prova('il rumore rosa ha un fattore di cresta da rumore (10–16 dB)', function () {
  const buf = SEGNALI.rosa(ctxFinto(SR));
  const cresta = 20 * Math.log10(buf.__picco);
  esigi(cresta > 10 && cresta < 16, 'cresta ' + cresta.toFixed(2) + ' dB, fuori dall\'atteso');
});

prova('al tetto dichiarato la punta arriva esattamente a 1', function () {
  const ctx = ctxFinto(SR);
  const tetto = SEGNALI.massimoSenzaClip(ctx, 'rosa');
  const buf = SEGNALI.rosa(ctx);
  const punta = buf.__picco * SEGNALI.ampiezza(tetto);
  esigi(punta <= 1.0001, 'al tetto la punta arriva a ' + punta.toFixed(4) + ': distorce');
  esigi(punta > 0.9, 'al tetto la punta è solo ' + punta.toFixed(4) + ': tetto troppo prudente');
});

// La controprova: il difetto che c'era davvero. Se un giorno qualcuno rimette
// −12 dBFS come livello massimo, questa deve fallire.
prova('CONTROPROVA — a −12 dBFS il rumore rosa distorceva', function () {
  const ctx = ctxFinto(SR);
  const buf = SEGNALI.rosa(ctx);
  const punta = buf.__picco * SEGNALI.ampiezza(-12);
  esigi(punta > 1, 'a −12 dBFS la punta è ' + punta.toFixed(4) +
                   ': se non supera 1 questa prova non sta più guardando niente');
  const tetto = SEGNALI.massimoSenzaClip(ctx, 'rosa');
  esigi(tetto < -12, 'il tetto (' + tetto.toFixed(2) + ' dBFS) non protegge da −12');
});

prova('il rumore bianco ha una cresta più bassa del rosa', function () {
  const ctx = ctxFinto(SR);
  const rosa = SEGNALI.rosa(ctx).__picco;
  const bianco = SEGNALI.bianco(ctx).__picco;
  esigi(bianco < rosa, 'bianco ' + bianco.toFixed(3) + ' non è sotto rosa ' + rosa.toFixed(3));
});

prova('lo stesso contesto restituisce lo stesso buffer (cache)', function () {
  const ctx = ctxFinto(SR);
  esigi(SEGNALI.rosa(ctx) === SEGNALI.rosa(ctx), 'il rumore viene rigenerato a ogni chiamata');
});

console.log('\n' + passate + ' passate, ' + fallite + ' fallite\n');
process.exit(fallite ? 1 : 0);
