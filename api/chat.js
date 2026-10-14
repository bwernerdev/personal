import { rota } from '../lib/http.js';
import { interpretar, rotinaDoApp } from '../lib/parser.js';
import { hojeSP, hojeInformado } from '../lib/datas.js';
import { listarRotina, listarTreinos, registrarTreino, ultimoDoExercicio, anotarFrase } from '../lib/store.js';
import { jaRegistrado } from '../lib/treino-do-dia.js';
import { responderConsulta } from '../lib/consultas.js';
import { habilitado as iaDisponivel, sugerir, perguntar, pareceConsulta } from '../lib/ia.js';

// Guarda a frase que as regras não resolveram (para ensiná-las depois: scripts/frases.js). Nunca atrapalha
// o chat: erro ou demora de mais (4 s) só vão para o log.
async function anotarFraseNova(dados) {
  try {
    await Promise.race([anotarFrase(dados), new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('tempo esgotado')), 4000))]);
  } catch (e) {
    console.error(`Frases novas: ${e.message}`);
  }
}

// POST { texto, usarRotina?, forcar?, hoje? }
// Só grava quando TUDO foi entendido; se algo faltar, devolve as perguntas e não grava nada.
// `hoje` (AAAA-MM-DD) vem do celular quando o registro ficou guardado sem internet: "ontem" e "seg"
// valem a partir do dia em que foi digitado, não do dia em que chegou aqui.
// Registro idêntico a um que já existe não é gravado de novo, a menos que venha `forcar`.
// Se as regras não entendem o texto e há uma chave de IA (GEMINI_API_KEY ou ANTHROPIC_API_KEY), a IA propõe uma reescrita
// (status "sugestao"): ela NUNCA é gravada direto; o app mostra e o usuário confirma (lib/ia.js).
export default rota('POST', async (req) => {
  const { texto, usarRotina = false, forcar = false, hoje } = req.body || {};
  if (!texto || !String(texto).trim()) return { status: 'vazio' };

  const rotinaInteira = await listarRotina();
  const rotina = rotinaDoApp(rotinaInteira); // treinos em standby ficam de fora do registro
  const dia = hojeInformado(hoje, hojeSP());
  // Pergunta sobre os treinos ("liste meu último full body 1"): só leitura. As regras respondem as comuns na hora;
  // as outras vão para a IA (se houver chave) com os dados do Notion.
  if (pareceConsulta(texto)) {
    const registros = await listarTreinos(5000);
    const direta = responderConsulta(texto, { registros, rotina: rotinaInteira, hoje: dia });
    if (direta) return { status: 'resposta', origem: 'regras', mensagem: direta };
    if (iaDisponivel()) {
      const resposta = await perguntar({ texto, rotina: rotinaInteira, registros, hoje: dia });
      if (resposta) return { status: 'resposta', origem: 'ia', mensagem: resposta.mensagem };
    }
  }

  let r = interpretar(texto, { rotina, hoje: dia, usarRotina: Boolean(usarRotina) });
  if (r.pendentes.some((p) => p.tipo === 'ambiguo_treino')) {
    // "puxada alta 50 4x12" existe em mais de um treino: se hoje já foi registrado um deles, é esse.
    const treinoDeHoje = (await listarTreinos()).find((t) => t.data === dia && rotina.some((x) => x.treino === t.treino))?.treino;
    if (treinoDeHoje) r = interpretar(texto, { rotina, hoje: dia, usarRotina: Boolean(usarRotina), treinoDeHoje });
  }

  if (!r.pronto) {
    // Pergunta de falta de carga/séries e dúvida entre exercícios são das regras; a IA só ajuda
    // quando o texto não foi entendido (erro) ou os números estão confusos.
    const naoEntendeu = r.erros.length > 0 || r.pendentes.some((p) => p.tipo === 'confuso');
    const confirmou = r.pendentes.find((p) => p.tipo === 'confirmar_exercicio');
    const motivo = r.erros[0] ?? (naoEntendeu ? 'números que não fecham' : confirmou?.mensagem);

    // Resposta que o usuário vai ver; o que sobrar vai para "Frases novas" antes de responder.
    let resposta = { status: 'precisa_resposta', pendentes: r.pendentes, erros: r.erros, entendidos: r.registros.length };
    let resultado = confirmou && !naoEntendeu ? 'Pediu confirmação' : 'Sem ajuda da IA';
    let sugestao = null;

    if (naoEntendeu && iaDisponivel()) {
      const ajuda = await sugerir({ texto, rotina, hoje: dia });
      resultado = 'IA não entendeu';
      if (ajuda?.tipo === 'nao_entendi') {
        resposta = { ...resposta, ajuda: ajuda.mensagem };
        // Nem as regras nem a reescrita entenderam e nada foi registrado: não é um treino, a IA responde livremente.
        if (r.registros.length === 0 && !r.pendentes.some((p) => p.tipo === 'confuso')) {
          const livre = await perguntar({ texto, rotina: rotinaInteira, registros: await listarTreinos(5000), hoje: dia });
          if (livre) {
            await anotarFraseNova({ frase: texto, resultado: 'IA respondeu livremente', motivo, sugestao: null, hoje: dia });
            return { status: 'resposta', origem: 'ia', mensagem: livre.mensagem };
          }
        }
      } else if (ajuda?.tipo === 'texto') {
        const novo = interpretar(ajuda.texto, { rotina, hoje: dia });
        // Serve reescrita sem erro que já tem registros OU só perguntas das regras (ex.: falta a carga).
        if (novo.erros.length === 0 && (novo.registros.length > 0 || novo.pendentes.length > 0)) {
          resposta = { status: 'sugestao', origem: 'ia', hoje: dia, texto_sugerido: ajuda.texto, pronto: novo.pronto, registros: novo.registros, pendentes: novo.pendentes };
          resultado = 'IA sugeriu';
          sugestao = ajuda.texto;
        }
      }
    }

    if (naoEntendeu || confirmou) await anotarFraseNova({ frase: texto, resultado, motivo, sugestao, hoje: dia });
    return resposta;
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
