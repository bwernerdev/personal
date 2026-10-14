import test from 'node:test';
import assert from 'node:assert/strict';


test('pergunta composta: duas coisas numa frase vão para a IA; pedido simples continua nas regras', async () => {
  const { perguntaComposta } = await import('./consultas.js');
  for (const t of ['qual foi o meu recorde de carga no voador e quantas vezes fiz esse exercício?', 'liste meu último full body 1 e quando foi o anterior', 'qual o recorde no voador? e a puxada?']) assert.equal(perguntaComposta(t), true, t);
  for (const t of ['maior carga no voador', 'quando fiz extensora?', 'liste meu último full body 1', 'qual foi minha última puxada alta?']) assert.equal(perguntaComposta(t), false, t);
});

import { responderConsulta, periodoDe, completarComContexto } from './consultas.js';

const HOJE = '2026-10-14'; // quarta
const R = (data, treino, exercicio, series, reps, carga, obs = null) => ({ data, treino, exercicio, series, reps, carga, obs });
const REGISTROS = [
  R('2026-10-13', 'Full body 2', 'Voador', 1, 8, 35),
  R('2026-10-13', 'Full body 2', 'Voador', 1, 12, 30),
  R('2026-10-13', 'Full body 2', 'Puxada alta', 3, 10, 40),
  R('2026-10-06', 'Full body 1', 'Voador', 3, 10, 30),
  R('2026-09-15', 'Full body 1', 'Voador', 3, 10, 25),
];

test('períodos: esta semana, semana passada, mês, últimos N dias, desde mês', () => {
  assert.deepEqual(periodoDe('como foi minha semana esta semana', HOJE), { de: '2026-10-12', ate: '2026-10-14', rotulo: 'Esta semana' });
  assert.deepEqual(periodoDe('semana passada', HOJE), { de: '2026-10-05', ate: '2026-10-11', rotulo: 'Semana passada' });
  assert.equal(periodoDe('este mes', HOJE).de, '2026-10-01');
  assert.deepEqual(periodoDe('mes passado', HOJE), { de: '2026-09-01', ate: '2026-09-30', rotulo: 'Mês passado' });
  assert.equal(periodoDe('ultimos 10 dias', HOJE).de, '2026-10-05');
  assert.equal(periodoDe('desde setembro', HOJE).de, '2026-09-01');
  assert.equal(periodoDe('desde 10/09', HOJE).de, '2026-09-10');
  assert.equal(periodoDe('qual meu ultimo treino', HOJE), null);
});

test('consulta por período: resumo dos dias e evolução do exercício', () => {
  const sem = responderConsulta('o que fiz nesta semana?', { registros: REGISTROS, rotina: [], hoje: HOJE });
  assert.match(sem, /Esta semana \(12\/10–14\/10\): 1 dia de treino/);
  assert.match(sem, /13\/10 \(ter\): Full body 2 — 2 exercícios, 5 séries/);
  assert.match(responderConsulta('como foi a semana passada', { registros: REGISTROS, rotina: [], hoje: HOJE }), /Semana passada \(05\/10–11\/10\): 1 dia/);
  assert.match(responderConsulta('o que fiz no mês passado', { registros: REGISTROS, rotina: [], hoje: HOJE }), /nenhum treino|1 dia/);
  const ev = responderConsulta('quanto evoluí no voador desde setembro?', { registros: REGISTROS, rotina: [], hoje: HOJE });
  assert.match(ev, /Voador — desde setembro: 3 dias; 15\/09 \(ter\) 25 kg → 13\/10 \(ter\) 35 kg \(\+10 kg\)\. Maior carga: 35 kg/);
});

test('pergunta curta que continua a anterior usa a intenção da pergunta de antes', () => {
  const historico = [{ de: 'eu', texto: 'qual meu recorde no voador?' }, { de: 'ia', texto: 'Maior carga em Voador: 35 kg' }];
  assert.equal(completarComContexto('e a puxada?', historico), 'recorde puxada');
  assert.match(responderConsulta(completarComContexto('e a puxada alta?', historico), { registros: REGISTROS, rotina: [], hoje: HOJE }), /Puxada alta: 40 kg/);
  assert.equal(completarComContexto('e a puxada?', []), null);
  assert.equal(completarComContexto('supino 24 5x10', historico), null);
  assert.equal(completarComContexto('e então, como foi o treino que eu fiz no sábado passado com a turma toda?', historico), null);
});
