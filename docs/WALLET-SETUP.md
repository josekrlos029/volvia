# Configuración de Apple Wallet y Google Wallet

Guía operativa para pasar de los certificados autofirmados de desarrollo
(`WALLET_MODE=stub`) a pases reales que un teléfono acepta (`WALLET_MODE=real`).

**Lo primero, para evitar gasto innecesario:**

| Necesitas | ¿Para qué? | ¿Obligatorio ahora? |
|---|---|---|
| Apple Developer Program (99 USD/año) | Firmar `.pkpass` | Sí, si quieres Apple Wallet |
| App Store Connect | Publicar apps nativas | **No.** Los pases no pasan por ahí |
| Google Cloud + Wallet API (gratis) | Emitir objetos de Google Wallet | Sí, si quieres Google Wallet |
| Google Play Console (25 USD, único) | Publicar la app de staff en Play | **No** ahora. El escáner es PWA |

App Store Connect y Play Console **no intervienen en las tarjetas de
fidelización**. Solo hacen falta el día que quieras que el escáner del staff sea
una app instalable desde las tiendas. Eso está al final del documento.

---

## Parte 1 — Apple Wallet (PassKit)

Todo esto ocurre en <https://developer.apple.com/account>, no en App Store
Connect.

### 1.1 Inscribirse en el Apple Developer Program

<https://developer.apple.com/programs/enroll/>

Elige el tipo de cuenta con cuidado, porque **no se puede cambiar después**:

- **Individual**: se aprueba en horas. El pase mostrará tu nombre personal como
  emisor en la pantalla de "detalles del pase".
- **Organización**: muestra "Volvia" como emisor. Exige un número **D-U-N-S** de
  la empresa (gratis, se solicita en el propio formulario de Apple) y la
  verificación tarda de días a semanas.

Para un producto que venderás a otros negocios, la cuenta de organización es la
correcta. Si tienes prisa, empieza con Individual para probar y migra después:
implica regenerar el certificado y volver a emitir los pases.

### 1.2 Anotar el Team ID

En la cuenta → **Membership details** → **Team ID**. Son 10 caracteres
alfanuméricos, por ejemplo `A1B2C3D4E5`.

→ va a `APPLE_TEAM_ID`.

### 1.3 Crear el Pass Type ID

**Certificates, Identifiers & Profiles** → **Identifiers** → botón **+** →
**Pass Type IDs** → Continue.

- Description: `Volvia Loyalty Card`
- Identifier: `pass.co.volvia.loyalty`

El identificador **tiene que empezar por `pass.`**. Usa exactamente esa cadena:
es la que ya está en `.env.example` y en el generador de certificados de
desarrollo, así que el resto encaja sin tocar nada.

→ va a `APPLE_PASS_TYPE_ID`.

### 1.4 Generar la CSR desde tu Mac

La clave privada se crea en tu máquina y **nunca sale de ella**. Apple solo firma
la parte pública.

Abre **Acceso a Llaveros** (Keychain Access) → menú **Acceso a Llaveros** →
**Asistente para certificados** → **Solicitar un certificado a una autoridad de
certificados…**

- Correo del usuario: tu correo de la cuenta de desarrollador
- Nombre común: `Volvia Pass Type ID`
- CA Email: déjalo vacío
- Marca **Guardado en disco** y **Permitirme especificar la información de la
  pareja de claves**
- Siguiente: **2048 bits**, algoritmo **RSA**

Se guarda un `CertificateSigningRequest.certSigningRequest`.

### 1.5 Emitir y descargar el certificado

Vuelve al Pass Type ID que creaste → **Create Certificate** → sube la CSR →
**Continue** → **Download**. Obtienes un `pass.cer`.

Haz doble clic para instalarlo en el llavero.

### 1.6 Exportar el `.p12`

En Acceso a Llaveros, categoría **Mis certificados**, busca
`Pass Type ID: pass.co.volvia.loyalty`. Debe tener un triángulo desplegable con
la clave privada dentro; si no lo tiene, la CSR no se generó en esta máquina y
hay que repetir el paso 1.4.

Clic derecho → **Exportar** → formato **Intercambio de información personal
(.p12)** → guarda como `volvia-pass.p12` y **pon una contraseña**. Guárdala en tu
gestor de contraseñas: es `APPLE_PASS_KEY_PASSPHRASE`.

