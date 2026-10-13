# docs/

Documentação do projeto. Um assunto por arquivo; este explica o **formato das palavras-chave** e o **modelo de dados**.

| Arquivo | Assunto |
|---|---|
| `README.md` (este) | Palavras-chave do chat e modelo de dados |
| [`DEPLOY.md`](DEPLOY.md) | Ligar ao Notion, publicar na Vercel e instalar no iPhone |

## Palavras-chave do chat

Formato: `[data] [treino]: exercício carga séries×reps, exercício ...`

```
peito: inc 24 5x10, cross 15 4x12, chest 40 4x10
ontem perna1: ext 50 4x12, agacha 60 5x8
seg costas: puxada 50 4x12
braço: prancha 4x60s, abd 4x10
costas: puxada 50x12 50x10 45x10
```

| Parte | Como escrever |
|---|---|
| **Treino** (antes dos `:`) | `peito`, `perna1`, `costas`, `ombro`, `perna2`, `braço` (pode vir como `treino de peito`). Também vale o nome completo (`Peito/Tríceps`). `perna` sozinho pergunta qual |
| **Data** (antes dos `:`) | `hoje` (padrão), `ontem`, `anteontem`, `seg`…`sab`, `dom`, `05/10`, `05/10/2026`. Dia da semana = o mais recente (hoje, se for hoje) |
| **Exercício** | Começo de cada palavra, em qualquer ordem: `inc` = Supino **inc**linado halter, `cross`, `ext`, `agacha`, `leg`, `rosca w`. Também vale um apelido em português: `supino maquina`, `cruzamento`, `extensao de pernas`, `press de pernas`, `gemeos`, `lateral`, `frances`… (lista em `SINONIMOS`, `lib/parser.js`). Aceita plural e um erro de digitação (`agachamneto`, `extenssora`) quando só há uma opção. Sem números no nome |
| **Carga** | `24`, `24kg`, `24 quilos`, `22,5` |
| **Séries × reps** | `5x10`, `5 x 10`, `5 séries de 10 repetições`. Em tempo: `4x60s` (os segundos vão para Observações) |
| **Cargas diferentes** | Dois ou mais pares *carga x reps*, um por série: `puxada 50x12 50x10 45x10`. Séries seguidas iguais se juntam (`50x12 50x12` = 2 séries de 12 com 50). Não misture com carga solta nem com tempo (o app pergunta) |
| **Vários exercícios** | Separe por vírgula, `;` ou linha nova. Linhas sem `:` herdam o treino e a data da linha de cima |

### Regras de segurança (não mudar sem combinar)

1. **Só grava quando tudo foi entendido.** Se um item gerar pergunta, nada é gravado.
2. **Nunca preenche por conta própria.** Faltou séries×reps? Pergunta "foi o do personal?" e só usa o valor da rotina se você confirmar. Se o personal pediu faixa (`10-12`), pede as reps feitas.
3. **Sem carga = pergunta**, exceto exercícios de Core (abdominal, prancha).
4. **Atalho ambíguo = pergunta** com botões (`rosca` → martelo, barra W, concentrada). Exercício que existe em dois treinos (`mesa`, `agacha`, `abd`) pede o treino.
5. O exercício precisa existir **no treino informado**; senão vira erro (não cria exercício fora da rotina).

### Registro repetido, desfazer e sem internet

- **Cargas diferentes viram uma linha por grupo** no banco Treinos, todas com a mesma data e a marca `bloco 1/3`, `bloco 2/3`… em Observações (é por ela que o app mostra as linhas do dia na ordem certa). Apague/edite no Notion com cuidado: sem o "bloco" a ordem se perde.
- **Registro idêntico a um que já existe não é gravado de novo** (mesmo exercício, treino, data, carga, séries, reps e observações). O app avisa e oferece "Registrar mesmo assim". Números diferentes no mesmo dia continuam valendo.
- **Desfazer** (no cartão logo após registrar) e **Excluir** (no Histórico) mandam o registro para a **lixeira do Notion**: dá para restaurar lá. Só funcionam em registros do banco Treinos.
- **Sem internet** o texto fica guardado no aparelho (com a data do dia em que foi digitado) e é enviado quando a conexão volta. A regra de segurança continua: se faltar informação, o app pergunta nessa hora e nada é gravado antes.

### O que ainda não é suportado

- Exercício fora da rotina do personal.
- Editar um registro (por enquanto: excluir e registrar de novo).

## Modelo de dados (Notion)

**Rotina** — o que o personal pediu (fonte oficial; 40 linhas)

