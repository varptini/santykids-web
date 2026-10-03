const SUPABASE_URL = 'https://piaxnqcafqkilwjxwwdm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DN68M-5ySj8UhPymSQ4U7A_iIjv65bR';
const SITE = 'https://santykids-web.vercel.app';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  const id = Number(req.query.id);
  const dest = `/catalogo.html?producto=${id}`;
  if (!Number.isInteger(id)) return res.redirect(302, '/catalogo.html');

  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,nombre,descripcion,imagenes&id=eq.${id}&estado=eq.publicado`,
    { headers: { apikey: SUPABASE_KEY } });
  const [p] = r.ok ? await r.json() : [];
  if (!p || !p.imagenes?.length) return res.redirect(302, '/catalogo.html');

  const desc = String(p.descripcion ?? '').slice(0, 150);
  const og = p.imagenes[0].replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=800&quality=75';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.nombre)} · Santy Kids</title>
<meta property="og:title" content="${esc(p.nombre)} · Santy Kids">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:url" content="${SITE}/p/${id}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${dest}">
<script>location.replace(${JSON.stringify(dest)});</script>
</head>
<body><a href="${dest}">Ver producto</a></body>
</html>`);
};
