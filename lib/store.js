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

// ---------- frases novas ----------
// Frases que as regras do chat não resolveram. Em produção vão para o banco "Frases novas" do Notion;
// no modo de teste, para data/frases.local.json (ou o arquivo de FRASES_LOCAL).

const ARQ_FRASES = process.env.FRASES_LOCAL ? pathToFileURL(process.env.FRASES_LOCAL) : new URL('data/frases.local.json', RAIZ);

async function lerFrasesLocais() {
  return existsSync(ARQ_FRASES) ? JSON.parse(await readFile(ARQ_FRASES, 'utf8')) : [];
}

// `dados`: { frase, resultado, motivo, sugestao, hoje }
export async function anotarFrase(dados) {
  if (!modoTeste()) return notion.anotarFraseNotion(dados);
  const lista = await lerFrasesLocais();
  const achada = lista.find((f) => f.frase === dados.frase.slice(0, 300));
  const campos = { resultado: dados.resultado, motivo: dados.motivo ?? null, sugestao: dados.sugestao ?? null, ultima: dados.hoje, incluida: false };
  if (achada) Object.assign(achada, campos, { vezes: achada.vezes + 1 });
  else lista.push({ id: `frase-${Date.now()}-${lista.length}`, frase: dados.frase.slice(0, 300), vezes: 1, obs: null, ...campos });
  await writeFile(ARQ_FRASES, JSON.stringify(lista, null, 2));
}

// Mais repetidas primeiro. `incluidas: true` lista as que já foram ensinadas às regras.
export async function listarFrases({ incluidas = false } = {}) {
  if (!modoTeste()) return notion.listarFrasesNotion({ incluidas });
  return (await lerFrasesLocais()).filter((f) => f.incluida === incluidas).sort((a, b) => b.vezes - a.vezes);
}

export async function marcarFrase(id, opcoes = {}) {
  if (!modoTeste()) return notion.marcarFraseNotion(id, opcoes);
  const lista = await lerFrasesLocais();
  const f = lista.find((x) => x.id === id);
  if (!f) throw new Error('Frase não encontrada.');
  f.incluida = opcoes.incluida ?? true;
  if (opcoes.obs) f.obs = opcoes.obs;
  await writeFile(ARQ_FRASES, JSON.stringify(lista, null, 2));
}
