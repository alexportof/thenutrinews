// Recebe o cadastro da página e envia para o RD Station como conversão "the-nutri-news".
// A chave fica na variável de ambiente RD_API_KEY (configurada na Vercel, nunca no código).

const PROFISSOES = ['Nutrição', 'Medicina', 'Educação Física', 'Outra'];
const CONVERSION_ID = 'the-nutri-news';

function limpa(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, erro: 'metodo' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  // Armadilha contra robôs: campo invisível precisa vir vazio.
  if (limpa(body.website, 200)) {
    return res.status(200).json({ ok: true });
  }

  const nome = limpa(body.nome, 120);
  const email = limpa(body.email, 160).toLowerCase();
  const celular = limpa(body.celular, 30).replace(/[^\d+]/g, '');
  const profissao = limpa(body.profissao, 40);

  const erros = [];
  if (nome.length < 2) erros.push('nome');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) erros.push('email');
  if (celular.replace(/\D/g, '').length < 10) erros.push('celular');
  if (!PROFISSOES.includes(profissao)) erros.push('profissao');
  if (erros.length) {
    return res.status(400).json({ ok: false, erro: 'campos', campos: erros });
  }

  const key = process.env.RD_API_KEY;
  if (!key) {
    console.error('RD_API_KEY ausente');
    return res.status(500).json({ ok: false, erro: 'config' });
  }

  const payload = {
    conversion_identifier: CONVERSION_ID,
    email,
    name: nome,
    mobile_phone: celular,
    cf_profissao: profissao,
    available_for_mailing: true,
  };
  const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
  if (limpa(utm.source, 120)) payload.traffic_source = limpa(utm.source, 120);
  if (limpa(utm.medium, 120)) payload.traffic_medium = limpa(utm.medium, 120);
  if (limpa(utm.campaign, 200)) payload.traffic_campaign = limpa(utm.campaign, 200);
  if (limpa(utm.term || utm.content, 200)) payload.traffic_value = limpa(utm.term || utm.content, 200);

  try {
    const r = await fetch(
      'https://api.rd.services/platform/conversions?api_key=' + encodeURIComponent(key),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ event_type: 'CONVERSION', event_family: 'CDP', payload }),
      }
    );
    if (r.ok) {
      return res.status(200).json({ ok: true });
    }
    const texto = await r.text();
    console.error('RD respondeu', r.status, texto.slice(0, 800));
    return res.status(502).json({ ok: false, erro: 'rd', status: r.status });
  } catch (e) {
    console.error('Falha ao chamar o RD', e && e.message);
    return res.status(502).json({ ok: false, erro: 'rede' });
  }
};
