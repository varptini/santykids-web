function initSantyCatalog(opts) {
  const SUPABASE_URL = 'https://piaxnqcafqkilwjxwwdm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_DN68M-5ySj8UhPymSQ4U7A_iIjv65bR'; // llave pública: solo lee productos publicados (RLS)
  const WA = 'https://wa.me/5217474005390';
  const NUEVO_DIAS = 14;

  const $ = id => document.getElementById(id);
  const grid = $(opts.gridId);
  const overlay = $('modalOverlay'), modalImg = $('modalImg');
  const modalNom = $('modalNombre'), modalBadge = $('modalBadge'), modalCap = $('modalCaption');
  const modalBtn = $('modalBtn'), modalPrecio = $('modalPrecio'), modalCat = $('modalCat'), thumbs = $('modalThumbs');
  const closeBtn = $('modalClose');
  const buscar = opts.searchId ? $(opts.searchId) : null;
  const chips = opts.chipsId ? $(opts.chipsId) : null;
  const count = opts.countId ? $(opts.countId) : null;

  let products = [], categoria = null, lastFocus = null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const precio = p => (p.precio === null || p.precio === undefined) ? '' : `$${Number(p.precio)} MXN`;
  const esNuevo = p => (Date.now() - new Date(p.created_at).getTime()) < NUEVO_DIAS * 864e5;
  const waLink = (nombre, id) => `${WA}?text=${encodeURIComponent(`Hola! Me interesa: ${nombre} (#${id}) 🎀 https://santykids-web.vercel.app/p/${id}`)}`;
  const ic = id => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

  // ── Menú móvil ──
  const menuBtn = $('menuBtn'), menu = $('menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open);
      menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
    menu.addEventListener('click', e => { if (e.target.closest('a')) { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); } });
  }

  // ── Modal ──
  function openModal(p) {
    const agotado = p.stock === 0;
    const show = i => {
      modalImg.src = p.imagenes[i];
      thumbs.querySelectorAll('button').forEach((t, k) => t.classList.toggle('on', k === i));
    };
    lastFocus = document.activeElement;
    modalImg.alt = p.nombre;
    modalNom.textContent = p.nombre;
    modalPrecio.textContent = precio(p);
    modalCat.textContent = [p.categoria, `#${p.id}`].filter(Boolean).join(' · ');
    modalBadge.innerHTML = agotado ? '<span class="badge badge-agotado" style="position:static;display:inline-block">Agotado</span>' : '';
    modalCap.textContent = [p.descripcion, p.hashtags].filter(Boolean).join('\n\n');
    modalBtn.innerHTML = agotado
      ? '<span class="soldout">Sin stock por ahora</span>'
      : `<a class="btn btn-wa" href="${waLink(p.nombre, p.id)}" target="_blank" rel="noopener">${ic('i-chat')}Pedir por WhatsApp</a>`;
    thumbs.innerHTML = p.imagenes.length > 1
      ? p.imagenes.map((u, k) => `<button type="button" aria-label="Ver foto ${k + 1}"><img src="${esc(u)}" alt="" /></button>`).join('') : '';
    thumbs.querySelectorAll('button').forEach((t, k) => t.addEventListener('click', () => show(k)));
    show(0);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }
  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') return closeModal();
    if (e.key === 'Tab') { // mantiene el foco dentro del modal
      const f = [...overlay.querySelectorAll('button, a[href]')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ── Filtros y tarjetas ──
  function renderChips() {
    if (!chips) return;
    const cats = [...new Set(products.map(p => p.categoria).filter(Boolean))].sort();
    if (!cats.length) { chips.innerHTML = ''; return; }
    chips.innerHTML = ['', ...cats].map(c =>
      `<button type="button" class="chip${(c || null) === categoria ? ' on' : ''}" data-c="${esc(c)}" aria-pressed="${(c || null) === categoria}">${c ? esc(c) : 'Todos'}</button>`).join('');
    chips.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      categoria = b.dataset.c || null;
      renderChips(); render();
    }));
  }

  function render() {
    grid.setAttribute('aria-busy', 'false');
    const q = buscar ? norm(buscar.value.trim()) : '';
    let shown = products.filter(p =>
      (!categoria || p.categoria === categoria) &&
      (!q || norm(`${p.nombre} ${p.descripcion}`).includes(q)));
    if (opts.limit) shown = shown.slice(0, opts.limit);
    if (count) count.textContent = products.length ? `${shown.length} ${shown.length === 1 ? 'producto' : 'productos'}` : '';
    if (!shown.length) {
      grid.innerHTML = '<div class="catalogo-msg">' + (products.length
        ? 'No encontramos productos con ese filtro. Prueba con otra palabra.'
        : 'Pronto tendremos productos aquí. ¡Síguenos en redes!') + '</div>';
      return;
    }
    grid.innerHTML = shown.map((p, i) => {
      const agotado = p.stock === 0;
      const badge = agotado
        ? '<span class="badge badge-agotado" style="position:static;display:inline-block">Agotado</span>'
        : esNuevo(p) ? '<span class="badge badge-nuevo" style="position:static;display:inline-block">Nuevo</span>' : '';
      return `
        <article class="cat-card${agotado ? ' agotado' : ''}" data-idx="${i}" tabindex="0" role="button" aria-label="Ver ${esc(p.nombre)}" style="--i:${Math.min(i, 10)}">
          <div class="cat-img"><img src="${esc(p.imagenes[0])}" alt="${esc(p.nombre)}" loading="lazy" /></div>
          <div class="cat-info">
            <h3 class="cat-nombre">${esc(p.nombre)} <span style="font-weight:400;color:var(--gris);font-size:.75rem">#${p.id}</span></h3>
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
              ${badge}
              ${precio(p) ? `<div class="cat-precio">${esc(precio(p))}</div>` : ''}
            </div>
            <p class="cat-desc">${esc(p.descripcion)}</p>
            <span class="btn btn-primary" style="margin-top:.6rem">${agotado ? 'Ver detalle' : 'Ver y pedir'} ${ic('i-arrow')}</span>
          </div>
        </article>`;
    }).join('');
    grid.querySelectorAll('.cat-card').forEach(card => {
      const open = () => openModal(shown[Number(card.dataset.idx)]);
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }
  if (buscar) buscar.addEventListener('input', render);

  // Producto más reciente disponible como imagen principal (solo home)
  function renderHero() {
    if (!opts.heroUpdate) return;
    const p = products.find(x => x.stock > 0);
    if (!p) return;
    $('heroFrame').innerHTML = `<img src="${esc(p.imagenes[0])}" alt="${esc(p.nombre)}" />`;
    $('heroTagText').textContent = p.nombre;
    $('heroTag').classList.add('on');
  }

  fetch(`${SUPABASE_URL}/rest/v1/products?select=*&estado=eq.publicado&order=created_at.desc`,
        { headers: { apikey: SUPABASE_KEY } })
    .then(r => r.ok ? r.json() : [])
    .catch(() => [])
    .then(data => {
      products = data.filter(p => p.imagenes && p.imagenes.length);
      renderChips(); render(); renderHero();
      const pid = new URLSearchParams(location.search).get('producto');
      const abrir = products.find(x => String(x.id) === pid);
      if (abrir) openModal(abrir);
    });
}
