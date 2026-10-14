# scripts/

Utilitários de linha de comando. Não vão para a Vercel (não estão em `api/` nem em `public/`) e não têm dependências: só Node 22.

## Padrão

- Um arquivo por utilitário, em ES module, com o uso no comentário do topo.
- Reaproveitam `lib/` (por exemplo `lib/store.js`) em vez de repetir regra de negócio.
- Leem `NOTION_TOKEN` da variável de ambiente ou do arquivo `.env` da raiz (nunca commitado). Sem token, usam os arquivos do modo de teste em `data/`.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `frases.js` | Ver e dar baixa nas frases do chat que as regras não resolveram |
| `dieta.js` | Gravar (`importar plano.json`) e ver (`mostrar`) o plano alimentar. O JSON é dado pessoal: guarde **fora** do repositório (formato em `lib/dieta.js`) |

## `frases.js`: ensinando as regras com as frases que falharam

O servidor guarda, no banco **Frases novas** do Notion, toda frase que as regras não entendem (e as que pedem confirmação por palavra desconhecida), com quantas vezes apareceu e o que a IA sugeriu. Frase que as regras resolvem **não** é guardada.

```bash
node scripts/frases.js listar              # pendentes, as mais repetidas primeiro
node scripts/frases.js listar --todas      # inclui as já incluídas nas regras
node scripts/frases.js listar --json       # para outros programas
node scripts/frases.js tabela              # linhas prontas para lib/frases-naturais.js
node scripts/frases.js incluir <id> [obs]  # dá baixa: a regra já foi criada
```

### Fluxo

1. O app guarda as frases sozinho (nada a fazer; precisa do banco conectado à integração, ver `docs/DEPLOY.md`).
2. De tempos em tempos, peça ao Claude Code: **"inclua as frases novas"**. Ele lê o banco (pelo Notion ou por `listar`), cria a regra em `lib/linguagem.js` / `lib/parser.js`, acrescenta a frase em `lib/frases-naturais.js` com o resultado esperado (`tabela` gera as linhas) e roda `node --test`.
3. Depois da regra, a frase recebe baixa (`incluir`, ou o checkbox **Incluída nas regras** no Notion). Se ela **reaparecer** (as regras ainda não resolvem), o servidor desmarca o checkbox e soma em **Vezes**, então ela volta para a lista de pendentes.

### No modo de teste (sem Notion)

Sem `NOTION_TOKEN`, o servidor local (`node server.js`) guarda em `data/frases.local.json` (ignorado pelo git) e o script lê dali.
