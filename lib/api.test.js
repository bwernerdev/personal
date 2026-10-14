// Teste das rotas da API no modo de teste local (sem Notion, sem rede).
// Usa um arquivo temporário no lugar de data/treinos.local.json. Rodar com:  node --test
import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pasta = mkdtempSync(join(tmpdir(), 'personal-teste-'));
const arquivo = join(pasta, 'treinos.json');
const arquivoFrases = join(pasta, 'frases.json');
process.env.TREINOS_LOCAL = arquivo; // antes de importar o store
process.env.FRASES_LOCAL = arquivoFrases;
delete process.env.NOTION_TOKEN;
delete process.env.VERCEL;
delete process.env.APP_CODE;

const { default: chat } = await import('../api/chat.js');
const { default: dia } = await import('../api/dia.js');
const { default: historico } = await import('../api/historico.js');
const { default: apagar } = await import('../api/apagar.js');
const { hojeSP, somarDias } = await import('./datas.js');

beforeEach(() => {
  rmSync(arquivo, { force: true });
  rmSync(arquivoFrases, { force: true });
});
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

// ---------- ajuda da IA (Gemini simulado; nenhum teste chama a API de verdade) ----------

const { reiniciarLimite } = await import('./ia.js');

async function comIASimulada(saida, corpo) {
  const fetchOriginal = globalThis.fetch;
  process.env.GEMINI_API_KEY = 'chave-de-teste';
  reiniciarLimite();
  let chamadas = 0;
  globalThis.fetch = async () => {
    chamadas++;
    if (saida instanceof Error) throw saida;
    return { status: 200, ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(saida) }] }, finishReason: 'STOP' }] }) };
  };
  try {
    return { resultado: await corpo(), chamadas: () => chamadas };
  } finally {
    globalThis.fetch = fetchOriginal;
    delete process.env.GEMINI_API_KEY;
  }
}

// Frase que as regras NÃO entendem (não diz qual exercício): só nela a IA é chamada.
const FRASE = 'o primeiro exercício da rotina, 24 quilos, 5 séries de 10';

