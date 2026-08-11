/* Il pezzo condiviso dai tre strumenti che scrivono un prompt.

   Quello che fanno è sempre lo stesso: raccolgono qualche scelta, ne ricavano
   istruzioni scritte bene per un assistente e le consegnano a chi le userà.

   Due regole nate da questo sito.

   1) Il prompt SI VEDE. Sta in un riquadro nella pagina, si può leggere e
      correggere prima di portarlo altrove. Un sito che apre un assistente con
      istruzioni che chi arriva non ha mai letto sembra un trucco — è la
      lezione del prompt della home, sceso da 5.000 caratteri a 132.

   2) Il prompt NON viaggia nell'indirizzo. Con un comunicato incollato dentro,
      l'URL arriva a decine di migliaia di caratteri: Perplexity, provato da
      qui, risponde «414 Request-URI Too Large», e gli altri troncano in
      silenzio, che è peggio. Quindi si copia sempre negli appunti e si apre
      l'assistente vuoto. Sempre lo stesso gesto, sempre lo stesso esito. */

var PROMPT = (function () {

  var ASSISTENTI = {
    chatgpt: { nome: 'ChatGPT', url: 'https://chatgpt.com/' },
    claude:  { nome: 'Claude',  url: 'https://claude.ai/new' }
  };

  /* Il ripiego va agganciato DENTRO il .catch: senza gesto dell'utente o fuori
     da https writeText rigetta, e chi non intercetta non copia e non lo dice. */
  function copia(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t).catch(function () { return conCasella(t); });
    }
    return conCasella(t);
  }

  function conCasella(t) {
    var a = document.createElement('textarea');
    a.value = t;
    a.style.position = 'fixed';
    a.style.opacity = '0';
    document.body.appendChild(a);
    a.select();
    try { document.execCommand('copy'); } catch (e) { /* niente da fare */ }
    document.body.removeChild(a);
  }

  /* La scheda va aperta nello stesso gesto del clic, altrimenti il browser la
     blocca come finestra non richiesta: prima si apre, poi si copia. */
  function apri(quale) {
    var a = ASSISTENTI[quale] || ASSISTENTI.chatgpt;
    window.open(a.url, '_blank', 'noopener');
  }

  /* Aggancia i due pulsanti e il messaggio.  `dammiIlTesto` viene richiamata al
     momento del clic, non prima: il prompt cambia a ogni tasto premuto. */
  function collega(opzioni) {
    var vai   = document.getElementById(opzioni.vai);
    var solo  = document.getElementById(opzioni.copia);
    var toast = document.getElementById(opzioni.toast);
    var dammiIlTesto = opzioni.testo;
    var etichetta = opzioni.evento || 'Prompt';

    function avvisa(t) {
      if (!toast) return;
      toast.textContent = t;
      toast.classList.add('show');
      setTimeout(function () { toast.classList.remove('show'); }, 2200);
    }

    if (vai) vai.addEventListener('click', function () {
      var t = dammiIlTesto();
      if (!t) return;
      apri(vai.getAttribute('data-assistente') || 'chatgpt');
      copia(t);
      avvisa('Prompt copiato: incollalo nella casella');
      if (window.track) track('click', etichetta + ':apri');
    });

    if (solo) solo.addEventListener('click', function () {
      var t = dammiIlTesto();
      if (!t) return;
      copia(t);
      avvisa('Prompt copiato');
      if (window.track) track('click', etichetta + ':copia');
    });

    return { avvisa: avvisa };
  }

  return { copia: copia, apri: apri, collega: collega };
})();
