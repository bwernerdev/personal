// Envoltório comum das rotas da API: método, código de acesso e erros.

import { createHash, timingSafeEqual } from 'node:crypto';
import { modoTeste } from './store.js';

const hash = (s) => createHash('sha256').update(String(s)).digest();

// Limite de tentativas erradas do código, por endereço. Fica na memória da função: na Vercel
// cada instância tem a sua contagem, então é uma barreira extra, não a proteção principal
// (essa é o APP_CODE ser longo).
const MAX_ERROS = 10;
const JANELA_MS = 15 * 60 * 1000;
const erros = new Map(); // ip -> { n, ate }

const quem = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();

function bloqueado(ip, agora = Date.now()) {
  const e = erros.get(ip);
  if (!e) return false;
  if (agora > e.ate) {
    erros.delete(ip);
    return false;
  }
  return e.n >= MAX_ERROS;
}

function errou(ip, agora = Date.now()) {
  if (erros.size > 1000) erros.clear();
  const e = erros.get(ip);
  if (!e || agora > e.ate) erros.set(ip, { n: 1, ate: agora + JANELA_MS });
  else e.n += 1;
}

function acesso(req) {
  const esperado = process.env.APP_CODE;
  if (!esperado) {
    // Sem código só é aceitável no modo de teste local.
    return modoTeste() ? { ok: true } : { ok: false, status: 503, erro: 'Defina APP_CODE no servidor.' };
  }
  const ip = quem(req);
  if (bloqueado(ip)) return { ok: false, status: 429, erro: 'Muitas tentativas erradas. Tente de novo em alguns minutos.' };
  const dado = req.headers['x-codigo'] || '';
  if (timingSafeEqual(hash(dado), hash(esperado))) {
    erros.delete(ip);
    return { ok: true };
  }
  errou(ip);
  return { ok: false, status: 401, erro: 'Código de acesso inválido.' };
}

export function rota(metodo, funcao) {
  return async (req, res) => {
    try {
      if (req.method !== metodo) return res.status(405).json({ erro: 'Método não permitido.' });
      const a = acesso(req);
      if (!a.ok) return res.status(a.status).json({ erro: a.erro });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(await funcao(req));
    } catch (e) {
      console.error(e);
      return res.status(500).json({ erro: e.message || 'Erro interno.' });
    }
  };
}