### 1.7 Convertir a PEM (que es lo que consume la API)

```bash
mkdir -p infra/certs

# Certificado público
openssl pkcs12 -in volvia-pass.p12 -clcerts -nokeys \
  -out infra/certs/pass-cert.pem

# Clave privada (te pedirá la contraseña del .p12 y luego una de salida:
# usa la MISMA para que APPLE_PASS_KEY_PASSPHRASE valga para ambas)
openssl pkcs12 -in volvia-pass.p12 -nocerts \
  -out infra/certs/pass-key.pem
```

Si usas el OpenSSL 3 de Homebrew en lugar del de macOS, añade `-legacy` a los dos
comandos: Keychain exporta el `.p12` con cifrados que OpenSSL 3 desactivó por
defecto y si no fallará con `unsupported`.

Comprueba que salió bien:

```bash
openssl x509 -in infra/certs/pass-cert.pem -noout -subject -issuer -enddate
```

El `subject` debe contener `UID=pass.co.volvia.loyalty` y el `issuer` te dice qué
generación de WWDR necesitas en el paso siguiente.

### 1.8 Certificado intermedio WWDR

Los pases se validan con la cadena completa, así que hace falta el intermedio de
Apple. Descárgalo de <https://www.apple.com/certificateauthority/> — para los
certificados que se emiten hoy es **Worldwide Developer Relations - G4**, pero
confirma con el `issuer` que imprimiste arriba.

```bash
curl -o /tmp/wwdr.cer https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
openssl x509 -inform der -in /tmp/wwdr.cer -out infra/certs/wwdr.pem
```

### 1.9 Notificaciones push de actualización de pase

Aquí no hay que crear nada nuevo: **el mismo certificado de Pass Type ID es el
certificado cliente de APNs** para actualizar pases. El worker reutiliza
`APPLE_PASS_CERT_PATH` / `APPLE_PASS_KEY_PATH` (no hay una variable aparte) y
envía por HTTP/2 a `api.push.apple.com` un cuerpo `{}` con el pass type id como
*topic* (`packages/wallet/src/apple/apns.ts`). Los tokens que APNs rechaza para
siempre (`410` o `BadDeviceToken`) se borran de `apple_pass_registrations`.

El push solo despierta al iPhone: luego pregunta qué seriales cambiaron y
descarga el pase. Por eso el worker marca `wallet_passes.updated_at` **antes**
de enviar el push.

### 1.10 Variables de entorno

```bash
WALLET_MODE=real
APPLE_PASS_TYPE_ID=pass.co.volvia.loyalty
APPLE_TEAM_ID=A1B2C3D4E5              # el tuyo del paso 1.2
APPLE_PASS_CERT_PATH=infra/certs/pass-cert.pem
APPLE_PASS_KEY_PATH=infra/certs/pass-key.pem
APPLE_PASS_KEY_PASSPHRASE=…           # la del paso 1.6
APPLE_WWDR_CERT_PATH=infra/certs/wwdr.pem
```

### 1.11 Probar en un iPhone real

```bash
curl -o prueba.pkpass http://localhost:8080/wallet/apple/pass/<token>
```

Envíatelo por correo o AirDrop y ábrelo en el iPhone. Debe aparecer la hoja
"Añadir a Wallet".

Dos motivos por los que un pase técnicamente válido es rechazado por el teléfono:

1. **MIME incorrecto.** Si lo sirves por HTTP tiene que ir con
   `Content-Type: application/vnd.apple.pkpass`. La API ya lo hace; ojo si metes
   un CDN o proxy delante.
2. **El `teamIdentifier` del `pass.json` no coincide con el del certificado.** Es
   el fallo más común y el mensaje de error del iPhone no lo dice.

Para actualizaciones automáticas por push, el `webServiceURL` del pase tiene que
ser **https con certificado válido** — `localhost` no sirve. Usa un túnel
(`cloudflared tunnel` o `ngrok`) apuntando a `:8080` y pon esa URL en
`PUBLIC_API_URL` mientras pruebas.

### 1.12 Caducidad

El certificado de Pass Type ID **caduca al año**. Cuando caduca no puedes firmar
pases nuevos ni actualizar los existentes; los ya instalados siguen visibles pero
congelados. Ponte un recordatorio de calendario a los 11 meses y repite los pasos
1.4 a 1.8.

