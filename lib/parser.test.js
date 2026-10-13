// Rodar com:  node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpretar } from './parser.js';

const rotina = JSON.parse(readFileSync(new URL('../data/rotina.json', import.meta.url), 'utf8'));
const HOJE = '2026-10-13'; // terça-feira
const run = (texto, extra = {}) => interpretar(texto, { rotina, hoje: HOJE, ...extra });

test('treino com atalhos de exercício', () => {
  const r = run('peito: inc 24 5x10, cross 15 4x12, chest 40 4x10');
  assert.equal(r.pronto, true);
  assert.deepEqual(
    r.registros.map((x) => [x.exercicio, x.treino, x.carga, x.series, x.reps, x.data]),
    [
      ['Supino inclinado halter', 'Peito/Tríceps', 24, 5, 10, HOJE],
      ['Crossover (polia alta)', 'Peito/Tríceps', 15, 4, 12, HOJE],
      ['Supino chest press', 'Peito/Tríceps', 40, 4, 10, HOJE],
    ],
  );
});

test('carga decimal com vírgula não quebra o item', () => {
  const r = run('peito: inc 22,5 5x10, voador 30 3x15');
  assert.equal(r.pronto, true);
  assert.equal(r.registros[0].carga, 22.5);
  assert.equal(r.registros[1].exercicio, 'Voador'); // exato vence "Voador invertido"
});

test('data por palavra, dia da semana e dd/mm', () => {
  assert.equal(run('ontem costas: puxada 50 4x12').registros[0].data, '2026-10-12');
  assert.equal(run('seg perna1: ext 50 4x12').registros[0].data, '2026-10-12');
  assert.equal(run('sex perna1: ext 50 4x12').registros[0].data, '2026-10-09');
  assert.equal(run('05/10 ombro: desenv 30 4x10').registros[0].data, '2026-10-05');
});

test('vários blocos em linhas diferentes', () => {
  const r = run('peito: inc 24 5x10\nperna1: ext 50 4x12, agacha 60 5x8');
  assert.equal(r.pronto, true);
  assert.deepEqual(r.registros.map((x) => x.treino), ['Peito/Tríceps', 'Perna 1', 'Perna 1']);
});

test('exercício em dois treinos pede o treino', () => {
  const r = run('mesa 40 4x12');
  assert.equal(r.pronto, false);
  assert.equal(r.pendentes[0].tipo, 'ambiguo_treino');
  assert.equal(r.pendentes[0].sugestoes.length, 2);
  assert.equal(r.pendentes[0].sugestoes[0].texto, 'perna1: mesa 40 4x12');
});

test('com o treino informado, o mesmo exercício resolve', () => {
  const r = run('perna2: mesa 40 4x12');
  assert.equal(r.pronto, true);
  assert.equal(r.registros[0].treino, 'Perna 2');
});

test('atalho ambíguo pergunta qual exercício', () => {
  const r = run('braço: rosca 14 3x12');
  assert.equal(r.pronto, false);
  assert.equal(r.pendentes[0].tipo, 'ambiguo_exercicio');
  assert.equal(r.pendentes[0].sugestoes.length, 3);
});

test('sem séries x reps: pergunta e só usa a rotina quando confirmado', () => {
  const sem = run('peito: inc 24');
  assert.equal(sem.pronto, false);
  assert.equal(sem.pendentes[0].tipo, 'sem_series_reps');
  assert.equal(sem.registros.length, 0);

  const com = run('peito: chest 40', { usarRotina: true });
  assert.equal(com.pronto, true);
  assert.equal(com.registros[0].series, 4);
  assert.equal(com.registros[0].reps, 10);
});

test('faixa de reps da rotina não é chutada', () => {
  const r = run('peito: inc 24', { usarRotina: true });
  assert.equal(r.pronto, false);
  assert.equal(r.pendentes[0].tipo, 'faixa');
});

test('sem carga pergunta, exceto no core', () => {
  assert.equal(run('peito: inc 5x10').pendentes[0].tipo, 'sem_carga');
  const core = run('braço: abd 4x10');
  assert.equal(core.pronto, true);
  assert.equal(core.registros[0].carga, null);
});

test('prancha em segundos vai para observações', () => {
  const r = run('braço: prancha 4x60s');
  assert.equal(r.pronto, true);
  assert.equal(r.registros[0].series, 4);
  assert.equal(r.registros[0].reps, null);
  assert.equal(r.registros[0].obs, '60 s por série');
});

test('exercício fora do treino informado vira erro, nada é gravado', () => {
  const r = run('peito: puxada 50 4x12, inc 24 5x10');
  assert.equal(r.pronto, false);
  assert.equal(r.erros.length, 1);
});

test('treino desconhecido e "perna" sozinho dão erro claro', () => {
  assert.match(run('xyz: inc 24 5x10').erros[0], /Não reconheci o treino/);
  assert.match(run('perna: ext 50 4x12').erros[0], /perna1/);
});

test('nome completo com acento e "peito/tríceps" funcionam', () => {
  const r = run('Peito/Tríceps: Supino inclinado halter 24 5x10');
  assert.equal(r.pronto, true);
});

// ---------- cargas diferentes por série ----------

test('cargas diferentes: cada par é carga x reps e iguais seguidas se juntam', () => {
  const r = run('costas: puxada 50x12 50x12 45x10');
  assert.equal(r.pronto, true);
  assert.deepEqual(
    r.registros.map((x) => [x.carga, x.series, x.reps, x.obs]),
    [
      [50, 2, 12, 'bloco 1/2'],
      [45, 1, 10, 'bloco 2/2'],
    ],
  );
});

test('cargas diferentes com carga decimal; um grupo só não marca bloco', () => {
  const r = run('peito: inc 22,5x10 22,5x10 22,5x8');
  assert.equal(r.pronto, true);
  assert.deepEqual(
    r.registros.map((x) => [x.carga, x.series, x.reps, x.obs]),
    [
      [22.5, 2, 10, 'bloco 1/2'],
      [22.5, 1, 8, 'bloco 2/2'],
    ],
  );
  const igual = run('peito: inc 24x10 24x10 24x10');
  assert.deepEqual(igual.registros.map((x) => [x.carga, x.series, x.reps, x.obs]), [[24, 3, 10, null]]);
});

test('um par só continua sendo séries x reps (carga separada)', () => {
  const r = run('peito: inc 24 5x10');
  assert.deepEqual(r.registros.map((x) => [x.carga, x.series, x.reps, x.obs]), [[24, 5, 10, null]]);
});

test('cargas diferentes misturadas com número solto ou tempo pergunta e não grava', () => {
  const solto = run('peito: inc 24 50x12 50x10');
  assert.equal(solto.pronto, false);
  assert.equal(solto.pendentes[0].tipo, 'confuso');
  const tempo = run('braço: prancha 20x60s 20x45s');
  assert.equal(tempo.pronto, false);
  assert.equal(tempo.registros.length, 0);
});

test('exercício ambíguo mantém os pares na sugestão', () => {
  const r = run('braço: rosca 15x12 15x10');
  assert.equal(r.pendentes[0].tipo, 'ambiguo_exercicio');
  assert.match(r.pendentes[0].sugestoes[0].texto, /15x12 15x10$/);
});
