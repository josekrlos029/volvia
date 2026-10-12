# Volvia Biz en Google Play

El paso a paso para publicar la app Android (`apps/android`, paquete `co.volvia.biz`)
y todo lo que pide Play Console, listo para copiar. La guía de Apple es
[APP-STORE.md](APP-STORE.md); lo común a las dos está en [APPS-NATIVAS.md](APPS-NATIVAS.md).

## 1. Lo que ya está en el repo

| Qué | Dónde |
|---|---|
| Bundle firmado para subir | `apps/android/app/build/outputs/bundle/release/app-release.aab` (se regenera con `./gradlew :app:bundleRelease`) |
| Textos de la ficha (es-419 y en-US) | `apps/android/store/listing/<idioma>/` |
| Icono de la ficha, 512×512 | `apps/android/store/out/play-icon-512.png` |
| Gráfico destacado, 1024×500 | `apps/android/store/out/feature-graphic-1024x500.png` |
| 6 capturas de teléfono, 1080×1920, por idioma | `apps/android/store/out/screenshots/<idioma>/` |
| QR de la tarjeta demo para el revisor | `apps/android/store/out/review/demo-card-sheet.png` |

`store/out/` y `store/raw/` no se versionan. Para regenerarlos: `node apps/android/store/icon.mjs`
(icono y gráfico) y, con el stack aislado en `:8081` y el build debug instalado,
`bash apps/android/store/capture.sh && node apps/android/store/frame.mjs` (capturas).

## 2. La clave de subida

La clave está en `~/volvia-keys/volvia-upload.jks` y sus contraseñas en
`apps/android/keystore.properties`, que Gradle lee para firmar el release. Ninguno de
los dos está en git. Hay una copia de las propiedades en `~/volvia-keys/`.

**Respáldala hoy**: guarda `volvia-upload.jks` y `keystore.properties` en tu gestor de
contraseñas o en un lugar cifrado fuera de este Mac. Con Play App Signing, perder la
clave de subida tiene arreglo (soporte de Google la cambia), pero tarda días.

Huellas de la clave de subida:

```
SHA-1:   31:2B:14:3A:3E:E8:E2:7C:32:41:9C:42:B5:4F:13:75:4C:1E:E0:D1
SHA-256: 28:91:25:9C:AF:91:83:F0:09:01:97:59:7E:71:C2:20:57:4C:D5:8C:F8:A1:63:D6:BF:0C:43:A8:6D:AC:32:6A
```

## 3. Cuenta de Play Console

1. https://play.google.com/console → crear cuenta de desarrollador (25 USD, pago único).
2. Elige **Organización** si Volvia tiene número D-U-N-S. Las cuentas **personales**
   creadas desde noviembre de 2023 tienen que hacer una prueba cerrada con al menos 12
   testers durante 14 días seguidos antes de poder pedir acceso a producción.
3. Verifica identidad y el teléfono de contacto. Puede tardar unos días.

## 4. Crear la app

**Todas las apps → Crear app**:

| Campo | Valor |
|---|---|
| Nombre | Volvia Biz |
| Idioma predeterminado | Español (Latinoamérica) – es-419 |
| App o juego | App |
| Gratis o de pago | Gratis |
| Declaraciones | Acepta las políticas y las leyes de exportación de EE. UU. |

## 5. Configurar la app (panel → "Configura tu app")

### Acceso a la app
**Todas o algunas funciones están restringidas** → añade instrucciones:

- Nombre: `Cuenta demo para revisión`
- Usuario / contraseña: los de la cuenta del negocio **Volvia Demo** en producción
  (la misma que preparaste para App Review).
- Otras instrucciones (en inglés, 486 de 500 caracteres; pégalo tal cual):

```
Staff-only app; accounts come from the Volvia dashboard (no sign-up). Use the login above.
1. Scan this QR from another screen: https://api.qrserver.com/v1/create-qr-code/?data=https://tarjeta.somosvolvia.com/c/k8iAbh372Doo5s8fbQwGx-JbPszGzwdX
2. Each scan adds a stamp; the 4th shows the reward and "Entregar ahora".
3. Top-right icon: account, pending stamps, sign out.
4. Airplane mode + scan: "Sello guardado", sent once online.
Camera only reads the QR on-device; no images stored.
```

Play no deja adjuntar imágenes. El enlace del paso 1 dibuja el QR de la tarjeta demo, el
mismo de `out/review/demo-card-sheet.png`. La explicación larga (modo avión, uso de la
cámara) ya está en la ficha y en la política de privacidad.

### Anuncios
**No, mi app no contiene anuncios.**

### Clasificación del contenido
Correo de contacto `hola@somosvolvia.com`. Categoría: **Todos los demás tipos de apps**
(utilidades, productividad, comunicación u otro). A todo **No**: violencia, contenido
sexual, lenguaje, sustancias, juegos de azar, interacción entre usuarios, compartir
ubicación, compras digitales, navegador web. Resultado esperado: PEGI 3 / Para todos.

### Público objetivo
Edad: **18 años o más** solamente. ¿Atrae a niños sin querer? **No**.

### Seguridad de los datos

