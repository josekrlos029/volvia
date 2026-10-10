# Producción

Volvia corre en `somosvolvia.com` desde el 7 de octubre de 2026. Este documento dice dónde
vive cada pieza y cómo se publica un cambio.

## Dónde vive cada cosa

| Pieza | Dónde | Notas |
|---|---|---|
| Sitio de marketing | Vercel, proyecto `volvia-web` (`apps/web`) | `somosvolvia.com`; `www` redirige al dominio raíz |
| Panel | Vercel, proyecto `volvia-app` (`apps/app`) | `app.somosvolvia.com` |
| Tarjeta del cliente | Vercel, proyecto `volvia-pass` (`apps/pass`) | `tarjeta.somosvolvia.com` |
| API | Cloud Run, servicio `volvia-api` | `api.somosvolvia.com`, escala a cero; el primer request tras inactividad paga el arranque en frío |
| Trabajos en segundo plano | Cloud Scheduler, job `volvia-jobs-cron` | Llama a `POST /internal/jobs/cron` de la API cada minuto; no hay ningún proceso encendido todo el tiempo |
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
`TOKEN_PEPPER`, `JOBS_SECRET`, `SMTP_PASS`, `STORAGE_ACCESS_KEY` y `STORAGE_SECRET_KEY`. El resto de la
configuración son variables normales del servicio.

## Publicar un cambio

**Las apps web** se publican solas con cada push a `main`. Vercel no reconstruye una app
si el commit no la toca.

**La API** se construye y despliega desde la raíz del repo:

```bash
export CLOUDSDK_ACTIVE_CONFIG_NAME=volvia
REPO="us-east4-docker.pkg.dev/somosvolvia-prod/volvia/api"
TAG="$(git rev-parse --short HEAD)"
docker buildx build --platform linux/amd64 -f infra/Dockerfile.api -t "${REPO}:${TAG}" --push .
gcloud run deploy volvia-api --region us-east4 --image "${REPO}:${TAG}"
```

Escribe `"${REPO}:${TAG}"` con llaves: en zsh, `$REPO:latest` aplica el modificador `:l` y
publica la imagen en otro repositorio.

**Las migraciones** van antes de desplegar una imagen que las necesite:
`pnpm db:migrate`, con `DATABASE_URL_UNPOOLED` apuntando a la URL directa de Neon.

**Wallet** necesita las credenciales en la API, que firma el `.pkpass`, envía los push
de APNs y parchea los pases de Google. Se usan los secretos `APPLE_PASS_CERT`,
`APPLE_PASS_KEY`, `APPLE_WWDR_CERT`, `GOOGLE_WALLET_SA_KEY` y
`APPLE_PASS_KEY_PASSPHRASE`, montados como archivos en `/secrets/...` (`*_PATH`). Las
variables con el contenido inline (`APPLE_PASS_CERT_PEM`, `APPLE_PASS_KEY_PEM`,
`APPLE_WWDR_CERT_PEM` y `GOOGLE_WALLET_SA_KEY_JSON`) siguen existiendo para entornos
que no admiten secretos montados.

## Trabajos en segundo plano sin proceso fijo

No hay worker en producción: una instancia fija costaría lo mismo con cero clientes que
con mil. En su lugar, la API expone dos endpoints protegidos por `JOBS_SECRET`:

- `POST /internal/jobs/cron`: lo llama Cloud Scheduler cada minuto. Corre el
  planificador de campañas, cierra mensajes atascados, los cumpleaños y la expiración
  (estos dos como mucho cada quince minutos), y después drena la bandeja de salida.
- `POST /internal/jobs/outbox`: lo llama la propia API sobre sí misma justo después de
  cualquier petición que escribe (un sello, un mensaje, una sede movida), así el pase se
  actualiza en segundos y no al minuto siguiente. Es una petición HTTP real porque en
  Cloud Run la CPU solo está garantizada mientras hay una petición en vuelo.

La API escala a cero igual que antes; cada tick es una petición normal y se cobra como
tal. Para montarlo una sola vez:

```bash
export CLOUDSDK_ACTIVE_CONFIG_NAME=volvia
gcloud services enable cloudscheduler.googleapis.com
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create JOBS_SECRET --data-file=-
gcloud run services update volvia-api --region us-east4 --update-secrets=JOBS_SECRET=JOBS_SECRET:latest
gcloud scheduler jobs create http volvia-jobs-cron --location us-east4 \
  --schedule='* * * * *' --time-zone='Etc/UTC' \
  --uri='https://api.somosvolvia.com/internal/jobs/cron' --http-method=POST \
  --headers="authorization=Bearer $(gcloud secrets versions access latest --secret=JOBS_SECRET)" \
  --attempt-deadline=120s
```

Si el secreto rota, hay que actualizar el job del scheduler con `gcloud scheduler jobs
update http volvia-jobs-cron --location us-east4 --update-headers=...`. En local no hace
falta nada de esto: `pnpm dev` levanta `worker.ts`, que llama a los mismos dos ticks
con un temporizador.

## Cuidado con el `.env` local

Si tu `.env` apunta a Neon y Redis de producción, `pnpm db:seed` y `pnpm db:reset` actúan
sobre producción. Para desarrollar, vuelve a los valores de `.env.example`, que usan los
contenedores locales.

## Redis sin cifrar, por ahora

La conexión a Redis Cloud usa `redis://`, igual que los demás proyectos en producción, y
cruza internet entre Google y AWS protegida solo por la contraseña. Es una decisión
consciente: cuando se active *Transport layer security* en Redis Cloud (plan de pago),
basta con cambiar el secreto `REDIS_URL` a `rediss://`. ioredis lo soporta sin cambios de
código.

## Lo que todavía no está encendido

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
