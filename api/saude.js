import { rota } from '../lib/http.js';
import { listarRotina, listarTreinos, modoTeste } from '../lib/store.js';

// GET: confere se o servidor consegue ler os dois bancos do Notion.
export default rota('GET', async () => {
  const resultado = { modo: modoTeste() ? 'teste local (sem Notion)' : 'notion' };
  try {
    resultado.rotina = `${(await listarRotina()).length} exercícios`;
  } catch (e) {
    resultado.rotina = `erro: ${e.message}`;
  }
  try {
    resultado.treinos = `${(await listarTreinos()).length} registros`;
  } catch (e) {
    resultado.treinos = `erro: ${e.message}`;
  }
  return resultado;
});
