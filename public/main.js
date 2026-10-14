// App do Personal: chat de registro, treino do dia e histórico.
// Todo o acesso ao Notion passa pela API (/api/*); nenhuma chave fica aqui.
import { iniciarTeclado } from './teclado.js';

const $ = (seletor) => document.querySelector(seletor);

const guardado = {
  ler(chave) {
    try {
      return localStorage.getItem(chave);
    } catch {
      return null;
    }
  },
  gravar(chave, valor) {
    try {
      localStorage.setItem(chave, valor);
    } catch {
      /* sem armazenamento: segue sem lembrar */
    }
  },
};

function el(tag, props = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') no.className = v;
    else if (k.startsWith('on')) no[k] = v;
    else no.setAttribute(k, v);
  }
  no.append(...filhos.flat().filter((f) => f !== null && f !== undefined));
  return no;
}

// ---------- formatação ----------

const num = (n) => String(n).replace('.', ',');
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const data = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const dataComDia = (iso) => (iso ? `${data(iso)}, ${DIAS_SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()]}` : '');
// Mesmo formato das respostas do chat: "4×12 · 50 kg".
function resumo(r) {
  const partes = [];
  if (r.series !== null && r.series !== undefined) partes.push(`${r.series}×${r.reps ?? '—'}`);
  if (r.carga !== null && r.carga !== undefined) partes.push(`${num(r.carga)} kg`);
  if (r.obs && !/^bloco \d+\/\d+$/.test(r.obs)) partes.push(r.obs); // "bloco 1/2" é só a ordem das cargas
  return partes.join(' · ') || 'sem detalhes';
}
// Um dia de treino pode ter várias linhas (cargas diferentes por série): mostra todas.
const resumoDia = (u) => (u.registros?.length ? u.registros : [u]).map(resumo).join(' + ');

// Data de hoje em São Paulo (AAAA-MM-DD), a mesma que o servidor usa.
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

// Registros digitados sem internet ficam guardados aqui até a conexão voltar.
const fila = {
  ler() {
    try {
      const lista = JSON.parse(guardado.ler('fila') || '[]');
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  },
  gravar(lista) {
    guardado.gravar('fila', JSON.stringify(lista));
  },
};

// ---------- acesso e chamadas à API ----------

let codigo = guardado.ler('codigo') || '';

function pedirCodigo() {
  return new Promise((resolver) => {
    $('#acesso').hidden = false;
    $('#codigo').value = '';
    $('#codigo').focus();
    $('#form-acesso').onsubmit = (e) => {
      e.preventDefault();
      codigo = $('#codigo').value.trim();
      guardado.gravar('codigo', codigo);
      $('#acesso').hidden = true;
      resolver();
    };
  });
}

async function chamar(caminho, opcoes = {}) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const resp = await fetch(caminho, {
      ...opcoes,
      headers: { 'Content-Type': 'application/json', 'x-codigo': codigo },
    });
    if (resp.status === 401) {
      await pedirCodigo();
      continue;
    }
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(corpo.erro || `Erro ${resp.status}`);
    return corpo;
  }
  throw new Error('Código de acesso inválido.');
}

// ---------- abas ----------

const TITULOS = { chat: 'Chat', dia: 'Treino do dia', historico: 'Histórico' };
let abaAtual = 'chat';

