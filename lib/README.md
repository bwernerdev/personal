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
| `claude.js` | Ajuda **opcional** do Claude (só se houver `ANTHROPIC_API_KEY`): reescreve a frase no formato do app e valida a reescrita (todo número tem de estar na mensagem). Nunca grava |
| `linguagem.js` | Linguagem do dia a dia, em funções puras: números por extenso, "5 séries de 10" → `5x10`, palavras de enfeite, separação de itens ("e depois", traço, ponto) |
| `normalizar.js` | Tira acentos/pontuação e quebra em palavras para comparar |
| `datas.js` | Datas no fuso de São Paulo: `hoje`, `ontem`, `seg`, `05/10` |
| `treino-do-dia.js` | Monta a tela "Treino do dia" e o histórico a partir da rotina e dos treinos; decide se um registro já existe (`jaRegistrado`) |
| `notion.js` | Chamadas à API do Notion (só servidor) |
| `store.js` | Escolhe a fonte de dados: Notion em produção, arquivos locais no modo de teste. Registrar, apagar e buscar por exercício |
| `http.js` | Envoltório das rotas: método, `x-codigo` (APP_CODE), limite de tentativas erradas, erros |

## Como adicionar algo

- **Frase nova que as regras deveriam entender:** acrescente em `frases-naturais.js` (com o resultado esperado) e rode `node --test`; `node lib/frases-naturais.js` mostra quantas as regras resolvem sozinhas. O teste de propriedade em `frases-naturais.test.js` gera milhares de frases e exige que **nenhum número gravado esteja ausente da frase**.
- **Novo atalho de treino:** `ALIAS` em `parser.js` (+ teste).
- **Novo apelido de exercício:** `SINONIMOS` em `parser.js` (chave = nome na rotina). Não crie apelido que comece com uma palavra que já identifica outro exercício sozinha (ex.: `puxada ...`), senão essa palavra passa a perguntar. Rode `node --test`.
- **Testes:** `parser.test.js`, `frases-naturais.test.js`, `datas.test.js`, `treino-do-dia.test.js`, `api.test.js` e `claude.test.js` (`node --test`; o Claude é sempre simulado, nenhum teste chama a API de verdade). O `api.test.js` chama as rotas de `api/` no modo local, com um arquivo temporário (variável `TREINOS_LOCAL`), e também cobre o limite de tentativas do código de `http.js`. O que fala com o Notion de verdade (`notion.js`) não tem teste automático: confira com `/api/saude` depois de publicar.
- **Nova coluna do Notion:** `notion.js` (ler e gravar), `parser.js` se vier do chat, e `docs/README.md`.
- **Nova regra de leitura:** `treino-do-dia.js`, com função pura.
