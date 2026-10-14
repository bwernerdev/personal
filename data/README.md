# data/

Dados usados **só no modo de teste local** (`node server.js` sem `NOTION_TOKEN`). Em produção tudo vem do Notion.

| Arquivo | O que é |
|---|---|
| `rotina.json` | Cópia da rotina do personal (40 exercícios, 6 treinos). Mesmo formato do banco **Rotina** no Notion |
| `frases.local.json` | Criado sozinho no modo de teste quando uma frase do chat não é entendida (o mesmo que o banco "Frases novas" faz no Notion). Está no `.gitignore`; `FRASES_LOCAL` troca o arquivo |
| `dieta.local.json` | Plano alimentar do modo de teste (`scripts/dieta.js importar`). Dado pessoal: está no `.gitignore`; `DIETA_LOCAL` troca o arquivo. Em produção o plano fica no Notion |
| `receitas.local.json` | Receitas do modo de teste (`scripts/dieta.js importar-receitas`). Está no `.gitignore`; `RECEITAS_LOCAL` troca o arquivo. Em produção ficam no Notion |
| `treinos.local.json` | Criado sozinho quando você registra treinos no modo de teste. Está no `.gitignore`; pode apagar à vontade. A variável `TREINOS_LOCAL` (caminho de um arquivo) troca o local; os testes automáticos usam isso para não mexer neste |

## Formato de cada exercício em `rotina.json`

```json
{ "exercicio": "Supino inclinado halter", "treino": "Peito/Tríceps", "ordem": 2,
  "grupo": "Peito", "series": 5, "reps": "10-12" }
```

`reps` é texto porque o personal usa faixas (`10-12`, `6-12`) e tempo (`60 s`).

Se o personal mudar a rotina: atualize o banco **Rotina** no Notion (é a fonte oficial) e, se quiser manter os testes iguais, este arquivo também.
