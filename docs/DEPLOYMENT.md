# Producción

Volvia corre en `somosvolvia.com` desde el 7 de octubre de 2026. Este documento dice dónde
vive cada pieza y cómo se publica un cambio.

## Dónde vive cada cosa

| Pieza | Dónde | Notas |
|---|---|---|
| Sitio de marketing | Vercel, proyecto `volvia-web` (`apps/web`) | `somosvolvia.com`; `www` redirige al dominio raíz |
| Panel | Vercel, proyecto `volvia-app` (`apps/app`) | `app.somosvolvia.com` |
| Tarjeta del cliente | Vercel, proyecto `volvia-pass` (`apps/pass`) | `tarjeta.somosvolvia.com` |
| API | Cloud Run, servicio `volvia-api` | `api.somosvolvia.com`, mínimo una instancia |
| Worker | Cloud Run, worker pool `volvia-worker` | Una instancia fija; no escucha en ningún puerto |
| Base de datos | Neon, AWS us-east-1 | URL *pooled* para la API, directa para migraciones |
| Redis | Redis Cloud, AWS us-east-1 | Sesiones, idempotencia, nonces, límites y colas |
| Archivos | Cloudflare R2, bucket `volvia-uploads` | Lectura pública en `files.somosvolvia.com` |
| Correo saliente | Resend por SMTP | Dominio `somosvolvia.com` verificado |
| Correo entrante | Cloudflare Email Routing | `hola@somosvolvia.com` se reenvía al Gmail del dueño |
| DNS | Cloudflare | Todo en DNS-only: Vercel y Google emiten sus propios certificados |

El proyecto de GCP es `somosvolvia-prod`, en la región `us-east4`, al lado de Neon y Redis.
Cada escaneo pasa por Redis, así que esa cercanía se nota en el mostrador.

Los secretos viven en Secret Manager y el servicio los lee con la cuenta
`volvia-runtime`: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`TOKEN_PEPPER`, `SMTP_PASS`, `STORAGE_ACCESS_KEY` y `STORAGE_SECRET_KEY`. El resto de la
configuración son variables normales del servicio.

## Publicar un cambio

**Las apps web** se publican solas con cada push a `main`. Vercel no reconstruye una app
si el commit no la toca.

**La API y el worker** comparten imagen. Desde la raíz del repo:

```bash
export CLOUDSDK_ACTIVE_CONFIG_NAME=volvia
REPO="us-east4-docker.pkg.dev/somosvolvia-prod/volvia/api"
TAG="$(git rev-parse --short HEAD)"
docker buildx build --platform linux/amd64 -f infra/Dockerfile.api -t "${REPO}:${TAG}" --push .
gcloud run deploy volvia-api --region us-east4 --image "${REPO}:${TAG}"
gcloud beta run worker-pools deploy volvia-worker --region us-east4 --image "${REPO}:${TAG}"
```

Escribe `"${REPO}:${TAG}"` con llaves: en zsh, `$REPO:latest` aplica el modificador `:l` y
publica la imagen en otro repositorio.

**Las migraciones** van antes de desplegar una imagen que las necesite:
`pnpm db:migrate`, con `DATABASE_URL_UNPOOLED` apuntando a la URL directa de Neon.

## Cuidado con el `.env` local

Si tu `.env` apunta a Neon y Redis de producción, `pnpm db:seed` y `pnpm db:reset` actúan
sobre producción. Para desarrollar, vuelve a los valores de `.env.example`, que usan los
contenedores locales.

## Redis sin cifrar

La base de Redis Cloud no tiene TLS activado, así que la conexión desde Cloud Run viaja
sin cifrar por internet. Solo la protege la contraseña. Para cifrarla hay que activar
*Transport layer security* en la base (plan de pago) y cambiar el secreto `REDIS_URL` a
`rediss://`. ioredis lo soporta sin cambios de código.

## Lo que todavía no está encendido

- **Wallet**: `WALLET_MODE=disabled`. Hace falta el Pass Type ID de Apple con su
  certificado y una cuenta de servicio de Google Wallet; los pasos están en
  [WALLET-SETUP.md](WALLET-SETUP.md).
- **Cobros**: `BILLING_ENABLED=false`. Faltan las llaves de producción de Stripe y Wompi,
  sus secretos de webhook y un precio por plan e intervalo.
- **Google OAuth**: falta el cliente, con `https://api.somosvolvia.com` en las URIs de
  callback.

## Lo que la API comprueba sola

Con `NODE_ENV=production` la API se niega a arrancar si encuentra los secretos de ejemplo,
el límite de peticiones apagado, cookies en `localhost`, orígenes en `http://` o URLs
apuntando a tu máquina. La comprobación vive en `unsafeForProduction`
(`apps/api/src/env.ts`) y está cubierta por pruebas.

## Cambiar el token del pase

`TOKEN_PEPPER` deriva el token de autenticación de cada pase de Apple. Cambiarlo invalida
todos los pases ya instalados: los dispositivos dejarán de poder actualizarse y habrá que
reinstalar. Elígelo una vez y no lo toques.
