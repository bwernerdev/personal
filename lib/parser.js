// Interpretador de palavras-chave: transforma texto livre em registros de treino.
// Exemplo:  "peito: inc 24 5x10, cross 15 4x12"
// Regras completas em docs/README.md.

import { normalizar, tokens } from './normalizar.js';
import { hojeSP, dataDePalavra, dataDiaMes } from './datas.js';

export const TREINOS = [
  'Peito/Tríceps',
  'Perna 1',
  'Costas/Bíceps',
  'Ombro/Trapézio',
  'Perna 2',
  'Bíceps/Tríceps',
];

// Atalho curto que o usuário digita para cada treino (usado nas sugestões).
export const ATALHO = {
  'Peito/Tríceps': 'peito',
  'Perna 1': 'perna1',
  'Costas/Bíceps': 'costas',
  'Ombro/Trapézio': 'ombro',
  'Perna 2': 'perna2',
  'Bíceps/Tríceps': 'braço',
};

const ALIAS = new Map();
for (const t of TREINOS) ALIAS.set(normalizar(t), t);
for (const [a, t] of Object.entries({
  peito: 'Peito/Tríceps',
  perna1: 'Perna 1', p1: 'Perna 1',
  perna2: 'Perna 2', p2: 'Perna 2',
  costas: 'Costas/Bíceps',
  ombro: 'Ombro/Trapézio', ombros: 'Ombro/Trapézio', trap: 'Ombro/Trapézio', trapezio: 'Ombro/Trapézio',
  braco: 'Bíceps/Tríceps', bracos: 'Bíceps/Tríceps', biceps: 'Bíceps/Tríceps', triceps: 'Bíceps/Tríceps',
  peitoral: 'Peito/Tríceps', costa: 'Costas/Bíceps', dorsal: 'Costas/Bíceps',
})) ALIAS.set(a, t);

const PALAVRAS_IGNORADAS = new Set([
  'rep', 'reps', 'repeticao', 'repeticoes', 'serie', 'series',
  'kg', 'kgs', 'quilo', 'quilos', 'kilo', 'kilos',
  'de', 'da', 'do', 'no', 'na', 'x',
]);

// Outros jeitos de chamar o mesmo exercício (chave = nome na rotina). Cada apelido é testado como
// o próprio nome: começo de cada palavra, em qualquer ordem. Não crie apelido que comece com uma
// palavra que já identifica outro exercício sozinha (ex.: "puxada ..."), senão ela passa a perguntar.
export const SINONIMOS = {
  // Peito / Tríceps
  'Fortalecimento manguito halter': ['manguito', 'manguito halter', 'manguito rotador', 'rotacao externa', 'fortalecimento'],
  'Supino inclinado halter': ['supino inc', 'supino inclinado', 'inclinado', 'inclinado halter', 'supino halter inclinado', 'incline'],
  'Crossover (polia alta)': ['cross', 'cross over', 'cruzamento', 'cruzamento polia', 'cruzamento de cabos', 'cabos'],
  'Supino chest press': ['chest', 'chest press', 'supino maquina', 'supino reto maquina', 'supino articulado', 'press peitoral', 'press de peito', 'peitoral maquina'],
  Voador: ['fly', 'peck deck', 'peck', 'crucifixo', 'crucifixo maquina', 'abertura'],
  'Tríceps máquina': ['triceps maq', 'triceps articulado', 'extensao de triceps maquina'],
  'Tríceps corda': ['triceps na corda', 'corda', 'triceps pulley corda'],

  // Perna 1 / Perna 2
  'Cadeira extensora': ['extensora', 'extensao', 'extensao de pernas', 'extensao de joelho'],
  'Agachamento livre': ['agachamento', 'agacha', 'agacho', 'squat', 'agachamento barra', 'agachamento com barra'],
  'Mesa flexora': ['flexora', 'flexao', 'flexao de pernas', 'flexao de joelho', 'flexora deitada'],
  'Leg press 45°': ['leg', 'leg press', 'legpress', 'press de pernas'],
  'Cadeira adutora': ['adutora', 'adutor', 'aducao'],
  'Cadeira abdutora': ['abdutora', 'abdutor', 'abducao'],
  'Panturrilha em pé': ['panturrilha', 'panturrilha de pe', 'gemeos', 'gemeos em pe', 'calf'],

  // Costas / Bíceps (cuidado: nenhum apelido de outro exercício pode começar com "puxada")
  'Puxada alta': ['puxada frontal', 'puxada na frente', 'puxada aberta', 'pulley alto'],
  'Remada máquina (serrote)': ['remada serrote', 'remada unilateral', 'serrote'],
  'Pulldown polia ou máquina': ['pull down', 'lat pulldown', 'lat pull down'],
  'Puxador supinado máquina': ['puxador', 'puxador supinado', 'supinada', 'supinado'],
  'Remada baixa': ['remada sentada', 'remada baixa polia', 'pulley baixo'],
  'Rosca direta barra W': ['rosca direta', 'rosca direta w', 'rosca w', 'rosca barra'],
  'Abdominal remador': ['remador', 'abd remador', 'abdominal maquina'],
  'Infra no chão': ['infra', 'infra chao', 'infra abdominal', 'abdominal infra'],

  // Ombro / Trapézio
  'Fortalecimento manguito polia': ['manguito', 'manguito polia', 'manguito rotador', 'rotacao externa', 'fortalecimento'],
  'Desenvolvimento máquina': ['desenv', 'desenvolvimento', 'press de ombro', 'press ombro', 'ombro maquina', 'shoulder press'],
  'Elevação lateral': ['lateral', 'elev lateral', 'lateral halter'],
  'Elevação frontal': ['frontal', 'elev frontal'],
  'Voador invertido': ['fly invertido', 'reverse fly', 'voador reverso', 'crucifixo invertido', 'posterior de ombro'],
  'Encolhimento ombro': ['encolhimento', 'trapezio', 'shrug'],

  // Bíceps / Tríceps
  'Tríceps barra reta polia': ['triceps barra', 'triceps polia', 'triceps pulley', 'barra reta'],
  'Tríceps coice': ['coice', 'kickback', 'triceps kickback'],
  'Tríceps francês': ['frances', 'triceps frances'],
  'Rosca martelo': ['martelo', 'hammer'],
  'Rosca barra W': ['rosca w', 'rosca barra', 'rosca barra w'],
  'Rosca concentrada halter': ['concentrada', 'rosca concentrada'],
  Prancha: ['plank', 'prancha isometrica', 'isometrico'],
};
const SINONIMOS_NORM = new Map(Object.entries(SINONIMOS).map(([nome, lista]) => [normalizar(nome), lista]));

