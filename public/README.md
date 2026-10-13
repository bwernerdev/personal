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
| `index.html` | Estrutura: 3 abas (Chat, Treino do dia, Histórico), o aviso de nova versão e a janela do código de acesso |
| `main.js` | Lógica das telas e chamadas à API |
| `styles.css` | Visual (tema escuro) |
| `sw.js` | Service worker: abre o app sem internet e guarda a última resposta de `/api/dia` e `/api/historico` |
| `manifest.webmanifest` | Dados de instalação (nome, ícones, tela cheia) |
| `icons/` | Ícones 192, 512 e `apple-touch-icon` (180) |

## Pontos de atenção

- **Aviso "Nova versão disponível" + botão Atualizar:** aparece sozinho, abaixo do título, quando o celular baixa uma versão nova (o service worker novo assume e dispara `controllerchange`; `main.js` mostra o aviso). Tocar em **Atualizar** recarrega o app; registros na fila sem internet não se perdem (ficam no `localStorage`), mas um texto digitado e não enviado sim. O app confere se há versão nova ao voltar para a tela, ao recuperar a internet e a cada 30 minutos. Na primeira instalação não aparece (não é atualização). **Só funciona se `VERSAO` mudar:** o navegador só percebe versão nova quando o `sw.js` muda.
- **Atualizou um arquivo do app?** Troque `VERSAO` em `sw.js` (`personal-v10` → `personal-v11`) para o celular baixar a versão nova.
- Registrar treino **exige internet** para gravar no Notion. Sem sinal, o texto fica numa fila no aparelho (`localStorage`, chave `fila`, com a data de quando foi digitado) e é enviado quando a conexão volta; o aviso no topo mostra "N na fila". Ver treino e histórico funciona offline com o que foi visto da última vez.
- **Desfazer** (cartão de registrado) e **Excluir** (Histórico) chamam `/api/apagar`; no Notion vão para a lixeira.
- No iPhone o app só instala em **Safari**: Compartilhar → Adicionar à Tela de Início.

## Cuidado com os nomes dos arquivos

**Não chame de `app.js`, `server.js` ou `index.js` nenhum arquivo que vá para a Vercel** (o `server.js` da raiz é exceção porque está no `.vercelignore`). A Vercel os confunde com o ponto de entrada de um servidor e roda o arquivo no servidor, onde `document` não existe. Foi o que derrubou a primeira publicação (`ReferenceError: document is not defined`). Por isso o app se chama `main.js` e o `vercel.json` desliga a detecção automática (`"framework": null`).

## Diagnóstico de tela

Para investigar problemas de layout no iPhone: **toque 5 vezes no título** (por exemplo, "Chat") e aparece um quadro com as medidas reais do aparelho (versão do app, tamanho da janela, áreas seguras, modo instalado, posição da barra de baixo). Tire uma captura de tela e mande para quem está ajudando; toque no quadro para fechar. Não grava nem envia nada.
