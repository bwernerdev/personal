// Teste das rotas da API no modo de teste local (sem Notion, sem rede).
// Usa um arquivo temporário no lugar de data/treinos.local.json. Rodar com:  node --test
import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pasta = mkdtempSync(join(tmpdir(), 'personal-teste-'));
const arquivo = join(pasta, 'treinos.json');
process.env.TREINOS_LOCAL = arquivo; // antes de importar o store
delete process.env.NOTION_TOKEN;
delete process.env.VERCEL;
delete process.env.APP_CODE;

const { default: chat } = await import('../api/chat.js');
const { default: dia } = await import('../api/dia.js');
const { default: historico } = await import('../api/historico.js');
const { default: apagar } = await import('../api/apagar.js');
const { hojeSP, somarDias } = await import('./datas.js');

beforeEach(() => rmSync(arquivo, { force: true }));
after(() => rmSync(pasta, { recursive: true, force: true }));

async function chamar(rota, { metodo = 'POST', body, query, headers = {} } = {}) {
  const res = {
    status(c) {
      res.codigo = c;
      return res;
    },
    json(o) {
      res.corpo = o;
      return res;
    },
    setHeader() {},
  };
  await rota({ method: metodo, headers, body, query }, res);
  return { status: res.codigo, corpo: res.corpo };
}

const enviar = (texto, extra = {}) => chamar(chat, { body: { texto, ...extra } });
const doExercicio = async (exercicio) => (await chamar(historico, { metodo: 'GET', query: { exercicio } })).corpo.registros;

test('registra, devolve ids e mostra o que foi feito antes na vez seguinte', async () => {
  const primeiro = await enviar('peito: inc 24 5x10');
  assert.equal(primeiro.corpo.status, 'ok');
  assert.equal(primeiro.corpo.registros[0].anterior, null);
  assert.match(primeiro.corpo.registros[0].id, /^local-/);

  const segundo = await enviar('ontem peito: inc 22 5x10');
  assert.equal(segundo.corpo.status, 'ok');
  assert.equal(segundo.corpo.registros[0].anterior.carga, 24);
});

test('texto repetido não grava duas vezes; "forcar" grava mesmo assim', async () => {
  await enviar('peito: inc 24 5x10');
  const repetido = await enviar('peito: inc 24 5x10');
  assert.equal(repetido.corpo.status, 'duplicado');
  assert.equal((await doExercicio('Supino inclinado halter')).length, 1);

  const forcado = await enviar('peito: inc 24 5x10', { forcar: true });
  assert.equal(forcado.corpo.status, 'ok');
  assert.equal((await doExercicio('Supino inclinado halter')).length, 2);

  const outraCarga = await enviar('peito: inc 26 5x10');
  assert.equal(outraCarga.corpo.status, 'ok'); // número diferente não é duplicado
});

test('faltando informação pergunta e não grava nada', async () => {
  const r = await enviar('peito: inc 24, cross 15 4x12');
  assert.equal(r.corpo.status, 'precisa_resposta');
  assert.equal((await doExercicio('Crossover (polia alta)')).length, 0);
});

test('desfazer apaga o registro; id inválido ou inexistente dá erro', async () => {
  const { corpo } = await enviar('peito: inc 24 5x10');
  const id = corpo.registros[0].id;

  const ruim = await chamar(apagar, { body: { id: '../x' } });
  assert.equal(ruim.status, 500);
  assert.match(ruim.corpo.erro, /inválido/);
  const naoExiste = await chamar(apagar, { body: { id: 'local-00000000' } });
  assert.match(naoExiste.corpo.erro, /não encontrado/);

  const apagado = await chamar(apagar, { body: { id } });
  assert.deepEqual(apagado.corpo, { ok: true });
  assert.equal((await doExercicio('Supino inclinado halter')).length, 0);
});

test('cargas diferentes viram blocos e o treino do dia mostra todos na ordem', async () => {
  const r = await enviar('costas: puxada 50x12 50x12 45x10');
  assert.equal(r.corpo.status, 'ok');
  assert.equal(r.corpo.registros.length, 2);

  const { corpo } = await chamar(dia, { metodo: 'GET', query: { treino: 'Costas/Bíceps' } });
  const puxada = corpo.exercicios.find((e) => e.exercicio === 'Puxada alta');
  assert.deepEqual(puxada.ultimo.registros.map((x) => [x.carga, x.series]), [[50, 2], [45, 1]]);
});

test('"hoje" informado pelo celular vale para "ontem" (registro guardado sem internet)', async () => {
  const digitadoEm = somarDias(hojeSP(), -10);
  const r = await enviar('ontem peito: inc 24 5x10', { hoje: digitadoEm });
  assert.equal(r.corpo.registros[0].data, somarDias(digitadoEm, -1));

  const velho = await enviar('peito: cross 15 4x12', { hoje: somarDias(hojeSP(), -90) });
  assert.equal(velho.corpo.registros[0].data, hojeSP()); // mais de 30 dias: ignora
});

test('com APP_CODE, código errado 10 vezes bloqueia o endereço (429); o certo passa', async () => {
  process.env.APP_CODE = 'codigo-de-teste';
  try {
    const ip = { 'x-forwarded-for': '10.0.0.1' };
    const semCodigo = await chamar(historico, { metodo: 'GET', headers: ip });
    assert.equal(semCodigo.status, 401);
    for (let i = 0; i < 9; i++) await chamar(historico, { metodo: 'GET', headers: { ...ip, 'x-codigo': 'errado' } });
    const bloqueado = await chamar(historico, { metodo: 'GET', headers: { ...ip, 'x-codigo': 'codigo-de-teste' } });
    assert.equal(bloqueado.status, 429);

    const outro = await chamar(historico, { metodo: 'GET', headers: { 'x-forwarded-for': '10.0.0.2', 'x-codigo': 'codigo-de-teste' } });
    assert.equal(outro.status, 200);
  } finally {
    delete process.env.APP_CODE;
  }
});
