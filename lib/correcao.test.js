import test from 'node:test';
import assert from 'node:assert/strict';
import { comandoDeCorrecao, executarCorrecao } from './correcao.js';

const NOMES = ['Voador', 'Puxada alta', 'Supino inclinado halter'];
const reg = (id, exercicio, data, carga, series = 1, reps = 10, obs = null, treino = 'Full body 2') => ({ id, exercicio, data, carga, series, reps, obs, treino });

test('correção: reconhece apagar, corrigir carga, séries e reps; ignora frases comuns', () => {
  assert.deepEqual(comandoDeCorrecao('apaga o último', NOMES), { tipo: 'apagar_ultimo' });
  assert.deepEqual(comandoDeCorrecao('desfaz', NOMES), { tipo: 'apagar_ultimo' });
  assert.deepEqual(comandoDeCorrecao('apague o último registro', NOMES), { tipo: 'apagar_ultimo' });
  assert.equal(comandoDeCorrecao('apague o voador de ontem', NOMES).tipo, 'apagar');
  assert.deepEqual(comandoDeCorrecao('errei, era 45 e não 40', NOMES).campos, { carga: 45 });
  assert.deepEqual(comandoDeCorrecao('corrige a puxada para 40 kg', NOMES).campos, { carga: 40 });
  assert.deepEqual(comandoDeCorrecao('na verdade foram 12 reps', NOMES).campos, { reps: 12 });
  assert.deepEqual(comandoDeCorrecao('muda o supino para 4x12', NOMES).campos, { series: 4, reps: 12 });
  assert.equal(comandoDeCorrecao('corrige o bloco 2 do voador para 45 kg', NOMES).bloco, 2);
  for (const t of ['supino 24 5x10', 'liste meu último treino', 'errei', 'hoje foi peito']) assert.equal(comandoDeCorrecao(t, NOMES), null, t);
});

test('correção: atualiza o último registro (ou o exercício citado) e diz antes e depois', async () => {
  const feitos = [];
  const acoes = { apagar: async (id) => feitos.push(['apagar', id]), atualizar: async (id, c) => feitos.push(['atualizar', id, c]) };
  const registros = [reg('a', 'Puxada alta', '2026-10-13', 50, 4, 12), reg('b', 'Voador', '2026-10-13', 30), reg('c', 'Voador', '2026-10-06', 25)];
  const m = await executarCorrecao({ tipo: 'corrigir', alvo: 'errei era 45', campos: { carga: 45 } }, registros, acoes);
  assert.match(m, /Corrigi Puxada alta, 13\/10 \(terça\): 4x12 · 50 kg → 4x12 · 45 kg/);
  assert.deepEqual(feitos[0], ['atualizar', 'a', { carga: 45 }]);
  const v = await executarCorrecao({ tipo: 'corrigir', alvo: 'corrige o voador para 35 kg', campos: { carga: 35 } }, registros, acoes);
  assert.match(v, /Voador, 13\/10/);
  assert.deepEqual(feitos[1], ['atualizar', 'b', { carga: 35 }]);
});

test('correção: vários blocos pedem o número; apagar leva todos os blocos do dia', async () => {
  const feitos = [];
  const acoes = { apagar: async (id) => feitos.push(id), atualizar: async (id) => feitos.push(`u${id}`) };
  const registros = [reg('a', 'Voador', '2026-10-13', 30, 1, 12, 'bloco 1/2'), reg('b', 'Voador', '2026-10-13', 35, 1, 8, 'bloco 2/2')];
  assert.match(await executarCorrecao({ tipo: 'corrigir', alvo: 'corrige o voador', campos: { carga: 40 } }, registros, acoes), /2 blocos/);
  assert.equal(feitos.length, 0);
  assert.match(await executarCorrecao({ tipo: 'corrigir', alvo: 'corrige o bloco 2 do voador', campos: { carga: 40 }, bloco: 2 }, registros, acoes), /1x8 · 35 kg → 1x8 · 40 kg/);
  assert.deepEqual(feitos, ['ub']);
  assert.match(await executarCorrecao({ tipo: 'apagar_ultimo' }, registros, acoes), /Apaguei Voador.*lixeira/);
  assert.deepEqual(feitos, ['ub', 'a', 'b']);
});

test('correção: séries avulsas do mesmo exercício no mesmo dia não são "blocos": mexe só na mais recente', async () => {
  const feitos = [];
  const acoes = { apagar: async (id) => feitos.push(['apagar', id]), atualizar: async (id, c) => feitos.push(['atualizar', id, c]) };
  const registros = [reg('novo', 'Voador', '2026-10-13', 35, 1, 8), reg('velho', 'Voador', '2026-10-13', 30, 1, 12)];
  assert.match(await executarCorrecao({ tipo: 'corrigir', alvo: 'errei era 40', campos: { carga: 40 } }, registros, acoes), /1x8 · 35 kg → 1x8 · 40 kg/);
  assert.match(await executarCorrecao({ tipo: 'apagar_ultimo' }, registros, acoes), /Apaguei Voador.*1x8 · 35 kg\./);
  assert.deepEqual(feitos, [['atualizar', 'novo', { carga: 40 }], ['apagar', 'novo']]);
});
