import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarDieta, validarReceitas } from './dieta.js';

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

test('validarReceitas: aceita receita completa e recusa sem ingredientes ou preparo', () => {
  const r = { nome: 'Crepioca', refeicao: 'Café da manhã', porcao: '1 pessoa', ingredientes: ['3 ovos'], preparo: ['Bata e asse.'] };
  assert.equal(validarReceitas([r]).length, 1);
  assert.throws(() => validarReceitas([]));
  assert.throws(() => validarReceitas([{ ...r, ingredientes: [] }]));
  assert.throws(() => validarReceitas([{ ...r, preparo: [''] }]));
});
