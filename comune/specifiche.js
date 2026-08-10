/* Le specifiche dei social, in un posto solo.

   Qui dentro c'è tutto quello che le piattaforme chiedono: misure consigliate,
   proporzioni accettate, peso massimo, durata, zone coperte dall'interfaccia.
   Gli strumenti del sito leggono da qui e non hanno numeri propri: quando una
   piattaforma cambia le regole si corregge questo file e cambiano tutti.

   Ogni numero ha accanto da dove viene e quando è stato controllato. Le voci
   marcate «incerto: true» non sono state confermate da una fonte solida: gli
   strumenti le usano per consigliare, mai per bocciare un file.

   Controllato il 10 agosto 2026 su: guida Hootsuite alle misure social,
   Buffer (Instagram), specifiche LinkedIn e X 2026, guide YouTube thumbnail,
   raccolte di limiti di caricamento (filesize.org, blondish, sproutsocial). */

var SOCIAL_AGGIORNATO = '10 agosto 2026';

var MB = 1024 * 1024;

/* rapporto = larghezza / altezza.  1.0 = quadrato, 0.5625 = 9:16 in piedi,
   1.777 = 16:9 sdraiato, 0.8 = 4:5.  Sotto «min» e «max» stanno gli estremi
   che la piattaforma accetta senza tagliare: fuori da lì taglia lei, e decide
   lei cosa buttare via. */
var SOCIAL = [
  {
    id: 'instagram',
    nome: 'Instagram',
    usi: [
      {
        id: 'post', nome: 'Post', media: 'immagine',
        ideale: { w: 1080, h: 1350 }, rapporto: 0.8,
        rapportoMin: 0.8, rapportoMax: 1.91,     // dal verticale 4:5 all'orizzontale 1.91:1
        latoMin: 320, pesoMax: 8 * MB
      },
      {
        id: 'story', nome: 'Story', media: 'entrambi',
        ideale: { w: 1080, h: 1920 }, rapporto: 0.5625,
        rapportoMin: 0.5625, rapportoMax: 0.5625, tolleranza: 0.12,
        latoMin: 320, pesoMax: 8 * MB,
        // Le zone dove l'interfaccia copre: sopra il nome di chi pubblica,
        // sotto la barra per rispondere.
        coperto: { alto: 0.13, basso: 0.18, sinistra: 0, destra: 0 }
      },
      {
        id: 'reel', nome: 'Reel', media: 'video',
        ideale: { w: 1080, h: 1920 }, rapporto: 0.5625,
        rapportoMin: 0.5625, rapportoMax: 0.5625, tolleranza: 0.12,
        durataMax: 20 * 60, incerto: true,
        coperto: { alto: 0.13, basso: 0.25, sinistra: 0, destra: 0.18 }
      }
    ]
  },
  {
    id: 'tiktok',
    nome: 'TikTok',
    usi: [
      {
        id: 'video', nome: 'Video', media: 'entrambi',
        ideale: { w: 1080, h: 1920 }, rapporto: 0.5625,
        rapportoMin: 0.5625, rapportoMax: 0.5625, tolleranza: 0.12,
        durataMax: 60 * 60, incerto: true,
        coperto: { alto: 0.10, basso: 0.22, sinistra: 0, destra: 0.20 }
      }
    ]
  },
  {
    id: 'facebook',
    nome: 'Facebook',
    usi: [
      {
        id: 'post', nome: 'Post', media: 'immagine',
        ideale: { w: 1080, h: 1350 }, rapporto: 0.8,
        rapportoMin: 0.8, rapportoMax: 1.91,
        latoMin: 320, pesoMax: 30 * MB
      },
      {
        id: 'video', nome: 'Video nel diario', media: 'video',
        ideale: { w: 1080, h: 1350 }, rapporto: 0.8,
        rapportoMin: 0.5625, rapportoMax: 1.777,   // accetta dal verticale all'orizzontale
        durataMax: 240 * 60, incerto: true
      },
      {
        id: 'story', nome: 'Story', media: 'entrambi',
        ideale: { w: 1080, h: 1920 }, rapporto: 0.5625,
        rapportoMin: 0.5625, rapportoMax: 0.5625, tolleranza: 0.12,
        pesoMax: 30 * MB,
        coperto: { alto: 0.13, basso: 0.18, sinistra: 0, destra: 0 }
      }
    ]
  },
  {
    id: 'linkedin',
    nome: 'LinkedIn',
    usi: [
      {
        id: 'post', nome: 'Post', media: 'immagine',
        ideale: { w: 1200, h: 1200 }, rapporto: 1,
        rapportoMin: 0.8, rapportoMax: 3,        // accetta da 4:5 fino a 3:1
        latoMin: 552, pesoMax: 5 * MB            // cinque mega: il più severo di tutti
      },
      {
        id: 'video', nome: 'Video', media: 'video',
        ideale: { w: 1080, h: 1350 }, rapporto: 0.8,
        rapportoMin: 0.5625, rapportoMax: 2.4,
        durataMax: 30 * 60, incerto: true
      }
    ]
  },
  {
    id: 'x',
    nome: 'X',
    usi: [
      {
        id: 'post', nome: 'Post', media: 'immagine',
        ideale: { w: 1600, h: 900 }, rapporto: 1.777,
        rapportoMin: 0.8, rapportoMax: 1.777,
        pesoMax: 5 * MB
      },
      {
        id: 'video', nome: 'Video', media: 'video',
        ideale: { w: 1280, h: 720 }, rapporto: 1.777,
        rapportoMin: 0.5625, rapportoMax: 1.777,
        durataMax: 140, incerto: true            // il limite classico dei 2 minuti e 20
      }
    ]
  },
  {
    id: 'youtube',
    nome: 'YouTube',
    usi: [
      {
        id: 'copertina', nome: 'Copertina del video', media: 'immagine',
        ideale: { w: 1280, h: 720 }, rapporto: 1.777,
        rapportoMin: 1.777, rapportoMax: 1.777, tolleranza: 0.05,
        latoMin: 640, pesoMax: 2 * MB,           // due mega, e li rifiuta davvero
        coperto: { alto: 0, basso: 0, sinistra: 0, destra: 0, angoloDurata: true }
      },
      {
        id: 'video', nome: 'Video', media: 'video',
        ideale: { w: 1920, h: 1080 }, rapporto: 1.777,
        rapportoMin: 0.5625, rapportoMax: 1.777,
        durataMax: 15 * 60, incerto: true        // 15 minuti finché l'account non è verificato
      },
      {
        id: 'short', nome: 'Short', media: 'video',
        ideale: { w: 1080, h: 1920 }, rapporto: 0.5625,
        rapportoMin: 0.5625, rapportoMax: 1, tolleranza: 0.05,
        durataMax: 3 * 60, incerto: true
      }
    ]
  }
];

