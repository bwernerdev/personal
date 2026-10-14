# api/

Funções serverless da Vercel: **um arquivo = uma rota** (`api/dia.js` → `/api/dia`). Cada arquivo faz `export default rota('MÉTODO', async (req) => ...)`, usando o envoltório de `lib/http.js`, que já cuida de método, código de acesso e erros.

## Padrão

- Rota fina: valida a entrada, chama `lib/` e devolve JSON. Regra de negócio fica em `lib/`.
- Toda rota exige o cabeçalho `x-codigo` igual a `APP_CODE` (sem `APP_CODE`, só funciona no modo de teste local).
- Respostas e erros em português; erro vem como `{ "erro": "..." }`.
- Depois de 10 códigos errados seguidos do mesmo endereço a API responde 429 por 15 minutos (contagem na memória de cada instância: barreira extra, não a proteção principal).

## Rotas

| Rota | Método | O que faz |
|---|---|---|
| `/api/chat` | POST `{ texto, usarRotina?, forcar?, hoje? }` | Interpreta e **grava só se tudo foi entendido**. Respostas: `ok` (cada registro volta com `id`), `precisa_resposta` (perguntas, nada gravado), `duplicado` (já existe igual; `forcar: true` grava mesmo assim), `sugestao` (a IA reescreveu a frase: traz `texto_sugerido`, `registros` de prévia, `pronto`, `pendentes` e `hoje`; **nada é gravado**, quem confirma reenvia `texto_sugerido` como mensagem normal), `erro_parcial`. Em `precisa_resposta` pode vir `ajuda` (mensagem da IA pedindo o que faltou). `hoje` (AAAA-MM-DD) é a data de quando foi digitado, usada nos registros guardados sem internet (aceita até 30 dias atrás) |
| `/api/apagar` | POST `{ id }` | Manda um registro do banco Treinos para a lixeira (no Notion dá para restaurar). Recusa páginas de outros bancos |
| `/api/dia` | GET `?treino=` | Rotina do treino escolhido (ou o próximo do ciclo) com o último registro de cada exercício; também traz `catalogo`, `grupos` e `grupoDoExercicio` (filtro por tipo do Histórico) |
| `/api/historico` | GET `?exercicio=` | Registros passados de um exercício, do mais recente para o mais antigo (cada um com `id`) |
| `/api/dieta` | GET | Plano alimentar (refeições com horário, opções "ou", substituições e nota). Só leitura; o plano é gravado por `scripts/dieta.js` |
| `/api/saude` | GET | Confere se o servidor lê os bancos do Notion (Rotina, Treinos e Frases novas) e mostra se a IA está ligada e qual (use depois de publicar) |

## Como adicionar uma rota

1. Crie `api/nome.js` com `export default rota(...)`.
2. Documente na tabela acima.
3. O servidor local (`server.js`) já encontra o arquivo pelo nome.