test('IA: texto que as regras não entendem vira sugestão; nada é gravado até confirmar', async () => {
  const sugestao = { acao: 'registrar', texto: 'hoje peito: Supino inclinado halter 24 5x10' };
  const { resultado, chamadas } = await comIASimulada(sugestao, async () => {
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

  // O usuário toca em "Registrar assim": o texto reescrito vai pelo caminho normal de regras (sem IA).
  const confirmado = await enviar('hoje peito: Supino inclinado halter 24 5x10');
  assert.equal(confirmado.corpo.status, 'ok');
  assert.equal((await doExercicio('Supino inclinado halter')).length, 1);
});

test('IA: reescrita com número inventado é descartada e o chat responde só com as regras', async () => {
  const { resultado } = await comIASimulada({ acao: 'registrar', texto: 'hoje peito: Supino inclinado halter 99 5x10' }, () => enviar(FRASE));
  assert.equal(resultado.corpo.status, 'precisa_resposta');
  assert.ok(resultado.corpo.erros.length > 0);
  assert.equal((await doExercicio('Supino inclinado halter')).length, 0);
});

test('IA: reescrita com exercício fora da rotina é descartada', async () => {
  const { resultado } = await comIASimulada({ acao: 'registrar', texto: 'peito: Rosca zottman 24 5x10' }, () => enviar(FRASE));
  assert.equal(resultado.corpo.status, 'precisa_resposta');
});

test('IA: falta de carga continua sendo pergunta das regras (sugestão não pronta, nada gravado)', async () => {
  const { resultado } = await comIASimulada({ acao: 'registrar', texto: 'peito: Supino inclinado halter 5x10' }, () => enviar('o primeiro exercício da rotina, cinco séries de dez'));
  assert.equal(resultado.corpo.status, 'sugestao');
  assert.equal(resultado.corpo.pronto, false);
  assert.equal(resultado.corpo.pendentes[0].tipo, 'sem_carga');
  assert.equal((await doExercicio('Supino inclinado halter')).length, 0);
});

test('IA: "não entendi" volta com a ajuda e sem gravar', async () => {
  const { resultado } = await comIASimulada({ acao: 'nao_entendi', mensagem: 'Quais exercícios você fez?' }, () => enviar('treinei bastante hoje'));
  assert.equal(resultado.corpo.status, 'precisa_resposta');
  assert.equal(resultado.corpo.ajuda, 'Quais exercícios você fez?');
});

test('IA: não é chamado quando as regras resolvem, perguntam carga ou têm dúvida entre exercícios', async () => {
  const { chamadas } = await comIASimulada({ acao: 'nao_entendi', mensagem: 'x' }, async () => {
    assert.equal((await enviar('peito: inc 24 5x10')).corpo.status, 'ok'); // regras entendem
    assert.equal((await enviar('hoje fiz supino inclinado com vinte e seis quilos, cinco séries de dez e depois o crossover com 15 quilos, 4 de 12')).corpo.status, 'ok'); // linguagem natural: as regras também entendem
    assert.equal((await enviar('peito: cross 5x10')).corpo.status, 'precisa_resposta'); // falta carga
    assert.equal((await enviar('braço: rosca 12 3x12')).corpo.pendentes[0].tipo, 'ambiguo_exercicio'); // dúvida
  });
  assert.equal(chamadas(), 0);
});

test('IA: erro de rede ou sem chave não muda o comportamento antigo', async () => {
  const { resultado } = await comIASimulada(new TypeError('fetch failed'), () => enviar(FRASE));
  assert.equal(resultado.corpo.status, 'precisa_resposta');
  const semChave = await enviar(FRASE);
  assert.equal(semChave.corpo.status, 'precisa_resposta');
  assert.equal(semChave.corpo.ajuda, undefined);
});

// ---------- frases novas (o que as regras não resolvem fica guardado) ----------

const { listarFrases, marcarFrase } = await import('./store.js');

test('frase que as regras não entendem é guardada, e repetida soma em "vezes"', async () => {
  await enviar('treinei bastante hoje');
  await enviar('treinei bastante hoje');
  await enviar('fiz o mesmo treino de ontem');
  const lista = await listarFrases();
  assert.deepEqual(lista.map((f) => [f.frase, f.vezes, f.resultado]), [
    ['treinei bastante hoje', 2, 'Sem ajuda da IA'],
    ['fiz o mesmo treino de ontem', 1, 'Sem ajuda da IA'],
  ]);
  assert.match(lista[0].motivo, /Não achei/);
});

test('frase que as regras resolvem, perguntam carga ou têm dúvida entre exercícios NÃO é guardada', async () => {
  await enviar('hoje fiz supino inclinado com vinte e quatro quilos, cinco séries de dez');
  await enviar('peito: cross 5x10'); // falta carga: pergunta das regras
  await enviar('braço: rosca 12 3x12'); // dúvida entre exercícios: pergunta das regras
  assert.deepEqual(await listarFrases(), []);
});

test('palavra desconhecida no nome pede confirmação e a frase fica guardada para ensinar as regras', async () => {
  const r = await enviar('supino inclinado com halteres leves 24 5x10');
  assert.equal(r.corpo.pendentes[0].tipo, 'confirmar_exercicio');
  const [f] = await listarFrases();
  assert.equal(f.resultado, 'Pediu confirmação');
  assert.match(f.motivo, /leves/);
});

test('IA sugeriu: a frase fica guardada com a sugestão (e marcar como incluída tira da lista)', async () => {
  await comIASimulada({ acao: 'registrar', texto: 'hoje peito: Supino inclinado halter 24 5x10' }, () => enviar('o primeiro exercício da rotina, 24 quilos, 5 séries de 10'));
  const [f] = await listarFrases();
  assert.equal(f.resultado, 'IA sugeriu');
  assert.equal(f.sugestao, 'hoje peito: Supino inclinado halter 24 5x10');

  await marcarFrase(f.id, { obs: 'regra criada' });
  assert.deepEqual(await listarFrases(), []);
  const incluidas = await listarFrases({ incluidas: true });
  assert.equal(incluidas[0].obs, 'regra criada');
});

test('frase que reaparece depois de incluída volta para a lista de pendentes', async () => {
  await enviar('treinei bastante hoje');
  const [f] = await listarFrases();
  await marcarFrase(f.id);
  await enviar('treinei bastante hoje');
  const [volta] = await listarFrases();
  assert.equal(volta.vezes, 2);
});

test('falha ao guardar a frase não atrapalha a resposta do chat', async () => {
  // aponta para um arquivo impossível de gravar: o chat tem de responder normalmente
  const { default: chatLocal } = await import('../api/chat.js');
  const original = process.env.FRASES_LOCAL;
  // O store já resolveu o caminho ao carregar; simulamos falha apagando a pasta temporária.
  rmSync(pasta, { recursive: true, force: true });
  try {
    const res = { status(c) { res.codigo = c; return res; }, json(o) { res.corpo = o; return res; }, setHeader() {} };
    await chatLocal({ method: 'POST', headers: {}, body: { texto: 'treinei bastante hoje' } }, res);
    assert.equal(res.codigo, 200);
    assert.equal(res.corpo.status, 'precisa_resposta');
  } finally {
    process.env.FRASES_LOCAL = original;
  }
});

test('recorde de carga: só quando passa de tudo que já foi registrado no exercício', async () => {
  mkdirSync(pasta, { recursive: true }); // o teste anterior apaga a pasta temporária
  const primeiro = await enviar('ontem peito: inc 24 5x10');
  assert.equal(primeiro.corpo.registros[0].recorde, false); // primeira vez: não há o que superar
  const maior = await enviar('peito: inc 26 5x10');
  assert.equal(maior.corpo.registros[0].recorde, true);
  const menor = await enviar('peito: inc 20 5x10');
  assert.equal(menor.corpo.registros[0].recorde, false);
});

test('chat: "errei, era 45" corrige o último registro; "apaga o último" apaga e diz o que foi', async () => {
  mkdirSync(pasta, { recursive: true });
  await enviar('peito: inc 24 5x10');
  const corrigido = await enviar('errei, era 22');
  assert.equal(corrigido.corpo.status, 'resposta');
  assert.match(corrigido.corpo.mensagem, /Corrigi Supino inclinado halter.*5x10 · 24 kg → 5x10 · 22 kg/);
  assert.equal((await doExercicio('Supino inclinado halter'))[0].carga, 22);
  const apagado = await enviar('apaga o último');
  assert.match(apagado.corpo.mensagem, /Apaguei Supino inclinado halter/);
  assert.equal((await doExercicio('Supino inclinado halter')).length, 0);
  assert.match((await enviar('desfaz')).corpo.mensagem, /Ainda não há registros/);
});
