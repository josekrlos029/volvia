# App Review Information — plantilla

Pega el bloque en inglés en App Store Connect → tu app → versión 1.0 → **App Review
Information → Notes**, y rellena los huecos. Marca **Sign-in required** y pon las
credenciales de la cuenta demo. Adjunta `out/review/demo-card-sheet.png` (botón
"Attachment").

## Antes de enviar

- [x] Negocio **Volvia Demo** creado en producción desde https://app.somosvolvia.com
      (cuenta nueva, correo que controles, p. ej. `review@somosvolvia.com`).
- [ ] Una tarjeta de sellos activa en ese negocio con pocos sellos requeridos (4) y una
      recompensa, para que el revisor vea la recompensa sin escanear ocho veces.
      **Reglas de la tarjeta: tiempo entre sellos 0 minutos y tope diario 10 o más.** Los
      valores por defecto (30 min, 2 al día) harían que el segundo escaneo del revisor
      fallara con "Ya tiene un sello muy reciente".
- [x] Un cliente de prueba unido a esa tarjeta: `https://tarjeta.somosvolvia.com/c/k8iAbh372Doo5s8fbQwGx-JbPszGzwdX`.
- [x] `out/review/demo-card-sheet.png` generado (2026-10-10).
- [ ] Probaste tú el flujo completo con esa cuenta en TestFlight.

## Notes (en inglés, para el revisor)

```
Volvia Biz is a business-to-business tool for the STAFF of shops and cafés that run
their loyalty program on Volvia (somosvolvia.com). It is not a consumer app. Accounts
are created by the business owner in the web dashboard; there is no sign-up inside the
app, which is why the login screen has no "create account" option.

DEMO ACCOUNT (production, dedicated to App Review)
  Email:    REVIEW_EMAIL
  Password: REVIEW_PASSWORD

HOW TO TEST
1. Sign in with the demo account. The camera scanner opens.
2. Point the camera at the attached QR code (demo-card-sheet.png). Print it or open it
   on another screen. The app adds a stamp and shows the customer's name and progress.
3. Scan the same code again to add another stamp (the demo card has no cooldown). It
   needs 4 stamps; on the fourth scan the app shows the reward and a "Entregar ahora"
   (hand over) button.
4. Tap the account icon (top right) to see the account sheet, pending stamps and sign out.
5. Offline: enable Airplane Mode, scan the code → "Sello guardado" (stamp saved). Disable
   Airplane Mode and return to the app → the stamp is sent automatically.

CAMERA
The camera is used only to read the QR code on the customer's card (AVFoundation
metadata output). No photo or video is captured or stored.

NATIVE FUNCTIONALITY (guideline 4.2)
Native camera scanning, keychain session storage, and an on-device offline queue with
idempotent retries. The app is not a web wrapper.

ACCOUNT DELETION (guideline 5.1.1 v)
Accounts are provisioned and deleted by the business in the web dashboard
(Settings → Team). Any user can also request deletion at hola@somosvolvia.com.

The app interface is in Spanish (its market is Latin America). Contact for questions:
hola@somosvolvia.com.
```

## App Privacy (sección "App Privacy" de la app)

Responde **Yes, we collect data from this app** y marca:

| Dato | Categoría ASC | Uso | ¿Vinculado al usuario? | ¿Tracking? |
|---|---|---|---|---|
| Correo | Contact Info → Email Address | App Functionality | Sí | No |
| Nombre | Contact Info → Name | App Functionality | Sí | No |
| ID de usuario | Identifiers → User ID | App Functionality | Sí | No |

Nada más (sin ubicación, sin fotos, sin diagnósticos de terceros, sin compras).
Tracking: **No**. Coincide con `Resources/PrivacyInfo.xcprivacy`.

## Age Rating

Todas las preguntas en **None / No** → resultado **4+**. "Made for Kids": No.
Unrestricted web access: No. Gambling: No.

## Otros campos

| Campo | Valor |
|---|---|
| Categoría principal | Business |
| Categoría secundaria | Productivity |
| Precio | Free (acuerdo "Free Apps" aceptado en Agreements, Tax, and Banking) |
| Disponibilidad | Todos los países, o al menos Colombia, México, Estados Unidos y España |
| Copyright | 2026 Volvia |
| Content Rights | No contiene contenido de terceros |
| Advertising Identifier (IDFA) | No |
| Export Compliance | Ya contestado por `ITSAppUsesNonExemptEncryption = false` en el Info.plist |
| Version Release | Manually release this version (publicas tú cuando quieras) |
| Sign in with Apple | No aplica: solo login propio, sin terceros (guía 4.8) |
