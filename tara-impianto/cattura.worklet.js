/* Raccoglie i campioni senza perderne.

   Due ingressi, e stanno insieme apposta:
     ingresso 0  il segnale che MANDIAMO nelle casse
     ingresso 1  quello che il microfono SENTE

   Arrivano allo stesso nodo e quindi allo stesso istante del tempo audio: sono
   sincroni per costruzione, senza che nessuno debba sincronizzarli. È il
   vantaggio che ha questa pagina e che Smaart non ha — lì il riferimento
   arriva via cavo da un'altra scheda, qui lo generiamo noi.

   Perché un worklet e non l'analizzatore integrato: quello dà solo quanto è
   forte ogni frequenza e BUTTA VIA la fase, che è metà della misura. E
   leggerlo a colpi di animazione perde blocchi: un buco nei campioni manda in
   vacca correlazione e fase, e non se ne accorge nessuno. */

class Cattura extends AudioWorkletProcessor {

  constructor() {
    super();
    this.raccolgo = false;
    this.rif = null;
    this.mic = null;
    this.scritti = 0;
    this.port.onmessage = (e) => {
      if (e.data.comando === 'parti') {
        this.rif = new Float32Array(e.data.campioni);
        this.mic = new Float32Array(e.data.campioni);
        this.scritti = 0;
        this.raccolgo = true;
      } else if (e.data.comando === 'ferma') {
        this.consegna();
      }
    };
  }

  consegna() {
    if (!this.raccolgo) return;
    this.raccolgo = false;
    const rif = this.rif.subarray(0, this.scritti).slice();
    const mic = this.mic.subarray(0, this.scritti).slice();
    this.port.postMessage({ tipo: 'fatto', rif, mic, scritti: this.scritti },
                          [rif.buffer, mic.buffer]);
    this.rif = this.mic = null;
  }

  process(inputs) {
    if (!this.raccolgo) return true;

    const a = inputs[0] && inputs[0][0];
    const b = inputs[1] && inputs[1][0];
    /* Se uno dei due ingressi non sta ancora dando niente si aspetta: scrivere
       silenzio da una parte e segnale dall'altra falserebbe l'allineamento, ed
       è un errore che poi non si vede più. */
    if (!a || !b) return true;

    const quanti = Math.min(a.length, b.length, this.rif.length - this.scritti);
    for (let i = 0; i < quanti; i++) {
      this.rif[this.scritti + i] = a[i];
      this.mic[this.scritti + i] = b[i];
    }
    this.scritti += quanti;

    // riempito il tempo chiesto, si consegna da solo
    if (this.scritti >= this.rif.length) this.consegna();

    // quanti campioni ho preso, per la barra che avanza
    if ((this.scritti & 8191) < 128) {
      this.port.postMessage({ tipo: 'avanzamento', scritti: this.scritti });
    }
    return true;
  }
}

registerProcessor('cattura', Cattura);
