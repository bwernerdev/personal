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

### Linguagem do dia a dia (sem IA)

As regras entendem frases soltas, não só o formato com dois-pontos. Tudo isto funciona sozinho, de graça e offline:

```
hoje fiz supino inclinado com 24 quilos, 5 séries de 10, e depois o crossover com 15, quatro de doze
ontem à noite fiz braço: rosca martelo 12 3x12
fiz cinco séries de dez no supino inclinado com vinte e quatro
segunda feira costas puxada alta 50 4x12
dia 10 peito: inc 24 5x10
supino inclinado, 24 quilos, 5x10
supino inclinado - 24 - 5x10
supino inclinado: 24 5x10
```

| O que entende | Exemplos |
|---|---|
| **Palavras de enfeite** (ignoradas) | `fiz`, `treinei`, `foi`, `com`, `carga`, `o`, `e depois`, `à noite`, `registrar`… |
| **Números por extenso** | `cinco`, `vinte e quatro`, `vinte e dois e meio` (= 22,5), `perna dois` |
| **Séries x reps ditas de outro jeito** | `5 séries de 10`, `10 repetições em 5 séries`, `4 vezes de 12`, `4 por 12`, `quatro de doze` |
| **Várias coisas na mesma frase** | separadas por vírgula, `;`, " e ", " depois ", " - " ou ponto |
| **Número solto** | `supino inclinado, 24 quilos, 5x10` junta os números ao exercício (só se ele ainda não os tem) |
| **Data e treino no meio da frase** | `hoje`, `ontem`, `segunda feira`, `dia 10`, `peito supino 24 5x10`, `hoje foi peito, ...` |
| **Exercício antes dos dois-pontos** | `supino inclinado: 24 5x10` |
| **Palavras fora de ordem** | `24 quilos supino inclinado 5x10`, `5x10 com 24 no supino inclinado`, `inclinado supino halter`, `supino inclinado 24 5x10 peito` (treino no fim ou no meio), `24 quilos, supino inclinado, 5x10` (números antes do nome), `24kg 5x10: supino inclinado` |
| **Detalhes do equipamento** | `supino com halteres no banco a 30 graus`, `45°`: o ângulo e a palavra "banco" não viram carga nem repetição (ensinado pelas "Frases novas") |
| **Só um dos dois** | `3 séries` ou `10 repetições`: pergunta o que falta |
| **Palavra que não existe na rotina** | `supino inclinado com halteres leves 24 5x10`: entende o exercício, **pergunta "é esse?"** (não chuta) |

Para a IA sobram só frases que não dizem qual exercício foi (`fiz o mesmo treino de ontem`, `treinei bastante`) e números que não fecham (`5x10-12`, duas cargas). Medido com a tabela de frases (`lib/frases-naturais.js`): **antes, 32 de 45 frases do dia a dia iam para a IA (71%); agora, 0 de 52**.

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

## Tela "Histórico"

- **Filtro por tipo:** fileira de botões com **Todos** e os grupos musculares da Rotina (Peito, Costas, Pernas, Ombros, Braços, Core…, na coluna *Grupo muscular*; grupo novo no Notion aparece sozinho no fim). Escolhendo um tipo, o seletor mostra só os exercícios dele e a tela lista esses exercícios para tocar. O último tipo escolhido fica lembrado no aparelho.
- Tocar em **Ver histórico** num cartão do "Treino do dia" abre o exercício; se o tipo escolhido escondia esse exercício, o filtro volta para **Todos**.
- Os dados vêm de `/api/dia` (`grupos` e `grupoDoExercicio`, montados por `gruposDaRotina` em `lib/treino-do-dia.js`).

## Ajuda de uma IA no chat (opcional, Gemini grátis)

O chat é um interpretador de regras. **Se, e só se**, o servidor tiver uma chave de IA, ela entra como ajudante quando as regras **não entendem** o texto (exercício não achado, números que não fecham). Exemplo: `fiz o primeiro exercício da rotina, 24 quilos, 5 séries de 10` (sem dizer qual exercício).

