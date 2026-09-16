/* I prompt stanno già nella pagina: qui si aggancia solo il pulsante.

   Si copia il prompt con le regole in coda. Le regole sono scritte una volta
   sola, in cima, perché valgono per tutti: undici copie identiche nel markup
   sarebbero undici posti da tenere allineati, e prima o poi uno resta indietro. */
(function () {
  var patto = document.getElementById('patto').textContent.trim();
  var toast = document.getElementById('toast');
  var timer = null;

  function avvisa(t) {
    toast.textContent = t;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  /* Le regole valgono solo per le verifiche (l'elenco con «data-patto»): i
     prompt per far lavorare chiedono di modificare, e «sola lettura» in coda
     li contraddirebbe. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.copia');
    if (!b) return;
    var voce = b.closest('.voce');
    var testo = voce.querySelector('.testo').textContent.trim();
    if (voce.closest('[data-patto]')) testo += '\n\n' + patto;
    PROMPT.copia(testo);
    avvisa('Copiato: incollalo all\'agente');
    b.textContent = 'Copiato ✓';
    setTimeout(function () { b.textContent = 'Copia il prompt'; }, 2200);
    if (window.track) track('click', 'Prompt:' + voce.id);
  });
})();
