// Una tabella sola, per regia e TV: tasto → comando.
// PagGiù/PagSu sono i tasti che mandano i pedali «volta-pagina» Bluetooth.
// Con ⌘, Ctrl o Alt il tasto resta al sistema (⌘R, ⌘Q, Ctrl+frecce…).

const TABELLA = {
  ArrowRight: 'riga+', ' ': 'riga+', PageDown: 'riga+',
  ArrowLeft: 'riga-', PageUp: 'riga-',
  ArrowDown: 'strofa+', ArrowUp: 'strofa-',
  n: 'brano+', N: 'brano+',
  p: 'brano-', P: 'brano-',
  b: 'nero', B: 'nero', '.': 'nero',
  '/': 'cerca',
  Enter: 'correggi',
};

export function comandoDaTasto({ key, metaKey, ctrlKey, altKey }) {
  if (metaKey || ctrlKey || altKey) return null;
  const tipo = TABELLA[key];
  return tipo ? { tipo } : null;
}