// ---------- prefixo (antes dos dois-pontos): treino e/ou data ----------

function lerPrefixo(bruto, hoje) {
  let texto = bruto;
  let data = null;

  const m = texto.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    data = dataDiaMes(m[1], m[2], m[3], hoje);
    if (!data) return { erro: `Data inválida: ${m[0]}` };
    texto = texto.replace(m[0], ' ');
  }

  const restantes = [];
  for (const t of tokens(texto)) {
    if (t === 'feira' || t === 'treino' || t === 'de' || t === 'do' || t === 'da') continue; // "treino de peito", "seg-feira"
    const d = dataDePalavra(t, hoje);
    if (d) {
      data = d;
      continue;
    }
    restantes.push(t);
  }

  const chave = restantes.join(' ');
  if (!chave) return { treino: null, data };
  if (chave === 'perna') return { erro: 'Qual perna: "perna1" ou "perna2"?' };
  const treino = ALIAS.get(chave);
  if (!treino) {
    return { erro: `Não reconheci o treino "${bruto.trim()}". Use: peito, perna1, costas, ombro, perna2 ou braço.` };
  }
  return { treino, data };
}

// ---------- item: "inc 24 5x10" ----------

function lerItem(bruto) {
  // "5 séries de 10 repetições" = "5x10"
  // Número com grau faz parte do nome ("Leg press 45°"), não é carga.
  let t = ` ${bruto.trim()} `
    .replace(/\d+\s*[°º]/g, ' ')
    .replace(/(\d+)\s*s[eé]ries?\s*(?:de|com|x)?\s*(\d+)/gi, ' $1x$2 ');
  let series = null;
  let reps = null;
  let segundos = null;
  let blocos = null;

  // Várias séries com cargas diferentes: "50x12 50x10 45x10" (cada par é carga x reps).
  // Só vale com 2 ou mais pares; um par só continua sendo "séries x reps" (ex.: "24 5x10").
  const PAR = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+)(?![a-z0-9])(\s*(?:segundos|seg|s)(?![a-z0-9]))?/gi;
  const pares = [...t.matchAll(PAR)];
  if (pares.length >= 2) {
    blocos = pares.map((m) => ({ carga: Number(m[1].replace(',', '.')), reps: Number(m[2]), emTempo: Boolean(m[3]) }));
    t = t.replace(PAR, ' ');
  }

  // 5x10  |  4x60s
  if (!blocos) t = t.replace(/(\d+)\s*[x×]\s*(\d+)\s*(segundos|seg|s)?(?![a-z0-9])/i, (_, s, r, u) => {
    series = Number(s);
    if (u) segundos = Number(r);
    else reps = Number(r);
    return ' ';
  });

  // 60s (prancha sem séries)
  if (series === null && !blocos) {
    t = t.replace(/(\d+)\s*(segundos|seg|s)(?![a-z0-9])/i, (_, n) => {
      segundos = Number(n);
      return ' ';
    });
  }

  const numeros = [...t.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0]);
  t = t.replace(/\d+(?:[.,]\d+)?\s*(?:kgs?|k)?(?![a-z0-9])/gi, ' ');

  const chave = t
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !PALAVRAS_IGNORADAS.has(normalizar(w)))
    .join(' ');

  return {
    bruto: bruto.trim(),
    chave,
    carga: numeros.length === 1 ? Number(numeros[0].replace(',', '.')) : null,
    // Com várias séries a carga vem dentro dos pares: número solto ou par em tempo é ambíguo.
    confuso: blocos ? numeros.length > 0 || blocos.some((b) => b.emTempo) : numeros.length > 1,
    blocos,
    series,
    reps,
    segundos,
  };
}

