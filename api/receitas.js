import { rota } from '../lib/http.js';
import { listarReceitas } from '../lib/store.js';

// GET: receitas feitas com os alimentos e as quantidades do plano alimentar. Só leitura.
export default rota('GET', async () => ({ receitas: await listarReceitas() }));