---

## Parte 2 — Google Wallet

Dos consolas distintas, y las dos hacen falta.

### 2.1 Proyecto de Google Cloud y API

1. <https://console.cloud.google.com> → crear proyecto `volvia`
2. **APIs y servicios** → **Biblioteca** → busca **Google Wallet API**
   (`walletobjects.googleapis.com`) → **Habilitar**

### 2.2 Cuenta de servicio

**IAM y administración** → **Cuentas de servicio** → **Crear**

- Nombre: `volvia-wallet`
- No le asignes ningún rol de IAM: los permisos de Wallet no se conceden aquí
  sino en la consola de negocio del paso 2.4

Entra en la cuenta creada → pestaña **Claves** → **Agregar clave** → **Crear
clave nueva** → **JSON**. Se descarga un archivo. Guárdalo en
`infra/certs/google-wallet-sa.json` (esa ruta ya está en `.gitignore`).

Del JSON necesitas el campo `client_email`, que tiene la forma
`volvia-wallet@volvia.iam.gserviceaccount.com`.

### 2.3 Cuenta de emisor (Issuer)

<https://pay.google.com/business/console>

Regístrate y solicita una cuenta de emisor para Google Wallet. Te dan un
**Issuer ID**: un número largo, del estilo `3388000000022xxxxxx`.

→ va a `GOOGLE_WALLET_ISSUER_ID`.

### 2.4 Autorizar a la cuenta de servicio

En la misma consola de negocio → **Usuarios** → **Invitar usuario** → pega el
`client_email` del paso 2.2 con rol **Desarrollador** (o Administrador).

Sin este paso la API responde `403` aunque las credenciales sean correctas. Es el
error más frecuente de esta integración.

### 2.5 Modo demo y acceso a producción

Al principio la cuenta está en **modo demo**: solo las cuentas de Google que
registres explícitamente pueden guardar un pase. Cualquier otra ve un error.

En la consola de negocio → sección de Google Wallet API → añade los correos de
prueba (el tuyo y el de quien vaya a probar).

Cuando el producto esté listo, solicita **acceso de publicación** desde la misma
consola. Google revisa la marca y el diseño del pase. Suele tardar días.
**Empieza este trámite antes de tener clientes reales**, no el día del
lanzamiento.

### 2.6 Variables de entorno

```bash
GOOGLE_WALLET_ISSUER_ID=3388000000022xxxxxx
GOOGLE_WALLET_SA_EMAIL=volvia-wallet@volvia.iam.gserviceaccount.com
GOOGLE_WALLET_SA_KEY_PATH=infra/certs/google-wallet-sa.json
GOOGLE_WALLET_CLASS_PREFIX=volvia_prod
```

`GOOGLE_WALLET_CLASS_PREFIX` separa entornos dentro del mismo emisor. Los ids se
construyen como `<issuerId>.<prefix>_<orgId>`, así que con `volvia_dev` en local
y `volvia_prod` en producción las clases nunca se pisan.

**Ese prefijo no se puede cambiar después sin romper los pases ya emitidos**, del
mismo modo que `TOKEN_PEPPER` en Apple. Decídelo una vez.

### 2.7 Probar

```bash
curl -sI http://localhost:8080/wallet/google/save/<token>
```

Devuelve una redirección a `https://pay.google.com/gp/v/save/<jwt>`. Ábrela en un
Android con una de las cuentas de prueba del paso 2.5.

---

## Avisos por cercanía

Las dos wallets saben mostrar el pase solas cuando el cliente se acerca al negocio. No hay
que rastrear a nadie ni mandar pushes propios: basta con que el pase lleve las coordenadas
de las sedes. El dueño las fija en Ajustes → Sedes, con el botón "Usar mi ubicación actual"
(el GPS del navegador, pensado para hacerlo desde la puerta del local) o pegando un enlace
de Google Maps. No hace falta ninguna API de mapas.

