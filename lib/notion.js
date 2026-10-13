// Cliente mínimo da API do Notion (versão com data sources). Só roda no servidor:
// o token NUNCA vai para o app do celular.

const VERSAO = '2025-09-03';
const BASE = 'https://api.notion.com/v1';

// IDs dos data sources criados no Notion (não são segredos; podem ser trocados por variável de ambiente).
export const ROTINA_DS = () => process.env.NOTION_ROTINA_DS || '245c3a99-83e4-4cfc-8dcb-b9c82a1de889';
export const TREINOS_DS = () => process.env.NOTION_TREINOS_DS || 'ecbfc1e7-ae29-4050-8362-ecd85288b870';

async function chamar(caminho, corpo, metodo = 'POST') {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error('NOTION_TOKEN não configurado.');
  const resp = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': VERSAO,
      'Content-Type': 'application/json',
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Notion ${resp.status}: ${json.message || resp.statusText}`);
  return json;
}

async function consultarTudo(dataSourceId, corpo = {}, limite = 300) {
  const linhas = [];
  let cursor;
  do {
    const r = await chamar(`/data_sources/${dataSourceId}/query`, {
      page_size: Math.min(100, limite),
      ...corpo,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    linhas.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor && linhas.length < limite);
  return linhas.slice(0, limite);
}

const texto = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join('');

export async function listarRotina() {
  const paginas = await consultarTudo(ROTINA_DS());
  return paginas
    .map((p) => ({
      exercicio: texto(p.properties['Exercício']),
      treino: p.properties['Treino']?.select?.name ?? null,
      ordem: p.properties['Ordem']?.number ?? 0,
      grupo: p.properties['Grupo muscular']?.select?.name ?? null,
      series: p.properties['Séries']?.number ?? null,
      reps: texto(p.properties['Repetições']),
    }))
    .filter((r) => r.exercicio && r.treino);
}

// Os registros mais recentes (padrão 300). Para um exercício específico, use listarTreinosDoExercicio.
export function listarTreinos(limite = 300) {
  return buscarTreinos({}, limite);
}

// Registros de um exercício, sem depender de ele estar entre os mais recentes.
export function listarTreinosDoExercicio(exercicio, limite = 40) {
  return buscarTreinos({ filter: { property: 'Exercício', title: { equals: exercicio } } }, limite);
}

async function buscarTreinos(consulta, limite) {
  const paginas = await consultarTudo(
    TREINOS_DS(),
    { sorts: [{ property: 'Data', direction: 'descending' }], ...consulta },
    limite,
  );
  return paginas.map((p) => ({
    id: p.id,
    exercicio: texto(p.properties['Exercício']),
    treino: p.properties['Treino']?.select?.name ?? null,
    grupo: p.properties['Grupo muscular']?.select?.name ?? null,
    data: (p.properties['Data']?.date?.start ?? '').slice(0, 10),
    series: p.properties['Séries']?.number ?? null,
    reps: p.properties['Repetições']?.number ?? null,
    carga: p.properties['Carga (kg)']?.number ?? null,
    obs: texto(p.properties['Observações']) || null,
  }));
}

export async function criarTreino(r) {
  const props = {
    'Exercício': { title: [{ text: { content: r.exercicio } }] },
    'Data': { date: { start: r.data } },
  };
  if (r.treino) props['Treino'] = { select: { name: r.treino } };
  if (r.grupo) props['Grupo muscular'] = { select: { name: r.grupo } };
  if (r.series !== null) props['Séries'] = { number: r.series };
  if (r.reps !== null) props['Repetições'] = { number: r.reps };
  if (r.carga !== null) props['Carga (kg)'] = { number: r.carga };
  if (r.obs) props['Observações'] = { rich_text: [{ text: { content: r.obs } }] };

  const pagina = await chamar('/pages', {
    parent: { type: 'data_source_id', data_source_id: TREINOS_DS() },
    properties: props,
  });
  return pagina.id;
}

const semTracos = (id) => String(id).replace(/-/g, '').toLowerCase();

// Manda o registro para a lixeira do Notion (dá para restaurar lá). Só aceita páginas do banco
// Treinos: com o código de acesso ninguém consegue apagar outras páginas da integração.
export async function apagarTreino(id) {
  const pagina = await chamar(`/pages/${id}`, null, 'GET');
  if (semTracos(pagina.parent?.data_source_id) !== semTracos(TREINOS_DS())) {
    throw new Error('Esse registro não é de um treino.');
  }
  await chamar(`/pages/${id}`, { in_trash: true }, 'PATCH');
}