/* Le misure consigliate per l'esportazione, cioè quelle che usa lo strumento
   che prepara le immagini. Stanno qui accanto alle regole di controllo perché
   sono la stessa materia: se cambia una, cambia l'altra.

   Il campo «uso» rimanda alla voce corrispondente qui sopra: serve a ritrovare
   le zone coperte dall'interfaccia senza riscriverle una seconda volta. */
var SOCIAL_FORMATI = [
  {
    id: 'instagram', nome: 'Instagram',
    formati: [
      { id: 'post-4x5',   etichetta: 'Post verticale',  nota: 'il più consigliato', w: 1080, h: 1350 },
      { id: 'post-1x1',   etichetta: 'Post quadrato',   w: 1080, h: 1080 },
      { id: 'story-9x16', etichetta: 'Story e Reel',    w: 1080, h: 1920, uso: 'story' }
    ]
  },
  {
    id: 'tiktok', nome: 'TikTok',
    formati: [ { id: 'post-9x16', etichetta: 'Video e foto', w: 1080, h: 1920, uso: 'video' } ]
  },
  {
    id: 'facebook', nome: 'Facebook',
    formati: [
      { id: 'post-1x1',   etichetta: 'Post quadrato',  w: 1080, h: 1080 },
      { id: 'post-4x5',   etichetta: 'Post verticale', w: 1080, h: 1350 },
      { id: 'story-9x16', etichetta: 'Story',          w: 1080, h: 1920, uso: 'story' },
      { id: 'link-191x1', etichetta: 'Anteprima link', nota: 'quando condividi un indirizzo', w: 1200, h: 630 }
    ]
  },
  {
    id: 'linkedin', nome: 'LinkedIn',
    formati: [
      { id: 'post-1x1',   etichetta: 'Post quadrato',  w: 1200, h: 1200 },
      { id: 'post-4x5',   etichetta: 'Post verticale', w: 1080, h: 1350 },
      { id: 'link-191x1', etichetta: 'Anteprima link', w: 1200, h: 627 }
    ]
  },
  {
    id: 'x', nome: 'X',
    formati: [
      { id: 'post-16x9', etichetta: 'Post orizzontale', nota: 'non viene ritagliato nel flusso', w: 1600, h: 900 },
      { id: 'post-1x1',  etichetta: 'Post quadrato',    w: 1080, h: 1080 }
    ]
  },
  {
    id: 'youtube', nome: 'YouTube',
    formati: [ { id: 'copertina-16x9', etichetta: 'Copertina del video', w: 1280, h: 720, uso: 'copertina' } ]
  }
];

// Con quale si parte, dove serve una scelta iniziale.
var PIATTAFORME_INIZIALI = ['instagram'];

/* Dove l'interfaccia della piattaforma copre l'immagine: nome utente e barra
   dei comandi in alto, campo per rispondere in basso, colonna dei pulsanti a
   destra. Le percentuali sono del lato corrispondente. Restituisce null se
   per quel formato non c'è niente da coprire. */
function zonaCoperta(piattaformaId, usoId) {
  if (!usoId) return null;
  for (var i = 0; i < SOCIAL.length; i++) {
    if (SOCIAL[i].id !== piattaformaId) continue;
    for (var j = 0; j < SOCIAL[i].usi.length; j++) {
      if (SOCIAL[i].usi[j].id === usoId) return SOCIAL[i].usi[j].coperto || null;
    }
  }
  return null;
}
