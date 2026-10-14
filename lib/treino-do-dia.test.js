// Rodar com:  node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { ultimoRegistro, jaRegistrado, treinoSugerido, montarDia, marcarFeitosHoje, historicoDe, gruposDaRotina } from './treino-do-dia.js';

// Listas no formato do store: mais recentes primeiro.
const reg = (exercicio, treino, data, carga, extra = {}) => ({ exercicio, treino, data, series: 4, reps: 10, carga, obs: null, ...extra });

test('treinoSugerido: começa no primeiro, avança um e volta ao início depois do último', () => {
  assert.equal(treinoSugerido([]), 'Peito/Tríceps');
  assert.equal(treinoSugerido([reg('x', 'Peito/Tríceps', '2026-10-12', 10)]), 'Perna 1');
  assert.equal(treinoSugerido([reg('x', 'Bíceps/Tríceps', '2026-10-12', 10)]), 'Peito/Tríceps');
  assert.equal(treinoSugerido([reg('x', null, '2026-10-12', 10), reg('y', 'Perna 2', '2026-10-11', 10)]), 'Bíceps/Tríceps');
});

test('ultimoRegistro prefere o mesmo treino e avisa quando vem de outro', () => {
  const lista = [reg('Agachamento', 'Perna 2', '2026-10-10', 80), reg('Agachamento', 'Perna 1', '2026-10-03', 70)];
  const mesmo = ultimoRegistro(lista, 'Agachamento', 'Perna 1');
  assert.equal(mesmo.carga, 70);
  assert.equal(mesmo.deOutroTreino, false);
  const outro = ultimoRegistro(lista, 'Agachamento', 'Peito/Tríceps');
  assert.equal(outro.carga, 80);
  assert.equal(outro.deOutroTreino, true);
  assert.equal(ultimoRegistro(lista, 'Inexistente', 'Perna 1'), null);
});

test('ultimoRegistro junta as linhas do mesmo dia na ordem dos blocos', () => {
  const lista = [
    reg('Puxada', 'Costas/Bíceps', '2026-10-12', 45, { obs: 'bloco 2/2' }),
    reg('Puxada', 'Costas/Bíceps', '2026-10-12', 50, { obs: 'bloco 1/2' }),
    reg('Puxada', 'Costas/Bíceps', '2026-10-05', 40),
  ];
  const u = ultimoRegistro(lista, 'Puxada', 'Costas/Bíceps');
  assert.deepEqual(u.registros.map((r) => r.carga), [50, 45]);
});

test('jaRegistrado: igual é duplicado; qualquer número diferente não é', () => {
  const lista = [reg('Supino', 'Peito/Tríceps', '2026-10-12', 24)];
  assert.equal(jaRegistrado(lista, reg('Supino', 'Peito/Tríceps', '2026-10-12', 24)), true);
  assert.equal(jaRegistrado(lista, reg('Supino', 'Peito/Tríceps', '2026-10-12', 26)), false);
  assert.equal(jaRegistrado(lista, reg('Supino', 'Peito/Tríceps', '2026-10-13', 24)), false);
  assert.equal(jaRegistrado(lista, reg('Supino', 'Peito/Tríceps', '2026-10-12', 24, { reps: 12 })), false);
  assert.equal(jaRegistrado(lista, reg('Supino', 'Peito/Tríceps', '2026-10-12', 24, { obs: 'bloco 1/2' })), false);
});

