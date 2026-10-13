// Frases do chat que as regras não resolveram (guardadas pelo servidor em "Frases novas").
// Uso:
//   node scripts/frases.js listar [--todas] [--json]   frases pendentes, as mais repetidas primeiro
//   node scripts/frases.js tabela                       linhas prontas para lib/frases-naturais.js
//   node scripts/frases.js incluir <id> [observação]    dá baixa: a regra já foi criada
// Com NOTION_TOKEN (variável ou arquivo .env) lê o Notion; sem ele, lê data/frases.local.json (modo de teste).

import { existsSync } from 'node:fs';
import { listarFrases, marcarFrase, modoTeste } from '../lib/store.js';

if (existsSync('.env')) process.loadEnvFile('.env'); // Node 22: lê o .env sem dependência

const [comando = 'listar', ...resto] = process.argv.slice(2);
const flags = new Set(resto.filter((a) => a.startsWith('--')));
const args = resto.filter((a) => !a.startsWith('--'));

const onde = () => (modoTeste() ? 'modo de teste (data/frases.local.json)' : 'Notion (banco "Frases novas")');
const aspas = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

async function listar() {
  const pendentes = await listarFrases({ incluidas: false });
  const todas = flags.has('--todas') ? [...pendentes, ...(await listarFrases({ incluidas: true }))] : pendentes;
  if (flags.has('--json')) return console.log(JSON.stringify(todas, null, 2));
  console.log(`${todas.length} frase(s) ${flags.has('--todas') ? 'no total' : 'pendente(s)'} — ${onde()}\n`);
  for (const f of todas) {
    console.log(`${String(f.vezes).padStart(3)}x  [${f.resultado}]${f.incluida ? ' (incluída)' : ''}  ${f.frase}`);
    if (f.motivo) console.log(`       motivo: ${f.motivo}`);
    if (f.sugestao) console.log(`       Claude: ${f.sugestao}`);
    console.log(`       id: ${f.id}  última vez: ${f.ultima}`);
  }
}

// Linhas para colar em FRASES (lib/frases-naturais.js). O esperado inicial é 'ia' (as regras ainda não
// resolvem); troque pelo resultado certo ({ ok: [...] } ou { pergunta: '...' }) ao criar a regra.
async function tabela() {
  const frases = await listarFrases({ incluidas: false });
  for (const f of frases) console.log(`  [${aspas(f.frase)}, 'ia'],${f.sugestao ? ` // Claude: ${f.sugestao}` : ''}`);
}

async function incluir() {
  const [id, ...obs] = args;
  if (!id) throw new Error('Informe o id (veja com "listar").');
  await marcarFrase(id, { incluida: true, obs: obs.join(' ') || undefined });
  console.log(`Frase ${id} marcada como incluída nas regras.`);
}

const comandos = { listar, tabela, incluir };
if (!comandos[comando]) {
  console.error(`Comando desconhecido: ${comando}. Use: listar, tabela ou incluir.`);
  process.exit(1);
}
try {
  await comandos[comando]();
} catch (e) {
  console.error(`Erro: ${e.message}`);
  process.exit(1);
}
