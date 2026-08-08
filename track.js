/*
  Statistiche anonime del sito — simonecastellan.com
  Una sola copia per tutte le pagine (prima viveva solo dentro index.html, quindi
  del profilo e delle altre pagine non si sapeva nulla).

  Manda un beacon a un Apps Script che scrive su un foglio privato. Nessun cookie,
  nessun identificatore, nessuna profilazione: vedi /privacy/.

  Uso:  <script src="/track.js" defer></script>
        track("click", "ChatGPT");   // gli eventi extra si chiamano a mano

  NOTA: gli assistenti AI che leggono le pagine NON eseguono JavaScript, quindi qui
  non compaiono. Il segnale che il sistema funziona non è questo file: è il rapporto
  fra i clic sul pulsante e i messaggi che arrivano firmati
  «— dal profilo AI di simonecastellan.com».
*/
(function () {
  var ANALYTICS_URL = "https://script.google.com/macros/s/AKfycbw2b2lcSidmlfcv-sPn8bDSTX7DbwoanhVypGuBoMmJ2yooRQQNaGp9D-gzVc6wIuof3Q/exec";

  function track(event, target) {
    if (!ANALYTICS_URL) return;
    try {
      var p = new URLSearchParams(location.search);
      var body = JSON.stringify({
        event: event,
        target: target || "",
        src: p.get("utm_source") || p.get("src") || "",
        ref: document.referrer || "",
        lang: navigator.language || "",
        screen: window.innerWidth + "x" + window.innerHeight,
        path: location.pathname,
        ua: navigator.userAgent || ""
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ANALYTICS_URL, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      } else {
        fetch(ANALYTICS_URL, {
          method: "POST", mode: "no-cors", keepalive: true,
          headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: body
        });
      }
    } catch (e) {}
  }

  // Variante per chi ha bisogno dell'esito (il modulo «Tienimi presente»): stesso
  // canale e stesso foglio, ma torna una Promise — un messaggio perso è un contatto
  // perso, quindi lì il fire-and-forget del beacon non basta.
  track.send = function (event, target) {
    var body = "";
    try {
      var p = new URLSearchParams(location.search);
      body = JSON.stringify({
        event: event,
        target: target || "",
        src: p.get("utm_source") || p.get("src") || "",
        ref: document.referrer || "",
        lang: navigator.language || "",
        screen: window.innerWidth + "x" + window.innerHeight,
        path: location.pathname,
        ua: navigator.userAgent || ""
      });
    } catch (e) { return Promise.reject(e); }
    return fetch(ANALYTICS_URL, {
      method: "POST", mode: "no-cors", keepalive: true,
      headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: body
    });
  };

  window.track = track;
  track("pageview");
})();