function restoDoItem(it) {
  if (it.blocos) return it.blocos.map((b) => `${b.carga}x${b.reps}`).join(' ');
  const partes = [];
  if (it.carga !== null) partes.push(`${it.carga}kg`);
  if (it.series !== null) partes.push(`${it.series}x${it.reps !== null ? it.reps : `${it.segundos}s`}`);
  return partes.join(' ');
}

// ---------- busca do exercício na rotina ----------

function acharExercicio(chave, rotina, treino) {
  const universo = treino ? rotina.filter((r) => r.treino === treino) : rotina;
  const porNome = new Map();
  for (const r of universo) {
    if (!porNome.has(r.exercicio)) porNome.set(r.exercicio, []);
    porNome.get(r.exercicio).push(r);
  }
  const nomes = [...porNome.keys()];
  const alvo = normalizar(chave);

  const exatos = nomes.filter((n) => normalizar(n) === alvo);
  if (exatos.length === 1) return { nome: exatos[0], linhas: porNome.get(exatos[0]) };

  const kt = tokens(chave);
  // Cada exercício pode ser chamado pelo nome ou por um sinônimo.
  const formas = (n) => [n, ...(SINONIMOS_NORM.get(normalizar(n)) || [])].map(tokens);
  const achar = (casa) => nomes.filter((n) => formas(n).some((ft) => kt.every((k) => ft.some((w) => casa(k, w)))));

  // 1) começo de cada palavra; 2) tolerante: plural/singular e uma letra errada, trocada ou faltando.
  const etapas = [(k, w) => w.startsWith(k), palavraParecida];
  for (const casa of etapas) {
    const candidatos = achar(casa);
    if (candidatos.length === 1) return { nome: candidatos[0], linhas: porNome.get(candidatos[0]) };
    if (candidatos.length > 1) return { ambiguo: candidatos };
  }
  return { nenhum: true };
}

// "halteres" ~ "halter", "agachamneto" ~ "agachamento". Só em palavras de 5+ letras, para não confundir curtas.
function palavraParecida(k, w) {
  if (k.length < 5 || w.length < 5) return false;
  if (k.startsWith(w) && k.length - w.length <= 2) return true; // plural
  if (Math.abs(k.length - w.length) > 1) return false;
  if (k === w) return true;
  let i = 0;
  while (k[i] === w[i]) i++;
  const [ak, aw] = [k.slice(i), w.slice(i)];
  return (
    ak.slice(1) === aw.slice(1) || //                   uma letra trocada
    ak.slice(1) === aw || aw.slice(1) === ak || //      uma letra a mais ou a menos
    (ak[0] === aw[1] && ak[1] === aw[0] && ak.slice(2) === aw.slice(2)) // duas letras trocadas de lugar
  );
}

// "50x12 50x12 45x10" -> [{carga 50, reps 12, series 2}, {carga 45, reps 10, series 1}]
function agruparBlocos(blocos) {
  const grupos = [];
  for (const b of blocos) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.carga === b.carga && ultimo.reps === b.reps) ultimo.series += 1;
    else grupos.push({ carga: b.carga, reps: b.reps, series: 1 });
  }
  return grupos;
}

// ---------- função principal ----------

