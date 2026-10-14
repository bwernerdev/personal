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
    { sorts: [{ property: 'Data', direction: 'descending' }, { timestamp: 'created_time', direction: 'descending' }], ...consulta },
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
    criado: Date.parse(p.created_time) || 0,
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

// Corrige séries, repetições, carga ou observação de um registro (só páginas do banco Treinos).
export async function atualizarTreino(id, campos) {
  const pagina = await chamar(`/pages/${id}`, null, 'GET');
  if (semTracos(pagina.parent?.data_source_id) !== semTracos(TREINOS_DS())) throw new Error('Esse registro não é de um treino.');
  const props = {};
  if (campos.series !== undefined) props['Séries'] = { number: campos.series };
  if (campos.reps !== undefined) props['Repetições'] = { number: campos.reps };
  if (campos.carga !== undefined) props['Carga (kg)'] = { number: campos.carga };
  if (campos.obs !== undefined) props['Observações'] = { rich_text: campos.obs ? [{ text: { content: String(campos.obs).slice(0, 1900) } }] : [] };
  if (Object.keys(props).length) await chamar(`/pages/${id}`, { properties: props }, 'PATCH');
}

// ---------- frases novas (o que as regras do chat não resolveram) ----------
// Banco "Frases novas": uma linha por frase, com quantas vezes apareceu. Serve para ensinar as
// regras depois (scripts/frases.js). O banco precisa estar conectado à integração, como os outros.

export const FRASES_DS = () => process.env.NOTION_FRASES_DS || 'c88162e2-35d4-4558-9a8f-9ce6f6f72a29';

const cortar = (s, n) => String(s ?? '').slice(0, n);
const comTexto = (s) => ({ rich_text: s ? [{ text: { content: cortar(s, 1900) } }] : [] });

// `dados`: { frase, resultado, motivo, sugestao, hoje }. Frase repetida soma em "Vezes".
export async function anotarFraseNotion({ frase, resultado, motivo, sugestao, hoje }) {
  const titulo = cortar(frase, 300);
  const achadas = await chamar(`/data_sources/${FRASES_DS()}/query`, {
    page_size: 1,
    filter: { property: 'Frase', title: { equals: titulo } },
  });
  const props = {
    Resultado: { select: { name: resultado } },
    Motivo: comTexto(motivo),
    'Sugestão da IA': comTexto(sugestao),
    'Última vez': { date: { start: hoje } },
    'Incluída nas regras': { checkbox: false }, // apareceu de novo: as regras ainda não resolvem
  };
  const existente = achadas.results[0];
  if (existente) {
    const vezes = existente.properties['Vezes']?.number ?? 1;
    await chamar(`/pages/${existente.id}`, { properties: { ...props, Vezes: { number: vezes + 1 } } }, 'PATCH');
    return;
  }
  await chamar('/pages', {
    parent: { type: 'data_source_id', data_source_id: FRASES_DS() },
    properties: { Frase: { title: [{ text: { content: titulo } }] }, ...props, Vezes: { number: 1 } },
  });
}

export async function listarFrasesNotion({ incluidas = false } = {}) {
  const paginas = await consultarTudo(
    FRASES_DS(),
    {
      filter: { property: 'Incluída nas regras', checkbox: { equals: incluidas } },
      sorts: [{ property: 'Vezes', direction: 'descending' }],
    },
    300,
  );
  return paginas
    .filter((p) => ![MEMORIA, DIETA].includes(p.properties['Resultado']?.select?.name))
    .map((p) => ({
    id: p.id,
    frase: texto(p.properties['Frase']),
    resultado: p.properties['Resultado']?.select?.name ?? null,
    motivo: texto(p.properties['Motivo']) || null,
    sugestao: texto(p.properties['Sugestão da IA']) || null,
    vezes: p.properties['Vezes']?.number ?? 1,
    ultima: (p.properties['Última vez']?.date?.start ?? '').slice(0, 10),
    incluida: Boolean(p.properties['Incluída nas regras']?.checkbox),
    obs: texto(p.properties['Observação']) || null,
  }));
}

