// Interpretador de palavras-chave: transforma texto livre em registros de treino.
// Exemplo:  "peito: inc 24 5x10, cross 15 4x12"
// Regras completas em docs/README.md.

import { normalizar, tokens } from './normalizar.js';
import { hojeSP, dataDePalavra, dataDiaMes, dataDoDia } from './datas.js';
import { prepararTexto, dividirItens, ENFEITES, DATAS_NA_FRASE } from './linguagem.js';

export const TREINOS = [
  'Peito/Tríceps',
  'Perna 1',
  'Costas/Bíceps',
  'Ombro/Trapézio',
  'Perna 2',
  'Bíceps/Tríceps',
  'Full body 1',
  'Full body 2',
  'Full body 3',
];

// Treinos antigos em standby: continuam no Notion e no histórico, mas somem do app (chips, chat, sugestão).
// Para reativar um, tire-o desta lista.
export const TREINOS_EM_STANDBY = TREINOS.slice(0, 6);
export const TREINOS_ATIVOS = TREINOS.filter((t) => !TREINOS_EM_STANDBY.includes(t));

// Treinos que o app mostra para esta rotina: os ativos, desde que a rotina já os tenha (o arquivo de
// teste data/rotina.json só tem os antigos; nesse caso nada é escondido).
export const treinosDoApp = (rotina) => (rotina.some((r) => TREINOS_ATIVOS.includes(r.treino)) ? TREINOS_ATIVOS : TREINOS_EM_STANDBY);
export const rotinaDoApp = (rotina) => rotina.filter((r) => treinosDoApp(rotina).includes(r.treino));

// Atalho curto que o usuário digita para cada treino (usado nas sugestões).
export const ATALHO = {
  'Peito/Tríceps': 'peito',
  'Perna 1': 'perna1',
  'Costas/Bíceps': 'costas',
  'Ombro/Trapézio': 'ombro',
  'Perna 2': 'perna2',
  'Bíceps/Tríceps': 'braço',
  'Full body 1': 'full1',
  'Full body 2': 'full2',
  'Full body 3': 'full3',
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
  full1: 'Full body 1', fullbody1: 'Full body 1', fb1: 'Full body 1', f1: 'Full body 1',
  full2: 'Full body 2', fullbody2: 'Full body 2', fb2: 'Full body 2', f2: 'Full body 2',
  full3: 'Full body 3', fullbody3: 'Full body 3', fb3: 'Full body 3', f3: 'Full body 3',
  peitoral: 'Peito/Tríceps', costa: 'Costas/Bíceps', dorsal: 'Costas/Bíceps',
})) ALIAS.set(a, t);

const PALAVRAS_IGNORADAS = new Set([
  'rep', 'reps', 'repeticao', 'repeticoes', 'serie', 'series',
  'kg', 'kgs', 'quilo', 'quilos', 'kilo', 'kilos', 'segundo', 'segundos', 'seg',
  'de', 'da', 'do', 'no', 'na', 'x',
  ...ENFEITES, // "fiz", "com", "hoje foi"... não fazem parte do nome do exercício
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
  'Rosca barra W': ['rosca w', 'rosca barra', 'rosca barra w', 'biceps barra', 'biceps barra w', 'rosca direta', 'rosca biceps'],
  'Tríceps francês ou barra': ['triceps frances', 'frances', 'triceps barra', 'triceps polia', 'triceps pulley', 'barra reta'],
  'Rosca concentrada halter': ['concentrada', 'rosca concentrada'],
  Prancha: ['plank', 'prancha isometrica', 'isometrico'],
};
const SINONIMOS_NORM = new Map(Object.entries(SINONIMOS).map(([nome, lista]) => [normalizar(nome), lista]));

// ---------- prefixo (antes dos dois-pontos): treino e/ou data ----------

// Palavras que podem aparecer antes dos dois-pontos sem mudar o treino: "hoje foi dia de costas:".
const PREFIXO_IGNORADO = new Set([...ENFEITES, 'de', 'do', 'da', 'no', 'na', 'dia', 'feira']);

function lerPrefixo(bruto, hoje) {
  let texto = bruto;
  let data = null;

  const m = texto.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    data = dataDiaMes(m[1], m[2], m[3], hoje);
    if (!data) return { erro: `Data inválida: ${m[0]}` };
    texto = texto.replace(m[0], ' ');
  }
  const dia = texto.match(/\bdia\s+(\d{1,2})\b/i);
  if (dia) {
    data = dataDoDia(dia[1], hoje);
    if (!data) return { erro: `Data inválida: ${dia[0]}` };
    texto = texto.replace(dia[0], ' ');
  }

  const restantes = [];
  for (const t of tokens(texto)) {
    const d = dataDePalavra(t, hoje);
    if (d) {
      data = d;
      continue;
    }
    if (PREFIXO_IGNORADO.has(t)) continue; // "treino de peito", "segunda-feira", "fiz", "ontem à noite"
    restantes.push(t);
  }

  const chave = restantes.join(' ');
  if (!chave) return { treino: null, data };
  if (chave === 'perna') return { erro: 'Qual perna: "perna1" ou "perna2"?' };
  const treino = ALIAS.get(chave);
  if (!treino) return { naoETreino: chave, data }; // quem chama decide: pode ser o nome de um exercício
  return { treino, data };
}

// ---------- item: "inc 24 5x10" ----------

