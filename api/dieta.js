import { rota } from '../lib/http.js';
import { listarDieta } from '../lib/store.js';

// GET: o plano alimentar (refeições com horário, opções "ou", substituições e nota). Só leitura.
export default rota('GET', async () => listarDieta());