| Provedor | Variável | Custo | Observação |
|---|---|---|---|
| **Google Gemini** (padrão) | `GEMINI_API_KEY` | **Grátis**, sem cartão (limite de uso por dia) | Chave em https://aistudio.google.com/apikey . Modelos `gemini-3.5-flash-lite` (rápido), depois `gemini-3.8-flash` e `gemini-flash-latest`: se um não existe (404), esgotou a cota (429), está sobrecarregado (503) ou demora mais de 10 s, tenta o próximo; `GEMINI_MODEL` fixa um só. |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | Pago (frações de centavo por uso) | Modelo `claude-haiku-5-5`, o mais barato; `ANTHROPIC_MODEL` troca. |

Com as duas chaves cadastradas vale o Gemini; `LLM_PROVIDER=anthropic` força o outro. Sem nenhuma chave, a ajuda fica desligada e o app usa só as regras.

### Como funciona (e por que não inventa dado)

1. As regras tentam primeiro. Se entendem, a IA **nem é chamada** (sem uso da cota). Perguntas de carga/séries faltando e dúvida entre exercícios continuam sendo das regras.
2. Se não entendem (hoje isso é raro: ver "Linguagem do dia a dia"), a IA recebe a frase, a lista de exercícios da rotina e a data de hoje, e devolve **só uma reescrita** no formato de palavras-chave (JSON).
3. O servidor valida a reescrita: **todo número dela precisa existir na mensagem original** (em dígitos ou por extenso, "vinte e quatro"); senão é descartada. Depois ela passa de novo pelo interpretador de regras (exercício da rotina, treino, data). Isso vale **igual para qualquer provedor**.
4. O app mostra **"Entendi assim (ajuda da IA)"** com os registros e a data. **Nada foi gravado.** Você toca em **Registrar assim** (reenvia a reescrita pelo caminho normal de regras, que grava) ou em **Editar**.
5. Se faltar informação (ex.: a carga), o app pergunta, como sempre. A IA **nunca** completa dado.

Qualquer falha (sem internet, erro da API, limite de uso, sobrecarga, tempo esgotado, resposta bloqueada ou recusada) volta ao comportamento só com regras. O tempo total é de 26 s (a função na Vercel tem 30 s). Nos logs da Vercel a falha aparece como `IA (Gemini): HTTP 503 ...` ou `IA (Gemini): tempo esgotado`.

### Configuração, limites e privacidade

- Variáveis no servidor (nunca no front-end nem no git): a chave do provedor, `GEMINI_MODEL`/`ANTHROPIC_MODEL` (opcional) e `LLM_LIMITE_POR_HORA` (padrão 30 por instância da Vercel, para não estourar a cota grátis). Passo a passo em [DEPLOY.md](DEPLOY.md).
- **Limites do plano gratuito do Gemini:** o Google define e muda os limites (pedidos por minuto e por dia). O app só chama a IA em frase que as regras não entendem, algumas vezes por semana, então a cota grátis sobra. Se a cota acabar, o app apenas volta às regras. Confira os limites atuais no AI Studio.
- **Privacidade:** nesses casos o texto da frase (máx. 600 caracteres), a lista de exercícios e a data vão para o provedor (Google ou Anthropic). **Planos gratuitos de alguns provedores podem usar o conteúdo enviado para melhorar os produtos deles**: leia os termos do Gemini antes de ativar. Nada do Notion além disso é enviado.
- A chave vai no **cabeçalho** da requisição (`x-goog-api-key` / `x-api-key`), nunca na URL.
- Chamada HTTP direta (`fetch`), sem SDK: a regra do projeto é não ter dependências. Se a API devolver 400 para algum parâmetro, o código tenta de novo sem ele (no Gemini: sem o "pensamento baixo", sem o esquema e, por fim, sem o modo JSON; no Claude: sem `fallbacks` e sem o formato estruturado).
- O código está em `lib/ia.js`; os testes simulam a API, nenhum chama a API de verdade.

## Frases novas: o app aprende com o que não entendeu

Toda frase que as regras **não resolvem** (erro, números confusos) e toda que pede confirmação por **palavra desconhecida** é guardada no banco **Frases novas** do Notion: a frase, o resultado (`IA sugeriu`, `IA não entendeu`, `Sem ajuda da IA` ou `Pediu confirmação`), o motivo, a sugestão da IA, **quantas vezes** apareceu e a última data. Frase que as regras resolvem, perguntam carga ou têm dúvida entre exercícios **não** é guardada.

