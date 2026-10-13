// Rodar com:  node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { hojeSP, somarDias, dataDePalavra, dataDiaMes, hojeInformado, dataDoDia } from './datas.js';

const HOJE = '2026-10-13'; // terça-feira

test('hojeSP usa o fuso de São Paulo (de madrugada em UTC ainda é o dia anterior)', () => {
  assert.equal(hojeSP(new Date('2026-10-13T02:00:00Z')), '2026-10-12');
  assert.equal(hojeSP(new Date('2026-10-13T15:00:00Z')), '2026-10-13');
});

test('somarDias atravessa mês e ano', () => {
  assert.equal(somarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(somarDias('2026-01-01', -1), '2025-12-31');
  assert.equal(somarDias('2028-02-28', 1), '2028-02-29');
});

test('palavras de data e dia da semana (o mais recente; hoje, se for hoje)', () => {
  assert.equal(dataDePalavra('hoje', HOJE), HOJE);
  assert.equal(dataDePalavra('ontem', HOJE), '2026-10-12');
  assert.equal(dataDePalavra('anteontem', HOJE), '2026-10-11');
  assert.equal(dataDePalavra('ter', HOJE), HOJE);
  assert.equal(dataDePalavra('qua', HOJE), '2026-10-07');
  assert.equal(dataDePalavra('dom', HOJE), '2026-10-11');
  assert.equal(dataDePalavra('abacaxi', HOJE), null);
});

test('dd/mm sem ano no futuro vale o ano passado; ano de 2 e 4 dígitos', () => {
  assert.equal(dataDiaMes('5', '10', undefined, HOJE), '2026-10-05');
  assert.equal(dataDiaMes('20', '12', undefined, HOJE), '2025-12-20');
  assert.equal(dataDiaMes('5', '10', '25', HOJE), '2025-10-05');
  assert.equal(dataDiaMes('5', '10', '2024', HOJE), '2024-10-05');
});

test('dd/mm que não existe vira null', () => {
  assert.equal(dataDiaMes('31', '02', undefined, HOJE), null);
  assert.equal(dataDiaMes('32', '01', undefined, HOJE), null);
  assert.equal(dataDiaMes('10', '13', undefined, HOJE), null);
});

test('hojeInformado aceita data recente e rejeita futura, antiga ou inválida', () => {
  assert.equal(hojeInformado('2026-10-12', HOJE), '2026-10-12');
  assert.equal(hojeInformado(HOJE, HOJE), HOJE);
  assert.equal(hojeInformado('2026-10-14', HOJE), HOJE); // futura
  assert.equal(hojeInformado('2026-08-01', HOJE), HOJE); // mais de 30 dias
  assert.equal(hojeInformado('2026-02-30', HOJE), HOJE); // não existe
  assert.equal(hojeInformado('ontem', HOJE), HOJE);
  assert.equal(hojeInformado(undefined, HOJE), HOJE);
});

test('dataDoDia: "dia 10" é deste mês; se ainda não chegou, do mês passado', () => {
  assert.equal(dataDoDia(10, HOJE), '2026-10-10');
  assert.equal(dataDoDia(13, HOJE), HOJE);
  assert.equal(dataDoDia(20, HOJE), '2026-09-20');
  assert.equal(dataDoDia(31, '2026-03-05'), null); // fevereiro não tem dia 31
  assert.equal(dataDoDia(30, '2026-03-05'), null);
  assert.equal(dataDoDia(20, '2026-01-05'), '2025-12-20');
  assert.equal(dataDoDia(40, HOJE), null);
});
