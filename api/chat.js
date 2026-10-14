import { rota } from '../lib/http.js';
import { interpretar, rotinaDoApp } from '../lib/parser.js';
import { hojeSP, hojeInformado } from '../lib/datas.js';
import { listarRotina, listarTreinos, registrarTreino, ultimoDoExercicio, anotarFrase, listarMemorias, anotarMemoria, apagarMemoria, apagarTreino, atualizarTreino, listarTreinosDoExercicio } from '../lib/store.js';
import { jaRegistrado } from '../lib/treino-do-dia.js';
import { responderConsulta, perguntaComposta, completarComContexto } from '../lib/consultas.js';
import { habilitado as iaDisponivel, sugerir, perguntar, pareceConsulta, PEDE_SUGESTAO } from '../lib/ia.js';
import { comandoDeMemoria, executarMemoria } from '../lib/memoria.js';
import { comandoDeCorrecao, executarCorrecao } from '../lib/correcao.js';
import { registrosParaConsulta } from '../lib/leitura.js';

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
  const { texto, usarRotina = false, forcar = false, hoje, historico } = req.body || {};
  if (!texto || !String(texto).trim()) return { status: 'vazio' };

  const dia0 = hojeInformado(hoje, hojeSP());
  // "lembre que tenho dor no ombro" / "o que você lembra de mim?" / "esqueça 2": regras do servidor, sem IA.
  const memoria = comandoDeMemoria(texto);
  if (memoria) {
    const mensagem = await executarMemoria(memoria, await listarMemorias(), { guardar: (nota) => anotarMemoria(nota, dia0), apagar: apagarMemoria });
    return { status: 'resposta', origem: 'regras', mensagem };
  }
  // Lembranças que a pessoa pediu para a IA guardar; se o Notion falhar, a IA responde sem elas.
  // Registros para consulta/conversa: os recentes (cache de 30 s) e, se o histórico for grande, o dos exercícios citados.
  const lerParaConsulta = async (pergunta) => registrosParaConsulta({ texto: pergunta, rotina: rotinaInteira, listarTreinos, listarTreinosDoExercicio });
  const memoriasDaIa = () => listarMemorias().then((l) => l.map((m) => m.nota), () => []);

  const rotinaInteira = await listarRotina();
  // "apaga o último", "errei, era 45", "corrige a puxada para 40": mexe no que já foi registrado (lixeira do Notion).
  const correcao = comandoDeCorrecao(texto, [...new Set(rotinaInteira.map((r) => r.exercicio))]);
  if (correcao) {
    const mensagem = await executarCorrecao(correcao, await listarTreinos(300, { fresco: true }), { apagar: apagarTreino, atualizar: atualizarTreino });
    return { status: 'resposta', origem: 'regras', mensagem };
  }
  const rotina = rotinaDoApp(rotinaInteira); // treinos em standby ficam de fora do registro
  const dia = hojeInformado(hoje, hojeSP());
  // Pergunta sobre os treinos ("liste meu último full body 1"): só leitura. As regras respondem as comuns na hora;
  // as outras vão para a IA (se houver chave) com os dados do Notion.
  // "e o voador?" depois de "qual meu recorde no supino?": as regras completam a pergunta com a anterior.
  const contextual = completarComContexto(texto, historico);
  if (contextual || pareceConsulta(texto)) {
    const { registros, parcial } = await lerParaConsulta(texto);
    // Pedido de sugestão de carga não é consulta de histórico: vai direto para a IA (as regras só mostrariam o último treino).
    const pedeSugestao = PEDE_SUGESTAO.test(String(texto).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase());
    const direta = pedeSugestao && iaDisponivel() ? null : responderConsulta(contextual ?? texto, { registros, rotina: rotinaInteira, hoje: dia });
    // Pergunta de várias partes: a IA responde tudo; as regras (que só respondem uma parte) ficam de reserva.
    if (direta && !(perguntaComposta(texto) && iaDisponivel())) return { status: 'resposta', origem: 'regras', mensagem: direta };
    if (iaDisponivel()) {
      const resposta = await perguntar({ texto, conversa: historico, rotina: rotinaInteira, registros, parcial, hoje: dia, memorias: await memoriasDaIa() });
      if (resposta) return { status: 'resposta', origem: 'ia', mensagem: resposta.mensagem };
    }
    if (direta) return { status: 'resposta', origem: 'regras', mensagem: direta };
  }

  let r = interpretar(texto, { rotina, hoje: dia, usarRotina: Boolean(usarRotina) });
  if (r.pendentes.some((p) => p.tipo === 'ambiguo_treino')) {
    // "puxada alta 50 4x12" existe em mais de um treino: se hoje já foi registrado um deles, é esse.
    const treinoDeHoje = (await listarTreinos(undefined, { fresco: true })).find((t) => t.data === dia && rotina.some((x) => x.treino === t.treino))?.treino;
    if (treinoDeHoje) r = interpretar(texto, { rotina, hoje: dia, usarRotina: Boolean(usarRotina), treinoDeHoje });
  }

  // Conversa que as regras confundiram com um exercício: sem nenhum número e com 4+ palavras ignoradas
  // ("me explica por que se faz drop set" -> "Mesa flexora?"). Não é treino: a IA responde.
  const palavrasIgnoradas = (p) => (/ignorei: ([^)]*)\)/.exec(p.mensagem || '')?.[1].split(',').length ?? 0);
  if (!r.pronto && r.registros.length === 0 && !/\d/.test(texto) && iaDisponivel() && r.pendentes.some((p) => p.tipo === 'confirmar_exercicio' && palavrasIgnoradas(p) >= 4)) {
    const livre = await perguntar({ texto, conversa: historico, rotina: rotinaInteira, ...(await lerParaConsulta(texto)), hoje: dia, memorias: await memoriasDaIa() });
    if (livre) return { status: 'resposta', origem: 'ia', mensagem: livre.mensagem };
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
          const livre = await perguntar({ texto, conversa: historico, rotina: rotinaInteira, ...(await lerParaConsulta(texto)), hoje: dia, memorias: await memoriasDaIa() });
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

  const antes = await listarTreinos(undefined, { fresco: true }); // lido antes de gravar, para mostrar "da última vez"

  if (!forcar) {
    const duplicados = r.registros.filter((reg) => jaRegistrado(antes, reg));
    if (duplicados.length) return { status: 'duplicado', duplicados };
  }

  const anteriores = new Map(); // um por exercício+treino (vários blocos dividem o mesmo "antes")
  // Carga maior que qualquer uma já registrada naquele exercício (confere o histórico inteiro se a janela recente não bastar).
  const ehRecorde = async (recentes, reg, id) => {
    if (reg.carga == null || reg.carga <= 0) return false;
    const maior = (lista) => Math.max(0, ...lista.filter((t) => t.exercicio === reg.exercicio && t.carga != null).map((t) => t.carga));
    if (reg.carga <= maior(recentes)) return false;
    const todos = (await listarTreinosDoExercicio(reg.exercicio, 200)).filter((t) => t.id !== id); // sem o que acabou de ser gravado
    return todos.length > 0 && reg.carga > maior(todos);
  };

  const salvos = [];
  for (const reg of r.registros) {
    try {
      const chave = `${reg.exercicio}|${reg.treino}`;
      if (!anteriores.has(chave)) anteriores.set(chave, await ultimoDoExercicio(antes, reg.exercicio, reg.treino));
      const id = await registrarTreino(reg);
      salvos.push({ ...reg, id, anterior: anteriores.get(chave), recorde: await ehRecorde(antes, reg, id) });
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
