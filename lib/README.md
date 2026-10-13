# lib/

Regras do projeto. É aqui que mora a lógica; `api/` e `public/` só chamam e mostram.

## Padrão

- Módulos ES (`import`/`export`), um assunto por arquivo, nomes em português e minúsculos com hífen.
- Funções puras sempre que der (sem rede, sem disco): ficam fáceis de testar. Rede e disco ficam só em `notion.js` e `store.js`.
- Teste ao lado do arquivo: `parser.js` → `parser.test.js` (rodar com `node --test`).

## Arquivos

| Arquivo | Papel |
|---|---|
| `parser.js` | Interpreta o texto do chat (`peito: inc 24 5x10`) e devolve registros, perguntas ou erros |
| `normalizar.js` | Tira acentos/pontuação e quebra em palavras para comparar |
| `datas.js` | Datas no fuso de São Paulo: `hoje`, `ontem`, `seg`, `05/10` |
| `treino-do-dia.js` | Monta a tela "Treino do dia" e o histórico a partir da rotina e dos treinos; decide se um registro já existe (`jaRegistrado`) |
| `notion.js` | Chamadas à API do Notion (só servidor) |
| `store.js` | Escolhe a fonte de dados: Notion em produção, arquivos locais no modo de teste. Registrar, apagar e buscar por exercício |
| `http.js` | Envoltório das rotas: método, `x-codigo` (APP_CODE), limite de tentativas erradas, erros |

## Como adicionar algo

- **Novo atalho de treino:** `ALIAS` em `parser.js` (+ teste).
- **Novo apelido de exercício:** `SINONIMOS` em `parser.js` (chave = nome na rotina). Não crie apelido que comece com uma palavra que já identifica outro exercício sozinha (ex.: `puxada ...`), senão essa palavra passa a perguntar. Rode `node --test`.
- **Testes:** `parser.test.js`, `datas.test.js`, `treino-do-dia.test.js` (`node --test`). `notion.js`, `store.js` e `http.js` fazem rede/disco e não têm teste automático: confira com `/api/saude` e o modo de teste local.
- **Nova coluna do Notion:** `notion.js` (ler e gravar), `parser.js` se vier do chat, e `docs/README.md`.
- **Nova regra de leitura:** `treino-do-dia.js`, com função pura.
