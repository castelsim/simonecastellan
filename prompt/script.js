/* I prompt stanno già nella pagina: qui si agganciano la copia del prompt e
   la copia del link a una scheda.

   Due regole.

   1) Le regole comuni si accodano solo alle verifiche (l'elenco con
      «data-patto»), una volta sola e separate da una riga: i prompt per far
      lavorare chiedono di modificare, e «non modificare» in coda li
      contraddirebbe. Si leggono dal <pre id="patto"> anche a pannello chiuso.

   2) «Copiato» si dice solo se la copia è riuscita. Prima si usava
      PROMPT.copia di /comune/prompt.js, che non restituisce l'esito: senza
      permesso agli appunti il pulsante diceva «Copiato» e negli appunti non
      c'era niente. Se fallisce, il testo compare selezionato dentro la
      scheda, pronto per ⌘C. */
(function () {
  var SEPARATORE = '\n\n---\n\n';
  var patto = document.getElementById('patto').textContent.trim();
  var toast = document.getElementById('toast');
  var timer = null;

  function avvisa(t) {
    clearTimeout(timer);
    // Svuotare prima: lo stesso messaggio due volte di fila non verrebbe riletto.
    toast.textContent = '';
    toast.classList.remove('show');
    setTimeout(function () {
      toast.textContent = t;
      toast.classList.add('show');
      timer = setTimeout(function () { toast.classList.remove('show'); }, 2600);
    }, 30);
  }

  function conCasella(t) {
    var a = document.createElement('textarea');
    a.value = t;
    a.setAttribute('readonly', '');
    a.style.position = 'fixed';
    a.style.top = '0';
    a.style.opacity = '0';
    document.body.appendChild(a);
    a.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(a);
    return ok;
  }

  // Restituisce sempre una promessa con l'esito vero: true solo se è andata.
  function copia(t) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(t).then(
        function () { return true; },
        function () { return conCasella(t); }
      );
    }
    return Promise.resolve(conCasella(t));
  }

  function testoDi(voce) {
    var t = voce.querySelector('.testo').textContent.trim();
    return voce.closest('[data-patto]') ? t + SEPARATORE + patto : t;
  }

  function nomeDi(voce) {
    return voce.querySelector('.nome').textContent.trim();
  }

  // Il ripiego: il testo intero, selezionato, nella scheda stessa.
  function copiaAMano(voce, t) {
    var box = voce.querySelector('.manuale');
    if (!box) {
      box = document.createElement('textarea');
      box.className = 'manuale';
      box.readOnly = true;
      box.rows = 8;
      box.setAttribute('aria-label', 'Testo da copiare a mano: ' + nomeDi(voce));
      voce.querySelector('.azioni').before(box);
    }
    box.value = t;
    box.focus();
    box.select();
  }

  function copiaPrompt(b) {
    var voce = b.closest('.voce');
    var t = testoDi(voce);
    if (!b.dataset.etichetta) b.dataset.etichetta = b.textContent;
    copia(t).then(function (ok) {
      if (ok) {
        var vecchio = voce.querySelector('.manuale');
        if (vecchio) vecchio.remove();
        b.textContent = 'Copiato ✓';
        b.classList.add('fatto');
        setTimeout(function () {
          b.textContent = b.dataset.etichetta;
          b.classList.remove('fatto');
        }, 2200);
        avvisa(voce.closest('[data-patto]')
          ? 'Copiato «' + nomeDi(voce) + '» con le regole: incollalo all\'agente'
          : 'Copiato «' + nomeDi(voce) + '»: incollalo all\'agente');
      } else {
        copiaAMano(voce, t);
        avvisa('Copia non riuscita: il testo è selezionato nella scheda, copialo con ⌘C o Ctrl+C');
      }
      if (window.track) track('click', 'Prompt:' + voce.id + (ok ? '' : ':fallita'));
    });
  }

  function copiaLink(a) {
    var voce = a.closest('.voce');
    var url = location.origin + location.pathname + '#' + voce.id;
    if (history.replaceState) history.replaceState(null, '', '#' + voce.id);
    copia(url).then(function (ok) {
      avvisa(ok ? 'Link a «' + nomeDi(voce) + '» copiato'
                : 'Copia non riuscita: il link è nella barra degli indirizzi');
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.copia');
    if (b) return copiaPrompt(b);
    var a = e.target.closest && e.target.closest('.ancora');
    if (a) { e.preventDefault(); copiaLink(a); }
  });
})();
