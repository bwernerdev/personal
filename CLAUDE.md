# Personal — instruções para o Claude Code

App de treino por chat (PWA) ligado ao Notion. Leia o [README.md](README.md) antes de mexer.

## Regras do projeto

- **Todo diretório tem um `README.md`** explicando o padrão daquela pasta (o que entra, nomes de arquivos, como adicionar um novo). Ao criar uma pasta nova ou mudar o padrão de uma existente, crie/atualize o `.md` dela na mesma alteração.
- **Não use `app.js`, `server.js` ou `index.js` como nome de arquivo que vai para a Vercel** (ela os confunde com servidor; ver `public/README.md`). O `server.js` da raiz só pode existir porque o `.vercelignore` o deixa de fora da publicação.
- Código e mensagens para o usuário em **português do Brasil**. Nomes de função e variável também em português, como no restante do projeto.
- **Sem dependências** (nem `npm install`): só Node 22 e APIs padrão. Se uma dependência for realmente necessária, registre o motivo em `docs/README.md`.
- **O chat é um interpretador de regras (`lib/parser.js`); o Claude é só um ajudante opcional** (`lib/claude.js`, pedido pelo usuário em 2026-10): só roda quando as regras não entendem o texto e existe `ANTHROPIC_API_KEY`. Ele **nunca grava**: propõe uma reescrita no formato de palavras-chave, todo número dela precisa existir na mensagem original, ela passa de novo pelo parser e o usuário confirma antes de gravar. Sem a chave, o app funciona só com regras. Não amplie o uso de LLM (nem para perguntas, cálculo ou sugestão de carga) sem o usuário pedir.
- **Segredos nunca no código nem no front-end.** `NOTION_TOKEN`, `APP_CODE` e `ANTHROPIC_API_KEY` só existem como variáveis de ambiente no servidor. Nunca commite `.env`.
- **Nunca invente dados de treino.** Séries, repetições e carga só são gravadas se o usuário informou, ou confirmou explicitamente usar o valor do personal (`usarRotina`). Se algo faltar, o servidor pergunta e **não grava nada**.
- O app **mostra o último treino**; não calcula nem sugere carga (decisão do usuário).

## Comandos

- `node server.js` — roda local em http://localhost:3000 (modo de teste sem `NOTION_TOKEN`).
- `node --test` — testes do interpretador. Rode sempre depois de mexer em `lib/parser.js`.

## Notion

Dois bancos (IDs em `lib/notion.js`): **Rotina** e **Treinos**. Se mudar colunas no Notion, atualize `lib/notion.js`, `docs/README.md` e `data/rotina.json`.
