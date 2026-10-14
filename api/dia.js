import { rota } from '../lib/http.js';
import { listarRotina, listarTreinos, ultimoDoExercicio } from '../lib/store.js';
import { hojeSP } from '../lib/datas.js';
import { montarDia, marcarFeitosHoje } from '../lib/treino-do-dia.js';

// GET ?treino=Perna 1   (sem parâmetro: o próximo treino do ciclo)
export default rota('GET', async (req) => {
  const [rotina, treinos] = await Promise.all([listarRotina(), listarTreinos()]);
  const dia = montarDia(rotina, treinos, req.query?.treino);
  // Exercício sem registro recente (ou só de outro treino): busca direto, para não esquecer treinos antigos.
  await Promise.all(
    dia.exercicios
      .filter((e) => !e.ultimo || e.ultimo.deOutroTreino)
      .map(async (e) => {
        e.ultimo = await ultimoDoExercicio(treinos, e.exercicio, e.treino);
      }),
  );
  return marcarFeitosHoje(dia, hojeSP());
});
