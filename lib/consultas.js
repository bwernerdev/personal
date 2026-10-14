// Perguntas simples sobre os treinos, respondidas só com regras (sem IA, sem chave, na hora):
//   "liste meu último full body 1", "qual foi minha última puxada alta?", "maior carga no voador",
//   "quando fiz extensora?", "o que fiz ontem?", "qual o próximo treino?", "quais exercícios tem no full 2?"
// Devolve o texto da resposta, ou null quando a pergunta não é de um tipo conhecido (aí a IA, se houver, responde).
// Só lê os registros recebidos; não grava nada.

import { normalizar, tokens } from './normalizar.js';
import { dataDePalavra } from './datas.js';
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
