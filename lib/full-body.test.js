// Frases do dia a dia com os treinos Full body (rotina em memória: a de teste data/rotina.json só tem os antigos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretar } from './parser.js';
import { responderConsulta } from './consultas.js';

const PLANO = {
  'Full body 1': ['Supino inclinado halter', 'Puxada alta', 'Remada baixa', 'Leg press ou hack', 'Mesa flexora', 'Rosca barra W', 'Tríceps barra reta polia'],
  'Full body 2': ['Supino chest press', 'Voador', 'Puxada alta', 'Cadeira extensora', 'Desenvolvimento máquina', 'Tríceps francês'],
  'Full body 3': ['Supino inclinado halter', 'Remada baixa', 'Pulldown polia ou máquina', 'Leg press ou agachamento hack', 'Mesa flexora', 'Rosca barra W', 'Tríceps francês ou barra'],
};
const rotina = Object.entries(PLANO).flatMap(([treino, lista]) => lista.map((exercicio, i) => ({ exercicio, treino, ordem: i + 1, grupo: 'x', series: null, reps: '' })));
const HOJE = '2026-10-14';

const FRASES = [
  ['full1: supino inc 24 4x10, puxada 50 4x12, remada 40 3x12', ['Full body 1:Supino inclinado halter', 'Full body 1:Puxada alta', 'Full body 1:Remada baixa']],
  ['full body 1: leg press 120 4x10, flexora 35 3x12, rosca 20 3x12', ['Full body 1:Leg press ou hack', 'Full body 1:Mesa flexora', 'Full body 1:Rosca barra W']],
  ['hoje fiz o full body 2: chest press 30 3x12, voador 25 3x12', ['Full body 2:Supino chest press', 'Full body 2:Voador']],
  ['ontem full 3 leg press 100 4x10', ['Full body 3:Leg press ou agachamento hack']],
  ['full2 puxada alta 45 4x10 extensora 40 3x15 desenvolvimento 20 3x12 triceps frances 15 3x12', ['Full body 2:Puxada alta', 'Full body 2:Cadeira extensora', 'Full body 2:Desenvolvimento máquina', 'Full body 2:Tríceps francês']],
  ['fiz full body 3 hoje, supino inclinado com 22 quilos 4 séries de 10, remada baixa 45 3x12', ['Full body 3:Supino inclinado halter', 'Full body 3:Remada baixa']],
  ['full 1 hoje: hack 100 4x10', ['Full body 1:Leg press ou hack']],
  ['treino full body 2, extensora 45 4x12', ['Full body 2:Cadeira extensora']],
  ['fullbody1 rosca w 20 3x12', ['Full body 1:Rosca barra W']],
  ['full3: pulldown 40 3x12, agachamento hack 80 4x10', ['Full body 3:Pulldown polia ou máquina', 'Full body 3:Leg press ou agachamento hack']],
  ['segunda full body 2 voador 25 3x12', ['Full body 2:Voador']],
  ['f1: puxada 50 4x12', ['Full body 1:Puxada alta']],
  ['fiz puxada alta 50 4x12 no full 2', ['Full body 2:Puxada alta']],
  ['full body um: puxada 50 4x12', ['Full body 1:Puxada alta']],
  ['full body dois voador 25 3x12', ['Full body 2:Voador']],
  ['full três: remada 40 3x12', ['Full body 3:Remada baixa']],
];

for (const [frase, esperado] of FRASES) {
  test(`full body: ${frase}`, () => {
    const r = interpretar(frase, { rotina, hoje: HOJE });
    assert.equal(r.pronto, true, JSON.stringify(r.erros.concat(r.pendentes.map((p) => p.mensagem))));
    assert.deepEqual(r.registros.map((x) => `${x.treino}:${x.exercicio}`), esperado);
  });
}

test('full body: exercício que existe em dois treinos pergunta qual foi', () => {
  const r = interpretar('puxada alta 50 4x12', { rotina, hoje: HOJE });
  assert.equal(r.pendentes[0]?.tipo, 'ambiguo_treino');
});

const R = [
  { data: '2026-10-13', treino: 'Full body 1', exercicio: 'Supino inclinado halter', series: 5, reps: 10, carga: 24, obs: '' },
  { data: '2026-10-13', treino: 'Full body 1', exercicio: 'Puxada alta', series: 4, reps: 12, carga: 50, obs: 'bloco 1/2' },
  { data: '2026-10-13', treino: 'Full body 1', exercicio: 'Puxada alta', series: 2, reps: 10, carga: 45, obs: 'bloco 2/2' },
  { data: '2026-10-10', treino: 'Full body 2', exercicio: 'Voador', series: 3, reps: 12, carga: 25, obs: '' },
  { data: '2026-10-06', treino: 'Full body 1', exercicio: 'Puxada alta', series: 4, reps: 12, carga: 47.5, obs: '' },
];
const perguntar = (q) => responderConsulta(q, { registros: R, rotina, hoje: HOJE });

test('consulta por regras: último treino, exercício, maior carga, quando e dia', () => {
  assert.match(perguntar('liste meu último full body 1'), /Full body 1 — 13\/10[\s\S]*Puxada alta: 4x12 · 50 kg \+ 2x10 · 45 kg/);
  assert.match(perguntar('liste meu último treino full2'), /Full body 2 — 10\/10[\s\S]*Voador: 3x12 · 25 kg/);
  assert.match(perguntar('qual foi minha última puxada alta?'), /13\/10/);
  assert.match(perguntar('maior carga na puxada alta'), /50 kg/);
  assert.match(perguntar('quando fiz voador?'), /10\/10/);
  assert.match(perguntar('o que fiz ontem?'), /Full body 1 — 13\/10/);
  assert.match(perguntar('histórico do supino inclinado'), /5x10 · 24 kg/);
  assert.match(perguntar('liste meu último full body 3'), /Ainda não há registros/);
});

