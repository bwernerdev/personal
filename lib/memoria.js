// Memória da IA: o usuário pede "lembre que tenho dor no ombro", "o que você lembra de mim?" ou "esqueça 2".
// É uma regra do servidor (nada de IA): só grava o que o usuário mandou guardar, com as palavras dele.
// As lembranças entram no prompt da IA (lib/ia.js) para ela responder levando em conta o que você contou.

import { normalizar } from './normalizar.js';

export const MAX_MEMORIAS = 30;
export const MAX_NOTA = 300;

// Devolve { tipo: 'guardar', nota } | { tipo: 'listar' } | { tipo: 'esquecer', alvo } | null.
export function comandoDeMemoria(textoOriginal) {
  const original = String(textoOriginal).trim();
  const t = normalizar(original).replace(/\s+/g, ' ');

  if (/^(o que (voce )?(lembra|sabe|guardou|anotou)( de| sobre)?( mim)?|minhas (memorias|notas|lembrancas)|liste (as |minhas )?(memorias|notas|lembrancas)|quais (sao )?(as )?(minhas )?(memorias|notas))\??$/.test(t)) {
    return { tipo: 'listar' };
  }

  const esquecer = /^(esqueca|esquece|esquecer|apague|apaga|remova|remove) (a |as |essa |esta )?(memoria|memorias|nota|notas|lembranca|lembrancas|tudo|isso)?\s*(.*)$/.exec(t);
  if (esquecer && (esquecer[3] || /^(esqueca|esquece|esquecer)/.test(t))) {
    const resto = esquecer[4].trim();
    if (/^esqueca|^esquece|^esquecer/.test(t) || esquecer[3]) {
      if (esquecer[3] === 'tudo' || /^(tudo|todas|todas as (memorias|notas))$/.test(resto)) return { tipo: 'esquecer', alvo: 'tudo' };
      const n = /^(\d+)$/.exec(resto)?.[1];
      return { tipo: 'esquecer', alvo: n ? Number(n) : resto || (esquecer[3] === 'isso' ? 'ultima' : null) };
    }
  }

  const guardar = /^(lembre|lembra|lembrar|anote|anota|guarde|guarda|memorize|memoriza)(-se)?( que| de que| isso| disso)?\s*[:,-]?\s*(.+)$/is.exec(original.normalize('NFD').replace(/\p{Diacritic}/gu, ''));
  if (guardar) {
    // Pega o texto com os acentos originais: a mesma posição, depois do prefixo.
    const prefixo = guardar[0].length - guardar[4].length;
    const nota = original.slice(Math.min(prefixo, original.length)).trim();
    if (nota.length >= 3 && !/^(isso|disso|isto)$/i.test(nota)) return { tipo: 'guardar', nota: nota.slice(0, MAX_NOTA) };
  }
  return null;
}

// Aplica o comando e devolve o texto da resposta. `memorias`: lista atual; `acoes`: { guardar(nota), apagar(id) }.
export async function executarMemoria(comando, memorias, acoes) {
  if (comando.tipo === 'listar') {
    return memorias.length
      ? `O que guardei sobre você:\n${memorias.map((m, i) => `${i + 1}. ${m.nota}`).join('\n')}\n\nPara apagar: "esqueça 2" ou "esqueça tudo".`
      : 'Ainda não guardei nada sobre você. Diga, por exemplo: "lembre que tenho dor no ombro direito".';
  }
  if (comando.tipo === 'guardar') {
    if (memorias.some((m) => normalizar(m.nota) === normalizar(comando.nota))) return 'Já tinha isso guardado.';
    if (memorias.length >= MAX_MEMORIAS) return `Já guardei ${MAX_MEMORIAS} coisas (o máximo). Apague alguma com "esqueça 1" antes de guardar outra.`;
    await acoes.guardar(comando.nota);
    return `Guardei: "${comando.nota}"`;
  }
  // esquecer
  if (!memorias.length) return 'Não tenho nada guardado para esquecer.';
  if (comando.alvo === 'tudo') {
    for (const m of memorias) await acoes.apagar(m.id);
    return `Apaguei tudo que tinha guardado (${memorias.length}).`;
  }
  let alvo = null;
  if (typeof comando.alvo === 'number') alvo = memorias[comando.alvo - 1];
  else if (comando.alvo === 'ultima') alvo = memorias[memorias.length - 1];
  else if (comando.alvo) {
    const achadas = memorias.filter((m) => normalizar(m.nota).includes(comando.alvo));
    if (achadas.length === 1) alvo = achadas[0];
    else return achadas.length ? 'Mais de uma lembrança combina; diga o número (veja com "o que você lembra de mim?").' : 'Não achei essa lembrança. Veja a lista com "o que você lembra de mim?".';
  }
  if (!alvo) return 'Qual lembrança? Diga o número (veja com "o que você lembra de mim?") ou "esqueça tudo".';
  await acoes.apagar(alvo.id);
  return `Esqueci: "${alvo.nota}"`;
}
