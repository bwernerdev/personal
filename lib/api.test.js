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

// ---------- ajuda do Claude (fetch simulado; nunca chama a API de verdade) ----------

const { reiniciarLimite } = await import('./claude.js');

async function comClaudeSimulado(saida, corpo) {
  const fetchOriginal = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = 'chave-de-teste';
  reiniciarLimite();
  let chamadas = 0;
  globalThis.fetch = async () => {
    chamadas++;
    if (saida instanceof Error) throw saida;
    return { status: 200, ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(saida) }] }) };
  };
  try {
    return { resultado: await corpo(), chamadas: () => chamadas };
  } finally {
    globalThis.fetch = fetchOriginal;
    delete process.env.ANTHROPIC_API_KEY;
  }
}

const FRASE = 'hoje fiz supino inclinado com 24 quilos 5 séries de 10';

test('Claude: texto que as regras não entendem vira sugestão; nada é gravado até confirmar', async () => {
  const sugestao = { acao: 'registrar', texto: 'hoje peito: Supino inclinado halter 24 5x10' };
  const { resultado, chamadas } = await comClaudeSimulado(sugestao, async () => {
    const r = await enviar(FRASE);
    assert.equal(r.corpo.status, 'sugestao');
    assert.equal(r.corpo.origem, 'ia');
    assert.equal(r.corpo.texto_sugerido, sugestao.texto);
    assert.equal(r.corpo.pronto, true);
    assert.deepEqual(r.corpo.registros.map((x) => [x.exercicio, x.carga, x.series, x.reps]), [['Supino inclinado halter', 24, 5, 10]]);
    assert.equal((await doExercicio('Supino inclinado halter')).length, 0); // ainda não gravou
    return r;
  });
  assert.equal(chamadas(), 1);
  assert.equal(resultado.corpo.status, 'sugestao');

  // O usuário toca em "Registrar assim": o texto reescrito vai pelo caminho normal de regras (sem Claude).
  const confirmado = await enviar('hoje peito: Supino inclinado halter 24 5x10');
  assert.equal(confirmado.corpo.status, 'ok');
  assert.equal((await doExercicio('Supino inclinado halter')).length, 1);
});

test('Claude: reescrita com número inventado é descartada e o chat responde só com as regras', async () => {
  const { resultado } = await comClaudeSimulado({ acao: 'registrar', texto: 'hoje peito: Supino inclinado halter 99 5x10' }, () => enviar(FRASE));
  assert.equal(resultado.corpo.status, 'precisa_resposta');
  assert.ok(resultado.corpo.erros.length > 0);
  assert.equal((await doExercicio('Supino inclinado halter')).length, 0);
});

test('Claude: reescrita com exercício fora da rotina é descartada', async () => {
  const { resultado } = await comClaudeSimulado({ acao: 'registrar', texto: 'peito: Rosca zottman 24 5x10' }, () => enviar(FRASE));
  assert.equal(resultado.corpo.status, 'precisa_resposta');
});

test('Claude: falta de carga continua sendo pergunta das regras (sugestão não pronta, nada gravado)', async () => {
  const { resultado } = await comClaudeSimulado({ acao: 'registrar', texto: 'peito: Supino inclinado halter 5x10' }, () => enviar('fiz o supino inclinado de cinco séries de dez'));
  assert.equal(resultado.corpo.status, 'sugestao');
  assert.equal(resultado.corpo.pronto, false);
  assert.equal(resultado.corpo.pendentes[0].tipo, 'sem_carga');
  assert.equal((await doExercicio('Supino inclinado halter')).length, 0);
});

test('Claude: "não entendi" volta com a ajuda e sem gravar', async () => {
  const { resultado } = await comClaudeSimulado({ acao: 'nao_entendi', mensagem: 'Quais exercícios você fez?' }, () => enviar('treinei bastante hoje'));
  assert.equal(resultado.corpo.status, 'precisa_resposta');
  assert.equal(resultado.corpo.ajuda, 'Quais exercícios você fez?');
});

test('Claude: não é chamado quando as regras resolvem, perguntam carga ou têm dúvida entre exercícios', async () => {
  const { chamadas } = await comClaudeSimulado({ acao: 'nao_entendi', mensagem: 'x' }, async () => {
    assert.equal((await enviar('peito: inc 24 5x10')).corpo.status, 'ok'); // regras entendem
    assert.equal((await enviar('peito: cross 5x10')).corpo.status, 'precisa_resposta'); // falta carga
    assert.equal((await enviar('braço: rosca 12 3x12')).corpo.pendentes[0].tipo, 'ambiguo_exercicio'); // dúvida
  });
  assert.equal(chamadas(), 0);
});

test('Claude: erro de rede ou sem chave não muda o comportamento antigo', async () => {
  const { resultado } = await comClaudeSimulado(new TypeError('fetch failed'), () => enviar(FRASE));
  assert.equal(resultado.corpo.status, 'precisa_resposta');
  const semChave = await enviar(FRASE);
  assert.equal(semChave.corpo.status, 'precisa_resposta');
  assert.equal(semChave.corpo.ajuda, undefined);
});