export async function marcarFraseNotion(id, { incluida = true, obs } = {}) {
  const props = { 'Incluída nas regras': { checkbox: incluida } };
  if (obs) props['Observação'] = comTexto(obs);
  await chamar(`/pages/${id}`, { properties: props }, 'PATCH');
}

// ---------- memória da IA ("lembre que ...") ----------
// Sem banco novo: ficam no banco "Frases novas" como linhas com Resultado = "Memória" e "Incluída nas regras"
// marcado (assim nunca aparecem na lista de frases a ensinar). O texto da lembrança é o título da linha.

const MEMORIA = 'Memória';

export async function anotarMemoriaNotion(nota, hoje) {
  await chamar('/pages', {
    parent: { type: 'data_source_id', data_source_id: FRASES_DS() },
    properties: {
      Frase: { title: [{ text: { content: cortar(nota, 300) } }] },
      Resultado: { select: { name: MEMORIA } },
      'Última vez': { date: { start: hoje } },
      'Incluída nas regras': { checkbox: true },
      Vezes: { number: 1 },
    },
  });
}

export async function listarMemoriasNotion() {
  const paginas = await consultarTudo(
    FRASES_DS(),
    { filter: { property: 'Resultado', select: { equals: MEMORIA } }, sorts: [{ timestamp: 'created_time', direction: 'ascending' }] },
    100,
  );
  return paginas.map((p) => ({ id: p.id, nota: texto(p.properties['Frase']), data: (p.properties['Última vez']?.date?.start ?? '').slice(0, 10) }));
}

export async function apagarMemoriaNotion(id) {
  await chamar(`/pages/${id}`, { in_trash: true }, 'PATCH');
}

// ---------- dieta ----------
// Também sem banco novo: uma linha por refeição em "Frases novas" com Resultado = "Dieta". O título é a hora e o nome,
// "Vezes" guarda a ordem e a refeição inteira (linhas, nota, substituições) fica em JSON no campo "Sugestão da IA".

const DIETA = 'Dieta';

// Antes da primeira gravação a opção "Dieta" ainda não existe no banco e o filtro falha: conta como "sem plano".
const linhasDaDieta = (extra = {}) =>
  consultarTudo(FRASES_DS(), { filter: { property: 'Resultado', select: { equals: DIETA } }, ...extra }, 100).catch((e) => {
    if (/not found for property/.test(e.message)) return [];
    throw e;
  });

export async function gravarDietaNotion({ orientacao, refeicoes }, hoje) {
  const antigas = await linhasDaDieta();
  for (const p of antigas) await chamar(`/pages/${p.id}`, { in_trash: true }, 'PATCH');
  for (const [i, r] of refeicoes.entries()) {
    const { hora, nome, ...resto } = r;
    const dados = JSON.stringify(i === 0 && orientacao ? { ...resto, orientacao } : resto);
    if (dados.length > 1900) throw new Error(`Refeição grande demais para guardar: ${nome}`);
    await chamar('/pages', {
      parent: { type: 'data_source_id', data_source_id: FRASES_DS() },
      properties: {
        Frase: { title: [{ text: { content: `${hora} ${nome}` } }] },
        Resultado: { select: { name: DIETA } },
        'Sugestão da IA': comTexto(dados),
        'Última vez': { date: { start: hoje } },
        'Incluída nas regras': { checkbox: true },
        Vezes: { number: i + 1 },
      },
    });
  }
}

export async function listarDietaNotion() {
  const paginas = await linhasDaDieta({ sorts: [{ property: 'Vezes', direction: 'ascending' }] });
  let orientacao = null;
  const refeicoes = paginas.map((p) => {
    const [, hora, nome] = /^(\d{2}:\d{2}) (.+)$/.exec(texto(p.properties['Frase'])) ?? [];
    const { orientacao: o, ...resto } = JSON.parse(texto(p.properties['Sugestão da IA']) || '{}');
    if (o) orientacao = o;
    return { hora, nome, ...resto };
  });
  return { orientacao, refeicoes };
}