// `bruto` é o texto já sem data/treino do meio da frase; `original` é o pedaço como estava na frase
// (é ele que as sugestões trocam no texto). "5 séries de 10" já virou 5x10 em prepararTexto.
function lerItem(bruto, original = bruto) {
  // Número com grau faz parte do nome ("Leg press 45°"), não é carga.
  // Também "banco a 30 graus" / "45 graus": é o ângulo do banco, não carga nem repetição.
  let t = ` ${bruto.trim()} `.replace(/\d+\s*(?:[°º]|graus?(?![\p{L}]))/giu, ' ');
  let series = null;
  let reps = null;
  let segundos = null;
  let blocos = null;

  // "sem carga", "sem peso", "peso do corpo": carga 0 kg (decisão do usuário), não é pergunta nem nome de exercício.
  let semCarga = false;
  t = t.replace(/(?<!\p{L})(?:sem\s+(?:carga|peso|anilhas?|halteres?)|(?:com\s+)?peso\s+(?:do\s+corpo|corporal)|s[oó]\s+o\s+corpo)(?!\p{L})/giu, () => {
    semCarga = true;
    return ' ';
  });

  // Várias séries com cargas diferentes: "50x12 50x10 45x10" (cada par é carga x reps).
  // Só vale com 2 ou mais pares; um par só continua sendo "séries x reps" (ex.: "24 5x10").
  const PAR = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+)(?![a-z0-9])(\s*(?:segundos|seg|s)(?![a-z0-9]))?/gi;
  const pares = [...t.matchAll(PAR)];
  if (pares.length >= 2) {
    blocos = pares.map((m) => ({ carga: Number(m[1].replace(',', '.')), reps: Number(m[2]), emTempo: Boolean(m[3]) }));
    t = t.replace(PAR, ' ');
  }

  // "3x10-12" / "3x10 a 12": faixa do personal, não o que foi feito. Guarda as séries; o chat pergunta as reps.
  let faixa = null;
  if (!blocos) t = t.replace(/(?<![\d.,])(\d{1,2})\s*[x×]\s*(\d{1,2})\s*(?:-|–|a|at[ée])\s*(\d{1,2})(?![\d.,])/iu, (_, s, de, ate) => {
    series = Number(s);
    faixa = `${de} a ${ate}`;
    return ' ';
  });

  // 5x10  |  4x60s
  if (!blocos && !faixa) t = t.replace(/(\d+)\s*[x×]\s*(\d+)\s*(segundos|seg|s)?(?![a-z0-9])/i, (_, s, r, u) => {
    series = Number(s);
    if (u) segundos = Number(r);
    else reps = Number(r);
    return ' ';
  });
  // "4x até a falha", "3x 30kg": só as séries (o "x" sem repetições logo depois); as repetições o chat pergunta.
  const SO_SERIES = /(?<![\d.,])(\d{1,2})\s*[x×](?![\p{L}])(?!\s*\d+(?:[.,]\d+)?(?![\d.,])(?!\s*(?:kgs?|quilos?|kilos?|k)(?!\p{L})))/iu;
  // Só com um "Nx" na frase: "30kg 10x 9x 9x" são as repetições de cada série.
  if (!blocos && series === null && (t.match(/\d\s*[x×](?![\p{L}\d])/giu) || []).length === 1) {
    t = t.replace(SO_SERIES, (_, s) => {
      series = Number(s);
      return ' ';
    });
  }

  // "3 séries" e "10 repetições" ditos separados (o par "3 séries de 10" já virou 3x10 antes).
  if (!blocos && series === null) {
    t = t.replace(/(?<![\d.,])(\d+)\s*s[eé]ries?(?!\p{L})/iu, (_, n) => {
      series = Number(n);
      return ' ';
    });
  }
  if (!blocos && reps === null) {
    t = t.replace(/(?<![\d.,])(\d+)\s*rep(?:eti[cç][aã]o|eti[cç][õo]es|s)?(?!\p{L})/iu, (_, n) => {
      reps = Number(n);
      return ' ';
    });
  }

  // 60s / 45 segundos (prancha)
  if (!blocos && segundos === null) {
    t = t.replace(/(\d+)\s*(segundos|seg|s)(?![a-z0-9])/i, (_, n) => {
      segundos = Number(n);
      return ' ';
    });
  }

  const numeros = [...t.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0]);
  // Carga seguida de 3 ou mais números pequenos, sem "NxM": são as repetições de cada série com a mesma carga.
  // Os números precisam vir juntos ("40kg 12 12 10"); com o nome no meio ("26 23 puxada 15 19") não dá para saber.
  const juntos = /\d+(?:[.,]\d+)?\s*(?:kgs?|quilos?|k)?(?:\s*[,;/-]?\s*\d{1,2}[x×]?(?![\d.,])){3,}/i.test(t);
  if (!blocos && series === null && reps === null && segundos === null && numeros.length >= 4 && juntos) {
    const [primeiro, ...resto] = numeros;
    if (resto.every((r) => /^\d{1,2}$/.test(r) && Number(r) >= 1 && Number(r) <= 40)) {
      blocos = resto.map((r) => ({ carga: Number(primeiro.replace(',', '.')), reps: Number(r), emTempo: false }));
      numeros.length = 0;
    }
  }
  t = t.replace(/\d+(?:[.,]\d+)?\s*(?:kgs?|k)?(?![a-z0-9])/gi, ' ');

  const chave = t
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !PALAVRAS_IGNORADAS.has(normalizar(w)))
    .join(' ');

  return {
    bruto: original.trim(),
    fragmentos: [original.trim()], // pedaços da frase que formam este item (números soltos juntados)
    chave,
    carga: numeros.length === 1 ? Number(numeros[0].replace(',', '.')) : semCarga && numeros.length === 0 ? 0 : null,
    // Com várias séries a carga vem dentro dos pares: número solto ou par em tempo é ambíguo.
    confuso: blocos ? numeros.length > 0 || blocos.some((b) => b.emTempo) : numeros.length > 1,
    blocos,
    series,
    reps,
    segundos,
    faixa,
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

  // 3) Palavras que não existem em nenhum nome da rotina ("leves", "smith") são ignoradas; quem usa
  // isso (`ruido`) pede confirmação ao usuário: o parser não escolhe o exercício sozinho.
  const vocabulario = nomes.flatMap((n) => formas(n).flat());
  const reconhecida = (k) => vocabulario.some((w) => w.startsWith(k) || palavraParecida(k, w));
  const ruido = kt.filter((k) => !reconhecida(k));
  const conhecidas = kt.filter(reconhecida);
  if (ruido.length > 0 && conhecidas.length > 0) {
    const candidatos = nomes.filter((n) => formas(n).some((ft) => conhecidas.every((k) => ft.some((w) => w.startsWith(k) || palavraParecida(k, w)))));
    if (candidatos.length === 1) return { nome: candidatos[0], linhas: porNome.get(candidatos[0]), ruido };
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

// Palavras de treino que valem sozinhas no começo de um item ("peito supino 24 5x10").
const TREINO_NO_COMECO = new Set(['peito', 'costas', 'ombro', 'ombros', 'perna1', 'perna2', 'p1', 'p2', 'braco', 'bracos', 'full1', 'full2', 'full3', 'f1', 'f2', 'f3']); // "peitoral" fica de fora: começa o apelido "peitoral maquina"

const semPontuacao = (w) => w.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');

// Lê um pedaço da frase (entre vírgulas, "e", traços). Pode ser só um cabeçalho ("hoje foi peito"),
// que muda o treino e a data dos itens seguintes (devolve null), ou um item de exercício.
// Data e treino ditos no meio da frase ("ontem", "segunda feira", "dia 10", "peito supino 24 5x10")
// são tirados daqui e vão para o `ctx`.
function lerParte(bruto, hoje, ctx) {
  let texto = bruto;
  // Observação entre parênteses vai para a coluna Observações e não entra na conta dos números.
  const notaAchada = /\(([^()]{1,120})\)/.exec(texto);
  let nota = notaAchada ? notaAchada[1].trim() : '';
  if (notaAchada) texto = texto.replace(notaAchada[0], ' ');
  // Técnicas ("até a falha", "drop set", "rest pause") também são observação, não parte do nome.
  texto = texto.replace(/(?<!\p{L})(?:at[ée]\s+(?:a\s+)?falha|na\s+falha|drop\s*-?\s*sets?|rest\s*-?\s*pause|bi\s*-?\s*sets?)(?!\p{L})/giu, (m) => {
    nota = [nota, m.trim()].filter(Boolean).join(' · ');
    return ' ';
  });

  const dm = texto.match(/(?<![\d.,])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?!\d)/);
  if (dm) {
    const d = dataDiaMes(dm[1], dm[2], dm[3], hoje);
    if (d) {
      ctx.data = d;
      texto = texto.replace(dm[0], ' ');
    }
  }
  const dia = texto.match(/\bdia\s+(\d{1,2})\b(?!\s*\/)/i);
  if (dia) {
    const d = dataDoDia(dia[1], hoje);
    if (d) {
      ctx.data = d;
      texto = texto.replace(dia[0], ' ');
    }
  }

  let palavras = [];
  for (const cru of texto.split(/\s+/).filter(Boolean)) {
    const n = normalizar(semPontuacao(cru));
    if (DATAS_NA_FRASE.has(n)) {
      ctx.data = dataDePalavra(n, hoje);
      continue;
    }
    if (/^(?:perna[12]|full[123])$/.test(n)) {
      ctx.treino = ALIAS.get(n); // "puxada alta 50 4x12 no full2"; não pode ser nome de exercício
      continue;
    }
    if (n !== 'feira') palavras.push(cru);
  }

  const uteis = palavras.filter((w) => !ENFEITES.has(normalizar(semPontuacao(w))));
  const temNumero = /\d/.test(palavras.join(' '));
  if (!temNumero) {
    if (uteis.length === 0) return null; // só data/enfeite: cabeçalho
    const chave = normalizar(uteis.join(' '));
    if (ALIAS.has(chave)) {
      ctx.treino = ALIAS.get(chave);
      return null; // "hoje foi peito"
    }
  }

  // Treino no começo do item: "peito supino inclinado 24 5x10", "perna 2 mesa flexora 30 4x12".
  const primeira = normalizar(semPontuacao(uteis[0] ?? ''));
  const segunda = normalizar(semPontuacao(uteis[1] ?? ''));
  if (uteis.length > 1 || temNumero) {
    if (primeira === 'perna' && /^[12]$/.test(segunda)) {
      ctx.treino = ALIAS.get(`perna ${segunda}`);
      palavras.splice(palavras.indexOf(uteis[0]), 1);
      palavras.splice(palavras.indexOf(uteis[1]), 1);
    } else if (TREINO_NO_COMECO.has(primeira) && (uteis.length > 1 || temNumero)) {
      ctx.treino = ALIAS.get(primeira);
      palavras.splice(palavras.indexOf(uteis[0]), 1);
    }
  }

  const item = lerItem(palavras.join(' '), bruto);
  if (item && nota) item.nota = nota;
  return item;
}

// Número solto numa vírgula ("supino inclinado, 24 quilos, 5x10" ou "24 quilos, 5x10, supino inclinado"):
// junta ao exercício vizinho, só se ele ainda não tem aquele dado (senão não dá para saber a qual se
// refere). Primeiro tenta o exercício de antes; o que sobrar vai para o de depois.
function juntarSoltos(itens) {
  const campos = ['carga', 'series', 'reps', 'segundos', 'blocos'];
  const temDado = (it) => campos.some((c) => it[c] !== null);
  const solto = (x) => !x.it.chave && temDado(x.it) && !x.it.confuso;
  const cabe = (alvo, s) =>
    Boolean(alvo) &&
    Boolean(alvo.it.chave) &&
    !alvo.it.confuso &&
    campos.every((c) => s.it[c] === null || alvo.it[c] === null) &&
    !(s.it.blocos && (alvo.it.series !== null || alvo.it.reps !== null)) &&
    !(alvo.it.blocos && (s.it.series !== null || s.it.reps !== null));
  const juntar = (alvo, s) => {
    for (const c of campos) if (s.it[c] !== null) alvo.it[c] = s.it[c];
    alvo.it.fragmentos.push(...s.it.fragmentos);
  };

  // Mesmo exercício com outro peso, sem repetir o nome: "inc 50 4x12 e 45 2x10" -> 4 séries de 50 e 2 de 45.
  const setsDe = (it) => it.blocos ?? (it.carga !== null && it.series !== null && it.reps !== null && it.segundos === null ? Array.from({ length: it.series }, () => ({ carga: it.carga, reps: it.reps, emTempo: false })) : null);
  const outroPeso = (alvo, s) => Boolean(alvo) && Boolean(alvo.it.chave) && !alvo.it.confuso && !s.it.confuso && setsDe(alvo.it) !== null && setsDe(s.it) !== null;

  const saida = [];
  for (const [i, atual] of itens.entries()) {
    const anterior = saida[saida.length - 1];
    if (solto(atual) && cabe(anterior, atual)) juntar(anterior, atual);
    // Se o próximo item tem nome e ainda não tem esses dados ("24 5x10, supino inclinado"), é dele, não do anterior.
    else if (solto(atual) && outroPeso(anterior, atual) && !cabe(itens[i + 1], atual)) {
      anterior.it.blocos = [...setsDe(anterior.it), ...setsDe(atual.it)];
      anterior.it.carga = anterior.it.series = anterior.it.reps = null;
      anterior.it.fragmentos.push(...atual.it.fragmentos);
    } else saida.push(atual);
  }
  // O que não coube no exercício de antes (números que vêm ANTES do nome): vai para o de depois.
  for (let i = saida.length - 2; i >= 0; i--) {
    if (solto(saida[i]) && cabe(saida[i + 1], saida[i])) {
      juntar(saida[i + 1], saida[i]);
      saida.splice(i, 1);
    }
  }
  return saida;
}

// Troca, no texto original, o pedaço do item (e os números soltos que foram juntados a ele).
function substituir(texto, it, novo) {
  let saida = texto.replace(it.fragmentos[0], () => novo);
  for (const f of it.fragmentos.slice(1)) saida = saida.replace(f, () => '');
  return saida;
}

// treinoDeHoje: treino que o usuário já registrou hoje; desempata exercício que existe em mais de um treino.
// Sem ele, o treino sai da própria mensagem: se os exercícios sem dúvida são todos de um treino só, os que existem
// em vários (flexora, remada...) são desse treino.
export function interpretar(textoOriginal, { rotina, hoje = hojeSP(), usarRotina = false, treinoDeHoje = null } = {}) {
  const opcoes = { rotina, hoje, usarRotina, treinoDeHoje };
  const r = interpretarUmaVez(textoOriginal, opcoes);
  if (treinoDeHoje || !r.pendentes.some((p) => p.tipo === 'ambiguo_treino' || p.tipo === 'ambiguo_exercicio')) return r;
  const treinos = [...new Set(r.registros.filter((x) => x.exercicio !== 'Cardio').map((x) => x.treino))];
  if (treinos.length !== 1) return r;
  const melhor = interpretarUmaVez(textoOriginal, { ...opcoes, treinoDeHoje: treinos[0] });
  return melhor.pendentes.length < r.pendentes.length ? melhor : r;
}

function interpretarUmaVez(textoOriginal, { rotina, hoje, usarRotina, treinoDeHoje }) {
  // Números por extenso, "5 séries de 10" -> 5x10, séries ditas uma a uma -> pares carga x reps. `texto` (já
  // ajustado) é o que as sugestões de resposta trocam.
  const texto = juntarSeriesEmLinhas(prepararTexto(String(textoOriginal)))
    .split(/\r?\n/)
    .map((l) => (naoFez(l) ? l : seriesPorVirgula(ajustarSeries(l))))
    .join('\n');
  const out = { registros: [], pendentes: [], erros: [], pulados: [], pronto: false };
  let ctx = { treino: null, data: null };

  for (const linha of texto.split(/\r?\n/)) {
    if (!linha.trim()) continue;
    if (naoFez(linha)) {
      out.pulados.push(linha.trim()); // "Extensora: não fiz": nada a registrar
      continue;
    }
    const cardio = lerCardio(linha, hoje);
    if (cardio) {
      registrarCardio(cardio, linha.trim(), { rotina, ctx, hoje, treinoDeHoje, out });
      continue;
    }
    let resto = linha;
    let i = linha.indexOf(':');
    if (i < 0) {
      const v = linha.indexOf(',');
      if (v > 0) {
        const p = lerPrefixo(linha.slice(0, v), hoje);
        if (!p.erro && p.naoETreino === undefined && (p.treino || p.data)) i = v;
      }
    }
    // Números antes dos dois-pontos e nada de número depois ("24kg 5x10: supino inclinado"): não é
    // "treino:", é uma frase só com os dados fora de ordem.
    if (i >= 0 && /\d/.test(linha.slice(0, i)) && !/\d/.test(linha.slice(i + 1)) && !/^\s*perna\s*[12]\s*$/i.test(linha.slice(0, i))) {
      resto = `${linha.slice(0, i)} ${linha.slice(i + 1)}`;
    } else if (i >= 0) {
      const antes = linha.slice(0, i);
      const depois = linha.slice(i + 1);
      const p = lerPrefixo(antes, hoje);
      if (p.naoETreino !== undefined) {
        // "supino inclinado: 24 5x10": antes dos dois-pontos está o exercício, não o treino.
        if (/\d/.test(depois) && !acharExercicio(p.naoETreino, rotina, ctx.treino).nenhum) {
          ctx = { treino: ctx.treino, data: p.data ?? ctx.data };
          resto = `${antes} ${depois}`;
        } else {
          out.erros.push(`Não reconheci o treino "${antes.trim()}". Use: ${treinosDoApp(rotina).map((t) => ATALHO[t]).join(', ')}.`);
          continue;
        }
      } else if (p.erro) {
        out.erros.push(p.erro);
        continue;
      } else {
        ctx = { treino: p.treino, data: p.data };
        resto = depois;
      }
    }

    const itens = [];
    // Cardio no fim de uma linha de exercícios: "flexora 30 3x10, cardio 20 min esteira", "... e uns 20 minutos de esteira".
    const k = [CARDIO_NO_MEIO, TEMPO_DE_CARDIO].map((re) => resto.search(re)).filter((p) => p > 0).sort((a, b) => a - b)[0];
    let cardioNoFim = null;
    if (k !== undefined) {
      cardioNoFim = resto.slice(k).replace(/^(?:uns|umas|mais|tamb[ée]m)\s+/iu, '');
      // "... e 20 min de esteira no full 3": o treino dito no fim vale para a linha toda.
      const treinoNoFim = /(?:\s+(?:no|na|do|da))?\s+(full[123]|perna[12])(?!\p{L}|\d)/iu.exec(cardioNoFim);
      if (treinoNoFim) {
        ctx.treino = ALIAS.get(normalizar(treinoNoFim[1]));
        cardioNoFim = cardioNoFim.replace(treinoNoFim[0], '');
      }
      resto = resto.slice(0, k).replace(/(?:\s*(?:[,;]|\be\b|\bdepois\b|\bfiz\b|\buns\b|\bmais\b))+\s*$/u, '');
    }

    for (const bruto of dividirItens(separarPorSeriesXReps(agruparSeries(resto)))) {
      if (!bruto.trim()) continue;
      if (naoFez(bruto)) {
        out.pulados.push(bruto.trim()); // "flexora 30 3x10, a extensora eu não fiz"
        continue;
      }
      const it = lerParte(bruto, hoje, ctx);
      if (it) itens.push({ it, ctx: { ...ctx } });
    }
    for (const { it, ctx: c } of juntarSoltos(itens)) {
      processarItem(it, { texto, rotina, hoje, usarRotina, treinoDeHoje, ctx: c, out });
    }
    if (cardioNoFim) registrarCardio({ obs: descreverCardio(cardioNoFim), treino: null, data: null, descricao: cardioNoFim.trim() }, cardioNoFim.trim(), { rotina, ctx, hoje, treinoDeHoje, out });
  }

  out.pronto = out.registros.length > 0 && out.pendentes.length === 0 && out.erros.length === 0;
  return out;
}

// ---------- linhas que não são "exercício carga NxM": não fiz, cardio e listas de séries ----------

// Exercício que não foi feito, sem número nenhum: "Extensora: não fiz, academia lotada", "não fiz a extensora",
// "pulei a extensora", "Extensora - não fiz", "sem extensora hoje". Não vira registro; fica em `out.pulados`
// para o chat avisar.
const NAO_FEZ = /(?<!\p{L})(?:n[aã]o\s+(?:fiz|fui|consegui|deu|rolou|treinei)|pulei|deixei\s+de\s+fazer|faltou\s+(?:o|a)\s)(?!\p{L})|^\s*sem\s+(?!carga|peso|anilha|halter)\p{L}/iu;
// "full3: não fiz extensora": o número do treino não conta como dado do exercício.
const semNumeroDeTreino = (linha) => linha.replace(/(?<!\p{L})(?:full|fb|f|perna|p)\s*[123](?!\d)/giu, ' ');
const naoFez = (linha) => NAO_FEZ.test(linha) && !/\d/.test(semNumeroDeTreino(linha));

// Cardio: "Cardio: 20min esteira, slope 5% velocidade 6", "full3: cardio 20 min", "esteira 20 min", "bike 30 minutos".
// Vira um registro sem séries, reps nem carga; os dados vão em Observações.
const APARELHOS_DE_CARDIO = 'cardio|esteira|bike|bicicleta|el[ií]ptico|transport|corrida|caminhada|escada|simulador|spinning';
const CARDIO = new RegExp(`^\\s*[-–—•*]?\\s*((?:${APARELHOS_DE_CARDIO})(?!\\p{L}).*\\d.*)$`, 'iu');
// No meio de uma linha de exercícios ("flexora 30 3x10, cardio 20 min"): precisa de tempo ou distância.
const CARDIO_NO_MEIO = new RegExp(`(?<=^|[,;]\\s*|\\s(?:e|depois)\\s)(?:${APARELHOS_DE_CARDIO})(?!\\p{L})(?=[^,;]*\\d+\\s*(?:min|h\\b|hora|km|seg))`, 'iu');

// "20 minutos de esteira", "uns 30 min na bike" (o tempo vem antes do aparelho).
const TEMPO_DE_CARDIO = new RegExp(`(?<=^|[,;]\\s*|\\s(?:e|depois|fiz|mais)\\s)(?:(?:uns|umas|mais)\\s+)?\\d+\\s*(?:min\\p{L}*|h|horas?)\\s+(?:de\\s+|na\\s+|no\\s+)?(?:${APARELHOS_DE_CARDIO})(?!\\p{L})`, 'iu');

function descreverCardio(descricao) {
  return descricao
    .replace(/^\s*cardio(?!\p{L})\s*[:\-–—]?\s*/iu, '')
    .replace(/(\d+)\s*min\p{L}*/giu, '$1 min')
    .replace(/slope/giu, 'inclinação')
    .replace(/(?<!\p{L})incl\.?(?!\p{L})/giu, 'inclinação')
    .replace(/(?<!\p{L})vel\.?(?!\p{L})/giu, 'velocidade')
    .split(/\s*[,;]\s*/)
    .map((p) => p.replace(/\s+(?=(?:inclinação|velocidade)(?!\p{L}))/giu, ' · ').trim().replace(/\.$/, ''))
    .filter(Boolean)
    .join(' · ');
}

// Linha inteira de cardio, com ou sem treino/data antes dos dois-pontos.
function lerCardio(linha, hoje) {
  let corpo = linha;
  let treino = null;
  let data = null;
  const i = linha.indexOf(':');
  if (i > 0) {
    const p = lerPrefixo(linha.slice(0, i), hoje);
    if (!p.erro && p.naoETreino === undefined && (p.treino || p.data)) {
      treino = p.treino;
      data = p.data;
      corpo = linha.slice(i + 1);
    }
  }
  const m = CARDIO.exec(corpo);
  if (!m) return null;
  const descricao = m[1].replace(/^\s*cardio(?!\p{L})\s*[:\-–—]?\s*/iu, '').trim();
  return { obs: descreverCardio(descricao), treino, data, descricao };
}

function registrarCardio(c, bruto, { rotina, ctx, hoje, treinoDeHoje, out }) {
  if (c.data) ctx.data = c.data;
  if (c.treino) ctx.treino = c.treino;
  const treino = ctx.treino ?? out.registros.at(-1)?.treino ?? treinoDeHoje;
  if (!treino) {
    out.pendentes.push({
      item: bruto,
      tipo: 'ambiguo_treino', // o chat tenta de novo com o treino já feito hoje
      mensagem: 'De qual treino é o cardio?',
      sugestoes: treinosDoApp(rotina).map((t) => ({ rotulo: t, texto: `${ATALHO[t]}: cardio ${c.descricao}` })),
    });
    return;
  }
  out.registros.push({ exercicio: 'Cardio', treino, grupo: 'Cardio', data: ctx.data || hoje, series: null, reps: null, carga: null, obs: c.obs });
}

// ---------- séries ditas uma a uma ----------

const CARGA = String.raw`\d+(?:[.,]\d+)?`;
const KG = String.raw`(?:kgs?|quilos?|kilos?|k)(?!\p{L})`;
const REPS = String.raw`(?:reps?|repeti[cç](?:[aã]o|[oõ]es)|vezes)(?!\p{L})`;
const SERIE_REPS_PRIMEIRO = new RegExp(String.raw`^(\d{1,2})\s*(?:${REPS})?\s+(?:com|de)\s+(${CARGA})\s*${KG}$`, 'iu');
const SERIE_CARGA_PRIMEIRO = new RegExp(String.raw`^(?:(${CARGA})(\s*${KG})?(\s*[x×*–—-]\s*|\s+|(?<=\p{L})\s*))?(\d{1,2})(?!\d)\s*(${REPS})?$`, 'iu');

// Uma série sozinha: { carga (texto, ou null = a da série anterior), reps, nota } ou null.
// "30kg 10 reps", "30 x 10", "30kg - 10 reps", "25 10", "10 reps", "10", "10 reps com 30kg", "9 de 30kg", "... (pesada)".
// Sem "kg" nem "reps", "5x10" é séries x reps, não carga x reps: só vale como série se o primeiro número passar de 10.
export function lerSerie(texto) {
  let t = String(texto).trim().replace(/^[-•*]\s*/, '');
  let nota = null;
  const n = /\(([^()]*)\)\.?\s*$/.exec(t);
  if (n) {
    nota = n[1].trim();
    t = t.slice(0, n.index);
  }
  t = t.trim().replace(/\.$/, '').trim();
  const r = SERIE_REPS_PRIMEIRO.exec(t);
  if (r) return { carga: r[2], reps: Number(r[1]), nota };
  const m = SERIE_CARGA_PRIMEIRO.exec(t);
  if (!m || Number(m[4]) < 1) return null;
  const [, carga, kg, sep] = m;
  if (carga !== undefined && !kg && !m[5] && /[x×*]/i.test(sep ?? '') && Number(carga.replace(',', '.')) <= 10) return null;
  return { carga: carga ?? null, reps: Number(m[4]), nota };
}

// Ajustes de uma linha antes de ler (só texto; nada é inventado):
// "1ª série 30kg 10 reps, 2ª série ..." / "série 1: ..." -> sem o número da série;
// "30kg (10, 9, 9)" e "30kg 10/9/9" -> 30x10 30x9 30x9; "30kg 10 reps 30kg 9 reps" (sem vírgula) -> 30x10 30x9.
export function ajustarSeries(linha) {
  let t = linha
    .replace(/(?<![\p{L}\d])(?:\d{1,2}\s*[ªºa°]\s*s[ée]rie|s[ée]rie\s*\d{1,2}|(?:primeira|segunda|terceira|quarta|quinta|[uú]ltima)\s+s[ée]rie)(?!\p{L})\s*:?\s*/giu, ' ')
    .replace(new RegExp(String.raw`(${CARGA})\s*(?:${KG})?\s*\(\s*(\d{1,2}(?:\s*[,;/]\s*\d{1,2})+)\s*\)`, 'giu'), (_, c, lista) =>
      lista.split(/\s*[,;/]\s*/).map((r) => `${c}x${r}`).join(' '))
    .replace(new RegExp(String.raw`(${CARGA})\s*${KG}\s+(\d{1,2}(?:\s*\/\s*\d{1,2})+)(?!\d)`, 'giu'), (_, c, lista) =>
      lista.split(/\s*\/\s*/).map((r) => `${c}x${r}`).join(' '));
  // Vários "carga kg reps reps" no mesmo pedaço, sem vírgula entre eles.
  const PAR = new RegExp(String.raw`(${CARGA})\s*${KG}\s*(?:[x×*–—-]\s*)?(\d{1,2})\s*${REPS}`, 'giu');
  t = t
    .split(/(\s*(?:,(?!\d)|;)\s*)/)
    .map((pedaco) => ((pedaco.match(PAR) || []).length >= 2 ? pedaco.replace(PAR, (_, c, r) => `${c}x${r}`) : pedaco))
    .join('');
  return t;
}

// "Flexora 30kg 10 reps, 30kg 9 reps, 9 reps" -> "Flexora 30x10 30x9 30x9", que o parser já entende como séries com
// cargas diferentes. Vale no meio da linha ("full3: flexora 30 10, 30 9, remada 45 3x12"): o grupo fecha no próximo nome.
export function agruparSeries(trecho) {
  const partes = trecho.split(/\s*(?:,(?!\d)|;)\s*/);
  if (partes.length < 2) return trecho;
  const saida = [];
  let grupo = null;
  const fechar = () => {
    if (grupo && grupo.series.length >= 2) {
      const nota = grupo.notas.length ? ` (${grupo.notas.join('; ')})` : '';
      saida.push(`${grupo.nome} ${grupo.series.map((s) => `${s.carga}x${s.reps}`).join(' ')}${nota}`);
    } else if (grupo) saida.push(...grupo.originais);
    grupo = null;
  };
  for (const p of partes) {
    const s = grupo ? lerSerie(p) : null;
    if (s) {
      grupo.series.push({ carga: s.carga ?? grupo.series.at(-1).carga, reps: s.reps });
      if (s.nota) grupo.notas.push(s.nota);
      grupo.originais.push(p);
      continue;
    }
    fechar();
    const m = /^(.*?\p{L}[^\d]*?)\s*[:—–-]?\s+(\d.*)$/u.exec(p); // nome + primeira série
    const primeira = m ? lerSerie(m[2]) : null;
    if (primeira && primeira.carga !== null) {
      grupo = { nome: m[1].trim(), series: [{ carga: primeira.carga, reps: primeira.reps }], notas: primeira.nota ? [primeira.nota] : [], originais: [p] };
    } else saida.push(p);
  }
  fechar();
  return saida.join(', ');
}

// "Rosca: 15kg 14 reps, 10 reps / 25 9 reps e 25 8" ou "Flexora 30kg: 10, 9, 9" (carga no cabeçalho):
// vira "Rosca: 15x14 15x10 25x9 25x8".
function seriesPorVirgula(linha) {
  const i = linha.indexOf(':');
  // Sem dois-pontos depois do nome: "Supino inclinado 10kg 12 reps, 10 reps e 10 reps" (também depois de "full3: ").
  const sem = /^(\s*[^:\d]{0,30}\d?\s*:)?\s*([^\d:]{2,}?)\s+(\d.*)$/u.exec(linha);
  if (sem && !/:/u.test(sem[3]) && /[,;]|\se\s/u.test(sem[3])) {
    const vira = seriesPorVirgula(`${sem[2].trim()}: ${sem[3]}`);
    if (vira !== `${sem[2].trim()}: ${sem[3]}`) return `${sem[1] ? `${sem[1]} ` : ''}${vira}`;
  }
  if (i < 1) return linha;
  const cabecalho = linha.slice(0, i);
  const numeros = cabecalho.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (numeros.length > 1) return linha;
  let carga = null;
  if (numeros.length === 1) {
    // "Flexora 30kg: 10, 9, 9": a carga está no nome; "full 3: ..." (número do treino) não é carga.
    if (!new RegExp(String.raw`\d+(?:[.,]\d+)?\s*${KG}`, 'iu').test(cabecalho)) return linha;
    carga = numeros[0];
  }
  const partes = linha
    .slice(i + 1)
    .trim()
    .split(/\s*(?:,(?!\d)|;|\/|\s+e\s+)\s*/u)
    .filter(Boolean);
  if (partes.length < 2) return linha;
  const series = [];
  const notas = [];
  for (const p of partes) {
    const s = lerSerie(p);
    if (!s) return linha;
    if (s.carga !== null) carga = s.carga;
    if (carga === null) return linha;
    if (s.nota) notas.push(s.nota);
    series.push(`${carga}x${s.reps}`);
  }
  const nota = notas.length ? ` (${notas.join('; ')})` : '';
  return `${cabecalho.replace(new RegExp(String.raw`\s*\d+(?:[.,]\d+)?\s*${KG}\s*$`, 'iu'), '')}: ${series.join(' ')}${nota}`;
}

// "Flexora:" sozinho numa linha e as séries nas linhas de baixo ("30kg 10 reps", "- 30kg 9 reps"): junta tudo numa linha só.
function juntarSeriesEmLinhas(texto) {
  const linhas = texto.split(/\r?\n/);
  const saida = [];
  for (let k = 0; k < linhas.length; k++) {
    const cabecalho = new RegExp(String.raw`^[^:\d]{2,40}(?:\s+\d+(?:[.,]\d+)?\s*${KG})?\s*:\s*$`, 'iu').test(linhas[k]);
    if (!cabecalho) {
      saida.push(linhas[k]);
      continue;
    }
    const series = [];
    let j = k + 1;
    while (j < linhas.length && linhas[j].trim() && lerSerie(linhas[j])) series.push(linhas[j++].trim().replace(/^[-•*]\s*/, ''));
    if (series.length === 0) {
      saida.push(linhas[k]);
      continue;
    }
    saida.push(`${linhas[k].trim()} ${series.join(', ')}`);
    k = j - 1;
  }
  return saida.join('\n');
}

// Vários exercícios sem vírgula: "puxada 45 4x10 extensora 40 3x15" -> a série "4x10" fecha o item.
// Palavras que continuam o mesmo item ("5x10 com 24 quilos", "3x12 cada") não separam.
const CONTINUA_O_ITEM = '(?:kgs?|quilos?|kilos?|reps?|repeticoes|repetições|series|séries|serie|série|vezes|cada|com|em|no|na|de|do|da|e|ou|a|o|na|ate|até|segundos?|seg)';
function separarPorSeriesXReps(texto) {
  const continua = `(?:${CONTINUA_O_ITEM}|${[...ENFEITES].join('|')})`;
  return texto.replace(new RegExp(`(\\d+\\s*[x×]\\s*\\d+(?:\\s*s\\b)?)\\s+(?=(?!${continua}(?![\\p{L}]))\\p{L}{3,})`, 'giu'), '$1, ');
}

const juntarObs = (base, it) => [base, it.nota].filter(Boolean).join(' · ') || null;

function processarItem(it, { texto, rotina, hoje, usarRotina, treinoDeHoje, ctx, out }) {
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

  let achado = acharExercicio(it.chave, rotina, ctx.treino);
  // Em dúvida entre exercícios de treinos diferentes ("tríceps barra"), vale o treino de hoje.
  if (achado.ambiguo && !ctx.treino && treinoDeHoje) {
    const doTreino = acharExercicio(it.chave, rotina, treinoDeHoje);
    if (doTreino.nome && !doTreino.ruido) achado = doTreino;
  }

  // Palavra de treino fora do lugar ("supino inclinado peito", "puxada alta costas 50 4x12"):
  // tira a palavra, usa como treino e procura de novo. Só vale se der um exercício daquele treino.
  if ((achado.nenhum || achado.ambiguo || achado.ruido) && !ctx.treino) {
    const palavras = it.chave.split(' ');
    const doTreino = palavras.find((p) => TREINO_NO_COMECO.has(normalizar(p)));
    if (doTreino && palavras.length > 1) {
      const semEla = palavras.filter((p) => p !== doTreino).join(' ');
      const treinoDito = ALIAS.get(normalizar(doTreino));
      const tentativa = acharExercicio(semEla, rotina, treinoDito);
      if (!tentativa.nenhum) {
        achado = tentativa;
        ctx.treino = treinoDito;
        it.chave = semEla;
      } else {
        const livre = acharExercicio(semEla, rotina, null);
        if (!livre.nenhum && !livre.ambiguo && !livre.ruido) {
          achado = livre;
          it.chave = semEla;
        }
      }
    }
  }

  // "desenvolvimento de ombro maquina": "ombro" aqui é parte do nome, não o treino. Tenta de novo sem a palavra.
  if (achado.nenhum) {
    const sem = it.chave.split(' ').filter((p) => !TREINO_NO_COMECO.has(normalizar(p))).join(' ');
    if (sem && sem !== it.chave) {
      const outra = acharExercicio(sem, rotina, ctx.treino);
      if (!outra.nenhum && !outra.ambiguo && !outra.ruido) {
        achado = outra;
        it.chave = sem;
      }
    }
  }

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
        texto: substituir(texto, it, `${nome} ${resto}`.trim()),
      })),
    });
    return;
  }

  const { nome, linhas } = achado;
  if (achado.ruido) {
    // Achou por eliminação (ignorou palavras que não existem na rotina): não chuta, confirma.
    out.pendentes.push({
      item: it.bruto,
      tipo: 'confirmar_exercicio',
      mensagem: `Entendi "${nome}" (ignorei: ${achado.ruido.join(', ')}). É esse exercício?`,
      sugestoes: [{ rotulo: nome, texto: substituir(texto, it, `${nome} ${restoDoItem(it)}`.trim()) }],
    });
    return;
  }

  let treino = ctx.treino;
  if (!treino) {
    const treinos = [...new Set(linhas.map((l) => l.treino))];
    if (treinos.length > 1 && treinoDeHoje && treinos.includes(treinoDeHoje)) {
      treino = treinoDeHoje;
    } else if (treinos.length > 1) {
      out.pendentes.push({
        item: it.bruto,
        tipo: 'ambiguo_treino',
        mensagem: `${nome} existe em mais de um treino (${treinos.join(' e ')}). Qual foi?`,
        sugestoes: treinos.map((t) => ({
          rotulo: t,
          texto: substituir(texto, it, `${ATALHO[t]}: ${it.fragmentos.join(' ')}`),
        })),
      });
      return;
    }
    treino = treino || treinos[0];
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
        obs: juntarObs(grupos.length > 1 ? `bloco ${i + 1}/${grupos.length}` : null, it),
      });
    });
    return;
  }

  let { series, reps, segundos } = it;

  if (it.faixa && reps === null) {
    const [de] = it.faixa.split(' a ');
    out.pendentes.push({
      item: it.bruto,
      tipo: 'faixa',
      mensagem: `Em ${nome} você escreveu a faixa ${it.faixa}. Quantas repetições fez? Por exemplo: ${it.chave} ${it.carga ?? 20} ${series}x${de}.`,
    });
    return;
  }

  // Disse só um dos dois ("3 séries" ou "10 repetições"): pergunta o que falta, não completa.
  if (segundos === null && (series === null) !== (reps === null)) {
    out.pendentes.push({
      item: it.bruto,
      tipo: 'sem_series_reps',
      mensagem: `Faltou ${series === null ? 'o número de séries' : 'o número de repetições'} em ${nome}. Diga séries x reps, por exemplo: ${it.chave} ${it.carga ?? 20} ${series ?? 4}x${reps ?? 10}.`,
    });
    return;
  }

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
        mensagem: linha.series
          ? `Faltou séries x reps em ${nome}. O personal pediu ${linha.series}x${linha.reps}. Foi isso?`
          : `Faltou séries x reps em ${nome}. Quantas séries e repetições? Por exemplo: ${it.chave} ${it.carga ?? 20} 4x12.`,
        oferecerRotina: Boolean(linha.series),
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
    obs: juntarObs(segundos !== null ? `${segundos} s por série` : null, it),
  });
}
