// Plano alimentar: formato e validação. Os dados são pessoais e NÃO ficam no repositório (público):
// vivem no Notion (linhas do banco "Frases novas" com Resultado = "Dieta") ou, no modo de teste, em data/dieta.local.json.
// O app só mostra o plano; não calcula nem inventa quantidades (as trocas "ou" vêm prontas da nutricionista).
//
// { orientacao?, refeicoes: [{ hora: "08:30", nome, linhas: [[opção, opção...], ...], nota?, substituicoes?: [{ nome, linhas }] }] }
// Cada linha é um alimento (ou um grupo de opções equivalentes, que a tela mostra separadas por "ou"). Cada opção pode trazer kcal, proteína e carboidrato.

const texto = (v, max = 200) => typeof v === 'string' && v.trim() && v.length <= max;
// Opção: texto simples ou { t: texto, k: kcal, p: proteína (g), c: carboidrato (g) } (valores aproximados que a tela mostra ao lado).
const opcaoValida = (o) => texto(o) || (texto(o?.t) && [o.k, o.p, o.c].every((n) => Number.isFinite(n) && n >= 0));
const linhasValidas = (l) => Array.isArray(l) && l.length > 0 && l.every((op) => Array.isArray(op) && op.length > 0 && op.every(opcaoValida));

export function validarDieta(dieta) {
  const refeicoes = dieta?.refeicoes;
  if (!Array.isArray(refeicoes) || !refeicoes.length) throw new Error('A dieta precisa ter "refeicoes".');
  for (const r of refeicoes) {
    if (!/^\d{2}:\d{2}$/.test(r?.hora ?? '') || !texto(r.nome, 80) || !linhasValidas(r.linhas)) throw new Error(`Refeição inválida: ${r?.nome ?? '?'}`);
    if (r.nota !== undefined && !texto(r.nota, 800)) throw new Error(`Nota inválida em ${r.nome}`);
    for (const s of r.substituicoes ?? []) if (!texto(s?.nome, 80) || !linhasValidas(s.linhas)) throw new Error(`Substituição inválida em ${r.nome}`);
  }
  return { orientacao: dieta.orientacao ?? null, refeicoes };
}

// Receitas: cada uma usa só alimentos e quantidades do plano.
// { nome, refeicao: "Café da manhã", porcao: "1 pessoa", valores?: "≈ 360 kcal e 32 g de proteína", ingredientes: [..], preparo: [..], nota? }
export function validarReceitas(receitas) {
  if (!Array.isArray(receitas) || !receitas.length) throw new Error('Informe a lista "receitas".');
  for (const r of receitas) {
    const ok = texto(r?.nome, 100) && texto(r.refeicao, 60) && texto(r.porcao, 60) &&
      (r.valores === undefined || texto(r.valores, 120)) && (r.nota === undefined || texto(r.nota, 400)) &&
      Array.isArray(r.ingredientes) && r.ingredientes.length && r.ingredientes.every((t) => texto(t, 160)) &&
      Array.isArray(r.preparo) && r.preparo.length && r.preparo.every((t) => texto(t, 300));
    if (!ok) throw new Error(`Receita inválida: ${r?.nome ?? '?'}`);
  }
  return receitas;
}
