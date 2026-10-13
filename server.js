// Servidor local para testar o app no computador:  node server.js
// Sem NOTION_TOKEN ele roda em "modo de teste" (rotina de data/rotina.json, treinos em data/treinos.local.json).
// Na Vercel este arquivo não é usado: public/ vira o site e api/ vira as funções.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = fileURLToPath(new URL('.', import.meta.url));
const PUBLICO = join(RAIZ, 'public');
const PORTA = Number(process.env.PORT) || 3000;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

async function lerCorpo(req) {
  const partes = [];
  for await (const p of req) partes.push(p);
  const bruto = Buffer.concat(partes).toString('utf8');
  try {
    return bruto ? JSON.parse(bruto) : {};
  } catch {
    return {};
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    const nome = url.pathname.slice(5).replace(/[^a-z-]/g, '');
    try {
      const { default: handler } = await import(pathToFileURL(join(RAIZ, 'api', `${nome}.js`)).href);
      req.query = Object.fromEntries(url.searchParams);
      req.body = req.method === 'POST' ? await lerCorpo(req) : undefined;
      res.status = (c) => {
        res.statusCode = c;
        return res;
      };
      res.json = (obj) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(obj));
      };
      return await handler(req, res);
    } catch (e) {
      res.statusCode = e.code === 'ERR_MODULE_NOT_FOUND' ? 404 : 500;
      return res.end(JSON.stringify({ erro: e.message }));
    }
  }

  const caminho = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
  try {
    const arquivo = await readFile(join(PUBLICO, caminho));
    res.setHeader('Content-Type', TIPOS[extname(caminho)] || 'application/octet-stream');
    res.end(arquivo);
  } catch {
    res.statusCode = 404;
    res.end('Não encontrado');
  }
}).listen(PORTA, () => console.log(`Personal rodando em http://localhost:${PORTA}`));
