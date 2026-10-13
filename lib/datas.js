// Datas em ISO (AAAA-MM-DD), sempre no fuso de São Paulo.

export function hojeSP(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}

export function somarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diaSemana(iso) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = domingo
}

const SEMANA = {
  dom: 0, domingo: 0,
  seg: 1, segunda: 1,
  ter: 2, terca: 2,
  qua: 3, quarta: 3,
  qui: 4, quinta: 4,
  sex: 5, sexta: 5,
  sab: 6, sabado: 6,
};

// Palavra já normalizada (sem acento) -> ISO, ou null se não for uma data.
// "seg" = a segunda-feira mais recente (hoje, se hoje for segunda).
export function dataDePalavra(palavra, hoje) {
  if (palavra === 'hoje') return hoje;
  if (palavra === 'ontem') return somarDias(hoje, -1);
  if (palavra === 'anteontem') return somarDias(hoje, -2);
  if (palavra in SEMANA) {
    const diff = (diaSemana(hoje) - SEMANA[palavra] + 7) % 7;
    return somarDias(hoje, -diff);
  }
  return null;
}

// "13/10" ou "13/10/2026". Sem ano: usa o ano de hoje (ou o anterior, se cair no futuro).
export function dataDiaMes(dia, mes, ano, hoje) {
  const d = Number(dia);
  const m = Number(mes);
  let a = ano ? Number(ano) : Number(hoje.slice(0, 4));
  if (ano && ano.length === 2) a += 2000;
  const iso = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const teste = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(teste.getTime()) || teste.getUTCMonth() + 1 !== m || teste.getUTCDate() !== d) return null;
  if (!ano && iso > hoje) return dataDiaMes(dia, mes, String(a - 1), hoje);
  return iso;
}

// Data de "hoje" informada pelo celular (registro guardado sem internet). Só vale se for uma
// data real, não for futura e não tiver mais de `maxDias` dias; senão usa a data do servidor.
export function hojeInformado(candidata, servidor, maxDias = 30) {
  if (typeof candidata !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(candidata)) return servidor;
  const d = new Date(`${candidata}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== candidata) return servidor;
  if (candidata > servidor || candidata < somarDias(servidor, -maxDias)) return servidor;
  return candidata;
}

// "dia 10": o dia 10 deste mês; se ainda não chegou, o do mês passado. null se o dia não existe.
export function dataDoDia(dia, hoje) {
  const d = Number(dia);
  let ano = Number(hoje.slice(0, 4));
  let mes = Number(hoje.slice(5, 7));
  const monta = (a, m) => {
    const iso = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const t = new Date(`${iso}T12:00:00Z`);
    return !Number.isNaN(t.getTime()) && t.getUTCMonth() + 1 === m && t.getUTCDate() === d ? iso : null;
  };
  const iso = monta(ano, mes);
  if (iso && iso <= hoje) return iso;
  mes -= 1;
  if (mes === 0) {
    mes = 12;
    ano -= 1;
  }
  return monta(ano, mes);
}
