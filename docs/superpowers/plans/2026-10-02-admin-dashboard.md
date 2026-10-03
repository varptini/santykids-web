# Dashboard de administración — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `admin.html`, a login-gated page where the store owner can create, edit, and archive products directly from a browser, without the Telegram bot.

**Architecture:** One new static page (`admin.html`) plus one new script (`admin.js`), same no-build pattern as the rest of the site. The browser talks directly to Supabase: `supabase-js` (CDN) handles email/password auth, and the existing `products` table / `products` Storage bucket handle data and images, authorized by the RLS policies already applied in migration `admin_write_access_for_authenticated`. No backend, no serverless functions, no service_role key in the client.

**Tech Stack:** Vanilla JS (ES2017+, no bundler), `@supabase/supabase-js` v2 via CDN (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`), `styles.css` for shared visual tokens/components. This project has no automated test runner — every task's verification is a manual check in the browser (serve with `python3 -m http.server 8000`, as used throughout this project), not an automated test suite. "Write the test" steps below mean "write down the exact manual check," and "run the test" means "perform it and confirm the stated result."

**Spec:** `docs/superpowers/specs/2026-10-02-admin-dashboard-design.md`

## Global Constraints

- No backend/serverless function; the browser calls Supabase directly (spec "Arquitectura").
- Never put the `service_role` key in client code — only the existing publishable key `sb_publishable_DN68M-5ySj8UhPymSQ4U7A_iIjv65bR` against `https://piaxnqcafqkilwjxwwdm.supabase.co` (spec "Arquitectura", matches `catalogo.js`).
- Single admin account (`admin@santykids.com`, already created); no sign-up UI anywhere on the page (spec "Alcance").
- "Eliminar" = set `estado = 'archivado'`; no hard delete of rows or Storage files anywhere in this plan (spec "Alcance").
- `admin.html` has no link from the public nav (`index.html`, `catalogo.html` stay unchanged) (spec "Arquitectura").
- Images upload to the existing Storage bucket `products`, same bucket the Telegram bot already writes to (spec "Arquitectura").
- Reuse `styles.css` (`.btn`, `.wrap`, `.section-title`, design tokens) for visual consistency; page-specific admin styles go in `admin.html`'s own `<style>` block, same pattern as `catalogo.html`.

## Review Focus

- Negative `precio` or `stock` entered in the form: the DB's `check` constraints reject it — the form must surface that as an inline error, not fail silently (Task 3).
- Selecting a non-image file in the photo picker: must be rejected per-file with a message, without blocking the other valid files in the same selection (Task 4).
- Session expiring mid-use (an authenticated call suddenly returns 401/403): the page must fall back to the login gate, not hang or show a raw error (Task 2).
- Archiving a product that is currently one of the 6 newest (shown in the home carousel): it must disappear from both `catalogo.html` and the `index.html` carousel, not just the catalog grid (Task 5).
- Saving a product with zero photos: `catalogo.js` already filters out any product whose `imagenes` array is empty, so it would silently never appear publicly even when `estado = 'publicado'`. The form must warn about this before saving (Task 4).

---

## Task 1: Page shell, Supabase client, and auth gate

**Files:**
- Create: `admin.html`
- Create: `admin.js`

**Interfaces:**
- Produces: global `sb` (Supabase client instance) in `admin.js`, used by every later task.
- Produces: `showGate()`, `showApp()` — toggle which of `#authGate` / `#adminApp` is visible.
- Produces: `async function login(email, password)` — calls `sb.auth.signInWithPassword`, returns `{ error }`; on error, writes `error.message` into `#loginError` and keeps the login form filled.
- Produces: `async function logout()` — calls `sb.auth.signOut()`, then `showGate()`.
- Produces: `onAuthReady(session)` — called once on load and on every `sb.auth.onAuthStateChange` event; calls `showApp()` when `session` is truthy, `showGate()` otherwise. Later tasks hook their own data loads onto this.

- [ ] **Step 1: Build `admin.html` shell**

Head: same `<link>`s as `catalogo.html` (Google Fonts, `styles.css`), plus a `<script>` tag loading `@supabase/supabase-js` from jsdelivr, pinned to an exact version (not the floating `@2`) with a Subresource Integrity hash — this page has write access to the database, so pin it harder than a read-only CDN include. Get the exact version and its SRI hash with `curl -s https://data.jsdelivr.com/v1/packages/npm/@supabase/supabase-js | head` (latest stable tag) and `curl -s "https://www.jsdelivr.com/sri/<version-tag>"`-equivalent lookup (jsdelivr exposes the hash in its own UI/API — any `sha384-` hash it publishes for that exact file is fine), then write `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@X.Y.Z/dist/umd/supabase.min.js" integrity="sha384-..." crossorigin="anonymous"></script>` before `admin.js`. Title: "Panel — Santy Kids". No link to this page from `index.html` or `catalogo.html`'s nav.

Body: two top-level containers, `<section id="authGate">` with a login form (`#loginForm`, inputs `#loginEmail` type=email, `#loginPassword` type=password, submit button, `<p id="loginError" class="count"></p>` for errors — reuse the `.count` class from `styles.css` for muted small text) and `<div id="adminApp" hidden>` with a header bar (store name, `#logoutBtn`) and two empty placeholders `<div id="productList"></div>` and `<div id="productForm" hidden></div>` that later tasks fill in.

- [ ] **Step 2: Write `admin.js` client + gate logic**

```js
const SUPABASE_URL = 'https://piaxnqcafqkilwjxwwdm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DN68M-5ySj8UhPymSQ4U7A_iIjv65bR';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
```

Implement `showGate()`, `showApp()` (toggle `hidden` attribute on `#authGate` / `#adminApp`), `login(email, password)`, `logout()`, and `onAuthReady(session)` per the Interfaces block above. Wire `#loginForm` submit to call `login()` with the field values (`e.preventDefault()` first). Wire `#logoutBtn` click to `logout()`. On script load, call `sb.auth.getSession().then(({data}) => onAuthReady(data.session))`, and register `sb.auth.onAuthStateChange((_event, session) => onAuthReady(session))`.

- [ ] **Step 3: Manual check — login gate**

Serve locally (`python3 -m http.server 8000`), open `http://localhost:8000/admin.html`.
Expected: only the login form is visible, `#adminApp` is hidden.
Type a wrong password for `admin@santykids.com` and submit.
Expected: `#loginError` shows an error message, form stays filled, `#adminApp` still hidden.
Type the correct password and submit.
Expected: `#authGate` hides, `#adminApp` becomes visible.
Reload the page.
Expected: still logged in (session persisted), `#adminApp` visible immediately.
Click `#logoutBtn`.
Expected: back to the login form.

- [ ] **Step 4: Commit**

```bash
git add admin.html admin.js
git commit -m "feat: panel admin — login y logout con Supabase Auth"
```

---

## Task 2: Product list (all products, any estado)

**Files:**
- Modify: `admin.js`
- Modify: `admin.html` (fills `#productList`)

**Interfaces:**
- Consumes: `sb` from Task 1.
- Produces: module-level `let products = []` — the full list as last loaded, read by Task 3/4/5.
- Produces: `async function loadProducts()` — `sb.from('products').select('*').order('created_at', {ascending: false})`; on success sets `products` and calls `renderProductList(products)`; on error with `status` 401 or 403, calls `logout()` (falls back to the gate per Review Focus); other errors show a message in a `#listMsg` element.
- Produces: `function renderProductList(list)` — renders one row per product into `#productList` with: thumbnail (`list[i].imagenes[0]`, or a placeholder if empty), `nombre`, `#${id}`, `categoria`, `precio`, `stock`, `estado`, and a button `data-id="${id}"` class `js-edit`. Row markup can reuse plain HTML/CSS (a simple table or flex rows); this does not need to match the public `.cat-card` styling.
- Produces: hook `onAuthReady` (Task 1) to call `loadProducts()` whenever a session becomes active.

- [ ] **Step 1: Implement `loadProducts()` and `renderProductList()` in `admin.js`**

Call `loadProducts()` from inside `onAuthReady(session)` when `session` is truthy (after `showApp()`).

- [ ] **Step 2: Manual check — list loads everything, not just published**

In the Supabase Table Editor (or via the existing test rows), confirm there is at least one product with `estado != 'publicado'`. Log into `admin.html`.
Expected: the list shows that non-published product too (the public `catalogo.html` would hide it — this list must not).
Expected: thumbnail, nombre, id, categoria, precio, stock, estado all render correctly for each row.

- [ ] **Step 3: Manual check — session-expiry fallback (Review Focus)**

While logged into `admin.html`, open the browser console and run `await sb.auth.signOut()` directly (bypassing the `#logoutBtn`), then call `loadProducts()` again from the console.
Expected: the call fails with a 401/403-style error and the page falls back to showing `#authGate` (via the `logout()` path), not a stuck or broken state.

- [ ] **Step 4: Commit**

```bash
git add admin.js admin.html
git commit -m "feat: panel admin — listado de todos los productos"
```

---

## Task 3: Create/edit form (text fields)

**Files:**
- Modify: `admin.js`
- Modify: `admin.html` (fills `#productForm`)

**Interfaces:**
- Consumes: `products` (Task 2, for the category datalist), `loadProducts()` (Task 2, called after a successful save to refresh the list).
- Produces: module-level `let editingId = null` (the product's `id` when editing, `null` when creating) — Task 4 reads/sets this too.
- Produces: `function openForm(product)` — `product` is `null` for "new product" (blank form, `editingId = null`) or a row from `products` for "edit" (fields populated, `editingId = product.id`); shows `#productForm`, hides `#productList`.
- Produces: `function closeForm()` — hides `#productForm`, shows `#productList`, resets `editingId = null`.
- Produces: `function populateCategoriaList()` — fills a `<datalist id="categoriaList">` with the distinct, sorted `categoria` values from `products` (reuse the same dedup approach as `catalogo.js`'s `renderChips`).
- Produces: `async function saveProduct(e)` — `e.preventDefault()`; builds a payload `{ nombre, descripcion, hashtags, precio: Number(...)||null, categoria, stock: Number(...), estado }` from the form fields; if `editingId` is set, `sb.from('products').update(payload).eq('id', editingId)`, else `sb.from('products').insert(payload)`; on success calls `loadProducts()` and `closeForm()`; on error, writes `error.message` into a `#formMsg` element and leaves the form filled (do not reset on error).

- [ ] **Step 1: Build the form markup in `admin.html`**

Inside `#productForm`: inputs for `nombre` (`#fNombre`), `descripcion` (`#fDescripcion`, textarea), `hashtags` (`#fHashtags`), `precio` (`#fPrecio`, number), `categoria` (`#fCategoria`, text, `list="categoriaList"`) + `<datalist id="categoriaList">`, `stock` (`#fStock`, number), `estado` (`#fEstado`, `<select>` with options `borrador`/`publicado`/`archivado`), a `<p id="formMsg"></p>`, and `#formSaveBtn` (submit) / `#formCancelBtn` (button, calls `closeForm()`). Wire the form's submit to `saveProduct`.

In `#productList`'s container (from Task 2), add a `#newProductBtn` button above the list that calls `openForm(null)`.

- [ ] **Step 2: Implement `openForm`, `closeForm`, `populateCategoriaList`, `saveProduct` in `admin.js`**

Wire each row's `.js-edit` button (rendered in Task 2) to `openForm(products.find(p => p.id === Number(btn.dataset.id)))`. Call `populateCategoriaList()` at the end of `renderProductList()` (Task 2) so the datalist always reflects the current product set.

- [ ] **Step 3: Manual check — create a text-only product**

Log in, click `#newProductBtn`, fill `nombre`, `precio` (e.g. `150`), `stock` (e.g. `3`), `estado = borrador`, leave photos empty (Task 4 handles those), save.
Expected: form closes, the new product appears in the list with the values entered.

- [ ] **Step 4: Manual check — edit an existing product**

Click "Editar" on an existing row.
Expected: form opens pre-filled with that product's current values.
Change `precio`, save.
Expected: the list reflects the new `precio` for that row; no duplicate row was created.

- [ ] **Step 5: Manual check — inline error on invalid data (Review Focus)**

Open the form, type `-5` into `#fPrecio`, save.
Expected: `#formMsg` shows an error (the DB's `precio >= 0` check rejects it), the form stays open with the typed values still present, and no row was added/changed in the list.

- [ ] **Step 6: Commit**

```bash
git add admin.js admin.html
git commit -m "feat: panel admin — crear y editar productos (campos de texto)"
```

---

## Task 4: Image upload

**Files:**
- Modify: `admin.js`
- Modify: `admin.html` (adds the file input + preview area to `#productForm`)

**Interfaces:**
- Consumes: `editingId`, `openForm`/`closeForm` (Task 3).
- Produces: module-level `let formImages = []` — array of `{ path, url }` for the images currently attached to the open form; `openForm(product)` (Task 3, extended here) seeds it from `product.imagenes` (as `{path: null, url}` for pre-existing URLs) or `[]` for a new product; `saveProduct` (Task 3, extended here) includes `formImages.map(i => i.url)` as the `imagenes` field of the payload.
- Produces: `function sanitizeFilename(name)` — lowercases, replaces anything outside `[a-z0-9._-]` with `_`.
- Produces: `async function handleFileSelect(fileList)` — for each file: if `!file.type.startsWith('image/')`, append `"${file.name}: no es una imagen"` to `#formMsg` and skip it; otherwise upload to `sb.storage.from('products').upload(`${Date.now()}_${sanitizeFilename(file.name)}`, file)`, then `sb.storage.from('products').getPublicUrl(path)`, push `{path, url}` to `formImages`, and call `renderImagePreview()`.
- Produces: `function renderImagePreview()` — renders a thumbnail `<img>` per `formImages` entry inside a `#fImagePreview` container, each with a remove button wired to `removeImage(index)`.
- Produces: `function removeImage(index)` — splices `formImages` at `index`, calls `renderImagePreview()`. (Only removes it from the form's pending state — does not delete the file from Storage, consistent with the spec's "no hard delete.")

- [ ] **Step 1: Add markup to `admin.html`**

Inside `#productForm`: `<input id="fImagenes" type="file" accept="image/*" multiple />` and `<div id="fImagePreview"></div>`. Wire `#fImagenes`'s `change` event to `handleFileSelect(event.target.files)`.

- [ ] **Step 2: Implement upload/preview/remove functions in `admin.js`**

Extend `openForm(product)` (Task 3) to reset `formImages` to `(product?.imagenes || []).map(url => ({path: null, url}))` and call `renderImagePreview()`. Extend `saveProduct` (Task 3) to add `imagenes: formImages.map(i => i.url)` to the payload. Add the zero-images warning: if `formImages.length === 0` when `saveProduct` runs, show a non-blocking message in `#formMsg` ("Sin fotos, este producto no va a aparecer en el catálogo público aunque esté publicado") before proceeding with the save — this does not prevent saving, per the spec's "validación mínima."

- [ ] **Step 3: Manual check — upload, preview, remove**

Open `#newProductBtn`, select two valid image files via `#fImagenes`.
Expected: two thumbnails appear in `#fImagePreview`.
Click the remove button on one.
Expected: only one thumbnail remains.
Fill `nombre`/`precio`/`stock`, save.
Expected: the product appears in the list with that one photo as its thumbnail; check in the Supabase Storage bucket `products` that the uploaded file exists at the expected path.

- [ ] **Step 4: Manual check — non-image file rejected (Review Focus)**

Select one valid image and one `.txt` file together in the same `#fImagenes` selection.
Expected: the image uploads and shows a thumbnail; `#formMsg` shows a message naming the `.txt` file as rejected; the valid image is not blocked by the invalid one.

- [ ] **Step 5: Manual check — zero-image warning (Review Focus)**

Create a product with no photos attached, `estado = publicado`, save.
Expected: `#formMsg` showed the "no va a aparecer" warning before/at save, the product still saves successfully. Then open `catalogo.html` and confirm this product does NOT appear (consistent with `catalogo.js` filtering out products with empty `imagenes`) — this confirms the warning is accurate, not just decorative.

- [ ] **Step 6: Commit**

```bash
git add admin.js admin.html
git commit -m "feat: panel admin — subida y eliminación de fotos en el formulario"
```

---

## Task 5: Archive action

**Files:**
- Modify: `admin.js`
- Modify: `admin.html` (adds the archive button to each list row)

**Interfaces:**
- Consumes: `loadProducts()` (Task 2), `products` (Task 2).
- Produces: `async function archiveProduct(id)` — shows `confirm('¿Archivar este producto? Dejará de verse en el catálogo público.')`; if confirmed, `sb.from('products').update({estado: 'archivado'}).eq('id', id)`, then `loadProducts()`; on error, shows it in `#listMsg`.

- [ ] **Step 1: Add an "Archivar" button to each row in `renderProductList()` (Task 2's function, extended here)**

`data-id="${id}"` class `js-archive`, wired to `archiveProduct(Number(btn.dataset.id))`. Skip rendering this button (or disable it) for rows already `estado === 'archivado'`.

- [ ] **Step 2: Implement `archiveProduct` in `admin.js`**

- [ ] **Step 3: Manual check — archive a published product (Review Focus)**

Pick one of the 3 existing test products, publish it if it isn't already (`estado = publicado`), confirm it currently shows in both `catalogo.html`'s grid and (if it's among the 6 newest) the `index.html` carousel. In `admin.html`, click "Archivar" on it and confirm the dialog.
Expected: the row's `estado` updates to `archivado` in the admin list.
Reload `catalogo.html`.
Expected: the product no longer appears.
Reload `index.html`.
Expected: the product no longer appears in the carousel either.

- [ ] **Step 4: Commit**

```bash
git add admin.js admin.html
git commit -m "feat: panel admin — archivar productos"
```

---

## Task 6: End-to-end pass, docs, and cleanup

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- None — this task verifies the whole feature and updates project documentation; it defines no new interfaces.

- [ ] **Step 1: Run the spec's full manual test plan**

Execute all 6 scenarios listed in `docs/superpowers/specs/2026-10-02-admin-dashboard-design.md` under "Testing" top to bottom, in order, in one sitting (most are already covered by earlier tasks' manual checks — this step is the final confirmation they still all hold together after Task 5's changes). Note and fix any regression before continuing.

- [ ] **Step 2: Update `CLAUDE.md`'s Architecture section**

Add one line each for `catalogo.html` (full catalog grid, split out of `index.html`), `styles.css` and `catalogo.js` (shared between `index.html` and `catalogo.html`), and `admin.html`/`admin.js` (login-gated product management, not linked from public nav). Follow the existing bullet style in that file.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documentar catalogo.html, styles.css, catalogo.js y admin.html en CLAUDE.md"
```