function abrirAba(nome) {
  abaAtual = nome;
  document.querySelectorAll('.aba').forEach((a) => a.classList.toggle('ativa', a.id === `aba-${nome}`));
  document.querySelectorAll('nav button').forEach((b) => {
    b.classList.toggle('ativa', b.dataset.aba === nome);
    if (b.dataset.aba === nome) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('#titulo').textContent = TITULOS[nome];
  if (nome === 'dia') carregarDia(estado.diaSelecionado);
  if (nome === 'historico') prepararHistorico();
}

document.querySelectorAll('nav button').forEach((b) => (b.onclick = () => abrirAba(b.dataset.aba)));

const estado = { dia: null, diaSelecionado: null };

// ---------- chat ----------

function adicionar(no) {
  const caixa = $('#mensagens');
  caixa.append(no);
  caixa.scrollTop = caixa.scrollHeight;
  return no;
}

const bolha = (classe, ...filhos) => adicionar(el('div', { class: `msg ${classe}`.trim() }, ...filhos));

function boasVindas() {
  bolha(
    '',
    el('h3', {}, 'Registre seu treino'),
    'Escreva por palavras-chave:\n',
    el('div', { class: 'linha' }, 'peito: inc 24 5x10, cross 15 4x12'),
    el('div', { class: 'linha' }, 'ontem perna1: ext 50 4x12, agacha 60 5x8'),
    el('div', { class: 'linha' }, 'costas: puxada 50x12 50x10 45x10'),
    el('div', { class: 'linha' }, 'ou do seu jeito: hoje fiz supino inclinado com 24 quilos, 5 séries de 10'),
    el('div', { class: 'antes' }, 'Treino: peito, perna1, costas, ombro, perna2, braço. Data: hoje (padrão), ontem, seg…sab, 05/10.'),
  );
}

function mostrarRegistrados(registros, titulo = 'Registrado ✓') {
  const cartao = bolha('', el('h3', {}, `${titulo} (${registros.length})`));

  // Cargas diferentes do mesmo exercício viram várias linhas: junta numa só no cartão.
  const grupos = [];
  for (const r of registros) {
    const g = grupos[grupos.length - 1];
    if (g && g.exercicio === r.exercicio && g.treino === r.treino) g.linhas.push(r);
    else grupos.push({ exercicio: r.exercicio, treino: r.treino, linhas: [r], anterior: r.anterior });
  }
  for (const g of grupos) {
    cartao.append(el('div', { class: 'linha' }, `${g.exercicio}: ${g.linhas.map(resumo).join(' + ')}`));
    const ant = g.anterior;
    cartao.append(
      el(
        'div',
        { class: 'antes' },
        ant
          ? `Antes (${data(ant.data)}${ant.deOutroTreino ? ', outro treino' : ''}): ${resumoDia(ant)}`
          : 'Primeira vez registrada',
      ),
    );
  }

  const ids = registros.map((r) => r.id).filter(Boolean);
  if (ids.length) {
    const botao = el('button', { type: 'button' }, 'Desfazer');
    botao.onclick = async () => {
      botao.disabled = true;
      botao.textContent = 'Desfazendo…';
      try {
        for (const id of ids) await chamar('/api/apagar', { method: 'POST', body: JSON.stringify({ id }) });
        cartao.querySelector('h3').textContent = `Desfeito (${ids.length})`;
        botao.remove();
      } catch (e) {
        botao.disabled = false;
        botao.textContent = 'Desfazer';
        bolha('erro', `Não consegui desfazer: ${e.message}\nConfira no Histórico.`);
      }
    };
    cartao.append(el('div', { class: 'acoes' }, botao));
  }
}

function mostrarPerguntas(resp, textoOriginal) {
  if (resp.ajuda) bolha('alerta', el('h3', {}, 'Ajuda da IA'), resp.ajuda);
  for (const e of resp.erros || []) bolha('erro', e);
  for (const p of resp.pendentes || []) {
    const acoes = el('div', { class: 'acoes' });
    for (const s of p.sugestoes || []) {
      acoes.append(
        el('button', {
          type: 'button',
          onclick: () => {
            $('#entrada').value = s.texto;
            ajustarEntrada();
            $('#entrada').focus();
          },
        }, s.rotulo),
      );
    }
    if (p.oferecerRotina) {
      acoes.append(el('button', { type: 'button', onclick: () => enviar(textoOriginal, true, 'Sim, foi o do personal') }, 'Sim, foi o do personal'));
    }
    bolha('alerta', p.mensagem, acoes.children.length ? acoes : null);
  }
  bolha('', el('div', { class: 'antes' }, 'Nada foi gravado ainda.'));
}

// A IA reescreveu a frase no formato do app. Nada foi gravado: o usuário confere e confirma.
// "Registrar assim" reenvia o texto reescrito pelo caminho normal (as regras validam de novo).
function mostrarSugestao(resp) {
  const linhas = resp.registros.map((r) => el('div', { class: 'linha' }, `${r.exercicio}: ${resumo(r)} · ${data(r.data)}`));
  const editar = () => {
    $('#entrada').value = resp.texto_sugerido;
    ajustarEntrada();
    $('#entrada').focus();
  };

  if (resp.pronto) {
    const acoes = el(
      'div',
      { class: 'acoes' },
      el('button', { type: 'button', onclick: () => enviar(resp.texto_sugerido, false, 'Registrar assim', { hoje: resp.hoje }) }, 'Registrar assim'),
      el('button', { type: 'button', onclick: editar }, 'Editar'),
    );
    bolha('alerta', el('h3', {}, 'Entendi assim (ajuda da IA)'), ...linhas, el('div', { class: 'antes' }, 'Confira antes de registrar: nada foi gravado ainda.'), acoes);
    return;
  }
  // Entendeu parte, mas falta informação (ex.: a carga): mostra o que entendeu e pergunta, sem gravar.
  bolha('alerta', el('h3', {}, 'Entendi assim (ajuda da IA)'), ...linhas, el('div', { class: 'antes' }, resp.texto_sugerido));
  editar();
  mostrarPerguntas({ pendentes: resp.pendentes, erros: [] }, resp.texto_sugerido);
}

function mostrarDuplicado(resp, texto, usarRotina) {
  const acoes = el(
    'div',
    { class: 'acoes' },
    el('button', { type: 'button', onclick: () => enviar(texto, usarRotina, 'Registrar mesmo assim', { forcar: true }) }, 'Registrar mesmo assim'),
  );
  bolha(
    'alerta',
    `Já estava registrado, nada foi gravado:\n${resp.duplicados.map((r) => `${r.exercicio}: ${resumo(r)} (${data(r.data)})`).join('\n')}`,
    acoes,
  );
}

// Mostra a resposta da API no chat. Devolve true se gravou.
function tratarResposta(resp, texto, usarRotina, titulo) {
  if (resp.status === 'ok') {
    mostrarRegistrados(resp.registros, titulo);
    return true;
  }
  if (resp.status === 'precisa_resposta') mostrarPerguntas(resp, texto);
  else if (resp.status === 'resposta') {
    bolha('', el('h3', {}, resp.origem === 'ia' ? 'Resposta da IA' : 'Seu histórico'), resp.mensagem);
    lembrar('ia', resp.mensagem);
  }
  else if (resp.status === 'sugestao') mostrarSugestao(resp);
  else if (resp.status === 'duplicado') mostrarDuplicado(resp, texto, usarRotina);
  else if (resp.status === 'erro_parcial') {
    if (resp.salvos.length) mostrarRegistrados(resp.salvos, titulo);
    bolha('erro', `Não consegui gravar "${resp.falhou}": ${resp.erro}\nOs itens acima foram salvos; reenvie só o restante.`);
  }
  return false;
}

const eSemRede = (e) => !navigator.onLine || e instanceof TypeError;

// Memória da conversa (só na tela; some ao fechar o app): as últimas mensagens vão junto para a IA lembrar do assunto.
const conversa = [];
function lembrar(de, texto) {
  conversa.push({ de, texto: String(texto).slice(0, 600) });
  if (conversa.length > 10) conversa.shift();
}

async function enviar(texto, usarRotina = false, rotuloUsuario = null, { forcar = false, hoje = hojeSP() } = {}) {
  const botao = $('#enviar');
  botao.disabled = true;
  bolha('eu', rotuloUsuario || texto);
  let pensando = null;
  const espera = setTimeout(() => (pensando = bolha('', el('div', { class: 'antes' }, 'Pensando…'))), 1500);
  try {
    const historico = conversa.slice();
    lembrar('eu', texto);
    const resp = await chamar('/api/chat', { method: 'POST', body: JSON.stringify({ texto, usarRotina, forcar, hoje, historico }) });
    clearTimeout(espera);
    pensando?.remove();
    // No celular (teclado próprio, sem cursor para editar) o campo sempre esvazia; o texto enviado fica na bolha.
    if (tratarResposta(resp, texto, usarRotina) || $('#entrada').classList.contains('com-teclado')) {
      $('#entrada').value = '';
      ajustarEntrada();
    }
  } catch (e) {
    if (eSemRede(e)) {
      // Guarda o texto e a data de hoje (para "ontem", "seg"… valerem a partir de agora) e envia depois.
      fila.gravar([...fila.ler(), { texto, usarRotina, forcar, hoje }]);
      $('#entrada').value = '';
      ajustarEntrada();
      atualizarAviso();
      bolha('alerta', 'Sem internet: guardei este registro no aparelho. Ele só é gravado no Notion quando a conexão voltar (e se faltar alguma informação eu pergunto nessa hora).');
    } else {
      bolha('erro', e.message);
    }
  } finally {
    clearTimeout(espera);
    pensando?.remove();
    botao.disabled = false;
  }
}

// Envia, em ordem, o que ficou guardado sem internet.
let enviandoFila = false;
async function enviarFila() {
  if (enviandoFila || !navigator.onLine || !fila.ler().length) return;
  enviandoFila = true;
  try {
    while (fila.ler().length) {
      const [item, ...resto] = fila.ler();
      bolha('eu', `${item.texto}\n(guardado sem internet)`);
      let resp;
      try {
        resp = await chamar('/api/chat', { method: 'POST', body: JSON.stringify(item) });
      } catch (e) {
        if (eSemRede(e)) return; // continua na fila
        bolha('erro', `Não consegui enviar o registro guardado: ${e.message}\nReenvie: ${item.texto}`);
        fila.gravar(resto);
        atualizarAviso();
        continue;
      }
      fila.gravar(resto);
      atualizarAviso();
      const gravou = tratarResposta(resp, item.texto, item.usarRotina, 'Registrado da fila ✓');
      if (!gravou && resp.status === 'precisa_resposta') {
        $('#entrada').value = item.texto;
        ajustarEntrada();
        bolha('', el('div', { class: 'antes' }, `O texto voltou para a caixa de mensagem. Corrija e envie (vale a data de hoje; para outro dia comece com a data, ex.: ontem peito: ...). Digitado em ${data(item.hoje)}.`));
      }
    }
  } finally {
    enviandoFila = false;
  }
}

// Campo editável em vez de <textarea>: o iOS não mostra a barra ↑ ↓ ✓ do formulário num campo assim.
// Mantém `.value` para o resto do código continuar igual.
const campo = $('#entrada');
Object.defineProperty(campo, 'value', {
  get: () => campo.innerText.replace(/ /g, ' '),
  set: (v) => {
    campo.textContent = v;
    ajustarEntrada();
  },
});

function ajustarEntrada() {
  campo.dataset.vazio = campo.innerText.trim() ? '' : '1'; // placeholder via CSS
  if (!campo.dataset.vazio) campo.scrollTop = campo.scrollHeight;
}

$('#form-chat').onsubmit = (e) => {
  e.preventDefault();
  const texto = $('#entrada').value.trim();
  if (texto) enviar(texto);
};
$('#entrada').addEventListener('input', ajustarEntrada);
// Celular: teclado próprio (o do iOS traz a barra ↑ ↓ ✓ que a página não consegue esconder).
if (matchMedia('(pointer: coarse)').matches) iniciarTeclado({ campo, raiz: $('#teclado'), aoEnviar: () => $('#form-chat').requestSubmit() });
$('#entrada').addEventListener('keydown', (e) => {
  // Enter envia (no celular também). Shift+Enter quebra linha. Não envia no meio de uma composição (acentos, ditado).
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    $('#form-chat').requestSubmit();
  }
});

// ---------- treino do dia ----------

// Cada treino já visto fica na memória: ao tocar nele aparece na hora e a versão nova chega em seguida.
const diasVistos = new Map();
let pedidoDia = 0;

async function carregarDia(treino) {
  const lista = $('#lista-dia');
  const chave = treino || '';
  const meu = ++pedidoDia;
  const visto = diasVistos.get(chave);
  if (visto) {
    estado.dia = visto;
    estado.diaSelecionado = visto.selecionado;
    renderDia();
  } else if (!estado.dia) {
    lista.replaceChildren(el('div', { class: 'vazio-geral' }, 'Carregando…'));
  } else {
    // troca o botão ativo já, enquanto a lista carrega
    estado.diaSelecionado = treino;
    $('#chips').querySelectorAll('button').forEach((b) => b.classList.toggle('ativa', b.textContent.replace(' ★', '') === treino));
    lista.classList.add('carregando');
  }
  try {
    const dados = await chamar(`/api/dia${treino ? `?treino=${encodeURIComponent(treino)}` : ''}`);
    diasVistos.set(chave, dados);
    diasVistos.set(dados.selecionado, dados);
    if (meu !== pedidoDia) return; // o usuário já tocou em outro treino
    estado.dia = dados;
    estado.diaSelecionado = dados.selecionado;
    renderDia();
  } catch (e) {
    if (meu === pedidoDia && !visto) lista.replaceChildren(el('div', { class: 'vazio-geral' }, e.message));
  } finally {
    if (meu === pedidoDia) lista.classList.remove('carregando');
  }
}

// Rola a fileira de botões para o escolhido ficar no meio (senão ele pode ficar cortado na borda).
function centralizarAtivo(fileira) {
  const ativo = fileira.querySelector('.ativa');
  if (ativo) fileira.scrollLeft = ativo.offsetLeft - (fileira.clientWidth - ativo.offsetWidth) / 2;
}

function renderDia() {
  const d = estado.dia;
  $('#chips').replaceChildren(
    ...d.treinos.map((t) =>
      el('button', { class: t === d.selecionado ? 'ativa' : '', onclick: () => carregarDia(t) }, t === d.sugerido ? `${t} ★` : t),
    ),
  );
  centralizarAtivo($('#chips')); // os últimos treinos ficam fora da tela no celular
  $('#aba-dia').scrollTop = 0;
  $('#lista-dia').replaceChildren(
    ...d.exercicios.map((ex) =>
      el(
        'div',
        { class: 'cartao' },
        el('h3', {}, ex.exercicio),
        el('div', { class: 'meta' }, ex.series ? `Personal: ${ex.series}×${String(ex.reps).replace("-", "–")}` : "Séries e repetições: você define"),
        ex.ultimo
          ? el('div', { class: 'ultimo' }, `Último (${dataComDia(ex.ultimo.data)}${ex.ultimo.deOutroTreino ? ', outro treino' : ''}): ${resumoDia(ex.ultimo)}`)
          : el('div', { class: 'ultimo vazio' }, 'Ainda sem registro'),
        el('button', { onclick: () => irParaHistorico(ex.exercicio) }, 'Ver histórico'),
      ),
    ),
  );
}

// ---------- histórico ----------

// Filtro por tipo (grupo muscular): "Todos" ou um grupo. O último escolhido fica lembrado no aparelho.
estado.grupo = guardado.ler('grupoHistorico') || '';

const exerciciosDoGrupo = () => {
  const d = estado.dia;
  const grupoDe = d.grupoDoExercicio || {};
  return d.catalogo.filter((n) => !estado.grupo || grupoDe[n] === estado.grupo);
};

function renderFiltroHistorico() {
  const d = estado.dia;
  const grupos = d.grupos || [];
  if (estado.grupo && !grupos.includes(estado.grupo)) estado.grupo = '';

  $('#filtro-grupos').replaceChildren(
    ...['', ...grupos].map((g) =>
      el(
        'button',
        { type: 'button', class: g === estado.grupo ? 'ativa' : '', 'aria-pressed': String(g === estado.grupo), onclick: () => escolherGrupo(g) },
        g || 'Todos',
      ),
    ),
  );
  $('#filtro-grupos').hidden = grupos.length === 0;
  centralizarAtivo($('#filtro-grupos'));

  const seletor = $('#seletor-exercicio');
  const anterior = seletor.value;
  const nomes = exerciciosDoGrupo();
  seletor.replaceChildren(
    el('option', { value: '' }, estado.grupo ? `Exercícios de ${estado.grupo.toLowerCase()} (${nomes.length})` : 'Escolha um exercício'),
    ...nomes.map((n) => el('option', { value: n }, n)),
  );
  seletor.value = nomes.includes(anterior) ? anterior : '';
  if (!seletor.value) carregarHistorico(''); // sem exercício escolhido: mostra os do tipo (ou nada)
}

function escolherGrupo(grupo) {
  estado.grupo = grupo;
  guardado.gravar('grupoHistorico', grupo);
  renderFiltroHistorico();
}

// Com um tipo escolhido e nenhum exercício, lista os exercícios daquele tipo para tocar.
function mostrarExerciciosDoGrupo() {
  const lista = $('#lista-historico');
  if (!estado.grupo) return lista.replaceChildren();
  const nomes = exerciciosDoGrupo();
  lista.replaceChildren(
    ...(nomes.length
      ? nomes.map((n) =>
          el(
            'button',
            {
              type: 'button',
              class: 'cartao item-exercicio',
              onclick: () => {
                $('#seletor-exercicio').value = n;
                carregarHistorico(n);
              },
            },
            n,
          ),
        )
      : [el('div', { class: 'vazio-geral' }, 'Nenhum exercício deste tipo.')]),
  );
}

async function prepararHistorico() {
  if (!estado.dia) {
    try {
      estado.dia = await chamar('/api/dia');
      estado.diaSelecionado = estado.dia.selecionado;
    } catch (e) {
      $('#lista-historico').replaceChildren(el('div', { class: 'vazio-geral' }, e.message));
      return;
    }
  }
  renderFiltroHistorico();
}

async function carregarHistorico(exercicio) {
  const lista = $('#lista-historico');
  if (!exercicio) return mostrarExerciciosDoGrupo();
  lista.replaceChildren(el('div', { class: 'vazio-geral' }, 'Carregando…'));
  try {
    const { registros } = await chamar(`/api/historico?exercicio=${encodeURIComponent(exercicio)}`);
    lista.replaceChildren(
      ...(registros.length
        ? registros.map((r) =>
            el(
              'div',
              { class: 'cartao' },
              el('h3', {}, `${data(r.data)} — ${resumo(r)}`),
              r.treino ? el('div', { class: 'meta' }, r.treino) : null,
              r.id ? el('button', { class: 'perigo', onclick: () => excluirRegistro(r, exercicio) }, 'Excluir') : null,
            ),
          )
        : [el('div', { class: 'vazio-geral' }, 'Nenhum registro deste exercício ainda.')]),
    );
  } catch (e) {
    lista.replaceChildren(el('div', { class: 'vazio-geral' }, e.message));
  }
}

async function excluirRegistro(r, exercicio) {
  if (!confirm(`Excluir este registro?
${exercicio}: ${resumo(r)} (${data(r.data)})`)) return;
  try {
    await chamar('/api/apagar', { method: 'POST', body: JSON.stringify({ id: r.id }) });
    carregarHistorico(exercicio);
  } catch (e) {
    alert(`Não consegui excluir: ${e.message}`);
  }
}

async function irParaHistorico(exercicio) {
  abrirAba('historico');
  await prepararHistorico();
  // Se o tipo escolhido esconde este exercício, volta para "Todos".
  const grupoDele = (estado.dia.grupoDoExercicio || {})[exercicio];
  if (estado.grupo && grupoDele !== estado.grupo) escolherGrupo('');
  $('#seletor-exercicio').value = exercicio;
  carregarHistorico(exercicio);
}

$('#seletor-exercicio').onchange = (e) => carregarHistorico(e.target.value);

// ---------- estado de rede e instalação ----------

function atualizarAviso() {
  const aviso = $('#aviso');
  const naFila = fila.ler().length;
  const partes = [];
  if (!navigator.onLine) partes.push('sem internet');
  if (naFila) partes.push(`${naFila} na fila`);
  aviso.hidden = partes.length === 0;
  aviso.textContent = partes.join(' · ');
}
addEventListener('online', () => {
  atualizarAviso();
  enviarFila();
});
addEventListener('offline', atualizarAviso);
atualizarAviso();

// ---------- atualização do app ----------
// O service worker novo se instala e assume sozinho (sw.js), mas esta tela continua com o código
// antigo até recarregar. Quando isso acontece, aparece o botão "Atualizar".

function mostrarAtualizacao() {
  $('#atualizar').hidden = false;
}

$('#botao-atualizar').onclick = (e) => {
  e.currentTarget.disabled = true;
  e.currentTarget.textContent = 'Atualizando…';
  location.reload();
};

if ('serviceWorker' in navigator) {
  // Na primeira instalação ainda não há controlador: não é "atualização", então não avisa.
  const jaTinhaControle = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (jaTinhaControle) mostrarAtualizacao();
  });

  addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then((registro) => {
        // O navegador só confere versão nova de vez em quando; aqui confere ao voltar para o app,
        // ao recuperar a internet e a cada 30 minutos com o app aberto.
        const conferir = () => registro.update().catch(() => {});
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) conferir();
        });
        addEventListener('online', conferir);
        setInterval(conferir, 30 * 60 * 1000);
      })
      .catch(() => {});
  });
}

