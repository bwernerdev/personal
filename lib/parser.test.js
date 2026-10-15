// Rodar com:  node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpretar, SINONIMOS } from './parser.js';

const rotina = JSON.parse(readFileSync(new URL('../data/rotina.json', import.meta.url), 'utf8'));
const HOJE = '2026-10-13'; // terça-feira
const run = (texto, extra = {}) => interpretar(texto, { rotina, hoje: HOJE, ...extra });

test('treino com atalhos de exercício', () => {
  const r = run('peito: inc 24 5x10, cross 15 4x12, chest 40 4x10');
  assert.equal(r.pronto, true);
  assert.deepEqual(
    r.registros.map((x) => [x.exercicio, x.treino, x.carga, x.series, x.reps, x.data]),
    [
      ['Supino inclinado halter', 'Peito/Tríceps', 24, 5, 10, HOJE],
      ['Crossover (polia alta)', 'Peito/Tríceps', 15, 4, 12, HOJE],
      ['Supino chest press', 'Peito/Tríceps', 40, 4, 10, HOJE],
    ],
  );
});

test('carga decimal com vírgula não quebra o item', () => {
  const r = run('peito: inc 22,5 5x10, voador 30 3x15');
  assert.equal(r.pronto, true);
  assert.equal(r.registros[0].carga, 22.5);
  assert.equal(r.registros[1].exercicio, 'Voador'); // exato vence "Voador invertido"
});

test('data por palavra, dia da semana e dd/mm', () => {
  assert.equal(run('ontem costas: puxada 50 4x12').registros[0].data, '2026-10-12');
  assert.equal(run('seg perna1: ext 50 4x12').registros[0].data, '2026-10-12');
  assert.equal(run('sex perna1: ext 50 4x12').registros[0].data, '2026-10-09');
  assert.equal(run('05/10 ombro: desenv 30 4x10').registros[0].data, '2026-10-05');
});

test('vários blocos em linhas diferentes', () => {
  const r = run('peito: inc 24 5x10\nperna1: ext 50 4x12, agacha 60 5x8');
  assert.equal(r.pronto, true);
  assert.deepEqual(r.registros.map((x) => x.treino), ['Peito/Tríceps', 'Perna 1', 'Perna 1']);
});

test('exercício em dois treinos pede o treino', () => {
  const r = run('mesa 40 4x12');
  assert.equal(r.pronto, false);
  assert.equal(r.pendentes[0].tipo, 'ambiguo_treino');
  assert.equal(r.pendentes[0].sugestoes.length, 2);
  assert.equal(r.pendentes[0].sugestoes[0].texto, 'perna1: mesa 40 4x12');
});

test('com o treino informado, o mesmo exercício resolve', () => {
  const r = run('perna2: mesa 40 4x12');
  assert.equal(r.pronto, true);
  assert.equal(r.registros[0].treino, 'Perna 2');
});

test('atalho ambíguo pergunta qual exercício', () => {
  const r = run('braço: rosca 14 3x12');
  assert.equal(r.pronto, false);
  assert.equal(r.pendentes[0].tipo, 'ambiguo_exercicio');
  assert.equal(r.pendentes[0].sugestoes.length, 3);
});

test('sem séries x reps: pergunta e só usa a rotina quando confirmado', () => {
  const sem = run('peito: inc 24');
  assert.equal(sem.pronto, false);
  assert.equal(sem.pendentes[0].tipo, 'sem_series_reps');
  assert.equal(sem.registros.length, 0);

  const com = run('peito: chest 40', { usarRotina: true });
  assert.equal(com.pronto, true);
  assert.equal(com.registros[0].series, 4);
  assert.equal(com.registros[0].reps, 10);
});

test('faixa de reps da rotina não é chutada', () => {
  const r = run('peito: inc 24', { usarRotina: true });
  assert.equal(r.pronto, false);
  assert.equal(r.pendentes[0].tipo, 'faixa');
});

test('sem carga pergunta, exceto no core', () => {
  assert.equal(run('peito: inc 5x10').pendentes[0].tipo, 'sem_carga');
  const core = run('braço: abd 4x10');
  assert.equal(core.pronto, true);
  assert.equal(core.registros[0].carga, null);
});

test('prancha em segundos vai para observações', () => {
  const r = run('braço: prancha 4x60s');
  assert.equal(r.pronto, true);
  assert.equal(r.registros[0].series, 4);
  assert.equal(r.registros[0].reps, null);
  assert.equal(r.registros[0].obs, '60 s por série');
});

test('exercício fora do treino informado vira erro, nada é gravado', () => {
  const r = run('peito: puxada 50 4x12, inc 24 5x10');
  assert.equal(r.pronto, false);
  assert.equal(r.erros.length, 1);
});

