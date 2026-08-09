/* I formati dei social, in un posto solo.

   Dietro alle sedici voci che si vedono ci sono cinque rapporti veri: qui si
   dichiara ogni voce con la sua misura, e chi genera le immagini raggruppa da
   sé le voci che chiedono esattamente la stessa cosa — così una foto quadrata
   1080×1080 si calcola una volta e vale per Instagram, Facebook e X.

   Misure verificate ad agosto 2026 (Hootsuite, Buffer, guide LinkedIn e X).
   Per aggiornarle si tocca solo questo file. */

var PIATTAFORME = [
  {
    id: 'instagram',
    nome: 'Instagram',
    formati: [
      { id: 'post-4x5',   etichetta: 'Post verticale',  nota: 'il più consigliato', w: 1080, h: 1350 },
      { id: 'post-1x1',   etichetta: 'Post quadrato',   w: 1080, h: 1080 },
      { id: 'story-9x16', etichetta: 'Story e Reel',    w: 1080, h: 1920 }
    ]
  },
  {
    id: 'tiktok',
    nome: 'TikTok',
    formati: [
      { id: 'post-9x16', etichetta: 'Video e foto', w: 1080, h: 1920 }
    ]
  },
  {
    id: 'facebook',
    nome: 'Facebook',
    formati: [
      { id: 'post-1x1',    etichetta: 'Post quadrato',  w: 1080, h: 1080 },
      { id: 'post-4x5',    etichetta: 'Post verticale', w: 1080, h: 1350 },
      { id: 'story-9x16',  etichetta: 'Story',          w: 1080, h: 1920 },
      { id: 'link-191x1',  etichetta: 'Anteprima link', nota: 'quando condividi un indirizzo', w: 1200, h: 630 }
    ]
  },
  {
    id: 'linkedin',
    nome: 'LinkedIn',
    formati: [
      { id: 'post-1x1',   etichetta: 'Post quadrato',  w: 1200, h: 1200 },
      { id: 'post-4x5',   etichetta: 'Post verticale', w: 1080, h: 1350 },
      { id: 'link-191x1', etichetta: 'Anteprima link', w: 1200, h: 627 }
    ]
  },
  {
    id: 'x',
    nome: 'X',
    formati: [
      { id: 'post-16x9', etichetta: 'Post orizzontale', nota: 'non viene ritagliato nel flusso', w: 1600, h: 900 },
      { id: 'post-1x1',  etichetta: 'Post quadrato',    w: 1080, h: 1080 }
    ]
  },
  {
    id: 'youtube',
    nome: 'YouTube',
    formati: [
      { id: 'copertina-16x9', etichetta: 'Copertina del video', w: 1280, h: 720 }
    ]
  }
];

// Con quale si parte: una sola piattaforma, tre anteprime. Aprire con venti
// risultati addosso è il modo più veloce per far chiudere la pagina.
var PIATTAFORME_INIZIALI = ['instagram'];
