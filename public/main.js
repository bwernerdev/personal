// App do Personal: chat de registro, treino do dia e histórico.
// Todo o acesso ao Notion passa pela API (/api/*); nenhuma chave fica aqui.

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
const data = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
function resumo(r) {
  const partes = [];
  if (r.carga !== null && r.carga !== undefined) partes.push(`${num(r.carga)} kg`);
  if (r.series !== null && r.series !== undefined) partes.push(`${r.series}×${r.reps ?? '—'}`);
  if (r.obs) partes.push(r.obs);
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
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === nome));
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
  else if (resp.status === 'duplicado') mostrarDuplicado(resp, texto, usarRotina);
  else if (resp.status === 'erro_parcial') {
    if (resp.salvos.length) mostrarRegistrados(resp.salvos, titulo);
    bolha('erro', `Não consegui gravar "${resp.falhou}": ${resp.erro}\nOs itens acima foram salvos; reenvie só o restante.`);
  }
  return false;
}

const eSemRede = (e) => !navigator.onLine || e instanceof TypeError;

async function enviar(texto, usarRotina = false, rotuloUsuario = null, { forcar = false, hoje = hojeSP() } = {}) {
  const botao = $('#enviar');
  botao.disabled = true;
  bolha('eu', rotuloUsuario || texto);
  try {
    const resp = await chamar('/api/chat', { method: 'POST', body: JSON.stringify({ texto, usarRotina, forcar, hoje }) });
    if (tratarResposta(resp, texto, usarRotina)) {
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

function ajustarEntrada() {
  const t = $('#entrada');
  t.style.height = 'auto';
  t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
}

$('#form-chat').onsubmit = (e) => {
  e.preventDefault();
  const texto = $('#entrada').value.trim();
  if (texto) enviar(texto);
};
$('#entrada').addEventListener('input', ajustarEntrada);
$('#entrada').addEventListener('keydown', (e) => {
  // No computador, Enter envia (Shift+Enter quebra linha). No celular, Enter quebra linha.
  if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer: fine)').matches) {
    e.preventDefault();
    $('#form-chat').requestSubmit();
  }
});

// ---------- treino do dia ----------

async function carregarDia(treino) {
  const lista = $('#lista-dia');
  try {
    const dados = await chamar(`/api/dia${treino ? `?treino=${encodeURIComponent(treino)}` : ''}`);
    estado.dia = dados;
    estado.diaSelecionado = dados.selecionado;
    renderDia();
  } catch (e) {
    lista.replaceChildren(el('div', { class: 'vazio-geral' }, e.message));
  }
}

function renderDia() {
  const d = estado.dia;
  $('#chips').replaceChildren(
    ...d.treinos.map((t) =>
      el('button', { class: t === d.selecionado ? 'ativa' : '', onclick: () => carregarDia(t) }, t === d.sugerido ? `${t} ★` : t),
    ),
  );
  $('#lista-dia').replaceChildren(
    ...d.exercicios.map((ex) =>
      el(
        'div',
        { class: 'cartao' },
        el('h3', {}, ex.exercicio),
        el('div', { class: 'meta' }, `Personal: ${ex.series}×${String(ex.reps).replace('-', '–')}`),
        ex.ultimo
          ? el('div', { class: 'ultimo' }, `Último (${data(ex.ultimo.data)}${ex.ultimo.deOutroTreino ? ', outro treino' : ''}): ${resumoDia(ex.ultimo)}`)
          : el('div', { class: 'ultimo vazio' }, 'Ainda sem registro'),
        el('button', { onclick: () => irParaHistorico(ex.exercicio) }, 'Ver histórico'),
      ),
    ),
  );
}

// ---------- histórico ----------

async function prepararHistorico() {
  const seletor = $('#seletor-exercicio');
  if (!estado.dia) {
    try {
      estado.dia = await chamar('/api/dia');
      estado.diaSelecionado = estado.dia.selecionado;
    } catch (e) {
      $('#lista-historico').replaceChildren(el('div', { class: 'vazio-geral' }, e.message));
      return;
    }
  }
  if (seletor.options.length <= 1) {
    seletor.replaceChildren(
      el('option', { value: '' }, 'Escolha um exercício'),
      ...estado.dia.catalogo.map((n) => el('option', { value: n }, n)),
    );
  }
}

async function carregarHistorico(exercicio) {
  const lista = $('#lista-historico');
  if (!exercicio) return lista.replaceChildren();
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

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

boasVindas();
enviarFila();
