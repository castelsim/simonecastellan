// Testi d'esempio, solo di pubblico dominio: servono al primo avvio (per
// provare subito) e alle prove automatiche.

export const ESEMPI = [
  {
    id: 'esempio-va-pensiero',
    titolo: 'Va, pensiero',
    artista: 'Giuseppe Verdi · testo di Temistocle Solera (1842)',
    note: 'Esempio: si può cancellare.',
    testo: `Va, pensiero, sull'ali dorate;
va, ti posa sui **clivi**, sui colli,
ove olezzano tepide e molli
{azzurro}l'aure dolci del suolo natal!{/}

Del Giordano le rive saluta,
di Sionne le torri atterrate…
# regia: qui entra il coro
{azzurro}Oh mia patria sì bella e perduta!{/}
{azzurro}Oh membranza sì cara e fatal!{/}

Arpa d'or dei fatidici vati,
perché muta dal salice pendi?
Le memorie nel petto raccendi,
ci favella del tempo che fu!

O simile di Solima ai fati
traggi un suono di crudo lamento,
o t'ispiri il Signore un concento
che ne infonda al patire **virtù**!`,
  },
  {
    id: 'esempio-canto-italiani',
    titolo: "Il Canto degli Italiani",
    artista: 'Michele Novaro · testo di Goffredo Mameli (1847)',
    note: 'Esempio: si può cancellare.',
    testo: `Fratelli d'Italia,
l'Italia s'è desta,
dell'elmo di Scipio
s'è cinta la testa.
Dov'è la Vittoria?
Le porga la chioma,
ché schiava di Roma
Iddio la creò.

{giallo}Stringiamci a coorte,{/}
{giallo}siam pronti alla morte.{/}
{giallo}Siam pronti alla morte,{/}
{giallo}l'Italia chiamò.{/}`,
  },
];

// Il caso peggiore per la misura: una strofa di 20 righe e una riga lunghissima.
export function branoLungo() {
  const righe = Array.from({ length: 20 }, (_, i) => `Riga numero ${i + 1} di una strofa molto lunga`);
  righe[3] = 'Questa è una riga lunghissima, scritta apposta per vedere cosa succede quando una sola riga '
    + 'non sta nello schermo nemmeno con il carattere più piccolo ammesso, e deve andare a capo senza uscire dai bordi';
  return { id: 'prova-lunga', titolo: 'Prova lunga', artista: '', note: '', testo: righe.join('\n') + '\n\nUltima strofa' };
}
