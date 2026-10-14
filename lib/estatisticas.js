// Números calculados pelo servidor para a IA (ela erra ao contar e comparar registros sozinha).
// Só leitura: recebe os registros (do mais recente para o mais antigo) e devolve um texto para o prompt.

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dmSemana = (iso) => `${dm(iso)} (${SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()]})`;
const kg = (n) => `${String(n).replace('.', ',')}kg`;
const diasEntre = (de, ate) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
const feito = (linhas) =>
  linhas
    .map((r) => [r.series && r.reps ? `${r.series}x${r.reps}` : '', r.carga != null ? kg(r.carga) : ''].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' + ');

// Estatísticas de um exercício: vezes (dias), último, anterior, recorde e variação de carga.
export function estatisticasDoExercicio(registros) {
  const porDia = new Map();
  for (const r of registros) {
    if (!porDia.has(r.data)) porDia.set(r.data, []);
    porDia.get(r.data).push(r);
  }
  const dias = [...porDia.keys()].sort().reverse();
  const maiorDoDia = (d) => Math.max(...porDia.get(d).filter((r) => r.carga != null).map((r) => r.carga), -Infinity);
  const comCarga = dias.filter((d) => Number.isFinite(maiorDoDia(d)));
  const recorde = comCarga.reduce((m, d) => (m === null || maiorDoDia(d) > maiorDoDia(m) ? d : m), null);
  const ultimo = dias[0];
  const anterior = comCarga.find((d) => d !== comCarga[0]);
  return {
    vezes: dias.length,
    ultimo: { data: ultimo, feito: feito(porDia.get(ultimo)) },
    recorde: recorde ? { data: recorde, carga: maiorDoDia(recorde) } : null,
    variacao: comCarga.length >= 2 && anterior ? { de: anterior, ate: comCarga[0], dif: Math.round((maiorDoDia(comCarga[0]) - maiorDoDia(anterior)) * 100) / 100 } : null,
  };
}

// `parcial`: o histórico é maior que o lido (só os mais recentes + os exercícios citados); o resumo avisa.
export function resumoCalculado(registros, hoje, { parcial = false } = {}) {
  if (!registros.length) return 'RESUMO CALCULADO PELO SERVIDOR: ainda não há registros.';
  const sessoes = new Map(); // "data|treino" -> true
  const porTreino = new Map();
  for (const r of registros) {
    const chave = `${r.data}|${r.treino}`;
    if (sessoes.has(chave)) continue;
    sessoes.set(chave, true);
    const t = porTreino.get(r.treino) || { vezes: 0, ultimo: r.data };
    t.vezes += 1;
    if (r.data > t.ultimo) t.ultimo = r.data;
    porTreino.set(r.treino, t);
  }
  const datas = [...new Set(registros.map((r) => r.data))].sort();
  const ultimaData = datas[datas.length - 1];
  const nosUltimos = (dias) => datas.filter((d) => diasEntre(d, hoje) >= 0 && diasEntre(d, hoje) < dias).length;

  const linhas = [
    parcial
      ? 'RESUMO CALCULADO PELO SERVIDOR (números exatos sobre os registros lidos: os mais recentes e todo o histórico dos exercícios citados; há treinos mais antigos que não foram lidos, então avise se a pergunta pedir contagem total desde o começo):'
      : 'RESUMO CALCULADO PELO SERVIDOR (números exatos sobre TODO o histórico; use-os em vez de contar ou comparar à mão):',
    `- Dias com treino registrado: ${datas.length} (primeiro ${dm(datas[0])}/${datas[0].slice(0, 4)}, último ${dmSemana(ultimaData)}, há ${Math.max(0, diasEntre(ultimaData, hoje))} dia(s)).`,
    `- Frequência: ${nosUltimos(7)} dia(s) com treino nos últimos 7 dias; ${nosUltimos(30)} nos últimos 30 (média ${(nosUltimos(28) / 4).toString().replace('.', ',')} por semana nas últimas 4).`,
    `- Por treino: ${[...porTreino].map(([nome, t]) => `${nome} ${t.vezes}x (último ${dm(t.ultimo)})`).join('; ')}.`,
    '- Por exercício (vezes = dias em que foi feito; recorde = maior carga já usada; variação = carga mais alta de cada uma das duas últimas vezes):',
  ];
  const porExercicio = new Map();
  for (const r of registros) {
    if (!porExercicio.has(r.exercicio)) porExercicio.set(r.exercicio, []);
    porExercicio.get(r.exercicio).push(r);
  }
  for (const [nome, lista] of porExercicio) {
    const e = estatisticasDoExercicio(lista);
    const partes = [`${e.vezes}x`, `último ${dm(e.ultimo.data)}: ${e.ultimo.feito || 'sem números'}`];
    if (e.recorde) partes.push(`recorde ${kg(e.recorde.carga)} (${dm(e.recorde.data)})`);
    if (e.variacao) partes.push(`variação ${dm(e.variacao.de)}→${dm(e.variacao.ate)}: ${e.variacao.dif > 0 ? '+' : ''}${String(e.variacao.dif).replace('.', ',')}kg`);
    linhas.push(`  • ${nome}: ${partes.join('; ')}`);
  }
  return linhas.join('\n');
}
