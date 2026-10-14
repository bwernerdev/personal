// Regras de leitura: o que mostrar na tela "Treino do dia" e no histórico.
// Sem cálculo de carga: o app só mostra o que você fez da última vez.

import { TREINOS_EM_STANDBY as TREINOS, treinosDoApp } from './parser.js';

// Exercício com cargas diferentes vira várias linhas na mesma data, marcadas "bloco 1/3" em Observações.
const ordemDoBloco = (r) => Number(/^bloco (\d+)\//.exec(r.obs || '')?.[1] ?? 0);
const emOrdemDeBloco = (lista) => [...lista].sort((a, b) => ordemDoBloco(a) - ordemDoBloco(b));

// Último treino de um exercício (lista já ordenada do mais recente para o mais antigo).
// Prefere o mesmo treino (ex.: Perna 1); se não houver, usa o mesmo exercício em outro treino.
// `registros` traz todas as linhas daquele dia (mais de uma quando houve cargas diferentes).
export function ultimoRegistro(treinos, exercicio, treino) {
  const doExercicio = treinos.filter((t) => t.exercicio === exercicio);
  const mesmo = doExercicio.find((t) => t.treino === treino);
  const base = mesmo || doExercicio[0];
  if (!base) return null;
  const doDia = doExercicio.filter((t) => t.data === base.data && t.treino === base.treino);
  return { ...base, deOutroTreino: !mesmo, registros: emOrdemDeBloco(doDia) };
}

// Já existe um registro igual (mesmo exercício, treino, data e números)? Evita gravar duas vezes
// o mesmo texto reenviado. Valores diferentes no mesmo dia continuam valendo (são outro registro).
export function jaRegistrado(treinos, r) {
  return treinos.some(
    (t) =>
      t.exercicio === r.exercicio &&
      t.treino === r.treino &&
      t.data === r.data &&
      t.series === r.series &&
      t.reps === r.reps &&
      t.carga === r.carga &&
      (t.obs || null) === (r.obs || null),
  );
}

// Sugere o próximo treino do ciclo, depois do último treino registrado.
export function treinoSugerido(treinos, lista = TREINOS) {
  const ultimo = treinos.find((t) => t.treino && lista.includes(t.treino));
  if (!ultimo) return lista[0];
  return lista[(lista.indexOf(ultimo.treino) + 1) % lista.length];
}

// Ordem em que os grupos musculares aparecem nos filtros; grupo novo no Notion entra no fim.
const ORDEM_DOS_GRUPOS = ['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core', 'Cardio'];

// Grupos que existem na rotina (para o filtro por tipo) e o grupo de cada exercício.
export function gruposDaRotina(rotina) {
  const porExercicio = {};
  for (const r of rotina) if (r.grupo && !porExercicio[r.exercicio]) porExercicio[r.exercicio] = r.grupo;
  const existentes = [...new Set(Object.values(porExercicio))];
  const peso = (g) => (ORDEM_DOS_GRUPOS.includes(g) ? ORDEM_DOS_GRUPOS.indexOf(g) : ORDEM_DOS_GRUPOS.length);
  const grupos = existentes.sort((a, b) => peso(a) - peso(b) || a.localeCompare(b, 'pt-BR'));
  return { grupos, grupoDoExercicio: porExercicio };
}

export function montarDia(rotina, treinos, treinoPedido) {
  const lista = treinosDoApp(rotina);
  const sugerido = treinoSugerido(treinos, lista);
  const selecionado = lista.includes(treinoPedido) ? treinoPedido : sugerido;
  const exercicios = rotina
    .filter((r) => r.treino === selecionado)
    .sort((a, b) => a.ordem - b.ordem)
    .map((r) => ({ ...r, ultimo: ultimoRegistro(treinos, r.exercicio, r.treino) }));
  const catalogo = [...new Set(rotina.map((r) => r.exercicio))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const { grupos, grupoDoExercicio } = gruposDaRotina(rotina);
  return { treinos: lista, sugerido, selecionado, exercicios, catalogo, grupos, grupoDoExercicio };
}

// Marca `feitoHoje` nos exercícios do dia que já têm registro de hoje (no mesmo treino): vira o "✓" da tela.
export function marcarFeitosHoje(dia, hoje) {
  for (const e of dia.exercicios) e.feitoHoje = Boolean(e.ultimo && !e.ultimo.deOutroTreino && e.ultimo.data === hoje);
  return dia;
}

// Histórico de um exercício: mais recente primeiro; dentro do mesmo dia, na ordem dos blocos.
export function historicoDe(treinos, exercicio, limite = 40) {
  const lista = treinos.filter((t) => t.exercicio === exercicio);
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    const dia = [lista[i]];
    while (i + 1 < lista.length && lista[i + 1].data === lista[i].data && lista[i + 1].treino === lista[i].treino) {
      dia.push(lista[++i]);
    }
    saida.push(...emOrdemDeBloco(dia));
  }
  return saida.slice(0, limite);
}
