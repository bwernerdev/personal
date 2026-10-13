// Normaliza texto para comparação: minúsculas, sem acentos, só letras/números/espaços.
export function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(texto) {
  const n = normalizar(texto);
  return n ? n.split(' ') : [];
}
