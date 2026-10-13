// Rodar com:  node --test
// Testa a ajuda do Claude SEM chamar a API de verdade (fetch simulado).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { habilitado, sugerir, reiniciarLimite, numerosDoTexto, numerosPermitidos, validarSugestao, montarSistema, diaDaSemana } from './claude.js';

const rotina = JSON.parse(readFileSync(new URL('../data/rotina.json', import.meta.url), 'utf8'));
const HOJE = '2026-10-13'; // terça-feira

afterEach(() => {
  reiniciarLimite();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.LLM_LIMITE_POR_HORA;
});

// Resposta no formato da API: bloco de raciocínio (vazio) + bloco de texto com o JSON pedido.
const resposta = (saida, extra = {}) => ({
  status: 200,
  ok: true,
  json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(saida) }], ...extra }),
});
const comChave = () => {
  process.env.ANTHROPIC_API_KEY = 'chave-de-teste';
};

test('números: ignora grau e marca do treino; aceita os escritos por extenso', () => {
  assert.deepEqual(numerosDoTexto('perna1: Leg press 45° 120 4x10, rosca 22,5x10'), [120, 4, 10, 22.5, 10]);
  const permitidos = numerosPermitidos('fiz vinte e quatro quilos, cinco séries de dez, 22,5 e cem');
  for (const n of [24, 20, 4, 5, 10, 22.5, 100]) assert.ok(permitidos.has(n), `deveria permitir ${n}`);
  assert.ok(!permitidos.has(99));
});

test('validarSugestao recusa número que não está na mensagem', () => {
  assert.equal(validarSugestao('supino 24 kg, 5 séries de 10', 'peito: Supino inclinado halter 24 5x10').ok, true);
  assert.equal(validarSugestao('supino 24 kg, 5 séries de 10', 'peito: Supino inclinado halter 30 5x10').ok, false);
  assert.equal(validarSugestao('supino com vinte e quatro, cinco de dez', 'peito: Supino inclinado halter 24 5x10').ok, true);
  assert.equal(validarSugestao('qualquer', '').ok, false);
  assert.equal(validarSugestao('qualquer', 'x'.repeat(1001)).ok, false);
});

test('o prompt traz o catálogo da rotina, as regras e a data (sem a mensagem do usuário)', () => {
  const sistema = montarSistema(rotina);
  assert.match(sistema, /Peito\/Tríceps \(escreva "peito"\): .*Supino inclinado halter/);
  assert.match(sistema, /Leg press 45°/);
  assert.match(sistema, /NUNCA invente valores/);
  assert.equal(diaDaSemana(HOJE), 'terça-feira');
});

test('sem ANTHROPIC_API_KEY não chama nada', async () => {
  assert.equal(habilitado(), false);
  const buscar = async () => assert.fail('não deveria chamar a API');
  assert.equal(await sugerir({ texto: 'oi', rotina, hoje: HOJE, buscar }), null);
});

