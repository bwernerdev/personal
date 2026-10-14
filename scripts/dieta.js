// Plano alimentar (dados pessoais: ficam no Notion, nunca no repositório).
// Uso:
//   node scripts/dieta.js importar <arquivo.json>   troca o plano inteiro (formato em lib/dieta.js)
//   node scripts/dieta.js importar-receitas <arquivo.json>   troca as receitas (lista de { nome, refeicao, porcao, ingredientes, preparo }, ver lib/dieta.js)
//   node scripts/dieta.js mostrar                    imprime o plano guardado
// Com NOTION_TOKEN (variável ou arquivo .env) grava no Notion; sem ele, em data/dieta.local.json (modo de teste).

import { existsSync, readFileSync } from 'node:fs';
import { listarDieta, gravarDieta, gravarReceitas, listarReceitas } from '../lib/store.js';
import { hojeSP } from '../lib/datas.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const [comando = 'mostrar', arquivo] = process.argv.slice(2);

if (comando === 'importar') {
  if (!arquivo) throw new Error('Informe o arquivo: node scripts/dieta.js importar plano.json');
  await gravarDieta(JSON.parse(readFileSync(arquivo, 'utf8')), hojeSP());
  console.log('Plano gravado.');
} else if (comando === 'importar-receitas') {
  if (!arquivo) throw new Error('Informe o arquivo: node scripts/dieta.js importar-receitas receitas.json');
  await gravarReceitas(JSON.parse(readFileSync(arquivo, 'utf8')), hojeSP());
  console.log('Receitas gravadas.');
} else if (comando === 'mostrar') {
  const { refeicoes } = await listarDieta();
  for (const r of refeicoes) console.log(`${r.hora} ${r.nome}: ${r.linhas.map((l) => l.map((o) => o.t ?? o).join(' OU ')).join('; ')}`);
  console.log(`
${(await listarReceitas()).length} receita(s)`);
} else {
  console.log('Comandos: importar <arquivo.json> | importar-receitas <arquivo.json> | mostrar');
}
