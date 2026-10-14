// Plano alimentar: formato e validação. Os dados são pessoais e NÃO ficam no repositório (público):
// vivem no Notion (linhas do banco "Frases novas" com Resultado = "Dieta") ou, no modo de teste, em data/dieta.local.json.
// O app só mostra o plano; não calcula nem inventa quantidades (as trocas "ou" vêm prontas da nutricionista).
//
// { orientacao?, refeicoes: [{ hora: "08:30", nome, linhas: [[opção, opção...], ...], nota?, substituicoes?: [{ nome, linhas }] }] }
// Cada linha é um alimento (ou um grupo de opções equivalentes, que a tela mostra separadas por "ou").

const texto = (v, max = 200) => typeof v === 'string' && v.trim() && v.length <= max;
const linhasValidas = (l) => Array.isArray(l) && l.length > 0 && l.every((op) => Array.isArray(op) && op.length > 0 && op.every((t) => texto(t)));

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
