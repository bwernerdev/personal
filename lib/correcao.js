// Corrigir ou apagar pelo chat o que acabou de ser registrado:
//   "apaga o último", "desfaz", "apague o voador de ontem"
//   "errei, era 45", "corrige a puxada para 40 kg", "na verdade foram 10 reps", "muda o supino para 4x12"
// Regras do servidor (sem IA). Tudo vai para a lixeira do Notion (dá para restaurar lá); a resposta diz o que mudou.

import { normalizar, tokens } from './normalizar.js';
import { juntarFullBody } from './linguagem.js';
import { exerciciosCitados } from './consultas.js';

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const data = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} (${SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()]})`;
const kg = (n) => `${String(n).replace('.', ',')} kg`;
const num = (s) => Number(String(s).replace(',', '.'));
const feito = (r) => [r.series && r.reps ? `${r.series}x${r.reps}` : '', r.carga != null ? kg(r.carga) : ''].filter(Boolean).join(' · ') || 'sem números';

const ARTIGO = '(?:o |a |os |as |meu |minha )?';
const APAGAR = '(?:apaga|apague|apagar|desfaz|desfaca|desfazer|remova|remove|remover|exclua|exclui|excluir|deleta|delete)';
const MARCADOR = /^(?:errei|erro meu|na verdade|corrige|corrigir|corrija|corrigindo|ops|opa|muda|mude|mudar|troca|troque|altera|altere|ajusta|ajuste|atualiza|atualize)\b/;

// Devolve { tipo: 'apagar_ultimo' } | { tipo: 'apagar', alvo } | { tipo: 'corrigir', alvo, campos, bloco } | null.
// `alvo`: pedaço do texto que pode citar o exercício (vazio = o último registrado). `nomes`: exercícios conhecidos.
export function comandoDeCorrecao(textoOriginal, nomes = []) {
  const texto = juntarFullBody(String(textoOriginal).trim());
  const t = normalizar(texto).replace(/[?!.]+$/g, '').replace(/\s+/g, ' ').trim();

  if (new RegExp(`^${APAGAR}(?: ${ARTIGO}(?:ultimo|ultima))?(?: registro| treino| exercicio| lancamento| serie)?$`).test(t) && /(?:ultimo|ultima|^desfaz|^desfaca|^desfazer)/.test(t)) {
    return { tipo: 'apagar_ultimo' };
  }
  const apagarDe = new RegExp(`^${APAGAR} ${ARTIGO}(?:registro |ultimo registro |lancamento )?(?:d[oae]s? )?(.+)$`).exec(t);
  if (apagarDe && exerciciosCitados(tokens(texto).filter((w) => w.length >= 4), nomes).length > 0) {
    return { tipo: 'apagar', alvo: apagarDe[1] };
  }

  if (!MARCADOR.test(t)) return null;
  // "e não 40" / "não 40": o valor errado, que não interessa.
  const limpo = t.replace(/\b(?:e )?nao(?: era| foi| foram)? \d+(?:[.,]\d+)?(?: ?(?:kg|kgs|k|quilos|kilos))?/g, ' ');
  const campos = {};
  const par = /(\d+)\s*x\s*(\d+)/.exec(limpo);
  let resto = limpo;
  if (par) {
    campos.series = Number(par[1]);
    campos.reps = Number(par[2]);
    resto = resto.replace(par[0], ' ');
  }
  const reps = /(\d+)\s*(?:reps|repeticoes|repeticao)\b|\b(?:reps|repeticoes)\s*(?:para |pra |de |foram |eram )?(\d+)/.exec(resto);
  if (reps && !par) {
    campos.reps = Number(reps[1] ?? reps[2]);
    resto = resto.replace(reps[0], ' ');
  }
  const series = /(\d+)\s*series?\b|\bseries?\s*(?:para |pra |de |foram |eram )?(\d+)/.exec(resto);
  if (series && !par) {
    campos.series = Number(series[1] ?? series[2]);
    resto = resto.replace(series[0], ' ');
  }
  const bloco = /\bbloco (\d+)\b/.exec(resto);
  if (bloco) resto = resto.replace(bloco[0], ' ');
  const carga = /(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|k|quilos|kilos)\b|\bcarga\s*(?:para |pra |de |foi |era )?(\d+(?:[.,]\d+)?)|\b(?:era|foi|foram|para|pra)\s+(\d+(?:[.,]\d+)?)\b/.exec(resto);
  if (carga) campos.carga = num(carga[1] ?? carga[2] ?? carga[3]);
  else if (!par && campos.reps === undefined && campos.series === undefined) {
    const solto = /(?<![\d,.])(\d+(?:[.,]\d+)?)(?![\d,.])/.exec(resto);
    if (solto) campos.carga = num(solto[1]);
  }
  if (Object.keys(campos).length === 0) return null;
  return { tipo: 'corrigir', alvo: texto, campos, bloco: bloco ? Number(bloco[1]) : null };
}

// O que o último registro do exercício abrange: se veio em blocos ("bloco 1/3"), os blocos da mesma mensagem, na ordem;
// se foi um registro avulso, só ele (duas séries do mesmo exercício gravadas em momentos diferentes não se misturam).
function ultimoDia(registros, exercicio) {
  const doExercicio = registros.filter((r) => r.exercicio === exercicio);
  if (!doExercicio.length) return [];
  const base = doExercicio[0];
  const marca = /^bloco (\d+)\/(\d+)/.exec(base.obs || '');
  if (!marca) return [base];
  const total = Number(marca[2]);
  const ordem = (r) => Number(/^bloco (\d+)\//.exec(r.obs || '')?.[1] ?? 0);
  return doExercicio
    .filter((r) => r.data === base.data && r.treino === base.treino && new RegExp(`^bloco \\d+/${total}`).test(r.obs || ''))
    .slice(0, total)
    .sort((x, y) => ordem(x) - ordem(y));
}

// `registros`: do mais recente para o mais antigo (o primeiro é o último registrado).
// `acoes`: { apagar(id), atualizar(id, campos) }. Devolve o texto da resposta.
export async function executarCorrecao(comando, registros, acoes) {
  if (!registros.length) return 'Ainda não há registros para mexer.';
  const nomes = [...new Set(registros.map((r) => r.exercicio))];
  const palavras = tokens(comando.alvo ?? '').filter((w) => w.length >= 4);
  const citados = comando.alvo ? exerciciosCitados(palavras, nomes) : [];
  if (citados.length > 1) return `Mais de um exercício combina (${citados.join(', ')}). Diga o nome completo.`;
  const exercicio = citados[0] ?? registros[0].exercicio;
  const linhas = ultimoDia(registros, exercicio);
  if (!linhas.length) return `Não achei registros de ${exercicio}.`;
  const dia = `${exercicio}, ${data(linhas[0].data)}`;

  if (comando.tipo === 'apagar_ultimo' || comando.tipo === 'apagar') {
    // "Último" = o registro mais recente; apaga junto os blocos do mesmo exercício e dia.
    for (const r of linhas) await acoes.apagar(r.id);
    return `Apaguei ${dia}: ${linhas.map(feito).join(' + ')}. (Fica na lixeira do Notion, se precisar restaurar.)`;
  }

  let alvos = linhas;
  if (linhas.length > 1) {
    if (!comando.bloco) return `${dia} tem ${linhas.length} blocos (${linhas.map((r, i) => `${i + 1}: ${feito(r)}`).join('; ')}). Diga qual, por exemplo: "corrige o bloco 2 para 45 kg".`;
    if (!linhas[comando.bloco - 1]) return `${dia} só tem ${linhas.length} blocos.`;
    alvos = [linhas[comando.bloco - 1]];
  }
  const [r] = alvos;
  const antes = feito(r);
  await acoes.atualizar(r.id, comando.campos);
  const depois = feito({ ...r, ...comando.campos });
  return `Corrigi ${dia}: ${antes} → ${depois}.`;
}
