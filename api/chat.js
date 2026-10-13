import { rota } from '../lib/http.js';
import { interpretar } from '../lib/parser.js';
import { hojeSP, hojeInformado } from '../lib/datas.js';
import { listarRotina, listarTreinos, registrarTreino, ultimoDoExercicio } from '../lib/store.js';
import { jaRegistrado } from '../lib/treino-do-dia.js';

// POST { texto, usarRotina?, forcar?, hoje? }
// Só grava quando TUDO foi entendido; se algo faltar, devolve as perguntas e não grava nada.
// `hoje` (AAAA-MM-DD) vem do celular quando o registro ficou guardado sem internet: "ontem" e "seg"
// valem a partir do dia em que foi digitado, não do dia em que chegou aqui.
// Registro idêntico a um que já existe não é gravado de novo, a menos que venha `forcar`.
export default rota('POST', async (req) => {
  const { texto, usarRotina = false, forcar = false, hoje } = req.body || {};
  if (!texto || !String(texto).trim()) return { status: 'vazio' };

  const rotina = await listarRotina();
  const r = interpretar(texto, {
    rotina,
    hoje: hojeInformado(hoje, hojeSP()),
    usarRotina: Boolean(usarRotina),
  });

  if (!r.pronto) {
    return {
      status: 'precisa_resposta',
      pendentes: r.pendentes,
      erros: r.erros,
      entendidos: r.registros.length,
    };
  }

  const antes = await listarTreinos(); // lido antes de gravar, para mostrar "da última vez"

  if (!forcar) {
    const duplicados = r.registros.filter((reg) => jaRegistrado(antes, reg));
    if (duplicados.length) return { status: 'duplicado', duplicados };
  }

  const anteriores = new Map(); // um por exercício+treino (vários blocos dividem o mesmo "antes")
  const salvos = [];
  for (const reg of r.registros) {
    try {
      const chave = `${reg.exercicio}|${reg.treino}`;
      if (!anteriores.has(chave)) anteriores.set(chave, await ultimoDoExercicio(antes, reg.exercicio, reg.treino));
      const id = await registrarTreino(reg);
      salvos.push({ ...reg, id, anterior: anteriores.get(chave) });
    } catch (e) {
      return {
        status: 'erro_parcial',
        salvos,
        falhou: reg.exercicio,
        erro: e.message,
      };
    }
  }
  return { status: 'ok', registros: salvos };
});
