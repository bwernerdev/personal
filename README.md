# Personal

App de treino para o celular: você escreve o que fez por **palavras-chave** (`peito: inc 24 5x10`), ele registra no **Notion** e mostra, na hora de treinar, **o que você fez da última vez** em cada exercício.

É um site que vira app no iPhone (**Compartilhar → Adicionar à Tela de Início**). Não usa a API do Claude: o chat é um interpretador de regras, então não há custo de IA.

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
| `docs/` | Formato das palavras-chave, modelo de dados, publicação | [docs/README.md](docs/README.md) |

## Primeiros passos

1. **Testar no computador** (precisa do Node 22+): `node server.js` e abra http://localhost:3000. Sem token ele usa o modo de teste, com dados locais.
2. **Ligar ao Notion e publicar:** siga [docs/DEPLOY.md](docs/DEPLOY.md).
3. **Instalar no iPhone:** abra o endereço no Safari → Compartilhar → Adicionar à Tela de Início.

Testes do interpretador: `node --test`.