| Pregunta | Respuesta |
|---|---|
| ¿Recopila o comparte datos de usuario de los tipos requeridos? | Sí |
| ¿Todos los datos se encriptan en tránsito? | Sí (solo HTTPS) |
| ¿Cómo crean cuenta los usuarios? | **Mi app no permite que los usuarios creen una cuenta** (las crea el negocio en el panel web). Métodos de acceso: usuario y contraseña, y OAuth (Google) |
| ¿Los usuarios pueden pedir que se borren sus datos? | Sí, escribiendo a hola@somosvolvia.com o pidiéndolo al negocio |

Tipos de datos, todos **recopilados**, **no compartidos**, **no efímeros**,
**obligatorios**, finalidad **Funcionalidad de la app** y **Administración de la cuenta**:

- Información personal → **Nombre**
- Información personal → **Dirección de correo electrónico**
- Información personal → **ID de usuario**

Nada más: ni fotos ni vídeos (la cámara decodifica el QR en el teléfono y no sube
imágenes), ni ubicación, ni actividad en apps, ni diagnósticos, ni identificadores de
dispositivo. La app no usa el ID de publicidad; su manifiesto no pide `AD_ID`.

### Resto de declaraciones

| Sección | Respuesta |
|---|---|
| Apps del Gobierno | No |
| Funciones financieras | Mi app no ofrece funciones financieras |
| Salud | Mi app no tiene funciones de salud |
| App de noticias | No |
| ID de publicidad | No |
| Política de privacidad | https://somosvolvia.com/es/privacidad |

## 6. Ficha de Play Store (Crecer → Presencia en Play Store → Ficha principal)

Para **es-419** y luego **Agregar idioma → Inglés (Estados Unidos)**:

| Campo | Archivo |
|---|---|
| Nombre (30) | `listing/<idioma>/title.txt` |
| Descripción breve (80) | `listing/<idioma>/short_description.txt` |
| Descripción completa (4000) | `listing/<idioma>/full_description.txt` |
| Icono | `out/play-icon-512.png` |
| Gráfico destacado | `out/feature-graphic-1024x500.png` |
| Capturas de teléfono | las 6 de `out/screenshots/<idioma>/`, en orden |

Capturas de tablet: no hacen falta; la app es para teléfono.

**Configuración de la ficha**: categoría **Empresa** (Business); etiquetas: Empresa,
Productividad; correo `hola@somosvolvia.com`; sitio web `https://somosvolvia.com`.

## 7. Primera versión: prueba interna

1. **Pruebas → Prueba interna → Crear versión**.
2. Acepta **Firma de apps de Play** (Google guarda la clave con la que se distribuye la
   app; tú solo firmas con la de subida).
3. Sube `app-release.aab`. Notas de la versión: `listing/<idioma>/release_notes.txt`.
4. **Testers**: crea una lista con tu correo y los del equipo; copia el enlace de
   participación, ábrelo en el teléfono e instala desde Play.

### Google Sign-In con la clave de Play
Las copias instaladas desde Play van firmadas con la clave de **Play App Signing**, no
con la tuya. **Integridad de la app → Firma de apps** muestra su SHA-1. Crea en Google
Cloud (proyecto `298986937091`) otro cliente OAuth tipo **Android** con paquete
`co.volvia.biz` y esa huella. Sin él, "Entrar con Google" falla en las copias de Play
(el correo y contraseña sí funcionan). Haz lo mismo con la SHA-1 de la clave de subida
(sección 2) si vas a instalar builds release firmados en local.

Prueba en el teléfono instalado desde Play: entrar con correo, entrar con Google,
escanear la tarjeta demo, entregar la recompensa, modo avión.

## 8. Producción y revisión

1. Si la cuenta es personal: **Prueba cerrada** con 12+ testers durante 14 días y luego
   **Solicitar acceso a producción**. Si es de organización, sigue directo.
2. **Producción → Países/regiones**: al menos Colombia, México, España y Estados Unidos.
3. **Producción → Crear versión → Agregar desde biblioteca** (el mismo bundle de la
   prueba) → **Revisar versión → Iniciar lanzamiento**.
4. **Resumen de publicación → Enviar cambios a revisión**. La primera revisión suele
   tardar de unos días a una semana.

## 9. Antes de enviar (checklist)

- [ ] Clave de subida respaldada fuera de este Mac.
- [ ] Negocio **Volvia Demo** en producción con su tarjeta: **4 sellos requeridos,
      0 minutos entre sellos y tope diario de 10 o más** (con los valores por defecto el
      segundo escaneo del revisor falla con "Ya tiene un sello muy reciente").
- [ ] Credenciales de la cuenta demo pegadas en "Acceso a la app".
- [ ] Cliente OAuth Android con la SHA-1 de Play App Signing.
- [ ] Probado en un teléfono real instalado desde la prueba interna.

## 10. Actualizaciones

Sube `versionCode` (y `versionName`) en `apps/android/app/build.gradle.kts`, ejecuta
`./gradlew :app:bundleRelease` y crea una versión nueva con ese `.aab`. Play rechaza un
`versionCode` repetido.
