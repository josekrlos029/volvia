# Publicar Volvia Biz en el App Store

Volvia Biz (`apps/ios`) es la app nativa del personal: entrar, escanear la tarjeta del
cliente, sumar el sello. Este documento es el camino completo desde esta Mac hasta
"Ready for Sale", en el orden en que conviene hacerlo. Primero se prueba en local, luego
se sube a TestFlight, y solo al final se envía a revisión.

Lo que el repo ya trae resuelto, para no buscarlo: el icono y la pantalla de arranque
(`apps/ios/Resources/Assets.xcassets`), el manifiesto de privacidad
(`Resources/PrivacyInfo.xcprivacy`), la URL de la API por configuración (Debug → localhost,
Release → `https://api.somosvolvia.com`), el soporte de iPad en vertical, el equipo de
firma (`DEVELOPMENT_TEAM` en `project.yml`), una cámara simulada que solo existe en el
simulador, y en `apps/ios/store/` los scripts que generan las capturas y los textos de la
ficha.

## 0. Qué es esta app para Apple

Una herramienta de uso interno para negocios que ya usan Volvia. No es para el público, no
tiene registro dentro de la app y no es un envoltorio de una web: la cámara es AVFoundation,
la sesión vive en el llavero y los sellos se guardan en disco antes de enviarse. Eso es lo
que la salva de la guía 4.2 (funcionalidad mínima) y lo que hay que decir, tal cual, en la
ficha y en las notas al revisor.

## 1. Lo que necesitas en esta Mac

| Cosa | Estado en esta máquina | Qué hacer |
|---|---|---|
| Apple Developer Program | Inscrito; Team ID `V69VG5K7D8` | Nada. Es el mismo equipo de los pases de Wallet |
| Xcode 26.2 | Instalado en `/Applications/Xcode.app` | `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` (una vez) |
| `xcodegen` | Instalado (`brew install xcodegen`) | Nada |
| Apple ID en Xcode | Comprobar | Xcode → Settings → Accounts → + → el Apple ID del equipo |
| iPhone físico | "iPhone de Jose" emparejado | Conéctalo por cable la primera vez y acepta "Confiar" |
| Node 22 + pnpm | Instalados | Nada |

Sin el `xcode-select`, `xcodebuild` falla con "requires Xcode". Los scripts de `store/`
lo esquivan exportando `DEVELOPER_DIR`, pero Xcode como app lo necesita.

Genera el proyecto siempre desde `project.yml`; el `.xcodeproj` no se versiona:

```bash
cd apps/ios && xcodegen generate && open VolviaBiz.xcodeproj
```

## 2. Probar en local antes de nada

### 2.1 Un backend que no sea producción

El `.env` de la raíz apunta a la base de datos de producción. Un `pnpm dev` normal levanta
la API en :8080 contra esa base, y cualquier sello que pruebes desde el simulador queda
grabado en un negocio real. La receta segura es una API aparte, en :8081, contra una base
local separada:

```bash
pnpm infra:up                                         # postgres, redis, mailpit, s3 local
docker compose -f infra/docker-compose.yml exec postgres \
  psql -U volvia -c 'create database volvia_e2e'      # solo la primera vez
cp apps/ios/local-api.env.example apps/ios/.env.local # .env.local está en .gitignore

set -a; source apps/ios/.env.local; set +a            # exporta TODO; el .env raíz queda ignorado
pnpm db:migrate && pnpm db:seed
(cd apps/api && pnpm exec tsx src/main.ts)            # API en http://localhost:8081
```

`db:seed` aquí es seguro porque `DATABASE_URL` ya está exportada y dotenv no la pisa.
Nunca lo corras en una terminal donde no hayas hecho el `source`.

El seed deja tres negocios; la contraseña es `volvia-local-2026` en todos:

| Correo | Negocio |
|---|---|
| hola@cafe-raices.test | Café Raíces |
| hola@burger-train.test | Burger Train |
| hola@barberia-nueve.test | Barbería Nueve |