test('consulta por regras: o que não reconhece vai para a IA (null)', () => {
  assert.equal(perguntar('como estou evoluindo?'), null);
});

test('mais jeitos de escrever: barra entre exercícios, "dia 12/10", observação entre parênteses', () => {
  let r = interpretar('full1: supino 24 4x10 / puxada 50 4x12', { rotina, hoje: HOJE });
  assert.equal(r.registros.length, 2);
  r = interpretar('dia 12/10 full 2 voador 25 3x12', { rotina, hoje: HOJE });
  assert.equal(r.registros[0].data, '2026-10-12');
  r = interpretar('full1: supino inclinado 24 5x10 (dor no ombro)', { rotina, hoje: HOJE });
  assert.equal(r.registros[0].obs, 'dor no ombro');
  assert.equal(r.registros[0].series, 5);
});

test('rotina sem séries/reps: a pergunta pede os números em vez de falar "nullx"', () => {
  const r = interpretar('full1: puxada alta 50kg 4x12, remada 40', { rotina, hoje: HOJE });
  assert.match(r.pendentes[0].mensagem, /Quantas séries e repetições/);
  assert.doesNotMatch(r.pendentes[0].mensagem, /null/);
});

test('consulta por regras: próximo treino, exercícios do treino, tempo desde o último, último geral', () => {
  assert.match(perguntar('qual o próximo treino?'), /Próximo treino: Full body 2/);
  assert.match(perguntar('quais exercícios tem no full body 2?'), /• Voador/);
  assert.match(perguntar('quanto tempo desde o último treino?'), /há 1 dia/);
  assert.match(perguntar('qual foi meu último treino?'), /Full body 1 — 13\/10/);
  assert.match(perguntar('me mostre o último full 1'), /Full body 1 — 13\/10/);
  assert.match(perguntar('liste as últimas 2 vezes da puxada'), /13\/10[\s\S]*06\/10/);
});

test('uma carga e as reps de cada série: "remada baixa 40kg 12 12 10"', () => {
  const r = interpretar('full3: remada baixa 40kg 12 12 10', { rotina, hoje: HOJE });
  assert.equal(r.pronto, true);
  assert.deepEqual(r.registros.map((x) => [x.carga, x.series, x.reps]), [[40, 2, 12], [40, 1, 10]]);
  // com só dois números pequenos continua sendo dúvida (24 5 10 pode ser 5 séries de 10)
  assert.equal(interpretar('full3: remada baixa 24 5 10', { rotina, hoje: HOJE }).pronto, false);
});

test('exercício em mais de um treino usa o treino já feito hoje; sem isso, pergunta', () => {
  assert.equal(interpretar('puxada alta 50 4x12', { rotina, hoje: HOJE }).pronto, false);
  const r = interpretar('puxada alta 50 4x12', { rotina, hoje: HOJE, treinoDeHoje: 'Full body 2' });
  assert.equal(r.registros[0].treino, 'Full body 2');
  // o treino de hoje só vale se o exercício existe nele
  assert.equal(interpretar('puxada alta 50 4x12', { rotina, hoje: HOJE, treinoDeHoje: 'Full body 3' }).pronto, false);
});

test('"ombro" dentro do nome do exercício não é o treino', () => {
  const r = interpretar('full2 desenvolvimento de ombro maquina 20 3x12', { rotina, hoje: HOJE });
  assert.equal(r.registros[0]?.exercicio, 'Desenvolvimento máquina');
});

test('full body: lista de séries separadas por vírgula e "não fiz"', () => {
  const texto = `Flexora: 30kg 10 reps, 30kg 9 reps, 30kg 9 reps

Extensora: não fiz, academia lotada.

Bíceps Barra w: 15kg 14 reps, 10 reps, 10 reps

Tríceps francês: 20kg 15 reps, 25 10 reps, 25 9 reps.

Cardio: 20min esteira, slope 5% velocidade 6`;
  const r = interpretar(texto, { rotina, hoje: HOJE, treinoDeHoje: 'Full body 3' });
  assert.equal(r.pronto, true, JSON.stringify(r.erros.concat(r.pendentes.map((p) => p.mensagem))));
  assert.deepEqual(
    r.registros.map((x) => `${x.exercicio} ${x.series}x${x.reps} ${x.carga}`),
    ['Mesa flexora 1x10 30', 'Mesa flexora 2x9 30', 'Rosca barra W 1x14 15', 'Rosca barra W 2x10 15', 'Tríceps francês 1x15 20', 'Tríceps francês 1x10 25', 'Tríceps francês 1x9 25', 'Cardio nullxnull null'],
  );
});

test('cardio: vira registro com os dados em Observações, no treino do exercício anterior ou de hoje', () => {
  const r = interpretar('full3: flexora 30 3x10\nCardio: 20min esteira, slope 5% velocidade 6', { rotina, hoje: HOJE });
  assert.equal(r.pronto, true);
  assert.deepEqual(r.registros.at(-1), { exercicio: 'Cardio', treino: 'Full body 3', grupo: 'Cardio', data: HOJE, series: null, reps: null, carga: null, obs: '20 min esteira · inclinação 5% · velocidade 6' });
  const sozinho = interpretar('cardio 30 min bike', { rotina, hoje: HOJE });
  assert.equal(sozinho.pendentes[0]?.tipo, 'ambiguo_treino');
  assert.equal(interpretar('cardio 30 min bike', { rotina, hoje: HOJE, treinoDeHoje: 'Full body 2' }).registros[0].treino, 'Full body 2');
});
