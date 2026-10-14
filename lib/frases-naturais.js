// Frases como as pessoas escrevem de verdade, com o que as regras devem fazer com cada uma.
// Usadas por frases-naturais.test.js (hoje = terça, 2026-10-13). Para ver quantas as regras
// resolvem sozinhas (sem a IA): node lib/frases-naturais.js
//
// esperado:
//   { ok: [[exercício, carga, séries, reps, data?], ...] }  grava direto (pronto)
//   { pergunta: 'tipo' }                                      as regras perguntam (nada grava)
//   'ia'                                                      as regras não entendem: só aí a IA ajuda

const SUPINO = 'Supino inclinado halter';
const CROSS = 'Crossover (polia alta)';
const PUXADA = 'Puxada alta';
const HOJE = '2026-10-13';
const ONTEM = '2026-10-12';

export const FRASES = [
  // --- formato do app (já funcionava) ---
  ['peito: inc 24 5x10, cross 15 4x12', { ok: [[SUPINO, 24, 5, 10], [CROSS, 15, 4, 12]] }],
  ['inc 24 5x10', { ok: [[SUPINO, 24, 5, 10]] }],
  ['ontem peito: inc 24 5x10', { ok: [[SUPINO, 24, 5, 10, ONTEM]] }],

  // --- palavras de enfeite e quem fez o quê ---
  ['hoje fiz supino inclinado com 24 quilos 5 séries de 10', { ok: [[SUPINO, 24, 5, 10, HOJE]] }],
  ['fiz o supino chest press com 40 quilos, 4 séries de 10', { ok: [['Supino chest press', 40, 4, 10]] }],
  ['treinei peito hoje: inc 24 5x10', { ok: [[SUPINO, 24, 5, 10]] }],
  ['Hoje foi dia de costas: puxada 50 4x12', { ok: [[PUXADA, 50, 4, 12]] }],
  ['treino de costas hoje: puxada 50 4x12, remada baixa 45 4x12', { ok: [[PUXADA, 50, 4, 12], ['Remada baixa', 45, 4, 12]] }],
  ['ontem à noite fiz braço: rosca martelo 12 3x12', { ok: [['Rosca martelo', 12, 3, 12, ONTEM]] }],
  ['supino inclinado 24 5x10.', { ok: [[SUPINO, 24, 5, 10]] }],

  // --- vários exercícios na mesma frase ---
  ['fiz supino inclinado 24kg 5x10 e crossover 15kg 4x12', { ok: [[SUPINO, 24, 5, 10], [CROSS, 15, 4, 12]] }],
  ['peito: supino inclinado 24 5x10 e depois crossover 15 4x12', { ok: [[SUPINO, 24, 5, 10], [CROSS, 15, 4, 12]] }],
  ['peito: voador 30 3x15 e supino inclinado 24 5x10', { ok: [['Voador', 30, 3, 15], [SUPINO, 24, 5, 10]] }],
  ['supino inclinado 24 5x10 - crossover 15 4x12', { ok: [[SUPINO, 24, 5, 10], [CROSS, 15, 4, 12]] }],

  // --- números por extenso e jeitos de dizer séries x repetições ---
  ['fiz cinco séries de dez no supino inclinado com vinte e quatro', { ok: [[SUPINO, 24, 5, 10]] }],
  ['crossover quatro de doze com quinze quilos', { ok: [[CROSS, 15, 4, 12]] }],
  ['puxada alta vinte e cinco quilos 4x12', { ok: [[PUXADA, 25, 4, 12]] }],
  ['supino inclinado vinte e dois e meio 5x10', { ok: [[SUPINO, 22.5, 5, 10]] }],
  ['peito: inclinado 24 5 séries 10 repetições', { ok: [[SUPINO, 24, 5, 10]] }],
  ['peito: inc 24 10 repetições em 5 séries', { ok: [[SUPINO, 24, 5, 10]] }],
  ['costas: puxada 4 séries de 12 com 50 quilos', { ok: [[PUXADA, 50, 4, 12]] }],
  ['peito: cross 15 4 por 12', { ok: [[CROSS, 15, 4, 12]] }],
  ['braço: prancha 3 vezes de 45 segundos', { ok: [['Prancha', null, 3, null]] }],

  // --- números separados do nome, por vírgula ou traço ---
  ['hoje fiz supino inclinado com 24 quilos, 5 séries de 10', { ok: [[SUPINO, 24, 5, 10, HOJE]] }],
  ['supino inclinado 24 quilos, 5x10', { ok: [[SUPINO, 24, 5, 10]] }],
  ['Supino Inclinado Halter, 24kg, 5x10', { ok: [[SUPINO, 24, 5, 10]] }],
  ['supino inclinado - 24 - 5x10', { ok: [[SUPINO, 24, 5, 10]] }],

  // --- data e treino fora do lugar de sempre ---
  ['segunda feira costas puxada alta 50 4x12', { ok: [[PUXADA, 50, 4, 12, ONTEM]] }],
  ['peito supino inclinado 24 5x10', { ok: [[SUPINO, 24, 5, 10]] }],
  ['hoje foi peito, supino inclinado 24 5x10', { ok: [[SUPINO, 24, 5, 10, HOJE]] }],
  ['ontem fiz supino inclinado 24 5x10, crossover 15 4x12', { ok: [[SUPINO, 24, 5, 10, ONTEM], [CROSS, 15, 4, 12, ONTEM]] }],
  ['dia 10 peito: inc 24 5x10', { ok: [[SUPINO, 24, 5, 10, '2026-10-10']] }],
  ['perna dois: mesa flexora 30 4x12', { ok: [['Mesa flexora', 30, 4, 12]] }],
  ['ontem: supino inclinado 24 5x10', { ok: [[SUPINO, 24, 5, 10, ONTEM]] }],
  ['supino inclinado: 24 5x10', { ok: [[SUPINO, 24, 5, 10]] }],

  // --- nome do exercício mais solto ---
  ['supino reto na maquina 40 4x10', { ok: [['Supino chest press', 40, 4, 10]] }],
  ['panturrilha em pé 40 4x15', { pergunta: 'ambiguo_treino' }], // existe em Perna 1 e Perna 2,
  ['ombro: elevação lateral 10 3x12, elevação frontal 10 3x12', { ok: [['Elevação lateral', 10, 3, 12], ['Elevação frontal', 10, 3, 12]] }],
  ['supino inclinado com halteres 24 5x10', { ok: [[SUPINO, 24, 5, 10]] }],
  ['supino inclinado com halteres leves 24 5x10', { pergunta: 'confirmar_exercicio' }], // palavra sobrando: confirma, não chuta

  // --- falta informação: as regras perguntam (nada grava) ---
  ['agachamento 60 5x8, mesa flexora 30 4x12', { pergunta: 'ambiguo_treino' }],
  ['peito: inc 24 3 séries', { pergunta: 'sem_series_reps' }],
  ['peito: inc 24 10 repetições', { pergunta: 'sem_series_reps' }],
  ['peito: inc 5x10', { pergunta: 'sem_carga' }],
  ['braço: rosca 12 3x12', { pergunta: 'ambiguo_exercicio' }],

  // --- ensinadas pelas "Frases novas" (o que a IA teve de resolver) ---
  ['hoje fiz o supino com halteres no banco a 30 graus, 24 quilos, 5 séries de 10', { ok: [[SUPINO, 24, 5, 10, HOJE]] }],
  ['supino com halteres no banco a 45 graus 24 5x10', { ok: [[SUPINO, 24, 5, 10]] }],
  ['supino inclinado a trinta graus com 24 quilos, 5x10', { ok: [[SUPINO, 24, 5, 10]] }],
  ['supino inclinado 24 5x10 banco 30°', { ok: [[SUPINO, 24, 5, 10]] }],

  // --- palavras fora de ordem ---
  ['24 quilos supino inclinado 5x10', { ok: [[SUPINO, 24, 5, 10]] }],
  ['5x10 com 24 no supino inclinado', { ok: [[SUPINO, 24, 5, 10]] }],
  ['inclinado supino halter 24 5x10', { ok: [[SUPINO, 24, 5, 10]] }],
  ['5x12 50 quilos alta puxada', { ok: [[PUXADA, 50, 5, 12]] }],
  ['supino inclinado 24 5x10 peito', { ok: [[SUPINO, 24, 5, 10]] }], // treino no fim
  ['supino peito inclinado 24 5x10', { ok: [[SUPINO, 24, 5, 10]] }], // treino no meio
  ['puxada alta costas 50 4x12', { ok: [[PUXADA, 50, 4, 12]] }],
  ['24 quilos, supino inclinado, 5x10', { ok: [[SUPINO, 24, 5, 10]] }], // números antes do nome
  ['24 5x10, supino inclinado', { ok: [[SUPINO, 24, 5, 10]] }],
  ['peito: 5x10 24 inc', { ok: [[SUPINO, 24, 5, 10]] }],
  ['5x10 24kg crossover ontem', { ok: [[CROSS, 24, 5, 10, ONTEM]] }], // data no fim
  ['hoje 24 quilos 5 séries de 10 no supino inclinado', { ok: [[SUPINO, 24, 5, 10, HOJE]] }],
  ['24kg 5x10: supino inclinado', { ok: [[SUPINO, 24, 5, 10]] }], // dados antes dos dois-pontos
  ['crossover 15 4x12, 24 5x10 supino inclinado', { ok: [[CROSS, 15, 4, 12], [SUPINO, 24, 5, 10]] }],

  // --- segurança: nunca gravar errado (pergunta ou erro, jamais registro) ---
  ['mesa de bilhar 24 5x10', { pergunta: 'confirmar_exercicio' }], // palavra desconhecida: confirma
  ['supino 5x10 24', { pergunta: 'ambiguo_exercicio' }],
  ['peito: inc 24 5x10, 15 4x12', { ok: [[SUPINO, 24, 5, 10], [SUPINO, 15, 4, 12]] }], // segundo item sem nome: é o mesmo exercício com outro peso
  ['peito: inc 24 5x10 10', 'ia'], // número a mais
  ['peito: inc 24 5 séries de 10 com 22', 'ia'], // duas cargas
  ['abdominal 3x15', { pergunta: 'ambiguo_exercicio' }], // remador ou infra
  ['peito: inc, 24, 5x10', { ok: [[SUPINO, 24, 5, 10]] }],
  ['costas: puxada 50 4x12, puxada 55 4x10', { ok: [[PUXADA, 50, 4, 12], [PUXADA, 55, 4, 10]] }],
  ['rosca martelo 12 3x12 e rosca concentrada 8 3x15', { ok: [['Rosca martelo', 12, 3, 12], ['Rosca concentrada halter', 8, 3, 15]] }],
  ['peito: inc 5x10, 24', { ok: [[SUPINO, 24, 5, 10]] }],

  // --- sem jeito pelas regras: aqui sim a IA ajuda ---
  ['treinei bastante hoje', 'ia'],
  ['fiz o mesmo treino de ontem', 'ia'],
  ['hoje foi pesado, fiz tudo da rotina', 'ia'],
  ['o primeiro exercício da rotina, 24 quilos, 5 séries de 10', 'ia'],
];