Y un token de tarjeta real para escanear, del negocio que vayas a usar:

```bash
docker compose -f infra/docker-compose.yml exec postgres psql -U volvia -d volvia_e2e -c \
  "select cc.token from customer_cards cc join organizations o on o.id = cc.org_id where o.slug = 'cafe-raices' limit 1"
```

### 2.2 En el simulador, con la cámara simulada

El simulador no tiene cámara. En lugar de una pantalla negra, los builds de simulador
muestran una foto y un botón "Simular lectura" que entrega al escáner el contenido de la
variable `VOLVIA_SIM_SCAN` (por defecto, una URL de tarjeta de demostración). Nada de eso
se compila para un iPhone real: está bajo `#if targetEnvironment(simulator)` en
`Sources/Features/ScannerView.swift` y `Sources/Core/SimulatorFixtures.swift`.

1. En Xcode, Product → Scheme → Edit Scheme → Run → Arguments → Environment Variables:
   - `VOLVIA_API_URL` = `http://localhost:8081`
   - `VOLVIA_SIM_SCAN` = `https://tarjeta.somosvolvia.com/c/<token del paso 2.1>`
2. Destino: iPhone 17 Pro Max. ⌘R.
3. Entra con `hola@cafe-raices.test`. Pulsa "Simular lectura": debe aparecer el nombre
   del cliente y "N de M sellos". Vuelve a pulsar: un sello más. Pulsa varias veces hasta
   completar la tarjeta para ver "¡Ganó …!" y "Entregar ahora".
4. Pantalla de cuenta (icono arriba a la derecha): nombre, negocio, cola, cerrar sesión.
5. Sin conexión: el simulador no tiene modo avión, así que para la API (Ctrl-C en su
   terminal) y simula otra lectura. Debe decir "Sello guardado" y la cabecera "1 por
   enviar". Arranca la API otra vez, manda la app a segundo plano y vuelve: la cola se vacía.
6. Repite el arranque en "iPad Pro 13-inch (M5)" para ver que la app se ve bien en iPad en
   vertical (gira el simulador con ⌘← : no debe rotar a horizontal).

Para ver una pantalla concreta sin tocar nada, la variable `VOLVIA_SIM_STATE` fija el estado
al arrancar: `login`, `aim`, `stamped`, `reward`, `queued`, `failed` o `account`. Es lo que
usa `store/capture.sh` para las capturas; mientras está puesta la app no toca la red.

### 2.3 Tests unitarios

```bash
cd apps/ios && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild test -scheme VolviaBiz -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max'
```

Veinte tests: cola offline, parseo del código y clasificación de errores.

### 2.4 En tu iPhone, con la cámara de verdad

La API local no es `localhost` desde el teléfono. Dos opciones:

- **Contra la API aislada**: en la misma red wifi, pon en el esquema
  `VOLVIA_API_URL` = `http://<IP de la Mac>:8081` (`ipconfig getifaddr en0`). Como es
  `http`, iOS lo permite solo en builds Debug. Elige "iPhone de Jose" como destino y ⌘R. La
  primera vez el teléfono pide confiar en el desarrollador: Ajustes → General → VPN y
  gestión de dispositivos → tu Apple ID → Confiar.
- **Contra producción**, que es la prueba que importa antes de publicar: Edit Scheme → Run
  → Build Configuration → Release, quita las variables de entorno, ⌘R. Entra con una cuenta
  real (o con la de "Volvia Demo" del paso 5) y escanea una tarjeta real desde otro
  teléfono o desde la pantalla de la Mac. Prueba también el modo avión.

Para escanear, saca el QR de una tarjeta en pantalla: en el stack aislado, abre
`http://localhost:3012/c/<token>` si levantas `apps/pass` con el mismo env
(`cd apps/pass && pnpm next dev --port 3012`), o genera un PNG con
`VOLVIA_REVIEW_URL=<url> node apps/ios/store/review-qr.mjs`.

## 3. Generar los recursos de la tienda

Todo sale de `apps/ios/store/`, un paquete Node independiente del workspace:

```bash
cd apps/ios/store
pnpm install --ignore-workspace          # una vez: resvg, sharp, qrcode
node icon.mjs                            # icono 1024 + variantes dark/tinted + logo de arranque
bash capture.sh                          # compila, arranca los dos simuladores y captura 6 estados × 2
node frame.mjs                           # compone las capturas de marketing en es-MX y en-US
```

Resultado en `store/out/`:

| Carpeta | Qué hay | Dónde va |
|---|---|---|
| `icon/AppIcon-1024-navy.png`, `-violet.png` | Dos variantes del icono, opacas, sin esquinas | La navy ya está instalada en el catálogo; `ICON_VARIANT=violet node icon.mjs` cambia |
| `icon/AppIcon-dark-1024.png`, `-tinted-1024.png` | Variantes iOS 18 | Catálogo (automático) |
| `screenshots/es-MX/iphone-6.9/01-aim.png … 06-login.png` | 1320×2868 | App Store Connect → Español (México) → iPhone 6.9" |
| `screenshots/es-MX/ipad-13/…` | 2064×2752 | → iPad 13" |
| `screenshots/en-US/…` | Igual, titulares en inglés | → English (U.S.) |
| `review/demo-card-sheet.png` | QR de la tarjeta demo (paso 5) | Adjunto en App Review Information |

Los tamaños son exactamente los que App Store Connect acepta: la captura cruda del iPhone
17 Pro Max ya es 1320×2868 y la del iPad Pro 13" es 2064×2752, y `frame.mjs` falla si
algo no mide eso. Apple escala el 6.9" a las pantallas menores; no hace falta subir más
tamaños. Los textos de cada pantalla están en `store/copy.json`; la app está en español en
ambas fichas (no tiene localización inglesa todavía), y la descripción en inglés lo dice.

El glifo de la "V" existe solo como PNG de 157 px incrustado en `assets/Icono * sin
Fondo.svg`; `lib.mjs` lo reconstruye con un contorno limpio a 1024. Si el diseñador entrega
el vector, basta con cambiar `glyphMask` en `lib.mjs` para renderizarlo con resvg.

## 4. Textos de la ficha

Listos para pegar en `apps/ios/store/metadata/<idioma>/`:

| Archivo | Campo en App Store Connect | Límite |
|---|---|---|
| `name.txt` | Name | 30 |
| `subtitle.txt` | Subtitle | 30 |
| `promotional_text.txt` | Promotional Text (editable sin nueva revisión) | 170 |
| `description.txt` | Description | 4000 |
| `keywords.txt` | Keywords (separadas por coma, sin repetir el nombre) | 100 |
| `release_notes.txt` | What's New in This Version | 4000 |
| `support_url.txt`, `marketing_url.txt`, `privacy_url.txt` | Support URL, Marketing URL, Privacy Policy URL | |
| `copyright.txt` | Copyright | |

Y `store/review/notes.md` tiene las notas para el revisor, las respuestas de App Privacy,
la clasificación por edad y el resto de campos, con los valores decididos.

## 5. El negocio de demostración para Apple

El revisor necesita entrar y escanear algo. Sin cuenta demo el rechazo es automático
(guía 2.1, "Information Needed"). Esto lo haces tú en producción, desde el panel:

1. Regístrate en https://app.somosvolvia.com con un correo que controles (por ejemplo
   `review@somosvolvia.com`). Negocio: "Volvia Demo".
2. Crea una tarjeta con **3 sellos** y una recompensa ("Café gratis"). Pocos sellos para
   que el revisor vea la recompensa sin escanear ocho veces. En las reglas de la tarjeta
   pon **0 minutos entre sellos** y **tope diario 10**: con los valores por defecto (30
   minutos, 2 al día) el segundo escaneo del revisor falla con "Ya tiene un sello muy
   reciente" y eso acaba en un rechazo 2.1.
3. Únete tú mismo como cliente desde la página pública de la tarjeta y copia el token de
   la URL `https://tarjeta.somosvolvia.com/c/<token>`.
