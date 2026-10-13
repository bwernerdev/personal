// Rodar com:  node --test
// Testa a guarda de "frases novas" no Notion SEM chamar o Notion de verdade (fetch simulado):
// confere para onde vai cada pedido e o formato do que seria enviado.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { anotarFraseNotion, listarFrasesNotion, marcarFraseNotion, FRASES_DS } from './notion.js';

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
  delete process.env.NOTION_TOKEN;
  delete process.env.NOTION_FRASES_DS;
});

// Simula o Notion: `respostas` é uma lista de corpos devolvidos em ordem; guarda os pedidos feitos.
function notionSimulado(respostas) {
  process.env.NOTION_TOKEN = 'token-de-teste';
  const pedidos = [];
  globalThis.fetch = async (url, opcoes) => {
    pedidos.push({ url: String(url), metodo: opcoes.method, corpo: opcoes.body ? JSON.parse(opcoes.body) : null, auth: opcoes.headers.Authorization });
    return { ok: true, status: 200, json: async () => respostas.shift() ?? {} };
  };
  return pedidos;
}

const dados = { frase: 'treinei bastante hoje', resultado: 'Sem ajuda do Claude', motivo: 'Não achei "treinei bastante"', sugestao: null, hoje: '2026-10-13' };

test('frase nova: procura pelo título e, não achando, cria a página com Vezes = 1', async () => {
  const pedidos = notionSimulado([{ results: [] }, { id: 'pagina-nova' }]);
  await anotarFraseNotion(dados);

  assert.equal(pedidos.length, 2);
  assert.match(pedidos[0].url, new RegExp(`/data_sources/${FRASES_DS()}/query$`));
  assert.deepEqual(pedidos[0].corpo.filter, { property: 'Frase', title: { equals: 'treinei bastante hoje' } });
  assert.equal(pedidos[0].auth, 'Bearer token-de-teste');

  assert.match(pedidos[1].url, /\/pages$/);
  assert.equal(pedidos[1].metodo, 'POST');
  const { parent, properties } = pedidos[1].corpo;
  assert.deepEqual(parent, { type: 'data_source_id', data_source_id: FRASES_DS() });
  assert.equal(properties.Frase.title[0].text.content, 'treinei bastante hoje');
  assert.equal(properties.Resultado.select.name, 'Sem ajuda do Claude');
  assert.equal(properties.Vezes.number, 1);
  assert.equal(properties['Última vez'].date.start, '2026-10-13');
  assert.equal(properties['Incluída nas regras'].checkbox, false);
  assert.equal(properties['Sugestão do Claude'].rich_text.length, 0);
});

test('frase que já existe: soma 1 em Vezes e desmarca "Incluída" (as regras ainda não resolvem)', async () => {
  const pedidos = notionSimulado([{ results: [{ id: 'pagina-1', properties: { Vezes: { number: 3 } } }] }, {}]);
  await anotarFraseNotion({ ...dados, resultado: 'Claude sugeriu', sugestao: 'peito: Supino inclinado halter 24 5x10' });

  assert.equal(pedidos.length, 2);
  assert.match(pedidos[1].url, /\/pages\/pagina-1$/);
  assert.equal(pedidos[1].metodo, 'PATCH');
  const p = pedidos[1].corpo.properties;
  assert.equal(p.Vezes.number, 4);
  assert.equal(p['Incluída nas regras'].checkbox, false);
  assert.equal(p.Resultado.select.name, 'Claude sugeriu');
  assert.equal(p['Sugestão do Claude'].rich_text[0].text.content, 'peito: Supino inclinado halter 24 5x10');
});

test('frase muito longa é cortada (título e texto) para caber no Notion', async () => {
  const pedidos = notionSimulado([{ results: [] }, {}]);
  await anotarFraseNotion({ ...dados, frase: 'a'.repeat(900), motivo: 'm'.repeat(5000) });
  assert.equal(pedidos[1].corpo.properties.Frase.title[0].text.content.length, 300);
  assert.ok(pedidos[1].corpo.properties.Motivo.rich_text[0].text.content.length <= 1900);
});

test('listar pendentes: filtra por "Incluída" = falso, ordena por Vezes e lê as colunas', async () => {
  const pedidos = notionSimulado([
    {
      results: [
        {
          id: 'p1',
          properties: {
            Frase: { title: [{ plain_text: 'treinei bastante hoje' }] },
            Resultado: { select: { name: 'Claude sugeriu' } },
            Motivo: { rich_text: [{ plain_text: 'Não achei' }] },
            'Sugestão do Claude': { rich_text: [{ plain_text: 'peito: x' }] },
            Vezes: { number: 5 },
            'Última vez': { date: { start: '2026-10-13' } },
            'Incluída nas regras': { checkbox: false },
          },
        },
      ],
      has_more: false,
    },
  ]);
  const frases = await listarFrasesNotion();
  assert.deepEqual(pedidos[0].corpo.filter, { property: 'Incluída nas regras', checkbox: { equals: false } });
  assert.deepEqual(pedidos[0].corpo.sorts, [{ property: 'Vezes', direction: 'descending' }]);
  assert.deepEqual(frases, [{ id: 'p1', frase: 'treinei bastante hoje', resultado: 'Claude sugeriu', motivo: 'Não achei', sugestao: 'peito: x', vezes: 5, ultima: '2026-10-13', incluida: false, obs: null }]);
});

test('marcar como incluída: PATCH na página com o checkbox e a observação', async () => {
  const pedidos = notionSimulado([{}]);
  await marcarFraseNotion('p1', { obs: 'regra criada' });
  assert.match(pedidos[0].url, /\/pages\/p1$/);
  assert.equal(pedidos[0].metodo, 'PATCH');
  assert.equal(pedidos[0].corpo.properties['Incluída nas regras'].checkbox, true);
  assert.equal(pedidos[0].corpo.properties['Observação'].rich_text[0].text.content, 'regra criada');
});

test('NOTION_FRASES_DS troca o banco; sem ele vale o banco "Frases novas" criado para o app', () => {
  assert.equal(FRASES_DS(), 'c88162e2-35d4-4558-9a8f-9ce6f6f72a29');
  process.env.NOTION_FRASES_DS = 'outro-id';
  assert.equal(FRASES_DS(), 'outro-id');
});
