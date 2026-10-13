// Rodar com:  node --test
// Confere, frase por frase, o que as regras fazem com linguagem do dia a dia (tabela em
// frases-naturais.js). É a prova de que o Claude só é chamado quando as regras não entendem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpretar } from './parser.js';
import { FRASES } from './frases-naturais.js';

const rotina = JSON.parse(readFileSync(new URL('../data/rotina.json', import.meta.url), 'utf8'));
const HOJE = '2026-10-13';

// Mesmo critério de api/chat.js: o Claude só é chamado se houver erro ou números confusos.
const precisaDeIa = (r) => r.erros.length > 0 || r.pendentes.some((p) => p.tipo === 'confuso');

for (const [frase, esperado] of FRASES) {
  test(`frase: ${frase.replace(/\n/g, ' / ')}`, () => {
    const r = interpretar(frase, { rotina, hoje: HOJE });
    if (esperado === 'ia') {
      assert.equal(precisaDeIa(r), true, 'deveria ser caso para o Claude');
      assert.equal(r.registros.length === 0 || !r.pronto, true, 'nada pode ficar pronto para gravar');
    } else if (esperado.pergunta) {
      assert.equal(precisaDeIa(r), false, 'as regras deveriam resolver sem o Claude');
      assert.equal(r.pronto, false);
      assert.ok(r.pendentes.some((p) => p.tipo === esperado.pergunta), `esperava a pergunta ${esperado.pergunta}, veio ${r.pendentes.map((p) => p.tipo)}`);
    } else {
      assert.equal(r.pronto, true, `não ficou pronto: ${JSON.stringify({ erros: r.erros, pendentes: r.pendentes.map((p) => p.tipo) })}`);
      const comData = esperado.ok.some((e) => e[4]);
      assert.deepEqual(
        r.registros.map((x) => [x.exercicio, x.carga, x.series, x.reps, ...(comData ? [x.data] : [])]),
        esperado.ok.map((e) => (comData ? [e[0], e[1], e[2], e[3], e[4] ?? HOJE] : e.slice(0, 4))),
      );
    }
  });
}

test('as regras resolvem a grande maioria das frases do dia a dia sem o Claude', () => {
  const naturais = FRASES.filter(([, esperado]) => esperado !== 'ia');
  const sozinhas = naturais.filter(([frase]) => !precisaDeIa(interpretar(frase, { rotina, hoje: HOJE })));
  assert.equal(sozinhas.length, naturais.length);
});

// ---------- propriedade: nunca inventar número, nunca estourar ----------

// Gerador pseudoaleatório fixo (mesmos casos em toda execução).
function sorteador(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test('em 8000 frases aleatórias: nunca estoura e, quando as regras gravam, todo número gravado está na frase', async () => {
  const { numerosPermitidos } = await import('./ia.js');
  const { SINONIMOS } = await import('./parser.js');
  const nomes = [...new Set(rotina.map((r) => r.exercicio))];
  const apelidos = Object.values(SINONIMOS).flat();
  const palavras = [
    ...nomes, ...apelidos, 'hoje', 'ontem', 'segunda', 'peito', 'costas', 'perna1', 'braço', 'fiz', 'com', 'quilos', 'kg', 'séries', 'de', 'e', 'depois',
    'por', 'vezes', 'repetições', 'treino', 'dia', 'vinte', 'e', 'quatro', 'cinco', 'dez', 'meio', 'carga', 'xyz', 'bastante',
    '5x10', '4x12', '3x60s', '22,5', '24kg', '50x12', '45x10', ':', ',', '-', '.', ...Array.from({ length: 40 }, (_, i) => String(i + 1)),
  ];
  const sorteio = sorteador(20261013);
  const sortear = (lista) => lista[Math.floor(sorteio() * lista.length)];
  const escolher = () => sortear(palavras);

  // Frases com cara de treino: cabeçalho opcional + 1 a 3 exercícios, cada número dito de um jeito.
  const cargas = ['24', '24kg', '24 quilos', 'vinte e quatro', '22,5', 'vinte e dois e meio', '15 kg', ''];
  const quantidades = ['5x10', '5 séries de 10', '5 por 10', 'cinco de dez', '10 repetições em 5 séries', '4 vezes de 12', '3 séries', '10 reps', '4 x 12', '3x60s', ''];
  const ligacoes = [', ', ' e ', ' - ', ' depois ', '; ', '. '];
  const cabecalhos = ['', 'hoje ', 'ontem ', 'hoje fiz ', 'peito: ', 'costas: ', 'treino de braço: ', 'segunda feira ', 'dia 10 ', 'hoje foi peito, '];
  const estruturada = () => {
    const itens = Array.from({ length: 1 + Math.floor(sorteio() * 3) }, () => {
      const partes = [sortear([...nomes, ...apelidos]), sortear(cargas), sortear(quantidades)];
      if (sorteio() < 0.2) partes.push(sortear(['com', 'xyz', 'bastante', 'leves']));
      if (sorteio() < 0.3) partes.sort(() => sorteio() - 0.5); // ordem embaralhada
      return partes.filter(Boolean).join(' ');
    });
    return sortear(cabecalhos) + itens.reduce((acc, it, i) => (i === 0 ? it : acc + sortear(ligacoes) + it), '');
  };
  let gravaram = 0;

  for (let i = 0; i < 8000; i++) {
    const frase = sorteio() < 0.7 ? estruturada() : Array.from({ length: 2 + Math.floor(sorteio() * 11) }, escolher).join(' ');
    let r;
    assert.doesNotThrow(() => (r = interpretar(frase, { rotina, hoje: HOJE })), `estourou com: ${frase}`);
    if (!r.pronto) continue;
    gravaram++;

    const permitidos = numerosPermitidos(frase);
    const pares = (frase.match(/\d+(?:[.,]\d+)?\s*[x×]\s*\d+/g) || []).length;
    for (const reg of r.registros) {
      assert.ok(nomes.includes(reg.exercicio), `exercício fora da rotina: ${reg.exercicio} (${frase})`);
      if (reg.carga !== null) assert.ok(permitidos.has(reg.carga), `carga ${reg.carga} inventada em: ${frase}`);
      if (reg.reps !== null) assert.ok(permitidos.has(reg.reps), `reps ${reg.reps} inventada em: ${frase}`);
      if (reg.series !== null) assert.ok(permitidos.has(reg.series) || pares >= 2, `séries ${reg.series} inventada em: ${frase}`);
    }
  }
  assert.ok(gravaram > 400, `o teste precisa exercitar gravações de verdade (só ${gravaram})`);
});
