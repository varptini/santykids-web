# Dashboard de administración — diseño

**Fecha:** 2026-10-02
**Estado:** aprobado para implementación

## Motivación

Hoy los productos (`catalog` en Supabase) solo se pueden crear/editar vía el
bot de Telegram (`~/proyectos/santykids-bot`), que corre desde el celular.
La dueña del negocio quiere poder subir y editar moños también desde una
compu, sin depender de tener el teléfono a mano.

## Alcance

- Crear productos nuevos.
- Editar productos existentes (nombre, descripción, hashtags, precio,
  categoría, stock, estado, fotos).
- "Eliminar" = pasar `estado` a `archivado` (soft delete). No hay borrado
  físico de filas ni de archivos en Storage.
- Una sola cuenta admin (`admin@santykids.com`), sin registro público.

Fuera de alcance (explícitamente, para esta iteración):
- Borrado físico/definitivo de productos.
- Múltiples cuentas / roles.
- Reemplazar o modificar el bot de Telegram — el dashboard es un camino
  alternativo, ambos coexisten y escriben a la misma tabla.
- Reordenar o paginar el catálogo público (ya resuelto en `catalogo.html`).

## Arquitectura

Una página estática nueva, `admin.html`, en el mismo repo y sin build step
(consistente con `index.html` / `catalogo.html`). Usa el cliente
`@supabase/supabase-js` por CDN para hablar directo con Supabase:

- **Auth**: `supabase.auth.signInWithPassword()` con la cuenta creada en
  Supabase Auth. Sin backend propio, sin funciones serverless.
- **Datos**: lectura/escritura a la tabla `products` vía PostgREST,
  autorizado por RLS (ver abajo), usando la misma llave pública
  (`sb_publishable_...`) que ya usan las páginas públicas — la diferencia
  la hace la sesión autenticada, no una llave distinta.
- **Imágenes**: subida directa a Supabase Storage, bucket `products`
  (público, ya existe y es el que usa el bot), también autorizada por RLS.

No se expone nunca la `service_role key` en el cliente.

## Seguridad (ya aplicado)

Antes de este documento ya se aplicó la migración
`admin_write_access_for_authenticated` en el proyecto `piaxnqcafqkilwjxwwdm`:

- `products`: nueva policy SELECT para `authenticated` (`using (true)`) —
  antes el público solo veía `estado = 'publicado'`; ahora una sesión
  logueada ve todo (incluye borradores y archivados).
- `products`: nueva policy INSERT para `authenticated`.
- `products`: nueva policy UPDATE para `authenticated`.
- `storage.objects`: nuevas policies INSERT/UPDATE para `authenticated`
  restringidas a `bucket_id = 'products'`.

Se creó manualmente el usuario `admin@santykids.com` en Supabase Auth
(auto-confirmado, sin email de verificación) y se desactivó el registro
público (`Allow new users to sign up` = off) para que nadie más pueda
crearse una cuenta.

## Componentes de la UI

1. **Gate de login**: al cargar, `supabase.auth.getSession()`. Sin sesión
   → formulario email + password. Con sesión → UI de administración.
   Botón de logout visible siempre que hay sesión.
2. **Lista de productos**: tabla compacta (no las cards bonitas del
   catálogo público) con miniatura, nombre, `#id`, categoría, precio,
   stock, estado y botón "Editar". Ordenada por `created_at desc`.
3. **Formulario crear/editar** (mismo formulario para ambos casos):
   - Campos: nombre, descripción, hashtags, precio, categoría (input con
     `<datalist>` sugiriendo categorías ya usadas), stock, estado
     (select: borrador/publicado/archivado).
   - Fotos: input `multiple` de archivos de imagen. Se suben a
     `products/<timestamp>_<nombre-archivo-sanitizado>` en el bucket
     `products` y se guarda la URL pública resultante en `imagenes`.
     Permite ver miniaturas de las fotos ya subidas y quitarlas antes de
     guardar.
   - Validación mínima en cliente (nombre no vacío, precio/stock no
     negativos) — la base ya rechaza valores inválidos vía `check`
     constraints existentes.
   - Guardar hace `insert` (producto nuevo) o `update` (producto
     existente) en `products`.
4. **Archivar**: botón que hace `update` de `estado` a `archivado` sobre
   el producto, con confirmación simple (`confirm()` del navegador o un
   modal liviano) antes de ejecutar.

## Manejo de errores

- Login fallido: mensaje inline ("email o contraseña incorrectos"), sin
  redirigir ni limpiar el formulario.
- Guardado fallido (red, o constraint de la base como precio negativo):
  mensaje inline con el error, el formulario conserva lo escrito.
- Subida de imagen fallida (archivo no es imagen, o falla de red): se
  informa cuál archivo falló sin perder las fotos que sí se subieron.
- Sesión expirada a mitad de uso: al fallar una petición por 401/403, se
  vuelve a mostrar el gate de login.

## Testing (manual, el proyecto no tiene test runner)

Servido local (`python3 -m http.server`):

1. Sin sesión: confirmar que `admin.html` muestra el login y no la UI de
   administración.
2. Login con `admin@santykids.com`: confirmar que carga la lista de
   productos (incluidos los 3 de prueba, aunque estén en distintos
   `estado`).
3. Crear un producto de prueba con una foto, estado `borrador`: confirmar
   que NO aparece en `catalogo.html` (público).
4. Editarlo, pasar `estado` a `publicado`: confirmar que SÍ aparece en
   `catalogo.html` y en el carrusel de destacados del home si es de los
   6 más nuevos.
5. Archivarlo: confirmar que desaparece de las páginas públicas pero
   sigue listado (marcado como archivado) en el dashboard.
6. Confirmar, con `fetch` sin sesión (o en una pestaña privada), que
   intentar un `insert`/`update` directo contra la API de Supabase es
   rechazado por RLS.
