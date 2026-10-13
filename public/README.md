# public/

O app que abre no celular. É servido como está (sem build, sem framework).

## Padrão

- HTML + CSS + JavaScript puro (módulo ES). Cores e medidas ficam nas variáveis no topo de `styles.css`.
- Layout pensado para celular (iPhone), com respeito às áreas seguras (`env(safe-area-inset-*)`).
- **Nenhuma chave aqui.** Tudo que precisa do Notion passa por `/api/*`.
- Texto na tela sempre em português do Brasil.

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Estrutura: 3 abas (Chat, Treino do dia, Histórico) e a janela do código de acesso |
| `main.js` | Lógica das telas e chamadas à API |
| `styles.css` | Visual (tema escuro) |
| `sw.js` | Service worker: abre o app sem internet e guarda a última resposta de `/api/dia` e `/api/historico` |
| `manifest.webmanifest` | Dados de instalação (nome, ícones, tela cheia) |
| `icons/` | Ícones 192, 512 e `apple-touch-icon` (180) |

## Pontos de atenção

- **Atualizou um arquivo do app?** Troque `VERSAO` em `sw.js` (`personal-v5` → `personal-v6`) para o celular baixar a versão nova.
- Registrar treino **exige internet** para gravar no Notion. Sem sinal, o texto fica numa fila no aparelho (`localStorage`, chave `fila`, com a data de quando foi digitado) e é enviado quando a conexão volta; o aviso no topo mostra "N na fila". Ver treino e histórico funciona offline com o que foi visto da última vez.
- **Desfazer** (cartão de registrado) e **Excluir** (Histórico) chamam `/api/apagar`; no Notion vão para a lixeira.
- No iPhone o app só instala em **Safari**: Compartilhar → Adicionar à Tela de Início.

## Cuidado com os nomes dos arquivos

**Não chame de `app.js`, `server.js` ou `index.js` nenhum arquivo que vá para a Vercel** (o `server.js` da raiz é exceção porque está no `.vercelignore`). A Vercel os confunde com o ponto de entrada de um servidor e roda o arquivo no servidor, onde `document` não existe. Foi o que derrubou a primeira publicação (`ReferenceError: document is not defined`). Por isso o app se chama `main.js` e o `vercel.json` desliga a detecção automática (`"framework": null`).