export function interpretar(texto, { rotina, hoje = hojeSP(), usarRotina = false } = {}) {
  const out = { registros: [], pendentes: [], erros: [], pronto: false };
  let ctx = { treino: null, data: null };

  for (const linha of String(texto).split(/\r?\n/)) {
    if (!linha.trim()) continue;
    let resto = linha;
    const i = linha.indexOf(':');
    if (i >= 0) {
      const p = lerPrefixo(linha.slice(0, i), hoje);
      if (p.erro) {
        out.erros.push(p.erro);
        continue;
      }
      ctx = { treino: p.treino, data: p.data };
      resto = linha.slice(i + 1);
    }

    for (const bruto of resto.split(/\s*(?:;|,(?!\d))\s*/)) {
      if (!bruto.trim()) continue;
      processarItem(lerItem(bruto), { texto, rotina, hoje, usarRotina, ctx, out });
    }
  }

  out.pronto = out.registros.length > 0 && out.pendentes.length === 0 && out.erros.length === 0;
  return out;
}

function processarItem(it, { texto, rotina, hoje, usarRotina, ctx, out }) {
  if (!it.chave) {
    out.erros.push(`Não entendi "${it.bruto}": falta o nome do exercício.`);
    return;
  }
  if (it.confuso) {
    out.pendentes.push({
      item: it.bruto,
      tipo: 'confuso',
      mensagem: `Não entendi os números de "${it.bruto}". Use carga e séries x reps (${it.chave} 24 5x10) ou carga x reps de cada série (${it.chave} 50x12 50x10 45x10).`,
    });
    return;
  }

  const achado = acharExercicio(it.chave, rotina, ctx.treino);
  if (achado.nenhum) {
    out.erros.push(`Não achei "${it.chave}"${ctx.treino ? ` no treino ${ctx.treino}` : ' na rotina'}.`);
    return;
  }
  if (achado.ambiguo) {
    const resto = restoDoItem(it);
    out.pendentes.push({
      item: it.bruto,
      tipo: 'ambiguo_exercicio',
      mensagem: `"${it.chave}" pode ser mais de um exercício. Qual deles?`,
      sugestoes: achado.ambiguo.map((nome) => ({
        rotulo: nome,
        texto: texto.replace(it.bruto, `${nome} ${resto}`.trim()),
      })),
    });
    return;
  }

  const { nome, linhas } = achado;
  let treino = ctx.treino;
  if (!treino) {
    const treinos = [...new Set(linhas.map((l) => l.treino))];
    if (treinos.length > 1) {
      out.pendentes.push({
        item: it.bruto,
        tipo: 'ambiguo_treino',
        mensagem: `${nome} existe em mais de um treino (${treinos.join(' e ')}). Qual foi?`,
        sugestoes: treinos.map((t) => ({
          rotulo: t,
          texto: texto.replace(it.bruto, `${ATALHO[t]}: ${it.bruto}`),
        })),
      });
      return;
    }
    treino = treinos[0];
  }

  const linha = linhas.find((l) => l.treino === treino) || linhas[0];

  if (it.blocos) {
    const grupos = agruparBlocos(it.blocos);
    grupos.forEach((g, i) => {
      out.registros.push({
        exercicio: nome,
        treino,
        grupo: linha.grupo,
        data: ctx.data || hoje,
        series: g.series,
        reps: g.reps,
        carga: g.carga,
        obs: grupos.length > 1 ? `bloco ${i + 1}/${grupos.length}` : null,
      });
    });
    return;
  }

  let { series, reps, segundos } = it;

  if (series === null && reps === null && segundos === null) {
    if (usarRotina) {
      const seg = /^(\d+)\s*s$/i.exec(linha.reps);
      if (seg) {
        series = linha.series;
        segundos = Number(seg[1]);
      } else if (/^\d+$/.test(linha.reps)) {
        series = linha.series;
        reps = Number(linha.reps);
      } else {
        out.pendentes.push({
          item: it.bruto,
          tipo: 'faixa',
          mensagem: `O personal pediu ${linha.series}x${linha.reps} em ${nome} (faixa). Informe as reps feitas, por exemplo: ${it.chave} ${it.carga ?? 20} ${linha.series}x10.`,
        });
        return;
      }
    } else {
      out.pendentes.push({
        item: it.bruto,
        tipo: 'sem_series_reps',
        mensagem: `Faltou séries x reps em ${nome}. O personal pediu ${linha.series}x${linha.reps}. Foi isso?`,
        oferecerRotina: true,
      });
      return;
    }
  }

  if (it.carga === null && linha.grupo !== 'Core') {
    out.pendentes.push({
      item: it.bruto,
      tipo: 'sem_carga',
      mensagem: `Qual foi a carga de ${nome}? Ex.: ${it.chave} 20 ${series ?? linha.series}x${reps ?? 10}.`,
    });
    return;
  }

  out.registros.push({
    exercicio: nome,
    treino,
    grupo: linha.grupo,
    data: ctx.data || hoje,
    series,
    reps,
    carga: it.carga,
    obs: segundos !== null ? `${segundos} s por série` : null,
  });
}
