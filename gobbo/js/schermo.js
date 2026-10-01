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
