# Publicar: Notion → Vercel → iPhone

O app precisa de um endereço `https://` para o iPhone instalar e para guardar o token do Notion fora do celular. Usamos a **Vercel** (o plano gratuito, Hobby, costuma bastar para uso pessoal; confira os termos atuais no site deles).

## 1. Integração do Notion

1. Abra https://www.notion.so/profile/integrations → **Nova integração** (tipo interno), no seu espaço de trabalho.
2. Copie o **token secreto**. Ele é uma senha: não coloque em arquivo do projeto nem no git.
3. No Notion, abra o banco **Treinos** → menu `•••` → **Conexões** → adicione a integração. Repita no banco **Rotina**.
   (Sem isso a API responde 404 para os dois bancos.)

## 2. Publicar na Vercel

Precisa do Node 22+ instalado (https://nodejs.org). No PowerShell, dentro desta pasta:

```
npx vercel
```

Faça login, aceite os padrões (projeto novo, nome `personal`). Depois cadastre as variáveis (o comando pergunta o valor; marque Production):

```
npx vercel env add NOTION_TOKEN
npx vercel env add APP_CODE
```

- `NOTION_TOKEN`: o token do passo 1.
- `APP_CODE`: um código **longo** que você inventa. É o que o app pede ao abrir; sem ele ninguém lê nem grava seus treinos, já que o endereço é público.

Publique em produção:

```
npx vercel --prod
```

## 3. Conferir a ligação com o Notion

O endereço de produção aparece no final do comando. Teste (troque pelo seu endereço e pelo seu código):

```
curl -H "x-codigo: SEU_CODIGO" https://SEU-APP.vercel.app/api/saude
```

Esperado: `{"modo":"notion","rotina":"40 exercícios","treinos":"0 registros"}`. Se vier `erro: Notion 404`, falta o passo 1.3 (conectar a integração aos bancos). Se vier `erro: Notion 401`, o token está errado.

## 4. Instalar no iPhone

1. Abra o endereço no **Safari** e digite o `APP_CODE` quando pedir.
2. **Compartilhar** → **Adicionar à Tela de Início**.
3. Abra pelo ícone. Fica em tela cheia, como um app.

## Atualizar depois

Mexeu no código? `npx vercel --prod` de novo. Se mudou algo em `public/`, troque `VERSAO` em `public/sw.js` para o celular pegar a versão nova.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Defina APP_CODE no servidor" | Variável `APP_CODE` não cadastrada em Production (cadastre e rode `npx vercel --prod`) |
| O app pede o código toda hora | Código digitado diferente do cadastrado |
| `erro: Notion 404` | Integração não conectada ao banco (passo 1.3) |
| `erro: Notion 400` ao gravar | Nome de coluna ou opção do Notion diferente do esperado: confira `docs/README.md` |