test('treino desconhecido e "perna" sozinho dão erro claro', () => {
  assert.match(run('xyz: inc 24 5x10').erros[0], /Não reconheci o treino/);
  assert.match(run('perna: ext 50 4x12').erros[0], /perna1/);
});

test('nome completo com acento e "peito/tríceps" funcionam', () => {
  const r = run('Peito/Tríceps: Supino inclinado halter 24 5x10');
  assert.equal(r.pronto, true);
});

// ---------- cargas diferentes por série ----------

test('cargas diferentes: cada par é carga x reps e iguais seguidas se juntam', () => {
  const r = run('costas: puxada 50x12 50x12 45x10');
  assert.equal(r.pronto, true);
  assert.deepEqual(
    r.registros.map((x) => [x.carga, x.series, x.reps, x.obs]),
    [
      [50, 2, 12, 'bloco 1/2'],
      [45, 1, 10, 'bloco 2/2'],
    ],
  );
});

test('cargas diferentes com carga decimal; um grupo só não marca bloco', () => {
  const r = run('peito: inc 22,5x10 22,5x10 22,5x8');
  assert.equal(r.pronto, true);
  assert.deepEqual(
    r.registros.map((x) => [x.carga, x.series, x.reps, x.obs]),
    [
      [22.5, 2, 10, 'bloco 1/2'],
      [22.5, 1, 8, 'bloco 2/2'],
    ],
  );
  const igual = run('peito: inc 24x10 24x10 24x10');
  assert.deepEqual(igual.registros.map((x) => [x.carga, x.series, x.reps, x.obs]), [[24, 3, 10, null]]);
});

test('um par só continua sendo séries x reps (carga separada)', () => {
  const r = run('peito: inc 24 5x10');
  assert.deepEqual(r.registros.map((x) => [x.carga, x.series, x.reps, x.obs]), [[24, 5, 10, null]]);
});

test('cargas diferentes misturadas com número solto ou tempo pergunta e não grava', () => {
  const solto = run('peito: inc 24 50x12 50x10');
  assert.equal(solto.pronto, false);
  assert.equal(solto.pendentes[0].tipo, 'confuso');
  const tempo = run('braço: prancha 20x60s 20x45s');
  assert.equal(tempo.pronto, false);
  assert.equal(tempo.registros.length, 0);
});

test('exercício ambíguo mantém os pares na sugestão', () => {
  const r = run('braço: rosca 15x12 15x10');
  assert.equal(r.pendentes[0].tipo, 'ambiguo_exercicio');
  assert.match(r.pendentes[0].sugestoes[0].texto, /15x12 15x10$/);
});

// ---------- jeitos diferentes de escrever ----------

const nomeDe = (texto) => run(texto).registros.map((x) => x.exercicio);

test('sinônimos em português levam ao mesmo exercício', () => {
  assert.deepEqual(nomeDe('peito: supino maquina 40 4x10'), ['Supino chest press']);
  assert.deepEqual(nomeDe('peito: cruzamento 15 4x12'), ['Crossover (polia alta)']);
  assert.deepEqual(nomeDe('perna1: extensao de pernas 50 4x12'), ['Cadeira extensora']);
  assert.deepEqual(nomeDe('perna1: press de pernas 120 4x10'), ['Leg press 45°']);
  assert.deepEqual(nomeDe('perna1: gemeos 40 4x15'), ['Panturrilha em pé']);
  assert.deepEqual(nomeDe('ombro: lateral 10 3x12'), ['Elevação lateral']);
  assert.deepEqual(nomeDe('braço: triceps frances 20 3x12'), ['Tríceps francês']);
});

test('os atalhos antigos continuam funcionando', () => {
  assert.deepEqual(nomeDe('peito: chest 40 4x10'), ['Supino chest press']);
  assert.deepEqual(nomeDe('peito: cross 15 4x12'), ['Crossover (polia alta)']);
  assert.deepEqual(nomeDe('perna1: leg 100 4x10'), ['Leg press 45°']);
  assert.deepEqual(nomeDe('costas: puxada 50 4x12'), ['Puxada alta']);
});

test('erro de digitação e plural são aceitos quando só há uma opção', () => {
  assert.deepEqual(nomeDe('perna1: agachamneto 60 5x8'), ['Agachamento livre']); // letras trocadas
  assert.deepEqual(nomeDe('perna1: extenssora 50 4x12'), ['Cadeira extensora']); // letra a mais
  assert.deepEqual(nomeDe('peito: voadro 30 3x12'), ['Voador']);
});