test('montarDia: sugere o próximo do ciclo, ordena pela rotina e traz o último de cada exercício', () => {
  const rotina = [
    { exercicio: 'B', treino: 'Costas/Bíceps', ordem: 2, grupo: 'Costas', series: 4, reps: '10' },
    { exercicio: 'A', treino: 'Costas/Bíceps', ordem: 1, grupo: 'Costas', series: 4, reps: '10' },
    { exercicio: 'C', treino: 'Perna 1', ordem: 1, grupo: 'Pernas', series: 3, reps: '12' },
  ];
  const treinos = [reg('C', 'Perna 1', '2026-10-12', 50), reg('A', 'Costas/Bíceps', '2026-10-05', 30)];
  const dia = montarDia(rotina, treinos, undefined);
  assert.equal(dia.sugerido, 'Costas/Bíceps');
  assert.equal(dia.selecionado, 'Costas/Bíceps');
  assert.deepEqual(dia.exercicios.map((e) => e.exercicio), ['A', 'B']);
  assert.equal(dia.exercicios[0].ultimo.carga, 30);
  assert.equal(dia.exercicios[1].ultimo, null);
  assert.equal(montarDia(rotina, treinos, 'Perna 1').selecionado, 'Perna 1');
  assert.equal(montarDia(rotina, treinos, 'Inexistente').selecionado, 'Costas/Bíceps');
  assert.deepEqual(dia.catalogo, ['A', 'B', 'C']);
});

test('historicoDe: só do exercício, com limite e blocos do mesmo dia em ordem', () => {
  const lista = [
    reg('Puxada', 'Costas/Bíceps', '2026-10-12', 45, { obs: 'bloco 2/2' }),
    reg('Puxada', 'Costas/Bíceps', '2026-10-12', 50, { obs: 'bloco 1/2' }),
    reg('Outro', 'Costas/Bíceps', '2026-10-12', 10),
    reg('Puxada', 'Costas/Bíceps', '2026-10-05', 40),
  ];
  const h = historicoDe(lista, 'Puxada');
  assert.deepEqual(h.map((r) => [r.data, r.carga]), [['2026-10-12', 50], ['2026-10-12', 45], ['2026-10-05', 40]]);
  assert.equal(historicoDe(lista, 'Puxada', 2).length, 2);
});

test('gruposDaRotina: ordem fixa, grupo novo no fim e grupo de cada exercício', () => {
  const rotina = [
    { exercicio: 'Remada', treino: 'Costas/Bíceps', grupo: 'Costas' },
    { exercicio: 'Supino', treino: 'Peito/Tríceps', grupo: 'Peito' },
    { exercicio: 'Prancha', treino: 'Bíceps/Tríceps', grupo: 'Core' },
    { exercicio: 'Pular corda', treino: 'Perna 1', grupo: 'Aeróbico' },
    { exercicio: 'Rosca', treino: 'Bíceps/Tríceps', grupo: 'Braços' },
    { exercicio: 'Rosca', treino: 'Costas/Bíceps', grupo: 'Braços' }, // repetido em outro treino
    { exercicio: 'Sem grupo', treino: 'Perna 1', grupo: null },
  ];
  const { grupos, grupoDoExercicio } = gruposDaRotina(rotina);
  assert.deepEqual(grupos, ['Peito', 'Costas', 'Braços', 'Core', 'Aeróbico']);
  assert.equal(grupoDoExercicio.Rosca, 'Braços');
  assert.equal(grupoDoExercicio['Sem grupo'], undefined);
  assert.deepEqual(montarDia(rotina, [], undefined).grupos, grupos);
});

test('marcarFeitosHoje: só marca quem tem registro de hoje no mesmo treino', () => {
  const rotina = [
    { exercicio: 'A', treino: 'Costas/Bíceps', ordem: 1, grupo: 'Costas', series: 4, reps: '10' },
    { exercicio: 'B', treino: 'Costas/Bíceps', ordem: 2, grupo: 'Costas', series: 4, reps: '10' },
    { exercicio: 'C', treino: 'Costas/Bíceps', ordem: 3, grupo: 'Costas', series: 4, reps: '10' },
  ];
  const treinos = [reg('A', 'Costas/Bíceps', '2026-10-14', 30), reg('B', 'Costas/Bíceps', '2026-10-12', 30), reg('C', 'Perna 1', '2026-10-14', 30)];
  const dia = marcarFeitosHoje(montarDia(rotina, treinos, 'Costas/Bíceps'), '2026-10-14');
  assert.deepEqual(dia.exercicios.map((e) => e.feitoHoje), [true, false, false]);
});