test('reescrita válida volta como texto; o pedido sai com chave, modelo e a mensagem protegida', async () => {
  comChave();
  let pedido;
  const buscar = async (url, opcoes) => {
    pedido = { url, opcoes, corpo: JSON.parse(opcoes.body) };
    return resposta({ acao: 'registrar', texto: 'peito: Supino inclinado halter 24 5x10' });
  };
  const r = await sugerir({ texto: 'hoje fiz supino inclinado com 24 quilos, 5 séries de 10', rotina, hoje: HOJE, buscar });
  assert.deepEqual(r, { tipo: 'texto', texto: 'peito: Supino inclinado halter 24 5x10' });

  assert.equal(pedido.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(pedido.opcoes.headers['x-api-key'], 'chave-de-teste');
  assert.equal(pedido.opcoes.headers['anthropic-version'], '2023-06-01');
  assert.equal(pedido.corpo.model, 'claude-haiku-5-5'); // o mais barato
  assert.equal(pedido.corpo.output_config.format.type, 'json_schema');
  assert.equal(pedido.corpo.output_config.effort, 'low');
  assert.equal(pedido.corpo.fallbacks, undefined); // o Haiku 5.5 não tem fallback no servidor
  assert.equal(pedido.opcoes.headers['anthropic-beta'], undefined);
  assert.match(pedido.corpo.messages[0].content, /<mensagem>\nhoje fiz supino/);
  assert.equal('temperature' in pedido.corpo, false); // parâmetros de amostragem não existem neste modelo
});

test('ANTHROPIC_MODEL troca o modelo; com o Opus o pedido leva o "fallbacks"', async () => {
  comChave();
  process.env.ANTHROPIC_MODEL = 'claude-opus-5-5';
  let pedido;
  await sugerir({ texto: 'oi', rotina, hoje: HOJE, buscar: async (_u, o) => ((pedido = { corpo: JSON.parse(o.body), headers: o.headers }), resposta({ acao: 'nao_entendi', mensagem: 'x' })) });
  assert.equal(pedido.corpo.model, 'claude-opus-5-5');
  assert.equal(pedido.corpo.fallbacks, 'default');
  assert.equal(pedido.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
});

test('reescrita com número inventado é recusada (null) em vez de aceita', async () => {
  comChave();
  const buscar = async () => resposta({ acao: 'registrar', texto: 'peito: Supino inclinado halter 99 5x10' });
  assert.equal(await sugerir({ texto: 'fiz supino 24 5x10', rotina, hoje: HOJE, buscar }), null);
});

test('"não entendi" do Claude vira mensagem curta e limpa', async () => {
  comChave();
  const buscar = async () => resposta({ acao: 'nao_entendi', mensagem: 'Quais exercícios?\n\u0007' });
  assert.deepEqual(await sugerir({ texto: 'treinei', rotina, hoje: HOJE, buscar }), { tipo: 'nao_entendi', mensagem: 'Quais exercícios?' });
});

test('falhas (HTTP, recusa, JSON quebrado, rede, ação desconhecida) devolvem null sem estourar', async () => {
  comChave();
  const falhas = [
    async () => ({ status: 500, ok: false, json: async () => ({}) }),
    async () => resposta({ acao: 'registrar', texto: 'peito: x' }, { stop_reason: 'refusal' }),
    async () => resposta({ acao: 'registrar', texto: 'peito: x' }, { stop_reason: 'max_tokens' }),
    async () => ({ status: 200, ok: true, json: async () => ({ content: [{ type: 'text', text: '{quebrado' }] }) }),
    async () => {
      throw new TypeError('fetch failed');
    },
    async () => resposta({ acao: 'apagar_tudo' }),
  ];
  for (const buscar of falhas) assert.equal(await sugerir({ texto: 'fiz supino 24', rotina, hoje: HOJE, buscar }), null);
});

// Roda `sugerir` com a API devolvendo 400 nas primeiras `recusas` tentativas e aceitando depois.
// Devolve o resultado e o que cada tentativa levou (fallbacks, formato JSON estruturado, effort).
async function comRecusas(recusas) {
  const tentativas = [];
  const buscar = async (_url, opcoes) => {
    const corpo = JSON.parse(opcoes.body);
    tentativas.push({ fallbacks: corpo.fallbacks, formato: Boolean(corpo.output_config.format), effort: corpo.output_config.effort });
    return tentativas.length <= recusas ? { status: 400, ok: false, json: async () => ({}) } : resposta({ acao: 'registrar', texto: 'peito: Supino inclinado halter 24 5x10' });
  };
  const r = await sugerir({ texto: 'supino inclinado 24 5x10', rotina, hoje: HOJE, buscar });
  return { r, tentativas };
}

test('HTTP 400 no Opus: tenta sem "fallbacks" e, se preciso, sem o formato JSON estruturado', async () => {
  comChave();
  process.env.ANTHROPIC_MODEL = 'claude-opus-5-5';
  const { r, tentativas } = await comRecusas(2);
  assert.equal(r.tipo, 'texto');
  assert.deepEqual(tentativas, [
    { fallbacks: 'default', formato: true, effort: 'low' },
    { fallbacks: undefined, formato: true, effort: 'low' },
    { fallbacks: undefined, formato: false, effort: 'low' },
  ]);
});

test('HTTP 400 no Haiku (padrão): nunca envia "fallbacks"; a 2ª tentativa tira o formato estruturado', async () => {
  comChave();
  const { r, tentativas } = await comRecusas(1);
  assert.equal(r.tipo, 'texto');
  assert.deepEqual(tentativas, [
    { fallbacks: undefined, formato: true, effort: 'low' },
    { fallbacks: undefined, formato: false, effort: 'low' },
  ]);
});

test('HTTP 400 em todas as tentativas: devolve null (o chat segue só com as regras)', async () => {
  comChave();
  const { r, tentativas } = await comRecusas(99);
  assert.equal(r, null);
  assert.equal(tentativas.length, 2); // Haiku: com e sem formato estruturado
});

test('saída cercada por bloco de código ainda é lida (quando o formato estruturado não foi usado)', async () => {
  comChave();
  const cercada = '```json\n{"acao":"registrar","texto":"peito: Supino inclinado halter 24 5x10"}\n```';
  const buscar = async () => ({ status: 200, ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: cercada }] }) });
  assert.deepEqual(await sugerir({ texto: 'supino inclinado 24 5x10', rotina, hoje: HOJE, buscar }), { tipo: 'texto', texto: 'peito: Supino inclinado halter 24 5x10' });
});

test('limite por hora: depois dele não chama mais a API', async () => {
  comChave();
  process.env.LLM_LIMITE_POR_HORA = '2';
  let chamadas = 0;
  const buscar = async () => (chamadas++, resposta({ acao: 'nao_entendi', mensagem: 'x' }));
  for (let i = 0; i < 5; i++) await sugerir({ texto: 'oi', rotina, hoje: HOJE, buscar });
  assert.equal(chamadas, 2); // a 3ª em diante nem chega à API
});
