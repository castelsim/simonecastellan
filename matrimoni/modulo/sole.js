/* Il sole del giorno del matrimonio — tramonto, luce per le foto, buio.

   ALGORITMO
   È quello del «NOAA Solar Calculator» (Global Monitoring Laboratory, NOAA),
   lo stesso dei loro fogli di calcolo: posizione media del sole, equazione del
   centro, obliquità corretta → declinazione ed equazione del tempo; da lì
   l'angolo orario per l'altezza voluta. Si ripete il conto due volte, la
   seconda all'istante trovata dalla prima: l'errore resta sotto il minuto alle
   nostre latitudini, più che abbastanza per decidere quando uscire a fare foto.
   Riferimenti: https://gml.noaa.gov/grad/solcalc/calcdetails.html
                (Meeus, «Astronomical Algorithms», 1991)

   LE ALTEZZE DEL SOLE CHE CONTANO
   · tramonto: −0,833° (il bordo superiore del disco tocca l'orizzonte, con la
     rifrazione dell'aria; è la definizione di tutti gli almanacchi)
   · luce per le foto («golden hour»): da +6° a −4°, la convenzione più diffusa
     fra i fotografi — luce bassa, calda, senza ombre dure
   · buio: −6°, fine del crepuscolo civile: da lì un video proiettato si vede
   Il terreno (colline, montagne a ovest) non è considerato: in collina il sole
   può sparire prima. Lo si dice sotto il numero, non lo si nasconde.

   ORARIO
   I conti sono in UTC; la resa in ora italiana usa il fuso «Europe/Rome», quindi
   l'ora legale è giusta anche se il telefono è impostato su un altro fuso.

   Funziona sia nel browser (window.Sole) sia in Node (require) per le prove. */
(function (radice) {
  "use strict";
  var RAD = Math.PI / 180;

  // Giorno giuliano alle 0:00 UTC del giorno civile y-m-d.
  function giornoGiuliano(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  // Declinazione (gradi) ed equazione del tempo (minuti) al giorno giuliano jd.
  function posizione(jd) {
    var T = (jd - 2451545) / 36525;
    var L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
    var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    var C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
            Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
            Math.sin(3 * M * RAD) * 0.000289;
    var omega = 125.04 - 1934.136 * T;
    var lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
    var eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    var eps = eps0 + 0.00256 * Math.cos(omega * RAD);
    var decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) / RAD;
    var y = Math.pow(Math.tan(eps * RAD / 2), 2);
    var eqt = 4 / RAD * (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) +
              4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
              0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
    return { decl: decl, eqt: eqt };
  }

  // Istante (ms UTC) in cui il sole passa per l'altezza `alt` (gradi), di
  // mattina (sale=true) o di sera. null se quel giorno non ci arriva.
  function istante(y, m, d, lat, lon, alt, sale) {
    var jd0 = giornoGiuliano(y, m, d);
    var t = 720 - 4 * lon; // minuti UTC, prima stima: il mezzogiorno solare
    for (var i = 0; i < 3; i++) {
      var p = posizione(jd0 + t / 1440);
      var mezzogiorno = 720 - 4 * lon - p.eqt;
      var cosH = (Math.sin(alt * RAD) - Math.sin(lat * RAD) * Math.sin(p.decl * RAD)) /
                 (Math.cos(lat * RAD) * Math.cos(p.decl * RAD));
      if (cosH > 1 || cosH < -1) return null;
      var H = Math.acos(cosH) / RAD;
      t = mezzogiorno + (sale ? -4 * H : 4 * H);
    }
    return Date.UTC(y, m - 1, d) + Math.round(t * 60000);
  }

  // data: "AAAA-MM-GG"; lat/lon in gradi decimali (est positivo).
  function giorno(data, lat, lon) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data || "");
    if (!m || !isFinite(lat) || !isFinite(lon)) return null;
    var Y = +m[1], M = +m[2], D = +m[3];
    return {
      tramonto: istante(Y, M, D, lat, lon, -0.833, false),
      luceDa:   istante(Y, M, D, lat, lon, 6, false),
      luceA:    istante(Y, M, D, lat, lon, -4, false),
      buio:     istante(Y, M, D, lat, lon, -6, false)
    };
  }

  var fmt = null;
  // «18:51» in ora italiana, arrotondato al minuto più vicino.
  function ora(ms) {
    if (ms == null) return "";
    var arrotondato = Math.round(ms / 60000) * 60000;
    try {
      if (!fmt) fmt = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hour12: false });
      return fmt.format(new Date(arrotondato));
    } catch (e) {
      var dt = new Date(arrotondato);
      return ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2);
    }
  }

  var Sole = { giorno: giorno, ora: ora, _istante: istante };
  if (typeof module !== "undefined" && module.exports) module.exports = Sole;
  else radice.Sole = Sole;
})(this);
