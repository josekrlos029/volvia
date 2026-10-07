# Volvia

Tarjetas de fidelización digitales para negocios locales. Un negocio diseña su tarjeta,
el cliente la agrega escaneando un QR (sin instalar nada), el equipo suma sellos desde el
celular, y al completarla se libera una recompensa.

## Cómo se levanta en local

```bash
pnpm install
cp .env.example .env                      # los valores por defecto ya funcionan
pnpm infra:up                             # postgres, redis, mailpit y almacenamiento
pnpm certs:dev                            # certificados de desarrollo para wallet
pnpm db:migrate && pnpm db:seed           # esquema y datos de prueba
pnpm dev                                  # las cuatro apps y el worker
```

| Servicio | URL | Qué es |
|---|---|---|
| Marketing | http://localhost:3000 | Sitio público en español e inglés |
| Panel | http://localhost:3001 | Panel del negocio, escáner y kiosko |
| Tarjeta | http://localhost:3002 | Alta, tarjeta del cliente y página del negocio |
| API | http://localhost:8080 | REST, webhooks y wallet. Documentación en `/docs` |
| Correo | http://localhost:58025 | Todo el correo que envía la plataforma |
| Archivos | http://localhost:59000 | Almacenamiento S3 local |

Los puertos de infraestructura son poco comunes a propósito (55432, 56379, 51025, 59000):
esta máquina ya tiene otros proyectos ocupando los puertos habituales, y conectarse por
error a la base de datos de otro proyecto es una clase de error que conviene evitar por
diseño.

### Cuentas de prueba

El seed crea tres negocios con historial real de visitas. La contraseña es
`volvia-local-2026` en todos.

| Correo | Negocio | Plan |
|---|---|---|
| hola@burger-train.test | Burger Train | Negocio |
| hola@cafe-raices.test | Café Raíces | Pro |
| hola@barberia-nueve.test | Barbería Nueve | Gratis |

## Estructura

```
apps/
  api/      Fastify sobre Node 22. API, webhooks, wallet y worker de trabajos.
  app/      Panel del negocio, escáner PWA y pantalla de kiosko.
  pass/     Superficies del cliente: alta, tarjeta y página pública del negocio.
  web/      Sitio de marketing con blog en MDX y páginas por sector.
  ios/      Volvia Biz para iPhone: Swift, SwiftUI y AVFoundation.
  android/  Volvia Biz para Android: Kotlin, Compose y CameraX.
packages/
  db/       Esquema Drizzle, migraciones y seed.
  shared/   Esquemas zod, matriz de planes y cliente HTTP tipado.
  wallet/   Generación y firma de pases de Apple y Google.
  ui/       Tokens de marca y utilidades compartidas.
  config/   Presets de TypeScript y Vitest.
```

## Comandos

```bash
pnpm dev            # todas las apps y el worker de la bandeja de salida
pnpm typecheck      # tipos en todo el monorepo
pnpm test           # unitarios, integración y la suite end to end
pnpm test:e2e       # solo Playwright, requiere pnpm dev corriendo
pnpm db:reset       # borra y recrea la base local
pnpm infra:logs     # logs de los contenedores
```

Cada push corre lo mismo en GitHub Actions (`.github/workflows/ci.yml`): lint, tipos,
build y unitarios en un trabajo, y la suite end to end contra el build de producción en
otro, con los mismos contenedores que usas aquí.

## El sitio público

El sitio de marketing vive en `apps/web` y es casi todo contenido: `src/lib` tiene un
módulo por colección (funciones, sectores, comparativas, glosario, referencias, guía,
plantillas, preguntas) y las páginas los recorren. Añadir un sector o una función es
añadir una entrada, no una página.

Está en español e inglés, con `hreflang`, canónicas y datos estructurados por página.
Las pruebas de `apps/web/test/content.test.ts` comprueban lo que un build no ve: que cada
entrada exista en los dos idiomas, que los slugs sean únicos y que los enlaces internos
apunten a algo que existe.

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md), por qué el sistema está partido así.
- [Modelo de datos](docs/DATA-MODEL.md), qué guarda cada tabla y por qué.
- [Operación](docs/RUNBOOK.md), qué hacer cuando algo falla.
- [Producción](docs/DEPLOYMENT.md), dónde vive cada pieza y cómo se publica un cambio.
- [Wallet](docs/WALLET-SETUP.md), certificados de Apple y Google paso a paso.
- [Apps nativas](docs/APPS-NATIVAS.md), las dos apps del personal y qué falta para publicarlas.
