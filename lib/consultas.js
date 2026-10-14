// Perguntas simples sobre os treinos, respondidas só com regras (sem IA, sem chave, na hora):
//   "liste meu último full body 1", "qual foi minha última puxada alta?", "maior carga no voador",
//   "quando fiz extensora?", "o que fiz ontem?"
// Devolve o texto da resposta, ou null quando a pergunta não é de um tipo conhecido (aí a IA, se houver, responde).
// Só lê os registros recebidos; não grava nada.

import { normalizar, tokens } from './normalizar.js';
import { dataDePalavra } from './datas.js';
import { TREINOS, ATALHO } from './parser.js';

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const formatarData = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} (${SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()]})`;
const kg = (n) => `${String(n).replace('.', ',')} kg`;

function linhaDoExercicio(linhas) {
  const partes = linhas.map((r) => {
    const feito = r.series && r.reps ? `${r.series}x${r.reps}` : '';
    return [feito, r.carga != null ? kg(r.carga) : ''].filter(Boolean).join(' · ') || 'sem números';
  });
  return `• ${linhas[0].exercicio}: ${partes.join(' + ')}${linhas.find((r) => r.obs && !/^bloco /.test(r.obs)) ? ` (${linhas.find((r) => r.obs && !/^bloco /.test(r.obs)).obs})` : ''}`;
}

// Um dia de treino: agrupa as linhas do mesmo exercício (cargas diferentes viram "bloco").
function descreverDia(registros) {
  const ordem = [];
  const porExercicio = new Map();
  for (const r of registros) {
    if (!porExercicio.has(r.exercicio)) {
      porExercicio.set(r.exercicio, []);
      ordem.push(r.exercicio);
    }
    porExercicio.get(r.exercicio).push(r);
  }
  return ordem.map((nome) => linhaDoExercicio(porExercicio.get(nome))).join('\n');
}

// Exercícios citados na pergunta: todas as palavras (4+ letras) do nome aparecem na pergunta (começo da palavra).
// Palavras de equipamento não precisam ser ditas ("supino inclinado" acha "Supino inclinado halter").
const EQUIPAMENTO = new Set(['halter', 'halteres', 'barra', 'maquina', 'polia', 'cabo', 'cabos', 'corda', 'livre', 'reta', 'articulado']);

export function exerciciosCitados(palavras, nomes) {
  const achados = nomes.filter((nome) => {
    const significativas = tokens(nome).filter((p) => p.length >= 4 && !EQUIPAMENTO.has(p));
    return significativas.length > 0 && significativas.every((p) => palavras.some((w) => w.startsWith(p.slice(0, 5)) || p.startsWith(w.slice(0, 5))));
  });
  // O nome mais específico (mais palavras) ganha: "Supino inclinado halter" vence "Supino".
  const maior = Math.max(0, ...achados.map((n) => tokens(n).length));
  return achados.filter((n) => tokens(n).length === maior);
}

export function responderConsulta(texto, { registros, rotina = [], hoje }) {
  const pergunta = normalizar(texto).replace(/[^a-z0-9]+/g, ' ').trim();
  const palavras = tokens(texto).filter((w) => w.length >= 4);
  const tem = (re) => re.test(pergunta);

  const treinos = TREINOS.filter((t) => pergunta.includes(normalizar(t).replace(/[^a-z0-9]+/g, ' ')) || pergunta.split(' ').includes(ATALHO[t]));
  const nomes = [...new Set([...rotina.map((r) => r.exercicio), ...registros.map((r) => r.exercicio)])];
  const exercicios = exerciciosCitados(palavras, nomes);
  const dataCitada = pergunta.split(' ').map((p) => dataDePalavra(p, hoje)).find(Boolean);

  const pedeUltimo = tem(/\b(ultimo|ultima|recente|mais recente|passado|passada)\b/);
  const pedeMaior = tem(/\b(maior|recorde|record|pr|max|maximo|mais pesad[oa]|melhor)\b/);
  const pedeQuando = tem(/\b(quando|que dia|qual dia|data)\b/);

  // 1) treino citado: o último dia em que foi feito
  if (treinos.length === 1 && exercicios.length === 0) {
    const treino = treinos[0];
    const doTreino = registros.filter((r) => r.treino === treino);
    if (!doTreino.length) return `Ainda não há registros do ${treino}.`;
    const dia = doTreino[0].data;
    return `${treino} — ${formatarData(dia)}\n${descreverDia(doTreino.filter((r) => r.data === dia))}`;
  }

  // 2) exercício citado
  if (exercicios.length === 1) {
    const nome = exercicios[0];
    const doExercicio = registros.filter((r) => r.exercicio === nome);
    if (!doExercicio.length) return `Ainda não há registros de ${nome}.`;
    if (pedeMaior) {
      const melhor = doExercicio.filter((r) => r.carga != null).sort((a, b) => b.carga - a.carga || (a.data < b.data ? 1 : -1))[0];
      if (!melhor) return `Os registros de ${nome} não têm carga.`;
      return `Maior carga em ${nome}: ${kg(melhor.carga)}${melhor.series && melhor.reps ? ` (${melhor.series}x${melhor.reps})` : ''} em ${formatarData(melhor.data)}.`;
    }
    if (pedeQuando && !tem(/\b(historico|liste|lista|mostre)\b/)) {
      return `Última vez em ${nome}: ${formatarData(doExercicio[0].data)}${doExercicio[0].treino ? `, no ${doExercicio[0].treino}` : ''}.`;
    }
    // últimas 5 vezes (um dia por vez)
    const dias = [...new Set(doExercicio.map((r) => r.data))].slice(0, pedeUltimo && !tem(/\b(historico|liste|lista|mostre)\b/) ? 1 : 5);
    return `${nome}\n${dias.map((d) => `${formatarData(d)}: ${linhaDoExercicio(doExercicio.filter((r) => r.data === d)).replace(/^• [^:]+: /, '')}`).join('\n')}`;
  }

  // 3) uma data citada: tudo que foi feito nela
  if (dataCitada && exercicios.length === 0 && treinos.length === 0) {
    const doDia = registros.filter((r) => r.data === dataCitada);
    if (!doDia.length) return `Não há registros em ${formatarData(dataCitada)}.`;
    const treinosDoDia = [...new Set(doDia.map((r) => r.treino))];
    return treinosDoDia.map((t) => `${t} — ${formatarData(dataCitada)}\n${descreverDia(doDia.filter((r) => r.treino === t))}`).join('\n\n');
  }

  return null;
}
