import { rota } from '../lib/http.js';
import { listarTreinosDoExercicio } from '../lib/store.js';
import { historicoDe } from '../lib/treino-do-dia.js';

// GET ?exercicio=Supino inclinado halter
export default rota('GET', async (req) => {
  const exercicio = req.query?.exercicio;
  if (!exercicio) return { registros: [] };
  const treinos = await listarTreinosDoExercicio(exercicio, 60);
  return { exercicio, registros: historicoDe(treinos, exercicio) };
});