| | iPhone | Android |
|---|---|---|
| Qué ve el cliente | Una sugerencia silenciosa en la pantalla de bloqueo, con el texto que generamos: "Estás cerca de X. Llevas 4/8 sellos." (o "¡Tienes una recompensa lista!"), en su idioma | Una notificación de Google Wallet con texto genérico; el texto y el radio los decide Google |
| Radio | Unos 100 m, lo fija iOS para tarjetas de tienda. `maxDistance` solo podría reducirlo, por eso no se manda | Unos 150 m, lo fija Google |
| Qué necesita el cliente | Tener el pase instalado | Pase guardado, notificaciones activas y ubicación precisa "siempre" para la app de Wallet |
| Campo del pase | `locations[]` en `pass.json` | `merchantLocations[]` en el LoyaltyObject (el campo `locations[]` existe pero está deprecado y ya no dispara avisos) |

Límites: 10 puntos por pase. Si un negocio tiene más sedes con coordenadas, van las 10
más antiguas.

Cuando cambian las coordenadas de una sede (o la sede se desactiva o se borra), la API
encola un `wallet.update` por cada tarjeta con pase instalado. El iPhone re-descarga el
pase con las nuevas `locations`; para Google el worker parchea `merchantLocations` en el
objeto. Como el resto de actualizaciones, el parche de Google solo sale con
`WALLET_MODE=real`.

Para probarlo en un iPhone real: pon la sede a menos de 100 m de donde estés, instala el
pase y bloquea el teléfono. La sugerencia aparece sin sonido y puede tardar unos minutos.
En Android, comprueba en la consola de Wallet que el objeto lleva `merchantLocations`.
Google no documenta si los avisos funcionan mientras la cuenta sigue en modo demo
(paso 2.5): si no llegan, es lo primero que descartar.

---

## Parte 3 — Tiendas de aplicaciones (más adelante)

Nada de esto hace falta para las tarjetas. Es solo para empaquetar el escáner del
staff (`apps/app`, ruta `/scan`) como app instalable.

### 3.1 Google Play — la ruta corta

`/scan` ya es una PWA instalable, así que la vía barata es **TWA (Trusted Web
Activity)**: un contenedor Android que abre tu propia web a pantalla completa,
sin barra de navegador.

1. **Play Console** (<https://play.google.com/console>), 25 USD pago único.
   Cuenta de **organización**: pide documento de constitución de la empresa y
   Google verifica la identidad. Desde 2023 las cuentas nuevas de tipo personal
   además exigen **12 testers durante 14 días** antes de poder publicar; las de
   organización no.
2. Generar el proyecto:
   ```bash
   npx @bubblewrap/cli init --manifest https://app.somosvolvia.com/manifest.webmanifest
   npx @bubblewrap/cli build
   ```
3. **Digital Asset Links**: publica en `https://app.somosvolvia.com/.well-known/assetlinks.json`
   la huella SHA-256 del certificado de firma. Sin esto la app abre con la barra
   de Chrome visible, que es exactamente lo que quieres evitar.
   La huella correcta es la de **Play App Signing** (Play Console → Integridad de
   la aplicación), no la de tu keystore local. Es el fallo clásico.
4. Ficha de la tienda: icono 512×512, gráfico destacado 1024×500, capturas de
   teléfono, política de privacidad publicada, y el formulario de **Seguridad de
   los datos** declarando que recoges correo y nombre.

### 3.2 App Store — la ruta larga

Apple **no acepta** envoltorios de web sin funcionalidad nativa propia (guía
4.2 de la App Review). Una TWA equivalente sería rechazada.

Para iOS hay que compilar de verdad: Expo o React Native reutilizando la lógica
de escaneo. Está fuera de esta iteración; la decisión que tomamos fue PWA
primero. Cuando toque:

1. Ya tendrás el Apple Developer Program de la parte 1, que cubre las dos cosas.
2. App Store Connect → **Mis apps** → **+** → nuevo bundle id
   `co.volvia.staff` (distinto del pass type id).
3. Subir con Xcode o `eas submit`, y pasar App Review.

---

## Orden recomendado

1. **Hoy**: inscripción en Apple Developer (la verificación de organización es lo
   que más tarda; arráncala ya) y proyecto de Google Cloud con la Wallet API.
2. **Cuando Apple apruebe**: pasos 1.3 a 1.10 y probar en un iPhone real.
3. **En paralelo**: emisor de Google Wallet y solicitud de acceso a producción,
   que también lleva revisión humana.
4. **Solo cuando el producto esté vendiéndose**: Play Console.
