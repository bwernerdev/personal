// Cache de leituras na memória do servidor, com validade curta. Serve para não reler o Notion (lento: ~0,5 s por
// chamada, e uma chamada por 100 linhas) a cada mensagem do chat. Cada instância da Vercel tem o seu: por isso a
// validade é curta e quem grava limpa o cache; leituras que precisam estar em dia pedem `fresco`.

export function criarCache(validadeMs, agora = () => Date.now()) {
  const itens = new Map(); // chave -> { promessa, ate }
  return {
    // Devolve o valor guardado (se ainda vale) ou chama `carregar`. Duas leituras ao mesmo tempo dividem a chamada.
    obter(chave, carregar, { fresco = false } = {}) {
      const guardado = itens.get(chave);
      if (!fresco && guardado && agora() < guardado.ate) return guardado.promessa;
      const promessa = Promise.resolve().then(carregar);
      itens.set(chave, { promessa, ate: agora() + validadeMs });
      promessa.catch(() => itens.get(chave)?.promessa === promessa && itens.delete(chave)); // erro não fica guardado
      return promessa;
    },
    limpar(chave) {
      if (chave === undefined) itens.clear();
      else itens.delete(chave);
    },
  };
}
