# Volvia Biz, las apps del personal

Dos apps nativas, una por tienda, con el mismo trabajo: entrar, escanear la tarjeta del
cliente y sumar el sello. Nada más. Todo lo demás —diseñar la tarjeta, ver clientes,
lanzar campañas— sigue en el panel web.

| | iOS | Android |
|---|---|---|
| Código | `apps/ios`, Swift 6 y SwiftUI | `apps/android`, Kotlin y Compose |
| Cámara | AVFoundation | CameraX + ML Kit |
| Sesión | Llavero | EncryptedSharedPreferences |
| Mínimo | iOS 17 | Android 8 (API 26) |

## Levantarlas en local

```bash
# iOS. El proyecto se genera desde project.yml, no se edita a mano ni se versiona.
cd apps/ios && xcodegen generate && open VolviaBiz.xcodeproj

# Android.
cd apps/android && ./gradlew :app:installDebug
```

Si `xcodebuild` se queja de que no encuentra Xcode, es que las herramientas de línea de
comandos apuntan a otro sitio:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Las dos apuntan a la API local por defecto. En el emulador de Android, `localhost` es el
propio emulador, así que `BuildConfig.API_URL` usa `10.0.2.2`, que es la máquina de
verdad. En el simulador de iOS, `localhost` sí funciona, y la variable de entorno
`VOLVIA_API_URL` del esquema cambia el destino sin tocar código (los builds Release llevan
`https://api.somosvolvia.com` desde `project.yml`).

El simulador de iOS no tiene cámara. Los builds de simulador muestran una foto y un botón
"Simular lectura" que entrega al escáner el valor de `VOLVIA_SIM_SCAN`; con
`VOLVIA_SIM_STATE=stamped` (o `login`, `aim`, `reward`, `queued`, `failed`, `account`) la
app arranca en ese estado con datos ficticios y sin tocar la red. Nada de eso se compila
para un iPhone real. Ojo: el `.env` de la raíz apunta a producción; para probar contra una
API local usa el stack aislado de [APP-STORE.md](APP-STORE.md) §2.

## Por qué el sello se guarda antes de enviarse

El mostrador no se detiene cuando se cae el wifi. Un sello se escribe primero en la cola
local y se envía después, así que lo que ve el empleado nunca depende de la red y al
cliente, que está ahí delante, no se le pide que espere o que vuelva.

Cada sello lleva una clave de idempotencia generada una sola vez, en el mostrador, y
reutilizada en cada reintento. Eso es lo que hace seguro reintentar: el servidor repite
el resultado original en vez de sellar dos veces.

La cola se para en el primer fallo de red en lugar de recorrer los cuarenta pendientes:
si no hay conexión, intentar el resto solo gasta batería. Un sello que el servidor
rechaza para siempre —una tarjeta que ya no existe— no se borra en silencio: queda
visible en la pantalla de cuenta, porque alguien se lo tomó a un cliente de verdad.

## Publicarlas

**Apple.** El paso a paso completo, desde la prueba local hasta la revisión, está en
[APP-STORE.md](APP-STORE.md). Lo que el código ya resuelve: icono y pantalla de arranque,
manifiesto de privacidad, URL de producción en Release, iPad en vertical, equipo de firma
(`V69VG5K7D8`) y los scripts de `apps/ios/store/` que generan capturas y textos. Lo que no
se puede automatizar: la cuenta de demostración en producción para el revisor y los clics
en App Store Connect.

Apple rechaza por la norma 4.2 las apps que son solo un envoltorio de una web. Esta no lo
es —cámara nativa, llavero, cola en disco— pero la ficha de la tienda tiene que dejar
claro que es una herramienta para el personal de un negocio, no para el público.

**Google.** Una cuenta de Play Console (25 USD, pago único). La app se firma con Play App
Signing; la clave de subida se genera una vez y no se pierde nunca, porque sin ella no se
puede publicar una actualización. Pendiente de documentar con el mismo detalle.

**Para las dos.** Política de privacidad publicada —ya existe, en `/es/privacidad`—, una
ficha que explique que es una app de uso interno, y capturas de pantalla. La revisión
preguntará cómo se usa la cámara: la respuesta es que solo lee el código de la tarjeta del
cliente, y que no se guarda ninguna imagen.

## Pruebas

```bash
cd apps/ios && xcodebuild test -scheme VolviaBiz \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max'

cd apps/android && ./gradlew :app:testDebugUnitTest
```

Lo que se prueba es lo que puede perder el sello de alguien: la cola offline, el parseo
del código escaneado y la clasificación de errores. La interfaz no se prueba
automáticamente; para eso está el simulador.
