// Linguagem do dia a dia: tira da frase o que as regras do parser.js precisam, sem mudar o sentido.
// Tudo aqui é função pura sobre texto (sem rede, sem Claude). O objetivo é as regras entenderem
// "hoje fiz supino inclinado com vinte e quatro quilos, cinco séries de dez" sozinhas.

import { normalizar } from './normalizar.js';

// ---------- números por extenso ----------

export const UNIDADES = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19,
};
export const DEZENAS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };

const espaco = (s) => /^\s+$/.test(s ?? '');

// "vinte e quatro" -> 24, "cinco" -> 5, "vinte e dois e meio" -> 22.5, "perna dois" -> "perna 2".
// "um"/"uma" só viram número em "perna um" e "uma série"; no resto são artigo ("um supino").
export function numerosPorExtenso(texto) {
  const pecas = String(texto).match(/\p{L}+|\d+(?:[.,]\d+)?|[^\p{L}\d]+/gu) || [];
  const saida = [];
  const palavraAntes = () => {
    for (let k = saida.length - 1; k >= 0; k--) if (!espaco(saida[k])) return normalizar(saida[k]);
    return '';
  };
  const proximaPalavra = (i) => (espaco(pecas[i + 1]) ? normalizar(pecas[i + 2] ?? '') : '');

  for (let i = 0; i < pecas.length; i++) {
    const n = normalizar(pecas[i]);
    let valor = null;
    let pula = 0; // peças além da atual que foram consumidas

    if (n === 'um' || n === 'uma') {
      if (palavraAntes() === 'perna' || /^series?$/.test(proximaPalavra(i))) valor = 1;
    } else if (n in DEZENAS) {
      valor = DEZENAS[n];
      const unidade = normalizar(pecas[i + 4] ?? '');
      if (espaco(pecas[i + 1]) && normalizar(pecas[i + 2] ?? '') === 'e' && espaco(pecas[i + 3]) && UNIDADES[unidade] < 10 && unidade !== 'um' && unidade !== 'uma') {
        valor += UNIDADES[unidade];
        pula = 4;
      } else if (unidade === 'um' || unidade === 'uma') {
        valor += 1;
        pula = 4;
      }
    } else if (n === 'cem' || n === 'cento') valor = 100;
    else if (n in UNIDADES) valor = UNIDADES[n];

    if (valor === null) {
      saida.push(pecas[i]);
      continue;
    }
    // "... e meio" / "... e meia": +0,5
    const j = i + pula;
    if (espaco(pecas[j + 1]) && normalizar(pecas[j + 2] ?? '') === 'e' && espaco(pecas[j + 3]) && ['meio', 'meia'].includes(normalizar(pecas[j + 4] ?? ''))) {
      valor += 0.5;
      pula += 4;
    }
    saida.push(String(valor));
    i += pula;
  }
  return saida.join('');
}

// ---------- séries e repetições ditas de outros jeitos ----------

const NAO_DIGITO = '(?<![\\d.,])'; // não começa no meio de outro número (22,5)
const NUM = '(\\d+)(?!\\d|[.,]\\d)'; // o número inteiro: não corta "22,5" em 22 e 5
const SEM_UNIDADE = '(?!\\s*(?:kgs?|quilos?|kilos?|k\\b))'; // "5 séries 24 quilos": o 24 é carga, não repetição

// Tudo vira "NxM": "5 séries de 10 repetições", "10 repetições em 5 séries", "4 vezes de 12",
// "4 por 12", "4 de 12" (só com poucas séries: "24 de 10" não é 24 séries).
export function reescreverQuantidades(texto) {
  return String(texto)
    .replace(new RegExp(`${NAO_DIGITO}${NUM}\\s*s[eé]ries?\\s*(?:de|com|x|por)?\\s*${NUM}${SEM_UNIDADE}(?:\\s*rep\\p{L}*)?`, 'giu'), '$1x$2')
    .replace(new RegExp(`${NAO_DIGITO}${NUM}\\s*rep\\p{L}*\\s*(?:em|por|de)\\s*${NUM}\\s*s[eé]ries?`, 'giu'), '$2x$1')
    .replace(new RegExp(`${NAO_DIGITO}${NUM}\\s*vezes\\s*(?:de|com)?\\s*${NUM}`, 'giu'), (m, a, b) => (Number(a) <= 20 ? `${a}x${b}` : m))
    .replace(new RegExp(`${NAO_DIGITO}${NUM}\\s*por\\s*${NUM}`, 'giu'), (m, a, b) => (Number(a) <= 20 ? `${a}x${b}` : m))
    .replace(new RegExp(`${NAO_DIGITO}${NUM}\\s*de\\s*${NUM}${SEM_UNIDADE}`, 'giu'), (m, a, b) => (Number(a) <= 8 ? `${a}x${b}` : m))
    .replace(new RegExp(`${NAO_DIGITO}${NUM}\\s*\\*\\s*${NUM}`, 'g'), '$1x$2');
}

// Texto como o parser vai ler: números por extenso e quantidades já no formato NxM.
export const prepararTexto = (texto) => reescreverQuantidades(numerosPorExtenso(texto));

// ---------- palavras que não mudam nada ----------

// Já sem acento, em minúsculas. Saem do nome do exercício e do treino ("hoje fiz supino com 24 kg").
export const ENFEITES = new Set([
  'fiz', 'fez', 'fizemos', 'fazer', 'treinei', 'treinou', 'treinar', 'treino', 'treinos', 'foi', 'fui', 'usei', 'usando',
  'peguei', 'mandei', 'rolou', 'tive', 'com', 'carga', 'peso', 'pesos', 'em', 'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'pra', 'para', 'tambem', 'ainda', 'depois', 'entao', 'ai', 'manha', 'tarde', 'noite', 'madrugada', 'cedo',
  'exercicio', 'exercicios', 'registrar', 'registre', 'registra', 'anota', 'anote', 'anotar', 'marca', 'marque', 'lanca',
  'lance', 'salva', 'salve', 'tipo', 'so', 'apenas', 'aquele', 'esse', 'meu', 'minha', 'e',
  'dos', 'das', 'nos', 'nas', 'ao', 'aos',
]);

// Datas que se pode dizer no meio da frase sem dois-pontos (as abreviações seg/ter/qua... só valem
// antes dos dois-pontos, porque "ter" e "qua" também são palavras comuns).
export const DATAS_NA_FRASE = new Set(['hoje', 'ontem', 'anteontem', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']);

// ---------- onde uma frase termina um exercício e começa o outro ----------

// "supino 24 5x10 e depois crossover 15 4x12", "supino 24 5x10 - cross 15 4x12", "a. b." viram vírgula.
export function dividirItens(texto) {
  return String(texto)
    .replace(/\s+(?:e|depois|aí|ai|também|tambem|aí depois)\s+(?:(?:e|depois|aí|ai)\s+)?/giu, ', ')
    .replace(/\s[-–—]\s/g, ', ')
    .replace(/\.\s+(?=\p{L})/gu, ', ')
    .split(/\s*(?:;|,(?!\d))\s*/);
}