test('palavra que serve para mais de um exercício continua perguntando', () => {
  const r = run('peito: halteres 20 3x10');
  assert.equal(r.pronto, false);
  assert.equal(r.pendentes[0].tipo, 'ambiguo_exercicio');
  assert.equal(r.pendentes[0].sugestoes.length, 2);
});

test('palavra sem nada parecido vira erro, não chute', () => {
  const r = run('costas: xyzabc 10 3x10');
  assert.equal(r.registros.length, 0);
  assert.match(r.erros[0], /Não achei/);
});

test('"5 séries de 10 repetições", "quilos" e "treino de peito" valem como 5x10, kg e peito', () => {
  const r = run('treino de peito: inc 24 quilos 5 séries de 10 repetições');
  assert.equal(r.pronto, true);
  assert.deepEqual(r.registros.map((x) => [x.treino, x.carga, x.series, x.reps]), [['Peito/Tríceps', 24, 5, 10]]);
});

test('todo nome da rotina e todo apelido leva ao exercício certo dentro do seu treino', () => {
  const problemas = [];
  for (const r of rotina) {
    for (const termo of [r.exercicio, ...(SINONIMOS[r.exercicio] || [])]) {
      const nomes = run(`${r.treino}: ${termo} 10 3x10`).registros.map((x) => x.exercicio);
      if (nomes.length !== 1 || nomes[0] !== r.exercicio) problemas.push(`[${r.treino}] "${termo}" -> ${nomes.join('|') || 'nada'}`);
    }
  }
  assert.deepEqual(problemas, []);
});

test('todo apelido pertence a um exercício que existe na rotina', () => {
  // A rotina de teste só tem os treinos antigos; os exercícios do Full body são testados em full-body.test.js.
  const nomes = new Set([...rotina.map((r) => r.exercicio), 'Tríceps francês ou barra']);
  assert.deepEqual(Object.keys(SINONIMOS).filter((n) => !nomes.has(n)), []);
});

test('nome completo com grau ("Leg press 45°") não confunde o 45 com a carga', () => {
  const r = run('perna1: Leg press 45° 120 4x10');
  assert.deepEqual(r.registros.map((x) => [x.exercicio, x.carga, x.series, x.reps]), [['Leg press 45°', 120, 4, 10]]);
});

test('rotina com Full body: só os treinos ativos aparecem; os antigos ficam em standby', async () => {
  const { treinosDoApp, rotinaDoApp, TREINOS_ATIVOS } = await import('./parser.js');
  const rotina = [
    { exercicio: 'Voador', treino: 'Peito/Tríceps', ordem: 1, grupo: 'Peito', series: 3, reps: '12' },
    { exercicio: 'Voador', treino: 'Full body 2', ordem: 2, grupo: 'Peito', series: null, reps: '' },
  ];
  assert.deepEqual(treinosDoApp(rotina), TREINOS_ATIVOS);
  assert.deepEqual(rotinaDoApp(rotina).map((r) => r.treino), ['Full body 2']);
  const r = interpretar('full2: voador 30 3x12', { rotina: rotinaDoApp(rotina), hoje: '2026-10-13' });
  assert.equal(r.registros[0].treino, 'Full body 2');
});

test('"sem carga", "sem peso" e "peso do corpo" valem 0 kg, sem perguntar', () => {
  for (const frase of ['peito: inc sem carga 4x12', 'peito: inc 4x12 sem peso', 'peito: inc 4x12 peso do corpo']) {
    const r = run(frase);
    assert.equal(r.pronto, true, frase);
    assert.equal(r.registros[0].carga, 0, frase);
  }
  const duas = run('peito: inc 4x12 sem carga, cross 15 4x12');
  assert.deepEqual(duas.registros.map((x) => x.carga), [0, 15]);
});

test('mesmo exercício com outro peso, sem repetir o nome, vira blocos', () => {
  for (const frase of ['peito: inc 50 4x12 e 45 2x10', 'peito: inc 50kg 4x12, 45kg 2x10', 'peito: inc 4x12 50 e 2x10 45']) {
    const r = run(frase);
    assert.equal(r.pronto, true, frase);
    assert.deepEqual(r.registros.map((x) => [x.carga, x.series, x.reps, x.obs]), [[50, 4, 12, 'bloco 1/2'], [45, 2, 10, 'bloco 2/2']], frase);
  }
  const tres = run('peito: inc 24 5x10 e 20 3x12 e 16 2x15');
  assert.deepEqual(tres.registros.map((x) => x.carga), [24, 20, 16]);
  assert.equal(run('peito: inc 50 4x12, cross 15 3x10').registros.length, 2); // exercícios diferentes continuam separados
  assert.equal(run('peito: 45 2x10').pronto, false); // sem exercício algum: continua erro
});
