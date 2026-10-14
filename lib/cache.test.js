import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCache } from './cache.js';
import { registrosParaConsulta } from './leitura.js';

test('cache: guarda pelo prazo, "fresco" ignora, limpar esquece, e erro não fica guardado', async () => {
  let agora = 0;
  const cache = criarCache(1000, () => agora);
  let chamadas = 0;
  const carregar = async () => ++chamadas;
  assert.equal(await cache.obter('a', carregar), 1);
  assert.equal(await cache.obter('a', carregar), 1); // dentro do prazo
  agora = 999;
  assert.equal(await cache.obter('a', carregar), 1);
  agora = 1000;
  assert.equal(await cache.obter('a', carregar), 2); // venceu
  assert.equal(await cache.obter('a', carregar, { fresco: true }), 3);
  cache.limpar('a');
  assert.equal(await cache.obter('a', carregar), 4);
  cache.limpar();
  assert.equal(await cache.obter('a', carregar), 5);

  let tentativas = 0;
  await assert.rejects(cache.obter('erro', async () => { tentativas++; throw new Error('rede'); }));
  assert.equal(await cache.obter('erro', async () => { tentativas++; return 'ok'; }), 'ok'); // não guardou o erro
  assert.equal(tentativas, 2);
});

test('cache: duas leituras ao mesmo tempo dividem uma só chamada', async () => {
  const cache = criarCache(1000);
  let chamadas = 0;
  const lento = () => new Promise((r) => setTimeout(() => r(++chamadas), 10));
  const [x, y] = await Promise.all([cache.obter('k', lento), cache.obter('k', lento)]);
  assert.deepEqual([x, y, chamadas], [1, 1, 1]);
});

const reg = (id, data, exercicio) => ({ id, data, exercicio, treino: 'Full body 1', criado: 0 });

test('leitura para consulta: histórico pequeno vem inteiro; grande vem parcial e soma o exercício citado', async () => {
  const rotina = [{ exercicio: 'Voador' }, { exercicio: 'Puxada alta' }];
  const recentes = [reg('a', '2026-10-13', 'Puxada alta'), reg('b', '2026-10-12', 'Puxada alta')];
  const antigos = [reg('c', '2025-01-05', 'Voador')];
  const listarTreinos = async (limite) => recentes.slice(0, limite);
  const listarTreinosDoExercicio = async (nome) => [...recentes, ...antigos].filter((r) => r.exercicio === nome);

  const inteiro = await registrosParaConsulta({ texto: 'qual meu voador?', rotina, listarTreinos, listarTreinosDoExercicio, limite: 5 });
  assert.deepEqual([inteiro.parcial, inteiro.registros.length], [false, 2]);

  const semCitar = await registrosParaConsulta({ texto: 'como foi meu treino?', rotina, listarTreinos, listarTreinosDoExercicio, limite: 2 });
  assert.deepEqual([semCitar.parcial, semCitar.registros.length], [true, 2]);

  const citando = await registrosParaConsulta({ texto: 'qual foi meu último voador?', rotina, listarTreinos, listarTreinosDoExercicio, limite: 2 });
  assert.equal(citando.parcial, true);
  assert.deepEqual(citando.registros.map((r) => r.id), ['a', 'b', 'c']); // o voador antigo veio junto, em ordem
});
