// Estatísticas calculadas, memória ("lembre que..."), busca no histórico, busca do Google e exemplos da reescrita.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resumoCalculado, estatisticasDoExercicio } from './estatisticas.js';
import { comandoDeMemoria, executarMemoria } from './memoria.js';
import { buscarRegistros, perguntar, exemplosParecidos, falaDosProprios, reiniciarLimite, montarSistemaConsulta } from './ia.js';

const registros = [
  { data: '2026-10-13', treino: 'Full body 2', exercicio: 'Voador', series: 1, reps: 12, carga: 30, obs: '' },
  { data: '2026-10-13', treino: 'Full body 2', exercicio: 'Voador', series: 1, reps: 8, carga: 35, obs: '' },
  { data: '2026-10-06', treino: 'Full body 2', exercicio: 'Voador', series: 3, reps: 10, carga: 30, obs: '' },
  { data: '2026-09-29', treino: 'Full body 1', exercicio: 'Puxada alta', series: 4, reps: 12, carga: 50, obs: '' },
];

test('estatísticas: vezes, último, recorde e variação saem do código, não da IA', () => {
  const e = estatisticasDoExercicio(registros.filter((r) => r.exercicio === 'Voador'));
  assert.equal(e.vezes, 2);
  assert.equal(e.ultimo.data, '2026-10-13');
  assert.deepEqual(e.recorde, { data: '2026-10-13', carga: 35 });
  assert.equal(e.variacao.dif, 5);
  const resumo = resumoCalculado(registros, '2026-10-14');
  assert.match(resumo, /Dias com treino registrado: 3/);
  assert.match(resumo, /Full body 2 2x/);
  assert.match(resumo, /Voador: 2x; último 13\/10: 1x12 30kg \+ 1x8 35kg; recorde 35kg \(13\/10\); variação 06\/10→13\/10: \+5kg/);
  assert.match(resumoCalculado([], '2026-10-14'), /não há registros/);
});

test('memória: reconhece guardar, listar e esquecer; não confunde com registro nem consulta', () => {
  assert.deepEqual(comandoDeMemoria('lembre que tenho dor no ombro direito'), { tipo: 'guardar', nota: 'tenho dor no ombro direito' });
  assert.deepEqual(comandoDeMemoria('Lembre-se: não posso agachar fundo'), { tipo: 'guardar', nota: 'não posso agachar fundo' });
  assert.deepEqual(comandoDeMemoria('o que você lembra de mim?'), { tipo: 'listar' });
  assert.deepEqual(comandoDeMemoria('esqueça 2'), { tipo: 'esquecer', alvo: 2 });
  assert.deepEqual(comandoDeMemoria('esqueça tudo'), { tipo: 'esquecer', alvo: 'tudo' });
  for (const t of ['supino 24 5x10', 'liste meu último full body 1', 'guarde isso', 'apague o registro do supino', 'lembrar']) assert.equal(comandoDeMemoria(t), null, t);
});

test('memória: guarda, não duplica, lista e esquece por número, texto ou tudo', async () => {
  let lista = [];
  const acoes = { guardar: async (nota) => lista.push({ id: `m${lista.length + 1}`, nota }), apagar: async (id) => (lista = lista.filter((m) => m.id !== id)) };
  assert.match(await executarMemoria({ tipo: 'guardar', nota: 'dor no ombro' }, lista, acoes), /Guardei/);
  assert.match(await executarMemoria({ tipo: 'guardar', nota: 'Dor no ombro' }, lista, acoes), /Já tinha/);
  await executarMemoria({ tipo: 'guardar', nota: 'meta: 80 kg no supino' }, lista, acoes);
  assert.match(await executarMemoria({ tipo: 'listar' }, lista, acoes), /1\. dor no ombro\n2\. meta: 80 kg/);
  assert.match(await executarMemoria({ tipo: 'esquecer', alvo: 'meta' }, lista, acoes), /Esqueci/);
  assert.equal(lista.length, 1);
  assert.match(await executarMemoria({ tipo: 'esquecer', alvo: 'tudo' }, lista, acoes), /Apaguei tudo/);
  assert.equal(lista.length, 0);
  assert.match(await executarMemoria({ tipo: 'listar' }, lista, acoes), /Ainda não guardei/);
});

