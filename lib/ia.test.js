// Rodar com:  node --test
// Testa a ajuda da IA (Gemini e Claude) SEM chamar nenhuma API de verdade (fetch simulado).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { habilitado, provedorAtual, sugerir, reiniciarLimite, numerosDoTexto, numerosPermitidos, validarSugestao, montarSistema, diaDaSemana } from './ia.js';

const rotina = JSON.parse(readFileSync(new URL('../data/rotina.json', import.meta.url), 'utf8'));
const HOJE = '2026-10-13'; // terça-feira
const VARIAVEIS = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'LLM_PROVIDER', 'LLM_LIMITE_POR_HORA'];

afterEach(() => {
  reiniciarLimite();
  for (const v of VARIAVEIS) delete process.env[v];
});

// Respostas no formato de cada API.
const respostaGemini = (saida, candidato = {}) => ({
  status: 200,
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text: 'raciocínio', thought: true }, { text: JSON.stringify(saida) }] }, finishReason: 'STOP', ...candidato }] }),
});
const respostaClaude = (saida, extra = {}) => ({
  status: 200,
  ok: true,
  json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(saida) }], ...extra }),
});
const recusa400 = { status: 400, ok: false, json: async () => ({}), text: async () => 'parâmetro inválido' };
const comGemini = () => {
  process.env.GEMINI_API_KEY = 'chave-gemini-de-teste';
};
const comClaude = () => {
  process.env.ANTHROPIC_API_KEY = 'chave-claude-de-teste';
};
const REESCRITA = { acao: 'registrar', texto: 'peito: Supino inclinado halter 24 5x10' };
const FRASE = 'o primeiro exercício da rotina, 24 quilos, 5 séries de 10';

// ---------- números, prompt, validação (iguais para qualquer provedor) ----------

