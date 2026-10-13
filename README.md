# Personal

App de treino para o celular: você escreve o que fez por **palavras-chave** (`peito: inc 24 5x10`), ele registra no **Notion** e mostra, na hora de treinar, **o que você fez da última vez** em cada exercício.

É um site que vira app no iPhone (**Compartilhar → Adicionar à Tela de Início**). O chat é um interpretador de regras (grátis, funciona offline). **Opcionalmente**, com uma chave de IA no servidor (Gemini, que tem plano grátis, ou Claude), uma IA ajuda só quando as regras não entendem a frase — e nunca grava sozinha (ver abaixo).

## O que o app faz

- **Registra por chat:** `peito: inc 24 5x10, cross 15 4x12`. Aceita apelidos em português (`supino maquina`, `gemeos`), plural e um erro de digitação quando só há uma opção; se houver dúvida, pergunta e não grava nada.
- **Cargas diferentes por série:** `puxada 50x12 50x10 45x10`.
- **Ajuda de IA (opcional):** frases livres que as regras não entendem. A IA reescreve no formato do app, o app mostra "Entendi assim" e você confirma. Sem chave (`GEMINI_API_KEY` ou `ANTHROPIC_API_KEY`) essa parte fica desligada, e as regras já resolvem quase tudo sozinhas.
- **Mostra o último treino** de cada exercício na tela "Treino do dia" e no Histórico.
- **Desfazer / Excluir:** manda o registro para a lixeira do Notion.
- **Não grava duas vezes** o mesmo texto reenviado (pergunta antes).
- **Sem internet:** guarda o registro no aparelho e envia quando a conexão volta.

Formato completo das palavras-chave: [docs/README.md](docs/README.md).

## Como funciona

```
iPhone (PWA)  ──►  /api (funções na Vercel)  ──►  Notion
 public/            api/ + lib/                    bancos Rotina e Treinos
```

- **Rotina** (Notion): os 40 exercícios dos 6 treinos do personal, com ordem, séries e repetições alvo.
- **Treinos** (Notion): o que você de fato fez, uma linha por exercício (data, treino, carga, séries, reps, observações).
- O token do Notion fica **só no servidor**. O app pede um código de acesso (`APP_CODE`).

## Estrutura de pastas

| Pasta | O que tem | Guia |
|---|---|---|
| `public/` | O app que abre no celular (HTML, CSS, JS, ícones, service worker) | [public/README.md](public/README.md) |
| `api/` | As rotas da API (uma função por arquivo) | [api/README.md](api/README.md) |
| `lib/` | Regras do projeto: interpretador, Notion, treino do dia | [lib/README.md](lib/README.md) |
| `data/` | Cópia da rotina para testes locais | [data/README.md](data/README.md) |
| `scripts/` | Utilitários de linha de comando (ex.: ler as frases que as regras não entenderam) | [scripts/README.md](scripts/README.md) |
| `docs/` | Formato das palavras-chave, modelo de dados, publicação | [docs/README.md](docs/README.md) |

## Primeiros passos

1. **Testar no computador** (precisa do Node 22+): `node server.js` e abra http://localhost:3000. Sem token ele usa o modo de teste, com dados locais.
2. **Ligar ao Notion e publicar:** siga [docs/DEPLOY.md](docs/DEPLOY.md).
3. **Instalar no iPhone:** abra o endereço no Safari → Compartilhar → Adicionar à Tela de Início.

Testes (interpretador, datas, regras do treino do dia e rotas da API no modo local): `node --test`.

## Fluxo de trabalho

`main` é o que está em produção na Vercel: cada mudança entra por **Pull Request** (branch → PR → merge), e a Vercel gera um endereço de teste para cada PR antes de publicar.
