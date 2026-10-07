# Producción

Nada de esto se ha ejecutado todavía. El sistema corre completo en local y esta es la lista
de lo que falta para sacarlo, pendiente de tu visto bueno.

## Lo que hay que crear

**Neon.** Una base y dos cadenas de conexión: la *pooled* para `DATABASE_URL` y la directa
para `DATABASE_URL_UNPOOLED`, que es la que usan las migraciones. El cliente ya detecta
Neon y activa TLS y el modo sin sentencias preparadas.

**Redis gestionado.** Sostiene sesiones, idempotencia, nonces de kiosko y límites. Debe
quedar en la misma región que Cloud Run: cada milisegundo aquí se paga en el escaneo.

**Cloud Run.** Dos servicios desde el mismo `infra/Dockerfile.api`: la API y el worker con
`--command node --args dist/worker.js`. La API con mínimo una instancia (arrancar en frío
un escaneo en el mostrador se siente mal); el worker puede escalar a cero.

**Vercel.** Tres proyectos apuntando al mismo repo, con `apps/web`, `apps/app` y
`apps/pass` como raíz.

**Almacenamiento.** Un bucket de GCS con el endpoint S3. El adaptador ya está detrás de
`STORAGE_*`.

**Correo.** Resend o similar, cambiando `SMTP_*`. En local todo cae en Mailpit.

## Lo que tienes que poner tú

- **Apple.** Un Pass Type ID y su certificado en Apple Developer, exportado como `.p12`.
  Hasta entonces `WALLET_MODE=stub` genera pases correctos que un iPhone rechaza.
- **Google Wallet.** Una cuenta de servicio con la API habilitada y el issuer ID.
- **Stripe.** Clave secreta, secreto de webhook y un precio por plan e intervalo.
- **Wompi.** Llaves de producción y los secretos de eventos e integridad.
- **Google OAuth.** Cliente y secreto, con el callback de la API en las URIs permitidas.

## Antes del primer despliegue

1. Genera secretos nuevos para `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` y `TOKEN_PEPPER`.
   Los locales están en el repositorio y no valen para producción.
2. Deja `RATE_LIMIT_ENABLED=true`. En local está en `false` para que la suite E2E pueda
   registrar muchos negocios desde una IP.
3. Pon `CORS_ORIGINS` con los dominios reales y `COOKIE_DOMAIN` con el dominio raíz.
4. Corre las migraciones contra la URL directa de Neon antes de levantar los servicios.

No hace falta que te acuerdes de los puntos 1 a 3: con `NODE_ENV=production` la API se
niega a arrancar si encuentra los secretos de ejemplo, el límite de peticiones apagado,
cookies en `localhost`, orígenes en `http://` o URLs apuntando a tu máquina. Falla al
arrancar, con la lista completa de lo que hay que corregir, en vez de quedarse sirviendo
con una configuración insegura. La comprobación vive en `unsafeForProduction`
(`apps/api/src/env.ts`) y está cubierta por pruebas.

## Cambiar el token del pase

`TOKEN_PEPPER` deriva el token de autenticación de cada pase de Apple. Cambiarlo invalida
todos los pases ya instalados: los dispositivos dejarán de poder actualizarse y habrá que
reinstalar. Elígelo una vez y no lo toques.
