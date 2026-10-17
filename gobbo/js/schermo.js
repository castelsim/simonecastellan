// Schermi: aprire la TV sul secondo schermo e tenere gli schermi accesi.

// Apre la finestra della TV. Se Chrome ha il permesso di vedere gli schermi,
// la mette sullo schermo esterno e grande quanto lui; altrimenti apre una
// finestra normale da trascinare. Sulla TV poi basta un clic su «Schermo
// intero» (o il tasto F, o un doppio clic).
//
// «noopener»: la TV è una finestra indipendente, in un processo suo. Aperta
// col legame alla regia, un blocco o un crash della regia bloccava anche la
// TV (revisione 01/10/2026, C2). Il prezzo: window.open non restituisce la
// finestra, quindi la regia capisce che la TV c'è dal suo saluto sul canale.
// → { esterno: boolean }
export async function apriTv() {
  let posto = 'noopener,popup,width=960,height=540';
  let esterno = false;
  try {
    if ('getScreenDetails' in window) {
      const schermi = await window.getScreenDetails();
      const altro = schermi.screens.find(s => s !== schermi.currentScreen && !s.isInternal)
        ?? schermi.screens.find(s => s !== schermi.currentScreen);
      if (altro) {
        esterno = true;
        posto = `noopener,popup,fullscreen,left=${altro.availLeft},top=${altro.availTop},width=${altro.availWidth},height=${altro.availHeight}`;
      }
    }
  } catch { /* permesso negato: finestra normale */ }
  window.open('tv.html', '_blank', posto);
  return { esterno };
}

// Gli schermi collegati, senza chiedere niente: solo se Chrome ha già il
// permesso (lo chiede «Apri TV»). `cambiati` è chiamata quando si collega o
// si stacca uno schermo. → [{ interno, larghezza, altezza }] oppure null
export async function leggiSchermi(cambiati) {
  try {
    if (!('getScreenDetails' in window)) return null;
    const p = await navigator.permissions.query({ name: 'window-management' });
    if (p.state !== 'granted') return null;
    const dettagli = await window.getScreenDetails();
    const elenco = () => dettagli.screens.map(s => ({ interno: !!s.isInternal, larghezza: s.width, altezza: s.height }));
    if (cambiati) dettagli.addEventListener('screenschange', () => cambiati(elenco()));
    return elenco();
  } catch { return null; }
}

// La finestra della TV è sullo schermo del Mac invece che sulla TV?
// (05/10/2026: TV in estensione ma vuota, la finestra era dietro la regia.)
// Sì se c'è uno schermo esterno più largo del Mac e la finestra sta dentro il Mac.
export function tvSulMac(tv, schermi) {
  const mac = schermi?.find(s => s.interno);
  const esterni = (schermi ?? []).filter(s => !s.interno);
  if (!mac || !esterni.length || !tv) return false;
  const piuLargo = Math.max(...esterni.map(s => s.larghezza));
  return piuLargo > mac.larghezza && tv.larghezza <= mac.larghezza && tv.altezza <= mac.altezza;
}

// La finestra della TV è sulla TV ma non a schermo intero? Chrome la apre sulla
// TV con le sue barre (titolo, indirizzo) e lascia lo schermo intero a un gesto
// sulla finestra stessa: doppio clic o F (prova con la TV vera, 05/10/2026).
// Sì se è larga quanto uno schermo esterno ma più bassa di lui.
export function tvNonIntera(tv, schermi) {
  if (!tv) return false;
  return (schermi ?? []).some(s => !s.interno && s.larghezza === tv.larghezza && tv.altezza < s.altezza);
}

// Lo schermo non si spegne e non va in stop finché la pagina è visibile.
// Chrome toglie il blocco quando la pagina si nasconde: lo richiediamo al ritorno.
export function tieniAcceso() {
  if (!('wakeLock' in navigator)) return;
  const chiedi = async () => {
    if (document.visibilityState !== 'visible') return;
    try { await navigator.wakeLock.request('screen'); } catch { /* negato o non supportato */ }
  };
  document.addEventListener('visibilitychange', chiedi);
  chiedi();
}

// Il service worker rende l'app disponibile anche a server spento.
export function registraFuoriLinea() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