test('números: ignora grau e marca do treino; aceita os escritos por extenso (inclusive "e meio")', () => {
  assert.deepEqual(numerosDoTexto('perna1: Leg press 45° 120 4x10, rosca 22,5x10'), [120, 4, 10, 22.5, 10]);
  const permitidos = numerosPermitidos('fiz vinte e quatro quilos, cinco séries de dez, 22,5, cem e vinte e dois e meio');
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

test('o prompt traz o catálogo da rotina, as regras e a data', () => {
  const sistema = montarSistema(rotina);
  assert.match(sistema, /Peito\/Tríceps \(escreva "peito"\): .*Supino inclinado halter/);
  assert.match(sistema, /Leg press 45°/);
  assert.match(sistema, /NUNCA invente valores/);
  assert.equal(diaDaSemana(HOJE), 'terça-feira');
});

// ---------- escolha do provedor ----------

test('sem nenhuma chave: ajuda desligada e nada é chamado', async () => {
  assert.equal(habilitado(), false);
  assert.equal(provedorAtual(), null);
  assert.equal(await sugerir({ texto: 'oi', rotina, hoje: HOJE, buscar: async () => assert.fail('não deveria chamar') }), null);
});

test('provedor: só Gemini, só Claude, os dois (vale o Gemini, grátis) e LLM_PROVIDER forçando', () => {
  comGemini();
  assert.equal(provedorAtual(), 'gemini');
  delete process.env.GEMINI_API_KEY;
  comClaude();
  assert.equal(provedorAtual(), 'anthropic');
  comGemini();
  assert.equal(provedorAtual(), 'gemini');
  process.env.LLM_PROVIDER = 'anthropic';
  assert.equal(provedorAtual(), 'anthropic');
  delete process.env.ANTHROPIC_API_KEY; // forçou um provedor sem chave: cai no que tem chave
  assert.equal(provedorAtual(), 'gemini');
  process.env.LLM_PROVIDER = 'inventado';
  assert.equal(provedorAtual(), 'gemini');
});

// ---------- Gemini ----------

test('Gemini: pedido com chave no cabeçalho (nunca na URL), instrução do sistema, JSON e mensagem protegida', async () => {
  comGemini();
  let pedido;
  const buscar = async (url, opcoes) => ((pedido = { url, opcoes, corpo: JSON.parse(opcoes.body) }), respostaGemini(REESCRITA));
  const r = await sugerir({ texto: 'hoje fiz supino inclinado com 24 quilos, 5 séries de 10', rotina, hoje: HOJE, buscar });
  assert.deepEqual(r, { tipo: 'texto', texto: 'peito: Supino inclinado halter 24 5x10' });

  assert.equal(pedido.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
  assert.equal(pedido.opcoes.headers['x-goog-api-key'], 'chave-gemini-de-teste');
  assert.ok(!pedido.url.includes('chave-gemini'), 'a chave não pode ir na URL');
  assert.match(pedido.corpo.systemInstruction.parts[0].text, /NUNCA invente valores/);
  assert.match(pedido.corpo.contents[0].parts[0].text, /<mensagem>\nhoje fiz supino/);
  const geracao = pedido.corpo.generationConfig;
  assert.equal(geracao.responseMimeType, 'application/json');
  assert.equal(geracao.responseSchema.type, 'OBJECT');
  assert.equal(geracao.temperature, 0);
});

test('GEMINI_MODEL troca o modelo', async () => {
  comGemini();
  process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';
  let url;
  await sugerir({ texto: 'oi', rotina, hoje: HOJE, buscar: async (u) => ((url = u), respostaGemini({ acao: 'nao_entendi', mensagem: 'x' })) });
  assert.match(url, /models\/gemini-3\.5-flash-lite:generateContent$/);
});

test('Gemini: modelo inexistente (404) ou sem cota (429) passa para o próximo; modelo fixado não tenta outros', async () => {
  comGemini();
  const erro = (status) => ({ status, ok: false, json: async () => ({}), text: async () => 'x' });
  const nomeDoModelo = (url) => url.match(/models\/([^:]+):/)[1];

  const usados = [];
  const buscar = async (url) => (usados.push(nomeDoModelo(url)), usados.length === 1 ? erro(404) : usados.length === 2 ? erro(429) : respostaGemini(REESCRITA));
  assert.equal((await sugerir({ texto: FRASE, rotina, hoje: HOJE, buscar })).tipo, 'texto');
  assert.deepEqual(usados, ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest']);

  assert.equal(await sugerir({ texto: FRASE, rotina, hoje: HOJE, buscar: async () => erro(404) }), null); // todos falham

  process.env.GEMINI_MODEL = 'so-este';
  const tentados = [];
  await sugerir({ texto: FRASE, rotina, hoje: HOJE, buscar: async (u) => (tentados.push(u), erro(404)) });
  assert.equal(tentados.length, 1);
});

test('Gemini: partes de raciocínio ("thought") são ignoradas; só vale o texto da resposta', async () => {
  comGemini();
  const r = await sugerir({ texto: FRASE, rotina, hoje: HOJE, buscar: async () => respostaGemini(REESCRITA) });
  assert.equal(r.tipo, 'texto');
});

test('Gemini: bloqueio de segurança, MAX_TOKENS e resposta vazia devolvem null', async () => {
  comGemini();
  const casos = [
    async () => respostaGemini(REESCRITA, { finishReason: 'SAFETY' }),
    async () => respostaGemini(REESCRITA, { finishReason: 'MAX_TOKENS' }),
    async () => ({ status: 200, ok: true, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) }),
    async () => ({ status: 200, ok: true, json: async () => ({ candidates: [] }) }),
    async () => ({ status: 200, ok: true, json: async () => ({ candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] }) }),
  ];
  for (const buscar of casos) assert.equal(await sugerir({ texto: FRASE, rotina, hoje: HOJE, buscar }), null);
});

// Roda `sugerir` com a API devolvendo 400 nas primeiras `recusas` tentativas e aceitando depois.
async function comRecusas(recusas, resposta) {
  const tentativas = [];
  const buscar = async (_url, opcoes) => {
    const corpo = JSON.parse(opcoes.body);
    const g = corpo.generationConfig;
    tentativas.push(
      g
        ? { esquema: Boolean(g.responseSchema), json: Boolean(g.responseMimeType) }
        : { fallbacks: corpo.fallbacks, formato: Boolean(corpo.output_config.format), effort: corpo.output_config.effort },
    );
    return tentativas.length <= recusas ? recusa400 : resposta();
  };
  const r = await sugerir({ texto: FRASE, rotina, hoje: HOJE, buscar });
  return { r, tentativas };
}

test('Gemini com HTTP 400: tenta sem o esquema e, por fim, sem o modo JSON (prompt apenas)', async () => {
  comGemini();
  const { r, tentativas } = await comRecusas(2, () => respostaGemini(REESCRITA));
  assert.equal(r.tipo, 'texto');
  assert.deepEqual(tentativas, [
    { esquema: true, json: true },
    { esquema: false, json: true },
    { esquema: false, json: false },
  ]);
});

test('Gemini com HTTP 400 em tudo (ou 429/500): devolve null, o chat segue só com as regras', async () => {
  comGemini();
  const { r, tentativas } = await comRecusas(99, () => respostaGemini(REESCRITA));
  assert.equal(r, null);
  assert.equal(tentativas.length, 3);
  const limite = { status: 429, ok: false, json: async () => ({}), text: async () => 'cota' };
  assert.equal(await sugerir({ texto: FRASE, rotina, hoje: HOJE, buscar: async () => limite }), null);
});

// ---------- Claude (opcional) ----------

test('Claude: modelo barato por padrão, sem "fallbacks"; com o Opus o pedido leva o "fallbacks"', async () => {
  comClaude();
  let pedido;
  const buscar = async (url, opcoes) => ((pedido = { url, opcoes, corpo: JSON.parse(opcoes.body) }), respostaClaude(REESCRITA));
  const r = await sugerir({ texto: 'supino inclinado 24 quilos, 5 séries de 10', rotina, hoje: HOJE, buscar });
  assert.equal(r.tipo, 'texto');
  assert.equal(pedido.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(pedido.opcoes.headers['x-api-key'], 'chave-claude-de-teste');
  assert.equal(pedido.corpo.model, 'claude-haiku-5-5');
  assert.equal(pedido.corpo.output_config.format.type, 'json_schema');
  assert.equal(pedido.corpo.fallbacks, undefined);
  assert.equal('temperature' in pedido.corpo, false);

  process.env.ANTHROPIC_MODEL = 'claude-opus-5-5';
  await sugerir({ texto: 'oi', rotina, hoje: HOJE, buscar });
  assert.equal(pedido.corpo.model, 'claude-opus-5-5');
  assert.equal(pedido.corpo.fallbacks, 'default');
  assert.equal(pedido.opcoes.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
});

test('Claude com HTTP 400 no Opus: sem "fallbacks" e, se preciso, sem o formato; no Haiku nunca envia "fallbacks"', async () => {
  comClaude();
  process.env.ANTHROPIC_MODEL = 'claude-opus-5-5';
  let { r, tentativas } = await comRecusas(2, () => respostaClaude(REESCRITA));
  assert.equal(r.tipo, 'texto');
  assert.deepEqual(tentativas, [
    { fallbacks: 'default', formato: true, effort: 'low' },
    { fallbacks: undefined, formato: true, effort: 'low' },
    { fallbacks: undefined, formato: false, effort: 'low' },
  ]);

  delete process.env.ANTHROPIC_MODEL;
  ({ r, tentativas } = await comRecusas(1, () => respostaClaude(REESCRITA)));
  assert.equal(r.tipo, 'texto');
  assert.deepEqual(tentativas, [
    { fallbacks: undefined, formato: true, effort: 'low' },
    { fallbacks: undefined, formato: false, effort: 'low' },
  ]);
});

test('Claude: recusa de segurança e max_tokens devolvem null', async () => {
  comClaude();
  for (const stop of ['refusal', 'max_tokens']) {
    assert.equal(await sugerir({ texto: FRASE, rotina, hoje: HOJE, buscar: async () => respostaClaude(REESCRITA, { stop_reason: stop }) }), null);
  }
});

// ---------- comportamento comum a qualquer provedor ----------

test('reescrita com número inventado é recusada (null) em vez de aceita', async () => {
  for (const [liga, resposta] of [[comGemini, respostaGemini], [comClaude, respostaClaude]]) {
    liga();
    const buscar = async () => resposta({ acao: 'registrar', texto: 'peito: Supino inclinado halter 99 5x10' });
    assert.equal(await sugerir({ texto: 'fiz supino 24 5x10', rotina, hoje: HOJE, buscar }), null);
    reiniciarLimite();
    for (const v of VARIAVEIS) delete process.env[v];
  }
});

test('"não entendi" da IA vira mensagem curta e limpa', async () => {
  comGemini();
  const buscar = async () => respostaGemini({ acao: 'nao_entendi', mensagem: 'Quais exercícios?\n\u0007' });
  assert.deepEqual(await sugerir({ texto: 'treinei', rotina, hoje: HOJE, buscar }), { tipo: 'nao_entendi', mensagem: 'Quais exercícios?' });
});

test('falhas (HTTP, JSON quebrado, rede, ação desconhecida) devolvem null sem estourar', async () => {
  comGemini();
  const falhas = [
    async () => ({ status: 500, ok: false, json: async () => ({}), text: async () => 'erro' }),
    async () => ({ status: 200, ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{quebrado' }] }, finishReason: 'STOP' }] }) }),
    async () => {
      throw new TypeError('fetch failed');
    },
    async () => respostaGemini({ acao: 'apagar_tudo' }),
  ];
  for (const buscar of falhas) assert.equal(await sugerir({ texto: 'fiz supino 24', rotina, hoje: HOJE, buscar }), null);
});

test('saída cercada por bloco de código ainda é lida (quando o modo JSON não foi usado)', async () => {
  comGemini();
  const cercada = '```json\n{"acao":"registrar","texto":"peito: Supino inclinado halter 24 5x10"}\n```';
  const buscar = async () => ({ status: 200, ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: cercada }] }, finishReason: 'STOP' }] }) });
  assert.deepEqual(await sugerir({ texto: 'supino inclinado 24 5x10', rotina, hoje: HOJE, buscar }), { tipo: 'texto', texto: 'peito: Supino inclinado halter 24 5x10' });
});

test('limite por hora: depois dele não chama mais a API', async () => {
  comGemini();
  process.env.LLM_LIMITE_POR_HORA = '2';
  let chamadas = 0;
  const buscar = async () => (chamadas++, respostaGemini({ acao: 'nao_entendi', mensagem: 'x' }));
  for (let i = 0; i < 5; i++) await sugerir({ texto: 'oi', rotina, hoje: HOJE, buscar });
  assert.equal(chamadas, 2); // a 3ª em diante nem chega à API
});
