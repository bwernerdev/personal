import test from 'node:test';
import assert from 'node:assert/strict';


test('pergunta composta: duas coisas numa frase vão para a IA; pedido simples continua nas regras', async () => {
  const { perguntaComposta } = await import('./consultas.js');
  for (const t of ['qual foi o meu recorde de carga no voador e quantas vezes fiz esse exercício?', 'liste meu último full body 1 e quando foi o anterior', 'qual o recorde no voador? e a puxada?']) assert.equal(perguntaComposta(t), true, t);
  for (const t of ['maior carga no voador', 'quando fiz extensora?', 'liste meu último full body 1', 'qual foi minha última puxada alta?']) assert.equal(perguntaComposta(t), false, t);
});
