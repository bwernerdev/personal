// Teclado próprio do app (estilo Google Keyboard, tema escuro), só para telas de toque.
// Existe porque o teclado do iOS sempre mostra a barra ↑ ↓ ✓ e a página não consegue escondê-la.
// Escreve direto no campo do chat (sempre no fim do texto). Letras entram ao soltar o dedo;
// segurar uma tecla abre as variações (á à â ã, 1…0 na fileira de cima) e dá para deslizar até a desejada.

const ICONES = {
  shift: '<svg viewBox="0 0 24 24"><path d="M12 4 3.5 13H8v6h8v-6h4.5z"/></svg>',
  shiftTrava: '<svg viewBox="0 0 24 24"><path d="M12 4 3.5 13H8v4h8v-4h4.5z"/><rect x="8" y="19" width="8" height="2"/></svg>',
  apagar: '<svg viewBox="0 0 24 24"><path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7zm3.4 3.6L11 10l2 2-2 2 1.4 1.4 2-2 2 2L17.8 14l-2-2 2-2-1.4-1.4-2 2z"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/></svg>',
  enviar: '<svg viewBox="0 0 24 24"><path d="M3 20.5v-6.8l11-1.7-11-1.7V3.5L22 12z"/></svg>',
};

const ACENTOS = {
  a: ['á', 'à', 'â', 'ã', 'ä'],
  e: ['é', 'è', 'ê', 'ë'],
  i: ['í', 'ì', 'î', 'ï'],
  o: ['ó', 'ò', 'ô', 'õ', 'ö'],
  u: ['ú', 'ù', 'û', 'ü'],
  c: ['ç'],
  n: ['ñ'],
};
const NUMEROS_DE_CIMA = { q: '1', w: '2', e: '3', r: '4', t: '5', y: '6', u: '7', i: '8', o: '9', p: '0' };

const letra = (c) => ({ r: c, v: c, mais: [...(NUMEROS_DE_CIMA[c] ? [NUMEROS_DE_CIMA[c]] : []), ...(ACENTOS[c] || [])], letra: true });
const simbolo = (c, mais = []) => ({ r: c, v: c, mais });
const linhaDeLetras = (s) => [...s].map(letra);
const linhaDeSimbolos = (s) => [...s].map((c) => simbolo(c));

const VIRGULA = simbolo(',', ['?', '!', ';', ':', '-']);
const PONTO = simbolo('.', [',', '?', '!', ':', ';', '-', '_', '(', ')', '"', "'"]);

const CAMADAS = {
  abc: [
    { teclas: linhaDeLetras('qwertyuiop') },
    { teclas: linhaDeLetras('asdfghjkl'), recuo: true },
    { teclas: [{ tipo: 'shift', largura: 1.5 }, ...linhaDeLetras('zxcvbnm'), { tipo: 'apagar', largura: 1.5 }] },
    { teclas: [{ tipo: 'camada', para: 'sim1', r: '?123', largura: 1.5 }, { tipo: 'mic', largura: 1 }, VIRGULA, { tipo: 'espaco', largura: 5 }, PONTO, { tipo: 'enter', largura: 1.5 }] },
  ],
  sim1: [
    { teclas: linhaDeSimbolos('1234567890') },
    { teclas: [simbolo('@'), simbolo('#'), simbolo('$', ['€', '£', '¢', '¥']), simbolo('_'), simbolo('&'), simbolo('-', ['–', '—', '•']), simbolo('+'), simbolo('('), simbolo(')'), simbolo('/')] },
    { teclas: [{ tipo: 'camada', para: 'sim2', r: '=\\<', largura: 1.5 }, ...linhaDeSimbolos('*"\':;!?'), { tipo: 'apagar', largura: 1.5 }] },
    { teclas: [{ tipo: 'camada', para: 'abc', r: 'ABC', largura: 1.5 }, VIRGULA, { tipo: 'espaco', largura: 5 }, PONTO, { tipo: 'enter', largura: 1.5 }] },
  ],
  sim2: [
    { teclas: linhaDeSimbolos('~`|•√π÷×¶∆') },
    { teclas: linhaDeSimbolos('£¢€¥^°={}\\') },
    { teclas: [{ tipo: 'camada', para: 'sim1', r: '?123', largura: 1.5 }, ...linhaDeSimbolos('%©®™✓[]'), { tipo: 'apagar', largura: 1.5 }] },
    { teclas: [{ tipo: 'camada', para: 'abc', r: 'ABC', largura: 1.5 }, VIRGULA, { tipo: 'espaco', largura: 5 }, PONTO, { tipo: 'enter', largura: 1.5 }] },
  ],
};

