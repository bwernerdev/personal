# .github/

Configuração do GitHub deste repositório.

- `workflows/test.yml` — roda `node --test` em todo pull request e em todo push na `main` (Node 22, sem instalar dependências). Se falhar, o PR mostra o erro antes de mesclar. Para **bloquear** a mesclagem quando falhar, marque o check `testes` como obrigatório em Settings → Branches (regra da `main`).
- Novo workflow: um arquivo `.yml` em `workflows/`, com nome que diga o que faz.
