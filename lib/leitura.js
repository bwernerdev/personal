// Quantos registros ler do Notion para responder uma consulta, sem ficar lento quando o histórico crescer.
// Cada 100 linhas são uma chamada ao Notion (~0,5 s, uma após a outra): ler tudo sempre custaria segundos com meses de treino.
// Então lê os `limite` mais recentes; se isso for tudo que existe, está completo. Se o histórico é maior, soma o histórico
// completo dos exercícios citados na pergunta (esses o Notion filtra direto) e avisa que o resto é parcial.

import { tokens } from './normalizar.js';
import { exerciciosCitados } from './consultas.js';

export const LIMITE_CONSULTA = Number(process.env.LIMITE_CONSULTA) || 1500;
const MAX_EXERCICIOS = 3;
const POR_EXERCICIO = 500;

const maisRecentesPrimeiro = (lista) => lista.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : (b.criado || 0) - (a.criado || 0)));

// Devolve { registros, parcial }: `parcial` = há registros mais antigos que não foram lidos.
export async function registrosParaConsulta({ texto, rotina, listarTreinos, listarTreinosDoExercicio, limite = LIMITE_CONSULTA }) {
  const recentes = await listarTreinos(limite);
  if (recentes.length < limite) return { registros: recentes, parcial: false };
  const nomes = [...new Set(rotina.map((r) => r.exercicio))];
  const citados = exerciciosCitados(tokens(texto).filter((w) => w.length >= 4), nomes).slice(0, MAX_EXERCICIOS);
  if (!citados.length) return { registros: recentes, parcial: true };
  const ids = new Set(recentes.map((r) => r.id));
  const extras = (await Promise.all(citados.map((nome) => listarTreinosDoExercicio(nome, POR_EXERCICIO)))).flat().filter((r) => !ids.has(r.id));
  return { registros: maisRecentesPrimeiro([...recentes, ...extras]), parcial: true };
}
