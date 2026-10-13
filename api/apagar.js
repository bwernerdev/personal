import { rota } from '../lib/http.js';
import { apagarTreino } from '../lib/store.js';

// POST { id }  -> manda o registro para a lixeira (no Notion dá para restaurar).
export default rota('POST', async (req) => {
  const id = String(req.body?.id ?? '');
  if (!/^[\w-]{8,64}$/.test(id)) throw new Error('Registro inválido.');
  await apagarTreino(id);
  return { ok: true };
});
