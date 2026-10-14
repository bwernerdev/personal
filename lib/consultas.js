// Perguntas simples sobre os treinos, respondidas só com regras (sem IA, sem chave, na hora):
//   "liste meu último full body 1", "qual foi minha última puxada alta?", "maior carga no voador",
//   "quando fiz extensora?", "o que fiz ontem?", "qual o próximo treino?", "quais exercícios tem no full 2?"
// Devolve o texto da resposta, ou null quando a pergunta não é de um tipo conhecido (aí a IA, se houver, responde).
// Só lê os registros recebidos; não grava nada.

import { normalizar, tokens } from './normalizar.js';
import { dataDePalavra, somarDias, dataDiaMes } from './datas.js';
import { juntarFullBody } from './linguagem.js';
import { TREINOS, ATALHO, treinosDoApp } from './parser.js';
import { treinoSugerido } from './treino-do-dia.js';

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const formatarData = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} (${SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()]})`;
const kg = (n) => `${String(n).replace('.', ',')} kg`;
const diasEntre = (de, ate) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
const NUMEROS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7 };

function feitoDe(linhas) {
  return linhas
    .map((r) => [r.series && r.reps ? `${r.series}x${r.reps}` : '', r.carga != null ? kg(r.carga) : ''].filter(Boolean).join(' · ') || 'sem números')
    .join(' + ');
}

function linhaDoExercicio(linhas) {
  const nota = linhas.map((r) => r.obs).find((o) => o && !/^bloco /.test(o));
  return `• ${linhas[0].exercicio}: ${feitoDe(linhas)}${nota ? ` (${nota})` : ''}`;
}

// Um dia de treino: agrupa as linhas do mesmo exercício (cargas diferentes viram "bloco").
function descreverDia(registros) {
  const porExercicio = new Map();
  for (const r of registros) {
    if (!porExercicio.has(r.exercicio)) porExercicio.set(r.exercicio, []);
    porExercicio.get(r.exercicio).push(r);
  }
  return [...porExercicio.values()].map(linhaDoExercicio).join('\n');
}

const diaDoTreino = (registros, treino) => {
  const doTreino = registros.filter((r) => r.treino === treino);
  return doTreino.length ? { data: doTreino[0].data, linhas: doTreino.filter((r) => r.data === doTreino[0].data) } : null;
};

// Palavras de equipamento não precisam ser ditas ("supino inclinado" acha "Supino inclinado halter").
const EQUIPAMENTO = new Set(['halter', 'halteres', 'barra', 'maquina', 'polia', 'cabo', 'cabos', 'corda', 'livre', 'reta', 'articulado']);
const casa = (p, w) => w.startsWith(p.slice(0, 5)) || p.startsWith(w.slice(0, 5));

// Exercícios citados na pergunta: todas as palavras (4+ letras, fora equipamento) do nome aparecem nela. Se nenhum
// nome completo aparece, vale a palavra que só existe em UM exercício ("puxada" -> "Puxada alta").
export function exerciciosCitados(palavras, nomes) {
  const achados = nomes.filter((nome) => {
    const significativas = tokens(nome).filter((p) => p.length >= 4 && !EQUIPAMENTO.has(p));
    return significativas.length > 0 && significativas.every((p) => palavras.some((w) => casa(p, w)));
  });
  if (achados.length) {
    // O nome mais específico (mais palavras) ganha: "Supino inclinado halter" vence "Supino".
    const maior = Math.max(...achados.map((n) => tokens(n).length));
    return achados.filter((n) => tokens(n).length === maior);
  }
  const unicos = new Set();
  for (const w of palavras.filter((x) => x.length >= 5)) {
    const donos = nomes.filter((nome) => tokens(nome).some((p) => p.length >= 5 && !EQUIPAMENTO.has(p) && casa(p, w)));
    if (donos.length === 1) unicos.add(donos[0]);
  }
  return [...unicos];
}

export function responderConsulta(textoOriginal, { registros, rotina = [], hoje }) {
  const texto = juntarFullBody(textoOriginal);
  const pergunta = normalizar(texto).replace(/[^a-z0-9]+/g, ' ').trim();
  const palavras = tokens(texto).filter((w) => w.length >= 4);
  const tem = (re) => re.test(pergunta);
  const ativos = rotina.length ? treinosDoApp(rotina) : TREINOS;

  const treinos = TREINOS.filter((t) => pergunta.includes(normalizar(t).replace(/[^a-z0-9]+/g, ' ')) || pergunta.split(' ').includes(ATALHO[t]));
  const nomes = [...new Set([...rotina.map((r) => r.exercicio), ...registros.map((r) => r.exercicio)])];
  const exercicios = treinos.length ? exerciciosCitados(palavras, nomes).filter((n) => !rotina.some((r) => r.exercicio === n && treinos.includes(r.treino)) || tem(/\b(carga|historico|recorde|quando)\b/)) : exerciciosCitados(palavras, nomes);
  const dataCitada = pergunta.split(' ').map((p) => dataDePalavra(p, hoje)).find(Boolean);

  const pedeUltimo = tem(/\b(ultimo|ultima|ultimos|ultimas|recente|passado|passada)\b/);
  const pedeMaior = tem(/\b(maior|recorde|record|pr|max|maximo|mais pesad[oa]|melhor)\b/);
  const pedeQuando = tem(/\b(quando|que dia|qual dia|data)\b/);
  const pedeLista = tem(/\b(historico|liste|lista|listar|mostre|mostrar|compare|todas|todos)\b/);
  const n = Number(/\b(\d+)\b/.exec(pergunta)?.[1]) || NUMEROS[pergunta.split(' ').find((p) => NUMEROS[p] && p !== 'um' && p !== 'uma')] || null;

  // período ("esta semana", "mês passado", "últimos 10 dias", "desde setembro"): resumo dos dias ou evolução do exercício
  const periodo = periodoDe(pergunta, hoje);
  if (periodo && treinos.length === 0 && exercicios.length <= 1) {
    if (exercicios.length === 0) return resumoDoPeriodo(registros, periodo);
    if (periodo.desde || tem(/\b(evolu\w*|progress\w*|compar\w*|subi|aumentei|mudou)\b/)) return evolucaoDoExercicio(registros, exercicios[0], periodo);
    const dias = [...new Set(registros.filter((r) => r.exercicio === exercicios[0] && r.data >= periodo.de && r.data <= periodo.ate).map((r) => r.data))];
    if (!dias.length) return `${exercicios[0]}: sem registros (${periodo.rotulo.toLowerCase()}).`;
    return `${exercicios[0]} — ${periodo.rotulo.toLowerCase()}\n${dias.map((d) => `${formatarData(d)}: ${feitoDe(registros.filter((r) => r.exercicio === exercicios[0] && r.data === d))}`).join('\n')}`;
  }

  // 0) próximo treino / treino de hoje: segue o ciclo dos treinos ativos
  if (tem(/\bproximo treino\b|\bqual treino\b.*\b(hoje|fazer)\b|\bo que (devo|vou|falta) fazer\b|\btreino de hoje\b/) && treinos.length === 0 && exercicios.length === 0) {
    const proximo = treinoSugerido(registros, ativos);
    const ultimo = registros.find((r) => ativos.includes(r.treino));
    const exs = rotina.filter((r) => r.treino === proximo).sort((a, b) => a.ordem - b.ordem).map((r) => r.exercicio);
    return `Próximo treino: ${proximo}${ultimo ? ` (o último foi ${ultimo.treino}, em ${formatarData(ultimo.data)})` : ''}${exs.length ? `\n${exs.map((e) => `• ${e}`).join('\n')}` : ''}`;
  }

  // 1) há quanto tempo foi o último treino
  if (tem(/\b(quanto tempo|faz quanto|ha quanto|a quanto tempo|desde)\b/) && treinos.length === 0 && exercicios.length === 0) {
    if (!registros.length) return 'Ainda não há registros.';
    const d = diasEntre(registros[0].data, hoje);
    return `O último treino foi em ${formatarData(registros[0].data)} (${registros[0].treino}), ${d <= 0 ? 'hoje' : d === 1 ? 'há 1 dia' : `há ${d} dias`}.`;
  }

  // 2) quais exercícios tem um treino
  if (treinos.length === 1 && tem(/\b(exercicios|exercicio|tem no|inclui|composto|lista de exercicios)\b/) && !pedeUltimo) {
    const exs = rotina.filter((r) => r.treino === treinos[0]).sort((a, b) => a.ordem - b.ordem).map((r) => r.exercicio);
    return exs.length ? `${treinos[0]}\n${exs.map((e) => `• ${e}`).join('\n')}` : `Não há exercícios cadastrados no ${treinos[0]}.`;
  }

  // 3) treino citado: o último dia em que foi feito
  if (treinos.length === 1 && exercicios.length === 0) {
    const dia = diaDoTreino(registros, treinos[0]);
    if (!dia) return `Ainda não há registros do ${treinos[0]}.`;
    return `${treinos[0]} — ${formatarData(dia.data)}\n${descreverDia(dia.linhas)}`;
  }

  // 4) exercício citado
  if (exercicios.length === 1) {
    const nome = exercicios[0];
    const doExercicio = registros.filter((r) => r.exercicio === nome);
    if (!doExercicio.length) return `Ainda não há registros de ${nome}.`;
    if (pedeMaior) {
      const melhor = doExercicio.filter((r) => r.carga != null).sort((a, b) => b.carga - a.carga || (a.data < b.data ? 1 : -1))[0];
      if (!melhor) return `Os registros de ${nome} não têm carga.`;
      return `Maior carga em ${nome}: ${kg(melhor.carga)}${melhor.series && melhor.reps ? ` (${melhor.series}x${melhor.reps})` : ''} em ${formatarData(melhor.data)}.`;
    }
    if (pedeQuando && !pedeLista) return `Última vez em ${nome}: ${formatarData(doExercicio[0].data)}${doExercicio[0].treino ? `, no ${doExercicio[0].treino}` : ''}.`;
    const quantos = n && n <= 20 ? n : pedeUltimo && !pedeLista ? 1 : 5;
    const dias = [...new Set(doExercicio.map((r) => r.data))].slice(0, quantos);
    return `${nome}\n${dias.map((d) => `${formatarData(d)}: ${feitoDe(doExercicio.filter((r) => r.data === d))}`).join('\n')}`;
  }

  // 5) uma data citada: tudo que foi feito nela
  if (dataCitada && exercicios.length === 0 && treinos.length === 0) {
    const doDia = registros.filter((r) => r.data === dataCitada);
    if (!doDia.length) return `Não há registros em ${formatarData(dataCitada)}.`;
    return [...new Set(doDia.map((r) => r.treino))].map((t) => `${t} — ${formatarData(dataCitada)}\n${descreverDia(doDia.filter((r) => r.treino === t))}`).join('\n\n');
  }

  // 6) "qual foi meu último treino?" (sem citar treino nem exercício)
  if (pedeUltimo && tem(/\btreino\b/) && treinos.length === 0 && exercicios.length === 0 && registros.length) {
    const { data, treino } = registros[0];
    return `${treino} — ${formatarData(data)}\n${descreverDia(registros.filter((r) => r.data === data && r.treino === treino))}`;
  }

  return null;
}

// Pergunta com mais de uma parte ("recorde no voador e quantas vezes fiz?", "último treino e quando foi o anterior?"):
// as regras respondem uma coisa só, então a IA (se houver) fica com ela e as regras ficam de reserva.
const PEDIDOS = [/\b(maior|recorde|record|pr|max|maximo|melhor)\b/, /\b(quantas vezes|quantos|quantas|quantidade)\b/, /\b(quando|que dia|qual dia|ha quanto|quanto tempo)\b/, /\b(ultimo|ultima|recente)\b/, /\b(compare|comparar|evolu\w*|progress\w*|media)\b/, /\b(proximo|proxima)\b/, /\b(historico|liste|lista|todas)\b/];
export function perguntaComposta(texto) {
  const t = normalizar(juntarFullBody(texto));
  if ((String(texto).match(/\?/g) || []).length >= 2) return true;
  const pedidos = PEDIDOS.filter((re) => re.test(t)).length;
  return pedidos >= 2 && /\b(e|alem disso|tambem|depois)\b|,/.test(t);
}

// ---------- períodos ("esta semana", "mês passado", "últimos 10 dias", "desde setembro") ----------

const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const fimDoMes = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();
const segundaDe = (dia) => somarDias(dia, -((new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7));
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// Devolve { de, ate, rotulo, desde } ou null. `pergunta` já normalizada (sem acento, minúscula).
export function periodoDe(pergunta, hoje) {
  const ano = Number(hoje.slice(0, 4));
  const mesHoje = Number(hoje.slice(5, 7));
  if (/\b(esta|essa|nesta|nessa) semana\b|\bsemana atual\b/.test(pergunta)) return { de: segundaDe(hoje), ate: hoje, rotulo: 'Esta semana' };
  if (/\bsemana passada\b/.test(pergunta)) {
    const seg = somarDias(segundaDe(hoje), -7);
    return { de: seg, ate: somarDias(seg, 6), rotulo: 'Semana passada' };
  }
  if (/\b(este|esse|neste|nesse) mes\b/.test(pergunta)) return { de: iso(ano, mesHoje, 1), ate: hoje, rotulo: 'Este mês' };
  if (/\bmes passado\b/.test(pergunta)) {
    const [a, m] = mesHoje === 1 ? [ano - 1, 12] : [ano, mesHoje - 1];
    return { de: iso(a, m, 1), ate: iso(a, m, fimDoMes(a, m)), rotulo: 'Mês passado' };
  }
  const n = /\bultim[oa]s (\d{1,3}) (dias|semanas)\b/.exec(pergunta);
  if (n) {
    const dias = Number(n[1]) * (n[2] === 'semanas' ? 7 : 1);
    return { de: somarDias(hoje, -(dias - 1)), ate: hoje, rotulo: `Últimos ${n[1]} ${n[2]}` };
  }
  if (/\bultima semana\b|\bultimos 7 dias\b/.test(pergunta)) return { de: somarDias(hoje, -6), ate: hoje, rotulo: 'Últimos 7 dias' };
  const mes = new RegExp(String.raw`\b(desde|em|durante|no mes de|de) (?:o mes de )?(${Object.keys(MESES).join('|')})\b`).exec(pergunta);
  if (mes) {
    const m = MESES[mes[2]];
    const a = m > mesHoje ? ano - 1 : ano; // mês que ainda não chegou = do ano passado
    const desde = mes[1] === 'desde';
    return { de: iso(a, m, 1), ate: desde ? hoje : iso(a, m, fimDoMes(a, m)), rotulo: desde ? `Desde ${mes[2]}` : `${mes[2][0].toUpperCase()}${mes[2].slice(1)}`, desde };
  }
  const data = /\bdesde (?:o dia )?(\d{1,2})\/(\d{1,2})\b/.exec(pergunta);
  if (data) {
    const d = dataDiaMes(Number(data[1]), Number(data[2]), null, hoje);
    if (d) return { de: d, ate: hoje, rotulo: `Desde ${dm(d)}`, desde: true };
  }
  return null;
}

const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const diaCurto = (d) => `${dm(d)} (${SEMANA_CURTA[new Date(`${d}T12:00:00Z`).getUTCDay()]})`;

// Resumo dos treinos de um período: um bloco por dia, com o treino e quantos exercícios e séries.
export function resumoDoPeriodo(registros, periodo) {
  const doPeriodo = registros.filter((r) => r.data >= periodo.de && r.data <= periodo.ate);
  const cabecalho = `${periodo.rotulo} (${dm(periodo.de)}–${dm(periodo.ate)})`;
  if (!doPeriodo.length) return `${cabecalho}: nenhum treino registrado.`;
  const dias = [...new Set(doPeriodo.map((r) => r.data))].sort().reverse();
  const linhas = dias.map((d) => {
    const doDia = doPeriodo.filter((r) => r.data === d);
    const treinos = [...new Set(doDia.map((r) => r.treino).filter(Boolean))].join(' + ') || 'treino';
    const exercicios = new Set(doDia.map((r) => r.exercicio)).size;
    const series = doDia.reduce((s, r) => s + (r.series || 0), 0);
    return `• ${diaCurto(d)}: ${treinos} — ${exercicios} exercício${exercicios === 1 ? '' : 's'}${series ? `, ${series} séries` : ''}`;
  });
  return `${cabecalho}: ${dias.length} dia${dias.length === 1 ? '' : 's'} de treino.\n${linhas.join('\n')}`;
}

// Evolução de um exercício no período: primeira e última vez (maior carga de cada dia) e a diferença.
export function evolucaoDoExercicio(registros, nome, periodo) {
  const doExercicio = registros.filter((r) => r.exercicio === nome && r.data >= periodo.de && r.data <= periodo.ate && r.carga != null);
  const dias = [...new Set(doExercicio.map((r) => r.data))].sort();
  if (!dias.length) return `${nome}: sem registros com carga em ${periodo.rotulo.toLowerCase()}.`;
  const maior = (d) => Math.max(...doExercicio.filter((r) => r.data === d).map((r) => r.carga));
  const primeiro = dias[0];
  const ultimo = dias[dias.length - 1];
  if (dias.length === 1) return `${nome} — ${periodo.rotulo.toLowerCase()}: só um dia (${diaCurto(primeiro)}, ${kg(maior(primeiro))}).`;
  const dif = Math.round((maior(ultimo) - maior(primeiro)) * 100) / 100;
  const sinal = dif > 0 ? `+${String(dif).replace('.', ',')} kg` : dif < 0 ? `${String(dif).replace('.', ',')} kg` : 'igual';
  const recorde = Math.max(...dias.map(maior));
  return `${nome} — ${periodo.rotulo.toLowerCase()}: ${dias.length} dias; ${diaCurto(primeiro)} ${kg(maior(primeiro))} → ${diaCurto(ultimo)} ${kg(maior(ultimo))} (${sinal}). Maior carga: ${kg(recorde)}.`;
}

// Pergunta curta que continua a anterior ("e o voador?", "e ontem?"): junta o que a pessoa pedia antes
// (recorde, último, quando…) com o trecho novo. Devolve o texto completo ou null.
const INTENCOES = ['maior carga', 'recorde', 'ultimo', 'ultima', 'quando fiz', 'que dia', 'historico', 'liste', 'quantas vezes', 'compare', 'evolucao'];
export function completarComContexto(texto, historico = []) {
  const t = normalizar(juntarFullBody(texto)).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const palavras = t.split(' ');
  if (palavras.length > 7 || !/^(e|mas|tambem|e quanto ao|e sobre)\b/.test(t)) return null;
  const anterior = [...(Array.isArray(historico) ? historico : [])].reverse().find((h) => h?.de === 'eu' && typeof h.texto === 'string' && !/^e\b/.test(normalizar(h.texto)));
  if (!anterior) return null;
  const antes = normalizar(juntarFullBody(anterior.texto)).replace(/[^a-z0-9 ]+/g, ' ');
  const intencao = INTENCOES.filter((i) => antes.includes(i)).join(' ');
  if (!intencao) return null;
  return `${intencao} ${t.replace(/^(e quanto ao|e sobre|e|mas|tambem)\s+(?:(?:o|a|os|as|no|na|do|da)\s+)?/, '')}`.trim();
}
