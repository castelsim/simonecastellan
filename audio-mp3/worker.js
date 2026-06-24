// Web Worker: codifica MP3 con lamejs senza bloccare l'interfaccia.
// Riceve i campioni PCM Int16 (gia' a 48 kHz, stereo) e restituisce l'MP3.
/* global lamejs */
importScripts('lame.min.js');

self.onmessage = function (e) {
  var left = e.data.left;          // Int16Array canale sinistro
  var right = e.data.right;        // Int16Array canale destro
  var sampleRate = e.data.sampleRate; // 48000

  try {
    var encoder = new lamejs.Mp3Encoder(2, sampleRate, 128); // 2ch, 48kHz, 128kbps CBR
    var blockSize = 1152;          // dimensione frame MP3
    var chunksPerYield = 200;      // ogni quanti frame aggiornare il progresso
    var data = [];
    var total = left.length;
    var i = 0;
    var frame = 0;

    while (i < total) {
      var end = Math.min(i + blockSize, total);
      var l = left.subarray(i, end);
      var r = right.subarray(i, end);
      var buf = encoder.encodeBuffer(l, r);
      if (buf.length > 0) data.push(buf);
      i = end;
      frame++;
      if (frame % chunksPerYield === 0) {
        self.postMessage({ type: 'progress', value: i / total });
      }
    }

    var last = encoder.flush();
    if (last.length > 0) data.push(last);

    var blob = new Blob(data, { type: 'audio/mpeg' });
    self.postMessage({ type: 'done', blob: blob });
  } catch (err) {
    self.postMessage({ type: 'error', message: (err && err.message) || String(err) });
  }
};
