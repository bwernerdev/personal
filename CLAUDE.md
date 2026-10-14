# Personal — instruções para o Claude Code

App de treino por chat (PWA) ligado ao Notion. Leia o [README.md](README.md) antes de mexer.

## Regras do projeto

- **Todo diretório tem um `README.md`** explicando o padrão daquela pasta (o que entra, nomes de arquivos, como adicionar um novo). Ao criar uma pasta nova ou mudar o padrão de uma existente, crie/atualize o `.md` dela na mesma alteração.
- **Não use `app.js`, `server.js` ou `index.js` como nome de arquivo que vai para a Vercel** (ela os confunde com servidor; ver `public/README.md`). O `server.js` da raiz só pode existir porque o `.vercelignore` o deixa de fora da publicação.
- Código e mensagens para o usuário em **português do Brasil**. Nomes de função e variável também em português, como no restante do projeto.
- **Sem dependências** (nem `npm install`): só Node 22 e APIs padrão. Se uma dependência for realmente necessária, registre o motivo em `docs/README.md`.
- **O chat é um interpretador de regras (`lib/parser.js`); uma IA é só um ajudante opcional** (`lib/ia.js`, pedido pelo usuário em 2026-10; Gemini grátis por padrão, Claude como alternativa): só roda quando as regras não entendem o texto e existe `GEMINI_API_KEY` ou `ANTHROPIC_API_KEY`. Ela **nunca grava**: propõe uma reescrita no formato de palavras-chave, todo número dela precisa existir na mensagem original, ela passa de novo pelo parser e o usuário confirma antes de gravar. Sem chave, o app funciona só com regras. O caminho principal para o chat melhorar é ensinar as regras com as frases guardadas em "Frases novas" (`scripts/README.md`), não usar mais IA. Extensões pedidas pelo usuário (2026-10): responder perguntas de consulta sobre os treinos (`perguntar`, só leitura) e, quando as regras não entendem nada, responder livremente (`perguntar`, depois das regras e da reescrita). Não amplie o uso de LLM (cálculo ou sugestão de carga, gravação) sem o usuário pedir.
- **Segredos nunca no código nem no front-end.** `NOTION_TOKEN`, `APP_CODE`, `GEMINI_API_KEY` e `ANTHROPIC_API_KEY` só existem como variáveis de ambiente no servidor. Nunca commite `.env`.
- **Nunca invente dados de treino.** Séries, repetições e carga só são gravadas se o usuário informou, ou confirmou explicitamente usar o valor do personal (`usarRotina`). Se algo faltar, o servidor pergunta e **não grava nada**.
- O app **mostra o último treino**; não calcula nem sugere carga (decisão do usuário).

## Comandos

- `node server.js` — roda local em http://localhost:3000 (modo de teste sem `NOTION_TOKEN`).
- `node --test` — testes do interpretador. Rode sempre depois de mexer em `lib/parser.js`.

## Notion

Dois bancos (IDs em `lib/notion.js`): **Rotina** e **Treinos**. Se mudar colunas no Notion, atualize `lib/notion.js`, `docs/README.md` e `data/rotina.json`.

## Mapa rápido (leia isto em vez de abrir todos os arquivos)

- `lib/parser.js` — interpretador de regras (`interpretar`, `lerParte`, `juntarSoltos`, `acharExercicio`; exporta `ATALHO`, `SINONIMOS`). Mexeu aqui: `node --test`.
- `lib/linguagem.js` — texto: números por extenso, `NxM`, `ENFEITES`, datas, `dividirItens`.
- `lib/ia.js` — ajudante opcional (Gemini/Claude): reescreve (com exemplos de `frases-naturais.js`), responde consultas/conversa livre (busca do Google, função `buscar_registros`, resumo de `estatisticas.js`, lembranças de `memoria.js`); valida números, nunca grava.
- `lib/notion.js` / `lib/store.js` — Notion (IDs dos bancos) / camada que escolhe Notion ou arquivo local (`data/*.local.json`).
- `lib/frases-naturais.js` — tabela de frases que as regras devem entender (+ `.test.js`).
- `lib/treino-do-dia.js`, `lib/datas.js`, `lib/http.js` — treino do dia, datas, limite de requisições.
- `api/chat.js` (fluxo principal), `api/dia.js`, `api/historico.js`, `api/apagar.js`, `api/saude.js` — endpoints.
- `public/main.js` (telas), `public/styles.css`, `public/index.html`, `public/sw.js` (mude `VERSAO` a cada edição em `public/`).
- `scripts/frases.js` — "inclua as frases novas": `listar | tabela | incluir`.
- Fluxo de entrega: branch → commit → push → `gh pr create --body-file` → (usuário diz "mescle") `gh pr merge N --merge --delete-branch`.
- Economia: use Grep/Read com `offset`/`limit` nos arquivos grandes; respostas curtas.