| Coluna | Tipo |
|---|---|
| Exercício | título |
| Treino | seleção: Peito/Tríceps, Perna 1, Costas/Bíceps, Ombro/Trapézio, Perna 2, Bíceps/Tríceps |
| Ordem | número (ordem de execução no treino) |
| Grupo muscular | seleção: Peito, Costas, Pernas, Ombros, Braços, Core, Cardio |
| Séries | número |
| Repetições | texto (`12`, `10-12`, `60 s`) |

**Treinos** — o que você fez (uma linha por exercício)

| Coluna | Tipo |
|---|---|
| Exercício | título |
| Treino | seleção (mesmas opções da Rotina) |
| Grupo muscular | seleção |
| Data | data |
| Séries | número |
| Repetições | número |
| Carga (kg) | número |
| Observações | texto |

## Tela "Treino do dia"

- O treino marcado com ★ é o **próximo do ciclo**, depois do último treino registrado.
- Cada exercício mostra o que o personal pediu e **o último treino daquele exercício no mesmo treino** (se nunca fez nesse treino, mostra o de outro treino, avisando). Com cargas diferentes, aparecem todas: `50 kg · 2×12 + 45 kg · 1×10`.
- O app lê os 300 registros mais recentes do Notion; exercício que não aparece neles é buscado direto, então registros antigos não somem.

## Ajuda do Claude no chat (opcional)

O chat é um interpretador de regras. **Se, e só se**, o servidor tiver `ANTHROPIC_API_KEY`, o Claude entra como ajudante quando as regras **não entendem** o texto (exercício não achado, treino desconhecido, números confusos). Exemplos que ele resolve:

```
hoje fiz supino inclinado com 24 quilos, cinco séries de dez, e o crossover com 15, quatro de doze
segunda foi costas, puxada alta 4x12
```

### Como funciona (e por que não inventa dado)

1. As regras tentam primeiro. Se entendem, o Claude **nem é chamado** (sem custo). Perguntas de carga/séries faltando e dúvida entre exercícios continuam sendo das regras.
2. Se não entendem, o Claude recebe a frase, a lista de exercícios da rotina e a data de hoje, e devolve **só uma reescrita** no formato de palavras-chave (saída estruturada em JSON).
3. O servidor valida a reescrita: **todo número dela precisa existir na mensagem original** (em dígitos ou por extenso, "vinte e quatro"); senão é descartada. Depois ela passa de novo pelo interpretador de regras (exercício da rotina, treino, data).
4. O app mostra **"Entendi assim (ajuda da IA)"** com os registros e a data. **Nada foi gravado.** Você toca em **Registrar assim** (reenvia a reescrita pelo caminho normal de regras, que grava) ou em **Editar**.
5. Se faltar informação (ex.: a carga), o app pergunta, como sempre. A IA **nunca** completa dado.

Qualquer falha (sem internet, erro da API, limite de uso, resposta recusada) volta ao comportamento só com regras.

### Configuração, custo e privacidade

- Variáveis no servidor (nunca no front-end nem no git): `ANTHROPIC_API_KEY` (liga a ajuda), `ANTHROPIC_MODEL` (padrão `claude-haiku-5-5`, o mais barato; `claude-sonnet-5-5` e `claude-opus-5-5` entendem frases mais difíceis, mas custam bem mais), `LLM_LIMITE_POR_HORA` (padrão 30 por instância da Vercel). Passo a passo em [DEPLOY.md](DEPLOY.md).
- **Custo:** uma ajuda envia ~1,5 mil tokens (a lista de exercícios mais a frase) e recebe poucas centenas. Com o padrão (Haiku 5.5, US$ 0,10 / US$ 0,50 por milhão de tokens) fica em torno de **US$ 0,0004 por uso** (4 centésimos de centavo: mil usos custam uns 40 centavos de dólar); com o Opus 5.5 (US$ 4 / US$ 20) seria cerca de 25 vezes isso. Só frases que as regras não entendem geram custo. Um modelo menor pode errar mais em frases difíceis, mas isso não aumenta o risco de dado inventado: a conferência de números e a sua confirmação valem para qualquer modelo.
- **Privacidade:** nesses casos o texto da frase (máx. 600 caracteres), a lista de exercícios e a data vão para a Anthropic. Nada do Notion além disso é enviado.
- Chamada HTTP direta (`fetch`), sem SDK: a regra do projeto é não ter dependências. O Haiku 5.5 não tem "fallback" de recusa no servidor, então o parâmetro só é enviado com Opus/Sonnet; se a API devolver 400 para algum parâmetro, o código tenta de novo sem ele (e por último sem o formato JSON estruturado).
- O código está em `lib/claude.js`; os testes simulam o Claude, nenhum chama a API de verdade.
