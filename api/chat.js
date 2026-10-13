import { rota } from '../lib/http.js';
import { interpretar } from '../lib/parser.js';
import { hojeSP, hojeInformado } from '../lib/datas.js';
import { listarRotina, listarTreinos, registrarTreino, ultimoDoExercicio } from '../lib/store.js';
import { jaRegistrado } from '../lib/treino-do-dia.js';
import { habilitado as iaDisponivel, sugerir } from '../lib/claude.js';

// POST { texto, usarRotina?, forcar?, hoje? }
// Só grava quando TUDO foi entendido; se algo faltar, devolve as perguntas e não grava nada.
// `hoje` (AAAA-MM-DD) vem do celular quando o registro ficou guardado sem internet: "ontem" e "seg"
// valem a partir do dia em que foi digitado, não do dia em que chegou aqui.
// Registro idêntico a um que já existe não é gravado de novo, a menos que venha `forcar`.
// Se as regras não entendem o texto e há ANTHROPIC_API_KEY, o Claude propõe uma reescrita
// (status "sugestao"): ela NUNCA é gravada direto; o app mostra e o usuário confirma (lib/claude.js).
export default rota('POST', async (req) => {
  const { texto, usarRotina = false, forcar = false, hoje } = req.body || {};
  if (!texto || !String(texto).trim()) return { status: 'vazio' };

  const rotina = await listarRotina();
  const dia = hojeInformado(hoje, hojeSP());
  const r = interpretar(texto, { rotina, hoje: dia, usarRotina: Boolean(usarRotina) });

  if (!r.pronto) {
    // Pergunta de falta de carga/séries e dúvida entre exercícios são das regras; o Claude só ajuda
    // quando o texto não foi entendido (erro) ou os números estão confusos.
    const naoEntendeu = r.erros.length > 0 || r.pendentes.some((p) => p.tipo === 'confuso');
    if (naoEntendeu && iaDisponivel()) {
      const ajuda = await sugerir({ texto, rotina, hoje: dia });
      if (ajuda?.tipo === 'nao_entendi') {
        return { status: 'precisa_resposta', pendentes: r.pendentes, erros: r.erros, entendidos: r.registros.length, ajuda: ajuda.mensagem };
      }
      if (ajuda?.tipo === 'texto') {
        const novo = interpretar(ajuda.texto, { rotina, hoje: dia });
        // Serve reescrita sem erro que já tem registros OU só perguntas das regras (ex.: falta a carga).
        if (novo.erros.length === 0 && (novo.registros.length > 0 || novo.pendentes.length > 0)) {
          return { status: 'sugestao', origem: 'ia', hoje: dia, texto_sugerido: ajuda.texto, pronto: novo.pronto, registros: novo.registros, pendentes: novo.pendentes };
        }
      }
    }
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
