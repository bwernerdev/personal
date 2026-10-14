import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarDieta } from './dieta.js';

const refeicao = { hora: '12:00', nome: 'Almoço', linhas: [['Arroz (150 g)', 'Macarrão (132 g)'], ['Frango (130 g)']] };

test('validarDieta: aceita refeições com opções, nota e substituições', () => {
  const ok = validarDieta({ refeicoes: [{ ...refeicao, nota: 'Patê', substituicoes: [{ nome: 'Substituição 1', linhas: [['Iogurte (1 pote)']] }] }] });
  assert.equal(ok.refeicoes.length, 1);
  assert.equal(ok.orientacao, null);
});

test('validarDieta: recusa plano vazio, hora inválida e linhas vazias', () => {
  assert.throws(() => validarDieta({ refeicoes: [] }));
  assert.throws(() => validarDieta({ refeicoes: [{ ...refeicao, hora: '12h' }] }));
  assert.throws(() => validarDieta({ refeicoes: [{ ...refeicao, linhas: [[]] }] }));
  assert.throws(() => validarDieta({ refeicoes: [{ ...refeicao, linhas: [['']] }] }));
  assert.throws(() => validarDieta({ refeicoes: [{ ...refeicao, substituicoes: [{ nome: 'x', linhas: [] }] }] }));
});
