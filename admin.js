const SUPABASE_URL = 'https://piaxnqcafqkilwjxwwdm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DN68M-5ySj8UhPymSQ4U7A_iIjv65bR';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const authGate = $('authGate');
const adminApp = $('adminApp');
const loginForm = $('loginForm');
const loginEmail = $('loginEmail');
const loginPassword = $('loginPassword');
const loginError = $('loginError');
const logoutBtn = $('logoutBtn');
const productList = $('productList');
const listMsg = $('listMsg');
const newProductBtn = $('newProductBtn');
const productForm = $('productForm');
const productFormEl = $('productFormEl');
const formMsg = $('formMsg');
const formCancelBtn = $('formCancelBtn');
const fNombre = $('fNombre');
const fDescripcion = $('fDescripcion');
const fHashtags = $('fHashtags');
const fPrecio = $('fPrecio');
const fCategoria = $('fCategoria');
const fStock = $('fStock');
const fEstado = $('fEstado');
const categoriaList = $('categoriaList');
const buscar = $('buscar');
const fImagenes = $('fImagenes');
const fImagePreview = $('fImagePreview');

const ICON = {
  dots: '<svg class="dots" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  archive: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="2"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/></svg>',
};

const ESTADO = {
  publicado: { label: 'Publicado', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>' },
  borrador: { label: 'Borrador', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>' },
  archivado: { label: 'Archivado', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="2"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>' },
};

const closeMenus = () => {
  productList.querySelectorAll('.menu-panel').forEach(p => { p.hidden = true; });
  productList.querySelectorAll('.js-menu').forEach(b => b.setAttribute('aria-expanded', 'false'));
};
document.addEventListener('click', closeMenus);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const precio = p => (p.precio === null || p.precio === undefined) ? '' : `$${Number(p.precio)} MXN`;

let products = [];
let editingId = null;
let formImages = [];

function showGate() {
  authGate.hidden = false;
  adminApp.hidden = true;
}

function showApp() {
  authGate.hidden = true;
  adminApp.hidden = false;
}

async function login(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = error.message;
  }
  return { error };
}

async function logout() {
  await sb.auth.signOut();
  showGate();
}

function onAuthReady(session) {
  if (session) {
    showApp();
    loadProducts();
  } else {
    showGate();
  }
}

async function loadProducts() {
  if (listMsg) listMsg.textContent = '';
  const { data, error, status } = await sb.from('products').select('*').order('created_at', { ascending: false });
  if (error) {
    if (status === 401 || status === 403) {
      return logout();
    }
    if (listMsg) listMsg.textContent = 'No se pudo cargar la lista de productos.';
    return;
  }
  products = data;
  renderFiltered();
}

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function renderFiltered() {
  const q = norm(buscar.value.trim()).replace(/^#/, '');
  const list = q ? products.filter(p => norm(`${p.nombre} ${p.categoria} ${p.id} ${p.estado}`).includes(q)) : products;
  if (q && !list.length) {
    productList.innerHTML = '<p class="count">Sin resultados.</p>';
    return;
  }
  renderProductList(list);
}

function renderProductList(list) {
  if (!list.length) {
    productList.innerHTML = '<p class="count">No hay productos todavía.</p>';
    populateCategoriaList();
    return;
  }
  productList.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th></th><th>Producto</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${list.map(p => {
          const thumb = (p.imagenes && p.imagenes[0])
            ? `<img class="admin-thumb" src="${esc(p.imagenes[0])}" alt="${esc(p.nombre)}" loading="lazy" />`
            : '<div class="admin-thumb"></div>';
          return `
            <tr>
              <td>${thumb}</td>
              <td>
                <strong>${esc(p.nombre)}</strong>
                <div class="sub">#${esc(p.id)}${p.categoria ? ` · ${esc(p.categoria)}` : ''}</div>
              </td>
              <td>${esc(precio(p))}</td>
              <td>${esc(p.stock)}</td>
              <td><span class="estado estado-${esc(p.estado)}" title="${esc(ESTADO[p.estado]?.label ?? p.estado)}" aria-label="${esc(ESTADO[p.estado]?.label ?? p.estado)}">${ESTADO[p.estado]?.icon ?? ''}</span></td>
              <td>
                <div class="row-menu">
                  <button type="button" class="menu-btn js-menu" aria-haspopup="true" aria-expanded="false" aria-label="Acciones de ${esc(p.nombre)}">${ICON.dots}</button>
                  <div class="menu-panel" hidden>
                    <button type="button" class="menu-item js-edit" data-id="${esc(p.id)}" title="Editar" aria-label="Editar">${ICON.edit}</button>
                    ${p.estado !== 'archivado' ? `<button type="button" class="menu-item js-archive" data-id="${esc(p.id)}" title="Archivar" aria-label="Archivar">${ICON.archive}</button>` : ''}
                    <button type="button" class="menu-item menu-delete js-delete" data-id="${esc(p.id)}" title="Eliminar" aria-label="Eliminar">${ICON.trash}</button>
                  </div>
                </div>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  productList.querySelectorAll('.js-edit').forEach(btn => {
    btn.addEventListener('click', () => openForm(products.find(p => p.id === Number(btn.dataset.id))));
  });
  productList.querySelectorAll('.js-archive').forEach(btn => {
    btn.addEventListener('click', () => archiveProduct(Number(btn.dataset.id)));
  });
  productList.querySelectorAll('.js-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteProduct(Number(btn.dataset.id)));
  });
  productList.querySelectorAll('.js-menu').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const panel = btn.nextElementSibling;
      const abrir = panel.hidden;
      closeMenus();
      panel.hidden = !abrir;
      btn.setAttribute('aria-expanded', String(abrir));
    });
  });
  populateCategoriaList();
}

function openForm(product) {
  editingId = product ? product.id : null;
  formMsg.textContent = '';
  fNombre.value = product ? (product.nombre ?? '') : '';
  fDescripcion.value = product ? (product.descripcion ?? '') : '';
  fHashtags.value = product ? (product.hashtags ?? '') : '';
  fPrecio.value = product && product.precio !== null && product.precio !== undefined ? product.precio : '';
  fCategoria.value = product ? (product.categoria ?? '') : '';
  fStock.value = product && product.stock !== null && product.stock !== undefined ? product.stock : '';
  fEstado.value = product ? (product.estado ?? 'borrador') : 'borrador';
  formImages = (product?.imagenes || []).map(url => ({ path: null, url }));
  renderImagePreview();
  productForm.hidden = false;
  productList.hidden = true;
}

function closeForm() {
  editingId = null;
  productForm.hidden = true;
  productList.hidden = false;
}

function populateCategoriaList() {
  if (!categoriaList) return;
  const cats = [...new Set(products.map(p => p.categoria).filter(Boolean))].sort();
  categoriaList.innerHTML = cats.map(c => `<option value="${esc(c)}"></option>`).join('');
}

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
}

async function handleFileSelect(fileList) {
  for (const file of fileList) {
    if (!file.type.startsWith('image/')) {
      formMsg.textContent += `${formMsg.textContent ? ' ' : ''}${file.name}: no es una imagen`;
      continue;
    }
    const path = `${Date.now()}_${sanitizeFilename(file.name)}`;
    const { error } = await sb.storage.from('products').upload(path, file);
    if (error) {
      formMsg.textContent += `${formMsg.textContent ? ' ' : ''}${file.name}: ${error.message}`;
      continue;
    }
    const { data } = sb.storage.from('products').getPublicUrl(path);
    formImages.push({ path, url: data.publicUrl });
    renderImagePreview();
  }
}

function renderImagePreview() {
  if (!fImagePreview) return;
  fImagePreview.innerHTML = formImages.map((img, i) => `
    <div class="img-preview-item">
      <img src="${esc(img.url)}" alt="" />
      <button type="button" class="img-remove" data-index="${i}" aria-label="Quitar imagen">×</button>
    </div>`).join('');
  fImagePreview.querySelectorAll('.img-remove').forEach(btn => {
    btn.addEventListener('click', () => removeImage(Number(btn.dataset.index)));
  });
}

function removeImage(index) {
  formImages.splice(index, 1);
  renderImagePreview();
}

async function archiveProduct(id) {
  if (!confirm('¿Archivar este producto? Dejará de verse en el catálogo público.')) return;
  const { error } = await sb.from('products').update({ estado: 'archivado' }).eq('id', id);
  if (error) {
    listMsg.textContent = error.message;
    return;
  }
  await loadProducts();
}

async function deleteProduct(id) {
  if (!confirm('¿Eliminar este producto? No se puede deshacer.')) return;
  const { data, error } = await sb.from('products').delete().eq('id', id).select();
  if (error) {
    listMsg.textContent = error.message;
    return;
  }
  if (!data.length) {
    listMsg.textContent = 'No se pudo eliminar el producto.';
    return;
  }
  await loadProducts();
}

async function saveProduct(e) {
  e.preventDefault();
  formMsg.textContent = '';
  if (formImages.length === 0) {
    formMsg.textContent = 'Sin fotos, este producto no va a aparecer en el catálogo público aunque esté publicado';
  }
  const payload = {
    nombre: fNombre.value,
    descripcion: fDescripcion.value,
    hashtags: fHashtags.value,
    precio: Number(fPrecio.value) || null,
    categoria: fCategoria.value,
    stock: Number(fStock.value),
    estado: fEstado.value,
    imagenes: formImages.map(i => i.url),
  };
  const { error } = editingId
    ? await sb.from('products').update(payload).eq('id', editingId)
    : await sb.from('products').insert(payload);
  if (error) {
    formMsg.textContent = error.message;
    return;
  }
  await loadProducts();
  closeForm();
}

loginForm.addEventListener('submit', e => {
  e.preventDefault();
  login(loginEmail.value, loginPassword.value);
});

logoutBtn.addEventListener('click', logout);

newProductBtn.addEventListener('click', () => openForm(null));
formCancelBtn.addEventListener('click', closeForm);
productFormEl.addEventListener('submit', saveProduct);
fImagenes.addEventListener('change', e => handleFileSelect(e.target.files));
buscar.addEventListener('input', renderFiltered);

sb.auth.getSession().then(({ data }) => onAuthReady(data.session));
sb.auth.onAuthStateChange((_event, session) => onAuthReady(session));