- Guardar nunca atrapalha o chat: erro ou demora de mais (4 s) só vão para o log da Vercel.
- Só o texto da frase é guardado (máx. 300 caracteres), no **seu** Notion; nada vai para outro lugar.
- Para ensinar as regras: peça **"inclua as frases novas"**; o fluxo e o script (`node scripts/frases.js listar`) estão em [`scripts/README.md`](../scripts/README.md).
- Frase que reaparece depois de "incluída" volta sozinha para a lista de pendentes.

## Treinos ativos e em standby

Desde 2026-10 o app usa **Full body 1, 2 e 3**. Os seis treinos antigos (Peito/Tríceps … Bíceps/Tríceps) estão em *standby*: seguem no Notion (Rotina e Treinos) e no histórico, mas somem dos botões do "Treino do dia", do chat e da sugestão. A lista fica em `lib/parser.js` (`TREINOS_EM_STANDBY`); para reativar um treino, tire-o de lá. Os exercícios do Full body entraram na Rotina **sem séries e repetições** (o personal não passou); preencha no Notion quando houver. Sem rotina com Full body (arquivo de teste `data/rotina.json`), nada é escondido.

## Perguntas sobre os treinos (IA, só leitura)

Com `GEMINI_API_KEY` (ou `ANTHROPIC_API_KEY`), mensagens que parecem pergunta ("liste meu último full body 1", "qual foi minha carga na puxada alta?") não passam pelo registro: o servidor lê os registros que combinam com a pergunta (todo o histórico do treino ou exercício citado, inclusive treinos em standby, mais os 30 mais recentes; sem treino/exercício citado, os 300 mais recentes) e a rotina inteira, e a IA só redige a resposta (`perguntar` em `lib/ia.js`). A IA não recebe o token do Notion, não grava nada e só usa os dados enviados. Mensagem com "5x10" é sempre tratada como registro. Sem chave, ou se a IA falhar, a mensagem segue para as regras normais.

**IA livre (pedido do usuário, 2026-10-14):** só depois que as regras não entenderam nem como consulta nem como registro, e a reescrita da IA também falhou (nada registrado), a mensagem vai para `perguntar` e a IA responde livremente (dúvidas de treino, conversa em geral), com os dados do Notion à mão para perguntas sobre os treinos dele. Ordem fixa: regras de consulta → regras de registro → reescrita pela IA → resposta livre. A IA continua sem gravar nada. **Memória da conversa:** o app guarda na tela as últimas 10 mensagens (suas e as respostas) e manda junto em `historico`; o servidor as entrega à IA como dado (`blocoDaConversa`). Some ao fechar o app e não é gravada em lugar nenhum.

### Consultas respondidas só por regras (`lib/consultas.js`)

Antes de chamar a IA, o chat tenta responder na hora, sem chave: "liste meu último full body 1", "qual foi minha última puxada alta?", "maior carga no voador", "quando fiz extensora?", "o que fiz ontem?", "histórico do supino inclinado". O que não for reconhecido vai para a IA (se houver chave).

### Frases com Full body

O interpretador junta "full body 2", "full 2", "fullbody2", "fb2", "full body dois" em `full2` (também vale `f2`); o treino pode vir no começo, no meio ("... no full 2") ou depois de "fiz o full body 3 hoje,". Vários exercícios sem vírgula também funcionam: "puxada 45 4x10 extensora 40 3x15" (cada "NxM" fecha o item). Testes: `lib/full-body.test.js`.

### Mais jeitos aceitos (rodada de lapidação)

Registro: `/` separa exercícios ("supino 24 4x10 / puxada 50 4x12"); "dia 12/10 full 2 ..."; observação entre parênteses vira a coluna Observações ("supino 24 5x10 (dor no ombro)"); rotina sem séries/reps pergunta "Quantas séries e repetições?". Consultas: "qual o próximo treino?", "quais exercícios tem no full body 2?", "quanto tempo desde o último treino?", "qual foi meu último treino?", "liste as últimas 3 vezes da puxada", e nome parcial de exercício quando só um combina ("puxada").

Mais: uma carga e as reps de cada série ("remada baixa 40kg 12 12 10" = 40x12, 40x12, 40x10; precisa de 3+ séries para não confundir com "24 5 10"); exercício que existe em mais de um treino usa o treino que você já registrou hoje (se não houver, pergunta); "ombro" dentro do nome ("desenvolvimento de ombro máquina") não é tratado como treino.