const RECONHECIMENTO = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;
const TEMPO_SEGURAR = 350;
const TEMPO_DUPLO_SHIFT = 400;

export function iniciarTeclado({ campo, raiz, aoEnviar }) {
  let camada = 'abc';
  let shift = 0; // 0 minúscula, 1 uma maiúscula, 2 caixa alta travada
  let ultimoShift = 0;
  let aberto = null; // tecla pressionada agora
  let ouvindo = null; // reconhecimento de voz em andamento

  // O campo vira só uma tela de texto: nada de teclado nativo (que traz a barra ↑ ↓ ✓).
  campo.contentEditable = 'false';
  campo.setAttribute('aria-readonly', 'true');
  campo.classList.add('com-teclado');
  raiz.hidden = false;

  const balao = document.createElement('div');
  balao.className = 'tec-balao';
  balao.hidden = true;
  document.body.append(balao);

  const maiuscula = () => shift > 0;
  const valorDe = (t) => (t.letra && maiuscula() ? t.v.toUpperCase() : t.v);
  const rotuloDe = (t) => (t.letra && maiuscula() ? t.r.toUpperCase() : t.r);

  function desenhar() {
    raiz.replaceChildren(
      ...CAMADAS[camada].map((linha) => {
        const el = document.createElement('div');
        el.className = `tec-linha${linha.recuo ? ' recuo' : ''}`;
        for (const t of linha.teclas) {
          if (t.tipo === 'mic' && !RECONHECIMENTO) continue; // aparelho sem ditado: sem a tecla
          const b = document.createElement('button');
          b.type = 'button';
          b.tabIndex = -1;
          b.className = `tec-tecla${t.tipo ? ` ${t.tipo}` : ''}`;
          b.style.flex = String(t.largura || 1);
          if (t.tipo === 'shift') {
            b.innerHTML = shift === 2 ? ICONES.shiftTrava : ICONES.shift;
            if (shift) b.classList.add('ligada');
            b.setAttribute('aria-label', 'Maiúsculas');
          } else if (t.tipo === 'apagar') {
            b.innerHTML = ICONES.apagar;
            b.setAttribute('aria-label', 'Apagar');
          } else if (t.tipo === 'mic') {
            b.innerHTML = ICONES.mic;
            if (ouvindo) b.classList.add('ligada');
            b.setAttribute('aria-label', 'Ditar por voz');
          } else if (t.tipo === 'enter') {
            b.innerHTML = ICONES.enviar;
            b.setAttribute('aria-label', 'Enviar');
          } else if (t.tipo === 'espaco') {
            b.textContent = 'Português';
            b.setAttribute('aria-label', 'Espaço');
          } else {
            b.textContent = rotuloDe(t);
          }
          b._t = t;
          el.append(b);
        }
        return el;
      }),
    );
  }

  function editar(fn) {
    campo.value = fn(campo.value);
    campo.dispatchEvent(new Event('input'));
  }
  const inserir = (s) => editar((v) => v + s);
  const apagar = () => editar((v) => Array.from(v).slice(0, -1).join(''));

  function mostrarBalao(botao, opcoes, marcada) {
    const r = botao.getBoundingClientRect();
    balao.replaceChildren(
      ...opcoes.map((o, i) => {
        const s = document.createElement('span');
        s.textContent = o;
        if (i === marcada) s.className = 'marcada';
        return s;
      }),
    );
    balao.hidden = false;
    balao.dataset.n = String(opcoes.length);
    const largura = Math.max(r.width, opcoes.length * 40);
    const esquerda = Math.min(Math.max(4, r.left + r.width / 2 - largura / 2), window.innerWidth - largura - 4);
    balao.style.cssText = `left:${esquerda}px;width:${largura}px;bottom:${window.innerHeight - r.top + 6}px`;
  }
  const esconderBalao = () => {
    balao.hidden = true;
  };
  function marcarPorX(x) {
    const filhos = [...balao.children];
    if (!filhos.length) return;
    const r = balao.getBoundingClientRect();
    const i = Math.min(filhos.length - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * filhos.length)));
    filhos.forEach((f, k) => f.classList.toggle('marcada', k === i));
    aberto.escolha = filhos[i].textContent;
  }

  function avisar(texto) {
    const s = document.createElement('span');
    s.textContent = texto;
    balao.replaceChildren(s);
    balao.classList.add('aviso');
    balao.hidden = false;
    const r = raiz.getBoundingClientRect();
    balao.style.cssText = `left:8px;right:8px;width:auto;bottom:${window.innerHeight - r.top + 6}px`;
    setTimeout(() => {
      balao.hidden = true;
      balao.classList.remove('aviso');
    }, 3000);
  }

  // Ditado por voz (Web Speech API): o que você fala entra no fim do texto. Toque de novo para parar.
  function alternarDitado() {
    if (ouvindo) {
      ouvindo.stop();
      return;
    }
    const r = new RECONHECIMENTO();
    r.lang = 'pt-BR';
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const fala = Array.from(e.results).map((x) => x[0].transcript).join(' ').trim();
      if (fala) inserir((campo.value && !/\s$/.test(campo.value) ? ' ' : '') + fala + ' ');
    };
    r.onerror = (e) => avisar(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Ditado bloqueado: libere o microfone para este app nos Ajustes do iPhone.' : 'Ditado indisponível agora.');
    r.onend = () => {
      ouvindo = null;
      desenhar();
    };
    ouvindo = r;
    try {
      r.start();
    } catch {
      ouvindo = null;
      avisar('Ditado indisponível agora.');
    }
    desenhar();
  }

  function aoPressionar(e) {
    const botao = e.target.closest('.tec-tecla');
    if (!botao || aberto) return;
    e.preventDefault();
    const t = botao._t;
    aberto = { botao, t, escolha: null, aberto: false };
    botao.classList.add('pressionada');
    if (t.tipo === 'apagar') {
      apagar();
      aberto.espera = setTimeout(() => {
        aberto.repete = setInterval(apagar, 55);
      }, 400);
    } else if (t.letra || (!t.tipo && t.r)) {
      mostrarBalao(botao, [valorDe(t)], 0);
      aberto.escolha = valorDe(t);
      if (t.mais?.length) {
        aberto.espera = setTimeout(() => {
          aberto.aberto = true;
          const opcoes = t.mais.map((m) => (t.letra && maiuscula() ? m.toUpperCase() : m));
          mostrarBalao(botao, opcoes, 0);
          aberto.escolha = opcoes[0];
        }, TEMPO_SEGURAR);
      }
    }
  }

  function aoMover(e) {
    if (aberto?.aberto) marcarPorX(e.clientX);
  }

  function aoSoltar() {
    if (!aberto) return;
    const { botao, t, escolha } = aberto;
    clearTimeout(aberto.espera);
    clearInterval(aberto.repete);
    botao.classList.remove('pressionada');
    esconderBalao();
    aberto = null;

    if (t.tipo === 'apagar') return;
    if (t.tipo === 'shift') {
      const agora = Date.now();
      shift = agora - ultimoShift < TEMPO_DUPLO_SHIFT ? 2 : shift ? 0 : 1;
      ultimoShift = agora;
      desenhar();
    } else if (t.tipo === 'camada') {
      camada = t.para;
      desenhar();
    } else if (t.tipo === 'mic') {
      alternarDitado();
    } else if (t.tipo === 'espaco') {
      inserir(' ');
    } else if (t.tipo === 'enter') {
      aoEnviar();
    } else if (escolha) {
      inserir(escolha);
      if (shift === 1) {
        shift = 0;
        desenhar();
      }
    }
  }

  function aoCancelar() {
    if (!aberto) return;
    clearTimeout(aberto.espera);
    clearInterval(aberto.repete);
    aberto.botao.classList.remove('pressionada');
    esconderBalao();
    aberto = null;
  }

  raiz.addEventListener('pointerdown', aoPressionar);
  window.addEventListener('pointermove', aoMover);
  window.addEventListener('pointerup', aoSoltar);
  window.addEventListener('pointercancel', aoCancelar);
  raiz.addEventListener('contextmenu', (e) => e.preventDefault());
  desenhar();
}