// Medição rápida: node lib/frases-naturais.js
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  const { readFileSync } = await import('node:fs');
  const { interpretar } = await import('./parser.js');
  const rotina = JSON.parse(readFileSync(new URL('../data/rotina.json', import.meta.url), 'utf8'));
  const contagem = { certo: 0, errado: 0 };
  const falhas = [];
  for (const [frase, esperado] of FRASES) {
    const r = interpretar(frase, { rotina, hoje: HOJE });
    const precisaIa = r.erros.length > 0 || r.pendentes.some((p) => p.tipo === 'confuso');
    let ok;
    if (esperado === 'ia') ok = precisaIa;
    else if (esperado.pergunta) ok = !precisaIa && r.pendentes.some((p) => p.tipo === esperado.pergunta);
    else ok = r.pronto && JSON.stringify(r.registros.map((x) => [x.exercicio, x.carga, x.series, x.reps, ...(esperado.ok[0][4] ? [x.data] : [])])) === JSON.stringify(esperado.ok.map((e) => e.slice(0, esperado.ok[0][4] ? 5 : 4)));
    if (ok) contagem.certo++;
    else {
      contagem.errado++;
      falhas.push(frase);
    }
  }
  console.log(`${contagem.certo} de ${FRASES.length} frases certas pelas regras`);
  const naoIa = FRASES.filter(([, e]) => e !== 'ia').length;
  console.log(`Precisam da IA hoje (esperado: só as 'ia'): ${falhas.filter((f) => FRASES.find(([x]) => x === f)[1] !== 'ia').length} de ${naoIa}`);
  for (const f of falhas) console.log('  ✗', f);
}