4. `VOLVIA_REVIEW_TOKEN=<token> node apps/ios/store/review-qr.mjs`.
5. Prueba el ciclo completo con esa cuenta en TestFlight (paso 7) antes de enviar.

Esa cuenta se queda viva mientras la app esté publicada: Apple vuelve a entrar en cada
actualización.

## 6. App ID y registro en App Store Connect

1. https://developer.apple.com/account → Certificates, Identifiers & Profiles →
   Identifiers → + → App IDs → App. Description "Volvia Biz", Bundle ID **explícito**
   `co.volvia.biz`. Sin capabilities. (Xcode lo crearía solo al archivar, pero verlo
   registrado evita sorpresas.)
2. https://appstoreconnect.apple.com → Mis apps → + → Nueva app:
   - Plataformas: iOS
   - Nombre: Volvia Biz (si está tomado en la tienda, "Volvia Biz · Sellos")
   - Idioma principal: Español (México)
   - Bundle ID: co.volvia.biz
   - SKU: `volvia-biz-ios`
   - Acceso de usuario: Acceso total
3. En App Information → Localizable Information → + → English (U.S.), para la segunda ficha.
4. Agreements, Tax, and Banking: el acuerdo de **apps gratuitas** tiene que estar aceptado
   (lo está si ya aparece "Free Apps: Active"). Para una app gratis no hacen falta datos
   bancarios ni fiscales.

## 7. Archivar, subir y TestFlight

### 7.1 Desde Xcode (la vía normal)

1. `cd apps/ios && xcodegen generate && open VolviaBiz.xcodeproj`.
2. Destino: **Any iOS Device (arm64)**. Product → **Archive**. Con firma automática,
   Xcode crea el certificado "Apple Distribution" y el perfil de App Store al vuelo; te
   pedirá la contraseña del llavero.
3. Se abre el Organizer. **Validate App** primero: detecta icono, manifiesto de privacidad
   u orientaciones de iPad mal antes de subir nada. Luego **Distribute App → App Store
   Connect → Upload**, con "Upload your app's symbols" marcado y "Manage version and build
   number" desmarcado (las versiones se controlan en `project.yml`).
4. Llega un correo "has completed processing" en 5 a 30 minutos. Si en vez de eso llega
   un aviso ITMS-9xxxx, el texto dice qué falta; los que ya están cubiertos: 91053 (APIs
   con motivo → `PrivacyInfo.xcprivacy`), 90000-series de icono (catálogo con los tres
   1024), cifrado (`ITSAppUsesNonExemptEncryption = false`).

### 7.2 Por línea de comandos (opcional)

```bash
cd apps/ios && export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcodebuild -scheme VolviaBiz -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/VolviaBiz.xcarchive -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath build/VolviaBiz.xcarchive \
  -exportOptionsPlist store/ExportOptions.plist -exportPath build/export -allowProvisioningUpdates
```

`ExportOptions.plist` sube directamente a App Store Connect (`destination: upload`). Sin
sesión de Xcode con tu Apple ID necesita una App Store Connect API key
(`-authenticationKeyPath`, `-authenticationKeyID`, `-authenticationKeyIssuerID`).

### 7.3 TestFlight

1. App Store Connect → tu app → TestFlight. La build aparece cuando termina de procesarse.
2. Internal Testing → + → grupo "Equipo" → añade tu Apple ID (tiene que estar en Users and
   Access). La primera build pregunta por el cifrado; responde "No" (ya está en el plist).
3. En el iPhone, instala la app TestFlight, acepta la invitación y abre Volvia Biz.
4. Esto es un build de tienda contra producción: entra con "Volvia Demo", escanea el QR de
   `demo-card-sheet.png`, completa la tarjeta, prueba el modo avión. Si algo falla aquí,
   fallará en la revisión.

Las builds de TestFlight caducan a los 90 días.

## 8. Rellenar la versión 1.0

En App Store Connect → tu app → iOS App → 1.0 Prepare for Submission:

1. **Capturas**: arrastra `out/screenshots/es-MX/iphone-6.9/*.png` al hueco de iPhone
   6.9" (hasta 10; van las 6 en orden) y `ipad-13/*.png` al de iPad 13". Cambia el idioma
   arriba a English (U.S.) y repite con `en-US`.
2. **Promotional Text, Description, Keywords, Support URL, Marketing URL**: de
   `metadata/<idioma>/`.
3. **Version**: 1.0. **Copyright**: 2026 Volvia.
4. **Build**: + → la build de TestFlight.
5. **General App Information** (nivel app, no versión): Subtitle, Category (Business /
   Productivity), Content Rights (no third-party content), Age Rating (todo No → 4+),
   Privacy Policy URL.
6. **App Privacy** (sección aparte): "Yes, we collect data" → Email, Name, User ID, los
   tres vinculados al usuario, uso App Functionality, sin tracking. Tabla exacta en
   `store/review/notes.md`.
7. **App Review Information**: Sign-in required ✓, correo y contraseña de "Volvia Demo",
   tu nombre, teléfono y correo de contacto, las notas de `notes.md` pegadas, y el adjunto
   `demo-card-sheet.png`.
8. **Version Release**: "Manually release this version". Así apruebas y publicas cuando
   quieras.
9. **Pricing and Availability**: Free; todos los países (o al menos Colombia, México,
   Estados Unidos y España). Si prefieres que no aparezca en búsquedas, Apple ofrece
   distribución **Unlisted** (solo por enlace), pensada justo para apps de personal; se
   pide con un formulario desde esa misma pantalla y tarda unos días.

**Add for Review → Submit to App Review.**

## 9. La revisión

Estados: Waiting for Review → In Review → Pending Developer Release (si elegiste manual)
→ Ready for Sale. Lo habitual son 24 a 48 horas; la primera versión a veces más. Las
preguntas del revisor llegan por App Store Connect (Resolution Center) y por correo; se
responden ahí mismo, con capturas si hace falta, sin resubir la build salvo que pidan un
cambio de código.

Rechazos previsibles y la respuesta que ya está preparada:

| Guía | Qué dirían | Respuesta |
|---|---|---|
| 2.1 Information Needed | "No pudimos entrar" / "no hay nada que escanear" | La cuenta demo y el QR adjunto; comprueba que la cuenta sigue viva |
| 4.2 Minimum Functionality | "Parece un envoltorio web" | Cámara AVFoundation, llavero, cola offline en disco; no hay WebView |
| 5.1.1 (v) Login sin registro | "La app exige cuenta y no deja crearla" | App B2B; las cuentas las crea el negocio en el panel web; lo explica la ficha |
| 5.1.1 (v) Borrado de cuenta | "No hay forma de borrar la cuenta" | No se crean cuentas en la app; se borran desde el panel o por correo; está en las notas |
| 2.3.3 Capturas | "No reflejan la app" | Son capturas reales del simulador con un marco; nada inventado |
| 2.4.1 iPad | "No funciona en iPad" | Probada en iPad Pro 13" en vertical; `UIRequiresFullScreen` evita la exigencia de todas las orientaciones |
| 5.1.2 Privacidad | "Las etiquetas no coinciden" | App Privacy = `PrivacyInfo.xcprivacy` = lo que la API recibe (correo, nombre, id) |

## 10. Después

- **Publicar**: con liberación manual, botón "Release this version" cuando quieras.
- **Siguiente versión**: sube `MARKETING_VERSION` (1.1) y `CURRENT_PROJECT_VERSION` (2, 3,
  …) en `apps/ios/project.yml`, `xcodegen generate`, archiva y sube. El número de build
  tiene que crecer en cada subida, aunque la versión sea la misma.
- **Crashes**: Xcode → Window → Organizer → Crashes, con los símbolos que se subieron.
- **Renovación**: el Apple Developer Program caduca cada año; si caduca, la app desaparece
  de la tienda hasta renovar.
- **La cuenta demo** sigue siendo necesaria en cada revisión.
