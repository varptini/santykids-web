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

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const precio = p => (p.precio === null || p.precio === undefined) ? '' : `$${Number(p.precio)} MXN`;

let products = [];

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
  renderProductList(products);
}

function renderProductList(list) {
  if (!list.length) {
    productList.innerHTML = '<p class="count">No hay productos todavía.</p>';
    return;
  }
  productList.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th></th><th>Nombre</th><th>ID</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th>
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
              <td>${esc(p.nombre)}</td>
              <td>#${esc(p.id)}</td>
              <td>${esc(p.categoria)}</td>
              <td>${esc(precio(p))}</td>
              <td>${esc(p.stock)}</td>
              <td>${esc(p.estado)}</td>
              <td><button type="button" class="btn btn-ghost js-edit" data-id="${esc(p.id)}">Editar</button></td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

loginForm.addEventListener('submit', e => {
  e.preventDefault();
  login(loginEmail.value, loginPassword.value);
});

logoutBtn.addEventListener('click', logout);

sb.auth.getSession().then(({ data }) => onAuthReady(data.session));
sb.auth.onAuthStateChange((_event, session) => onAuthReady(session));
