/* Comuni che si riconoscono senza rete, per il tramonto.
   Coordinate del centro del comune (gradi decimali, arrotondate a 0,01°: un
   centesimo di grado di longitudine sposta il tramonto di meno di 3 secondi).
   Veneto prima di tutto, poi i dintorni dove capita di lavorare. Se il comune
   non c'è, il modulo offre la ricerca del luogo, ma solo dopo un tocco. */
(function (radice) {
  var L = [
    ["Abano Terme", 45.36, 11.79], ["Arzignano", 45.52, 11.33], ["Asiago", 45.88, 11.51],
    ["Asolo", 45.80, 11.91], ["Bardolino", 45.55, 10.72], ["Bassano del Grappa", 45.77, 11.73],
    ["Belluno", 46.14, 12.22], ["Breganze", 45.71, 11.56], ["Caorle", 45.60, 12.88],
    ["Cassola", 45.74, 11.80], ["Castelfranco Veneto", 45.67, 11.93], ["Chioggia", 45.22, 12.28],
    ["Cittadella", 45.65, 11.78], ["Conegliano", 45.89, 12.30], ["Cortina d'Ampezzo", 46.54, 12.14],
    ["Este", 45.23, 11.66], ["Feltre", 46.02, 11.91], ["Garda", 45.58, 10.71],
    ["Jesolo", 45.53, 12.64], ["Lonigo", 45.39, 11.39], ["Lusiana Conco", 45.79, 11.58],
    ["Marostica", 45.75, 11.66], ["Mestre", 45.49, 12.24], ["Mogliano Veneto", 45.56, 12.24],
    ["Monselice", 45.24, 11.75], ["Montebelluna", 45.78, 12.04], ["Mussolente", 45.78, 11.80],
    ["Oderzo", 45.78, 12.49], ["Padova", 45.41, 11.88], ["Peschiera del Garda", 45.44, 10.69],
    ["Piazzola sul Brenta", 45.54, 11.79], ["Portogruaro", 45.78, 12.84], ["Romano d'Ezzelino", 45.79, 11.77],
    ["Rosà", 45.72, 11.76], ["Rovigo", 45.07, 11.79], ["San Donà di Piave", 45.63, 12.57],
    ["Schio", 45.71, 11.36], ["Soave", 45.42, 11.25], ["Thiene", 45.71, 11.48],
    ["Treviso", 45.67, 12.24], ["Valdagno", 45.65, 11.30], ["Valdobbiadene", 45.90, 12.00],
    ["Valeggio sul Mincio", 45.35, 10.74], ["Venezia", 45.44, 12.32], ["Verona", 45.44, 10.99],
    ["Vicenza", 45.55, 11.54], ["Vittorio Veneto", 45.99, 12.30],
    // dintorni
    ["Bologna", 44.49, 11.34], ["Brescia", 45.54, 10.21], ["Ferrara", 44.84, 11.62],
    ["Mantova", 45.16, 10.79], ["Milano", 45.46, 9.19], ["Pordenone", 45.96, 12.66],
    ["Trento", 46.07, 11.12], ["Udine", 46.06, 13.24]
  ];
  function semplice(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  // Il comune scritto dagli sposi → [nome, lat, lon] oppure null.
  function trova(testo) {
    var t = semplice(testo);
    if (!t) return null;
    for (var i = 0; i < L.length; i++) if (semplice(L[i][0]) === t) return L[i];
    // «Bassano», «Romano», «Castelfranco»: basta l'inizio, se è uno solo.
    var inizio = L.filter(function (l) { return semplice(l[0]).indexOf(t) === 0; });
    return inizio.length === 1 ? inizio[0] : null;
  }
  var Luoghi = { elenco: L, trova: trova };
  if (typeof module !== "undefined" && module.exports) module.exports = Luoghi;
  else radice.Luoghi = Luoghi;
})(this);
