/* /prompt/ — la pagina nasce come elenco completo per categorie, leggibile
   senza script. Qui diventa interattiva: categorie · elenco · dettaglio (su
   telefono il dettaglio si apre sotto la voce scelta).

   Le schede non si copiano né si ricostruiscono: si SPOSTANO nel dettaglio e
   poi tornano nella loro sezione. Il testo resta uno, quello del markup.

   Tre regole sulla copia, nate dalle versioni precedenti:
   1) le regole comuni vanno in coda solo ai prompt che non agiscono
      (data-agisce assente), una volta, dopo «---»;
   2) «Copiato» si dice solo se la copia è riuscita davvero;
   3) se non riesce, il testo intero compare selezionato nella scheda. */
(function () {
  var SEPARATORE = '\n\n---\n\n';
  var ALIAS = { automatismi: 'salute' };   // ancore pubblicate prima del 16/09 e confluite altrove

  var catalogo = document.getElementById('catalogo');
  var nav = document.getElementById('catNav');
  var corpo = document.getElementById('catCorpo');
  var patto = document.getElementById('patto').textContent.trim();
  var toast = document.getElementById('toast');
  var sezioni = [].slice.call(corpo.querySelectorAll('.categoria'));
  var stretto = window.matchMedia('(max-width: 900px)');
  var timerToast = null;

  function avvisa(t) {
    clearTimeout(timerToast);
    toast.textContent = '';
    toast.classList.remove('show');
    setTimeout(function () {
      toast.textContent = t;
      toast.classList.add('show');
      timerToast = setTimeout(function () { toast.classList.remove('show'); }, 2600);
    }, 30);
  }

  /* ————— Copia ————— */
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
  function copia(t) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return conCasella(t); });
    }
    return Promise.resolve(conCasella(t));
  }
  function nomeDi(v) { return v.querySelector('.nome').textContent.trim(); }
  function testoDi(v) {
    var t = v.querySelector('.testo').textContent.trim();
    return v.hasAttribute('data-agisce') ? t : t + SEPARATORE + patto;
  }
  function copiaAMano(v, t) {
    var box = v.querySelector('.manuale');
    if (!box) {
      box = document.createElement('textarea');
      box.className = 'manuale';
      box.readOnly = true;
      box.rows = 8;
      box.setAttribute('aria-label', 'Testo da copiare a mano: ' + nomeDi(v));
      v.querySelector('.azioni').after(box);
    }
    box.value = t;
    box.focus();
    box.select();
  }
  function copiaPrompt(b) {
    var v = b.closest('.voce'), t = testoDi(v);
    if (!b.dataset.etichetta) b.dataset.etichetta = b.textContent;
    copia(t).then(function (ok) {
      if (ok) {
        var vecchio = v.querySelector('.manuale');
        if (vecchio) vecchio.remove();
        b.textContent = 'Copiato ✓';
        b.classList.add('fatto');
        setTimeout(function () { b.textContent = b.dataset.etichetta; b.classList.remove('fatto'); }, 2200);
        avvisa(v.hasAttribute('data-agisce')
          ? 'Copiato «' + nomeDi(v) + '»: incollalo all\'agente'
          : 'Copiato «' + nomeDi(v) + '» con le regole: incollalo all\'agente');
      } else {
        copiaAMano(v, t);
        avvisa('Copia non riuscita: il testo è selezionato nella scheda, copialo con ⌘C o Ctrl+C');
      }
      if (window.track) track('click', 'Prompt:' + v.id + (ok ? '' : ':fallita'));
    });
  }
  function copiaLink(a) {
    var v = a.closest('.voce');
    var url = location.origin + location.pathname + '#' + v.id;
    if (history.replaceState) history.replaceState(null, '', '#' + v.id);
    copia(url).then(function (ok) {
      avvisa(ok ? 'Link a «' + nomeDi(v) + '» copiato' : 'Copia non riuscita: il link è nella barra degli indirizzi');
    });
  }

  /* ————— La vista interattiva ————— */
  document.documentElement.classList.add('js');

  var colonna = document.createElement('div');       // elenco della categoria
  colonna.className = 'lista-col';
  colonna.innerHTML = '<p class="cat-intro" id="catIntro"></p><ul class="lista" id="lista"></ul>';
  var dettaglio = document.createElement('div');     // la scheda scelta
  dettaglio.className = 'dettaglio';
  dettaglio.id = 'dettaglio';
  corpo.before(colonna);
  colonna.after(dettaglio);

  var lista = colonna.querySelector('#lista');
  var intro = colonna.querySelector('#catIntro');
  var gCorrente = null, scelta = null;

  // Il menu delle categorie: pulsanti su computer, un menu a tendina su telefono.
  var tendina = document.createElement('select');
  tendina.className = 'cat-select';
  tendina.setAttribute('aria-label', 'Categoria');
  var ul = document.createElement('ul');
  ul.className = 'cat-lista';
  sezioni.forEach(function (s) {
    var g = s.dataset.g, n = s.querySelectorAll('.voce').length;
    var titolo = s.querySelector('.cat-titolo span').textContent;
    var li = document.createElement('li');
    if (g === 'decidere') li.className = 'stacco';
    li.innerHTML = '<button type="button" class="cat-btn" data-g="' + g + '">' +
      s.querySelector('.cat-titolo svg').outerHTML + '<span class="t">' + titolo + '</span><span class="n">' + n + '</span></button>';
    ul.appendChild(li);
    var o = document.createElement('option');
    o.value = g;
    o.textContent = titolo + ' (' + n + ')';
    tendina.appendChild(o);
  });
  nav.appendChild(tendina);
  nav.appendChild(ul);
  nav.hidden = false;

  // Ogni scheda ricorda la sua sezione e la sua posizione, per tornarci.
  // Si tengono i riferimenti: una scheda momentaneamente staccata dalla pagina
  // non si trova più con getElementById.
  var tutte = [], perId = {};
  sezioni.forEach(function (s) {
    [].forEach.call(s.querySelectorAll('.voce'), function (v, i) { v._sezione = s; v._ordine = i; tutte.push(v); perId[v.id] = v; });
  });

  function sezioneDi(g) { return document.getElementById('cat-' + g); }

  function sottotitolo(v) {
    var c = v.querySelector('.ciclo li .v') || v.querySelector('.passi li:nth-child(2)');
    return c ? c.textContent.trim() : '';
  }

  function apriCategoria(g, id) {
    gCorrente = g;
    tendina.value = g;
    [].forEach.call(ul.querySelectorAll('.cat-btn'), function (b) {
      var suo = b.dataset.g === g;
      b.setAttribute('aria-current', suo ? 'true' : 'false');
      // Nella fila che scorre la pastiglia scelta si porta in vista: altrimenti
      // si sceglie una categoria e la si perde di lato.
      if (suo && stretto.matches && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    var s = sezioneDi(g);
    intro.textContent = s.querySelector('.cat-sotto').textContent;
    // Tutte le schede della categoria, anche quella che ora sta nel dettaglio.
    var voci = tutte.filter(function (v) { return v._sezione === s; });
    // Su telefono il dettaglio sta DENTRO una voce dell'elenco: va messo in salvo
    // prima di riscrivere l'elenco, o sparisce insieme alla scheda che contiene.
    colonna.after(dettaglio);
    lista.innerHTML = voci.map(function (v) {
      return '<li><button type="button" class="voce-btn" data-id="' + v.id + '" aria-controls="dettaglio">' +
        '<b>' + nomeDi(v) + '</b><span>' + sottotitolo(v) + '</span></button></li>';
    }).join('');
    scegli(id && perId[id] ? id : voci[0].id);
  }

  function scegli(id) {
    var v = perId[id];
    // La scheda di prima torna nella sua sezione, al suo posto.
    if (scelta && scelta !== v) {
      var dopo = tutte.filter(function (x) { return x._sezione === scelta._sezione && x._ordine > scelta._ordine && x.parentNode === scelta._sezione.querySelector('.voci'); })[0];
      scelta._sezione.querySelector('.voci').insertBefore(scelta, dopo || null);
    }
    scelta = v;
    dettaglio.appendChild(v);
    dettaglio.insertBefore(barra, dettaglio.firstChild);
    [].forEach.call(lista.querySelectorAll('.voce-btn'), function (b) { b.setAttribute('aria-current', b.dataset.id === id ? 'true' : 'false'); });
    colloca();
  }

  /* Su telefono la scheda non si infila più dentro l'elenco: si apre a tutta
     pagina, con una barra «Indietro» che torna all'elenco. Prima la scheda
     spingeva le altre voci sotto un blocco lungo e l'elenco spariva. */
  function colloca() {
    if (dettaglio.parentNode !== catalogo) colonna.after(dettaglio);
    if (!stretto.matches) chiudiScheda(true);
  }

  var barra = document.createElement('div');
  barra.className = 'barra-indietro';
  barra.innerHTML = '<button type="button" class="indietro">Indietro<span class="vh"> all\'elenco</span></button><span class="dove"></span>';
  dettaglio.appendChild(barra);

  function apriScheda() {
    if (!stretto.matches || !scelta) return;
    barra.querySelector('.dove').textContent = scelta._sezione.querySelector('.cat-titolo span').textContent;
    document.documentElement.classList.add('scheda-aperta');
    window.scrollTo(0, 0);
  }
  function chiudiScheda(zitto) {
    document.documentElement.classList.remove('scheda-aperta');
    if (!zitto && gCorrente) history.replaceState(null, '', '#cat-' + gCorrente);
  }

  // Dove portare lo sguardo: il catalogo quando il dettaglio gli sta accanto,
  // il dettaglio stesso quando sta sotto (sotto i 1000 px).
  // Misurato: a 960 px si scorreva al catalogo e la scheda restava fuori schermo.
  var affiancato = window.matchMedia('(min-width: 1001px)');
  function mostraInVista(liscio) {
    (affiancato.matches ? catalogo : dettaglio).scrollIntoView({
      behavior: liscio && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto',
      block: 'start'
    });
  }

  function vaiA(hash, scorri) {
    var h = (hash || '').replace(/^#/, '');
    h = ALIAS[h] || h;
    if (perId[h]) {
      apriCategoria(perId[h]._sezione.dataset.g, h);
    } else if (h.indexOf('cat-') === 0 && sezioneDi(h.slice(4))) {
      apriCategoria(h.slice(4));
    } else {
      return false;
    }
    if (scorri) mostraInVista(true);
    return true;
  }

  /* ————— Eventi ————— */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var b = t.closest && t.closest('.copia');
    if (b) return copiaPrompt(b);
    var a = t.closest && t.closest('.ancora');
    if (a) { e.preventDefault(); return copiaLink(a); }
    var c = t.closest && t.closest('.cat-btn');
    if (c) { cambiaCategoria(c.dataset.g); return; }
    var ind = t.closest && t.closest('.indietro');
    if (ind) { chiudiScheda(); return; }
    var vb = t.closest && t.closest('.voce-btn');
    if (vb) {
      scegli(vb.dataset.id);
      if (stretto.matches) {
        // Una tappa nella cronologia: il gesto «indietro» del telefono
        // riporta all'elenco invece di uscire dalla pagina.
        history.pushState(null, '', '#' + vb.dataset.id);
        apriScheda();
      } else {
        history.replaceState(null, '', '#' + vb.dataset.id);
      }
      if (window.track) track('click', 'Prompt:apri:' + vb.dataset.id);
    }
  });

  function cambiaCategoria(g) {
    apriCategoria(g);
    // Su telefono si resta sull'elenco: la scheda si apre solo se la tocchi.
    history.replaceState(null, '', stretto.matches ? '#cat-' + g : '#' + scelta.id);
    if (stretto.matches) chiudiScheda(true);
  }

  tendina.addEventListener('change', function () { cambiaCategoria(tendina.value); });
  window.addEventListener('hashchange', function () {
    var h = location.hash.replace(/^#/, '');
    h = ALIAS[h] || h;
    if (perId[h]) { vaiA(location.hash, !stretto.matches); apriScheda(); }
    else { vaiA(location.hash, false); chiudiScheda(true); }
  });
  if (stretto.addEventListener) stretto.addEventListener('change', colloca);

  // Arrivo: con un'ancora si apre quella scheda, altrimenti la prima routine.
  // Lo scorrimento aspetta il salto automatico del browser all'ancora, che
  // altrimenti arriverebbe dopo e porterebbe altrove.
  if (vaiA(location.hash, false)) {
    var eraScheda = !!perId[(ALIAS[location.hash.replace(/^#/, '')] || location.hash.replace(/^#/, ''))];
    if (eraScheda) apriScheda();
    window.addEventListener('load', function () {
      requestAnimationFrame(function () {
        if (stretto.matches && eraScheda) window.scrollTo(0, 0);
        else mostraInVista(false);
      });
    });
  } else {
    apriCategoria(sezioni[0].dataset.g);
    if (stretto.matches) history.replaceState(null, '', '#cat-' + sezioni[0].dataset.g);
  }
})();