test('buscar_registros: filtra por exercício, treino e datas, e limita', () => {
  assert.equal(buscarRegistros(registros, { exercicio: 'voad' }).total, 3);
  assert.equal(buscarRegistros(registros, { treino: 'full body 1' }).total, 1);
  assert.equal(buscarRegistros(registros, { desde: '2026-10-01' }).total, 3);
  assert.equal(buscarRegistros(registros, { ate: '2026-10-01' }).total, 1);
  assert.equal(buscarRegistros(registros, { exercicio: 'voador', limite: 1 }).registros.length, 1);
  assert.match(buscarRegistros(registros, { exercicio: 'puxada' }).registros[0], /2026-09-29 \| Full body 1 \| Puxada alta \| 4x12 \| 50kg/);
});

test('o prompt leva memórias, resumo calculado e o aviso da função; sem elas, nada disso', () => {
  const comTudo = montarSistemaConsulta([], registros, '2026-10-14', { memorias: ['dor no ombro'], resumo: 'RESUMO CALCULADO X', texto: true, ferramentas: true });
  assert.match(comTudo, /dor no ombro/);
  assert.match(comTudo, /RESUMO CALCULADO X/);
  assert.match(comTudo, /buscar_registros/);
  assert.match(comTudo, /sem JSON/);
  const simples = montarSistemaConsulta([], registros, '2026-10-14');
  assert.doesNotMatch(simples, /LEMBRAR|buscar_registros/);
  assert.match(simples, /Responda SEMPRE em JSON/);
});

test('pergunta geral x pergunta sobre os dados dela', () => {
  assert.equal(falaDosProprios('qual a diferença entre hipertrofia e força?', registros, []), false);
  assert.equal(falaDosProprios('qual foi meu último treino?', registros, []), true);
  assert.equal(falaDosProprios('e o voador?', registros, []), true);
});

function comGemini(buscarFalso, fn) {
  const antes = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'teste';
  reiniciarLimite();
  return fn().finally(() => {
    if (antes === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = antes;
  });
}
const resposta = (partes, extra = {}) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: partes }, ...extra }] }) });

test('pergunta geral usa a busca do Google e devolve texto puro', async () => {
  const corpos = [];
  const buscar = async (url, opcoes) => {
    corpos.push(JSON.parse(opcoes.body));
    return resposta([{ text: 'Hipertrofia é o aumento do músculo; força é a capacidade de gerar tensão.' }]);
  };
  const r = await comGemini(buscar, () => perguntar({ texto: 'qual a diferença entre hipertrofia e força?', rotina: [], registros, hoje: '2026-10-14', memorias: ['dor no ombro'], buscar }));
  assert.match(r.mensagem, /Hipertrofia é o aumento/);
  assert.deepEqual(corpos[0].tools, [{ google_search: {} }]);
  assert.match(corpos[0].systemInstruction.parts[0].text, /dor no ombro/);
});

test('pergunta sobre os dados: a IA chama buscar_registros e responde com o resultado', async () => {
  const corpos = [];
  const buscar = async (url, opcoes) => {
    const corpo = JSON.parse(opcoes.body);
    corpos.push(corpo);
    if (corpos.length === 1) return resposta([{ functionCall: { name: 'buscar_registros', args: { exercicio: 'puxada' } }, thoughtSignature: 'abc' }]);
    return resposta([{ text: 'Puxada alta: 4x12 com 50 kg em 29/09.' }]);
  };
  const r = await comGemini(buscar, () => perguntar({ texto: 'qual foi minha última puxada alta?', rotina: [], registros, hoje: '2026-10-14', buscar }));
  assert.match(r.mensagem, /Puxada alta: 4x12/);
  assert.equal(corpos.length, 2);
  assert.ok(corpos[0].tools[0].functionDeclarations);
  const volta = corpos[1].contents;
  assert.equal(volta[1].role, 'model');
  assert.equal(volta[1].parts[0].thoughtSignature, 'abc'); // devolvido como veio
  assert.equal(volta[2].parts[0].functionResponse.response.total, 1);
  assert.match(volta[2].parts[0].functionResponse.response.registros[0], /Puxada alta \| 4x12 \| 50kg/);
});

