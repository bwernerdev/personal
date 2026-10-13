// Camada de dados. Em produção usa o Notion; sem NOTION_TOKEN (e fora da Vercel) usa
// arquivos locais, para poder testar o app sem internet:
//   - data/rotina.json        -> rotina do personal
//   - data/treinos.local.json -> treinos registrados no modo de teste (ignorado pelo git)

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as notion from './notion.js';
import { ultimoRegistro } from './treino-do-dia.js';

const RAIZ = new URL('../', import.meta.url);
const ARQ_ROTINA = new URL('data/rotina.json', RAIZ);
// TREINOS_LOCAL (caminho de arquivo) troca o arquivo de treinos do modo de teste; os testes automáticos usam isso.
const ARQ_TREINOS = process.env.TREINOS_LOCAL ? pathToFileURL(process.env.TREINOS_LOCAL) : new URL('data/treinos.local.json', RAIZ);

export function modoTeste() {
  return !process.env.NOTION_TOKEN && !process.env.VERCEL;
}

export async function listarRotina() {
  if (!modoTeste()) return notion.listarRotina();
  return JSON.parse(await readFile(ARQ_ROTINA, 'utf8'));
}

async function lerLocais() {
  if (!existsSync(ARQ_TREINOS)) return [];
  return JSON.parse(await readFile(ARQ_TREINOS, 'utf8'));
}

// Mais recentes primeiro.
function maisRecentesPrimeiro(lista) {
  return lista.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.criado - a.criado));
}

// Os registros mais recentes (para o próximo treino do ciclo, o "já registrado" e o treino do dia).
export async function listarTreinos() {
  if (!modoTeste()) return notion.listarTreinos();
  return maisRecentesPrimeiro(await lerLocais());
}

// Todos os registros de um exercício (mais recentes primeiro), mesmo os antigos.
export async function listarTreinosDoExercicio(exercicio, limite = 40) {
  if (!modoTeste()) return notion.listarTreinosDoExercicio(exercicio, limite);
  return maisRecentesPrimeiro((await lerLocais()).filter((t) => t.exercicio === exercicio)).slice(0, limite);
}

// Último treino de um exercício. Procura primeiro entre os `recentes`; só se não achar no mesmo
// treino vai buscar o exercício direto (assim registros antigos não somem com o tempo).
export async function ultimoDoExercicio(recentes, exercicio, treino) {
  const achado = ultimoRegistro(recentes, exercicio, treino);
  if (achado && !achado.deOutroTreino) return achado;
  const lista = await listarTreinosDoExercicio(exercicio, 30);
  return ultimoRegistro(lista, exercicio, treino) || achado;
}

// Devolve o id do registro criado (usado para desfazer).
export async function registrarTreino(r) {
  if (!modoTeste()) return notion.criarTreino(r);
  const lista = await lerLocais();
  const criado = Math.max(Date.now(), ...lista.map((t) => t.criado || 0)) + 1;
  const id = `local-${criado}`;
  lista.push({ ...r, id, criado });
  await writeFile(ARQ_TREINOS, JSON.stringify(lista, null, 2));
  return id;
}

export async function apagarTreino(id) {
  if (!modoTeste()) return notion.apagarTreino(id);
  const lista = await lerLocais();
  const resto = lista.filter((t) => t.id !== id);
  if (resto.length === lista.length) throw new Error('Registro não encontrado.');
  await writeFile(ARQ_TREINOS, JSON.stringify(resto, null, 2));
}