// ---------- diagnóstico de tela ----------
// Toque 5 vezes no título para ver as medidas reais do aparelho (versão do app, tamanho da área
// útil, áreas seguras, modo instalado). Serve para investigar problemas de layout no iPhone; toque
// no quadro para fechar.

async function medidasDoAparelho() {
  const retangulo = (seletor) => {
    const r = document.querySelector(seletor)?.getBoundingClientRect();
    return r ? `${Math.round(r.top)} → ${Math.round(r.bottom)}` : '—';
  };
  // As áreas seguras só se leem por CSS: mede-se o padding de uma caixa que usa env().
  const caixa = document.createElement('div');
  caixa.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(caixa);
  const e = getComputedStyle(caixa);
  const seguras = `${e.paddingTop} / ${e.paddingRight} / ${e.paddingBottom} / ${e.paddingLeft}`;
  caixa.remove();

  let caches_ = '—';
  try {
    caches_ = (await caches.keys()).join(', ') || '(nenhum)';
  } catch {
    /* sem Cache API */
  }
  const vv = window.visualViewport;
  const modo = ['standalone', 'fullscreen', 'minimal-ui', 'browser'].find((m) => matchMedia(`(display-mode: ${m})`).matches);
  return [
    `versão (cache): ${caches_}`,
    `instalado (standalone): ${navigator.standalone === true ? 'sim' : 'não'} · display-mode: ${modo ?? '?'}`,
    `janela: ${innerWidth} × ${innerHeight}`,
    `visualViewport: ${vv ? `${Math.round(vv.width)} × ${Math.round(vv.height)} (topo ${Math.round(vv.offsetTop)})` : '—'}`,
    `documento (clientHeight): ${document.documentElement.clientHeight}`,
    `tela: ${screen.width} × ${screen.height} · outerHeight: ${outerHeight}`,
    `áreas seguras (topo/dir/base/esq): ${seguras}`,
    `corpo (topo → base): ${retangulo('body')}`,
    `barra de baixo (topo → base): ${retangulo('nav')}`,
    `aba ativa (topo → base): ${retangulo('.aba.ativa')}`,
    `proporção: ${devicePixelRatio}`,
  ].join('\n');
}

let toquesNoTitulo = 0;
let zeraToques;
$('#titulo').addEventListener('click', async () => {
  clearTimeout(zeraToques);
  zeraToques = setTimeout(() => (toquesNoTitulo = 0), 1500);
  if (++toquesNoTitulo < 5) return;
  toquesNoTitulo = 0;
  const quadro = el('pre', { id: 'diagnostico', onclick: () => quadro.remove() }, await medidasDoAparelho());
  document.body.append(quadro);
});

boasVindas();
enviarFila();