test('se o caminho com ferramentas falha, cai no caminho simples (JSON com os registros)', async () => {
  let chamadas = 0;
  const buscar = async (url, opcoes) => {
    chamadas++;
    const corpo = JSON.parse(opcoes.body);
    if (corpo.tools) return { ok: false, status: 400, text: async () => 'ferramenta recusada' };
    return resposta([{ text: JSON.stringify({ acao: 'responder', mensagem: 'Voador: 1x8 · 35 kg em 13/10' }) }]);
  };
  const r = await comGemini(buscar, () => perguntar({ texto: 'qual foi meu último voador?', rotina: [], registros, hoje: '2026-10-14', buscar }));
  assert.match(r.mensagem, /Voador: 1x8/);
  assert.equal(chamadas, 2);
});

test('exemplos da reescrita: frases reais parecidas com a mensagem, sem treino nem data', () => {
  const ex = exemplosParecidos('fiz supino inclinado com 24 quilos cinco séries de dez');
  assert.ok(ex.length > 0 && ex.length <= 6);
  assert.match(ex[0], /^Mensagem: ".*"\n\{"acao":"registrar","texto":".* \d+(,\d+)? \d+x\d+/);
  assert.deepEqual(exemplosParecidos('xyz'), []);
});

import { conferirResposta, limparCache, PEDE_SUGESTAO, pareceConsulta } from './ia.js';

test('conferência: carga ou NxM que não existe nos dados reprova; os que existem (e diferenças) passam', () => {
  const ctx = { registros, resumo: resumoCalculado(registros, '2026-10-14'), entradas: 'qual meu voador?' };
  assert.equal(conferirResposta('Voador: 1x8 · 35 kg e 1x12 · 30 kg em 13/10', ctx).ok, true);
  assert.equal(conferirResposta('Subiu +5 kg desde a semana passada (30 kg → 35 kg)', ctx).ok, true); // 5 = diferença entre cargas
  const ruim = conferirResposta('Voador: 3x12 · 42,5 kg', ctx);
  assert.equal(ruim.ok, false);
  assert.deepEqual(ruim.problemas, ['42,5 kg', '3x12']);
});

test('resposta da IA com número inventado nunca chega ao usuário; a boa fica no cache', async () => {
  limparCache();
  let chamadas = 0;
  const buscar = async (url, opcoes) => {
    chamadas++;
    const corpo = JSON.parse(opcoes.body);
    const texto = corpo.generationConfig?.responseMimeType ? JSON.stringify({ acao: 'responder', mensagem: 'Voador: 1x8 · 99 kg' }) : 'Voador: 1x8 · 99 kg';
    return resposta([{ text: texto }]);
  };
  const ruim = await comGemini(buscar, () => perguntar({ texto: 'qual foi meu último voador?', rotina: [], registros, hoje: '2026-10-14', buscar }));
  assert.match(ruim.mensagem, /Não consegui confirmar os números/);

  const boa = async () => resposta([{ text: 'Voador: 1x8 · 35 kg e 1x12 · 30 kg' }]);
  const a = await comGemini(boa, () => perguntar({ texto: 'qual foi meu último voador mesmo?', rotina: [], registros, hoje: '2026-10-14', buscar: boa }));
  assert.match(a.mensagem, /35 kg/);
  let nova = 0;
  const contar = async () => { nova++; return resposta([{ text: 'outra' }]); };
  const b = await comGemini(contar, () => perguntar({ texto: 'qual foi meu último voador mesmo?', rotina: [], registros, hoje: '2026-10-14', buscar: contar }));
  assert.equal(nova, 0); // veio do cache
  assert.equal(b.mensagem, a.mensagem);
  assert.ok(chamadas >= 2);
});

test('sugestão de carga: quem pede recebe números novos, sem a conferência; e vira pergunta para a IA', () => {
  for (const t of ['quanto devo colocar no supino?', 'sugira uma carga para o voador', 'devo aumentar a carga da puxada?']) {
    assert.equal(PEDE_SUGESTAO.test(t.normalize('NFD').replace(/\p{Diacritic}/gu, '')), true, t);
    assert.equal(pareceConsulta(t), true, t);
  }
  assert.match(montarSistemaConsulta([], [], '2026-10-14'), /Só sugira carga ou progressão quando a pessoa PEDIR/);
});
