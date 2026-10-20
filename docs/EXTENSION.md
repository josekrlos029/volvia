# Volvia Biz para el navegador (Chrome y Safari)

Extensión para negocios que solo venden a domicilio. El equipo nunca ve al cliente, así que no
puede escanear su QR. En su lugar, lo busca por **cédula, teléfono o nombre** desde la
extensión y le pone el sello sin salir de WhatsApp Web o del panel de domicilios.

Código: `apps/extension` ([WXT](https://wxt.dev), Manifest V3, React 19, Tailwind v4 con la
marca de `@volvia/ui`). Un solo código genera Chrome y Safari.

## 1. Cómo funciona

| Pieza | Dónde |
| --- | --- |
| Interruptor del dueño «Permitir sellos a distancia» (+ «Pedir el número de pedido») | Panel → Equipo · `settings.remoteStamping` / `remoteStampingRequireOrder` |
| Estado y búsqueda | `GET /v1/remote/status`, `GET /v1/remote/lookup?q=` (`apps/api/src/modules/remote`) |
| Sellar | `POST /v1/stamp` con `channel: 'remote'`: misma idempotencia, recompensas y pase |
| Guardar cédula | `PUT /v1/remote/customers/:id/document` |
| Entrar con Google/Apple | Código de dispositivo: `POST /v1/auth/device/{start,approve,poll}` + `app…/extension/conectar` |
| Pedir cédula al inscribirse | Editor de tarjeta → «Qué pides al darse de alta» → Cédula (`collectDocument`) |

Reglas:
- **Apagado por defecto.** Sin el interruptor, la búsqueda y los sellos a distancia responden
  `403 REMOTE_STAMPING_DISABLED`.
- **Mismas reglas que en el mostrador.** `source: 'remote'` respeta la espera, el tope diario,
  los sellos máximos por escaneo y las campañas multiplicadoras (`rules.ts`, `service.ts`).
- **Se puede auditar.** Cada sello queda con `source: 'remote'` y el pedido en `note`. La ficha
  del cliente lo muestra como «A distancia · Pedido #4512».
- **La cédula se guarda normalizada**, sin puntos ni espacios y en mayúsculas. No es única
  (los errores de tipeo existen). La búsqueda solo devuelve los **últimos 4 dígitos**.
- **Tarjetas por monto mínimo (`min_spend`).** Desde la extensión no se pueden sellar en la
  v1, porque falta el campo de monto. La extensión pide hacerlo desde el teléfono.

CORS: la API no envía cabeceras CORS a orígenes `chrome-extension://`,
`safari-web-extension://` ni `moz-extension://`, pero tampoco los rechaza
(`plugins/security.ts`). El navegador omite CORS para una extensión con `host_permissions`
sobre la API. Cualquier otra extensión queda sin cabeceras, así que no puede leer respuestas
con las cookies del usuario.

## 2. Desarrollo

```bash
# Contra la pila aislada (API en 8081, panel en 3011); nunca contra prod.
cd apps/extension
WXT_API_URL=http://localhost:8081 WXT_APP_URL=http://localhost:3011 pnpm dev
```

`pnpm dev` abre un Chrome con la extensión cargada. A mano: `chrome://extensions` →
«Modo de desarrollador» → «Cargar descomprimida» → `apps/extension/.output/chrome-mv3`.

Sin variables, el build apunta a producción (`api.somosvolvia.com`, `app.somosvolvia.com`).

## 3. Publicar en Chrome Web Store

1. `cd apps/extension && pnpm zip` genera `.output/volvia-biz-<versión>-chrome.zip`.
2. [Panel de desarrollador](https://chrome.google.com/webstore/devconsole) (pago único de
   5 USD) → Nuevo elemento → subir el zip.
3. Ficha: categoría «Productividad», idioma español. Capturas de 1280×800 de búsqueda, sellar y
   resultado.
4. Justificación de permisos:
   - `storage`: guardar la sesión y los clientes recientes en este navegador.
   - `contextMenus`: «Buscar en Volvia» sobre un número seleccionado.
   - Host `api.somosvolvia.com`: la API de Volvia, el único sitio al que habla la extensión.
     No lee ni modifica las páginas que se visitan.
5. Privacidad: enlazar `https://somosvolvia.com/privacidad`. Datos tratados: el correo de la
   cuenta del negocio y los datos de los clientes, que se muestran enmascarados. Nada se vende
   ni se comparte.
6. El ID de la extensión queda fijo al publicarla. No hace falta registrarlo en la API.

Para subir de versión hay que cambiar `version` en `apps/extension/package.json`.

## 4. Publicar en Safari (Mac App Store)

Safari exige empaquetar la extensión dentro de una app de macOS.

```bash
cd apps/extension
pnpm safari:project        # build MV3 + xcrun safari-web-extension-converter → ./safari
open "safari/Volvia Biz/Volvia Biz.xcodeproj"
```

- Bundle ID de la app: `co.volvia.biz.safari` (la extensión hereda `.Extension`). Hay que
  registrarlo en el portal de Apple con la misma cuenta de [APP-STORE.md](APP-STORE.md).
- En Xcode: equipo de firma, categoría «Business» y ícono (reutiliza
  `apps/ios/Resources/Assets.xcassets/AppIcon.appiconset`).
- Prueba local: Safari → Ajustes → Avanzado → «Mostrar funciones para desarrolladores». Luego
  Desarrollo → «Permitir extensiones sin firmar», ejecutar la app desde Xcode y activar la
  extensión en Ajustes → Extensiones.
- Archivar y subir desde Xcode (Product → Archive → Distribute App → App Store Connect).
  Después, en App Store Connect: ficha de macOS, capturas de 1280×800 y revisión.
- La carpeta `safari/` se genera y está en `.gitignore`. Hay que regenerarla con
  `pnpm safari:project` en cada versión.

## 5. Checklist antes de anunciarla

- [ ] Migración `0013_remote_stamping` aplicada en producción (`pnpm db:migrate` con la URL de
      prod, como en [DEPLOYMENT.md](DEPLOYMENT.md)).
- [ ] API y panel desplegados (rutas `/v1/remote/*`, `/v1/auth/device/*`, página
      `/extension/conectar`).
- [ ] Spec `tests/e2e/specs/remote-stamping.spec.ts` en verde sobre la pila aislada.
- [ ] Ficha de Chrome publicada y enlace puesto en Panel → Equipo → Sellos a distancia.
- [ ] App de Safari aprobada.
