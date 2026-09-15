# Volvia

Tarjetas de fidelización digitales para negocios locales. Un negocio diseña su tarjeta,
el cliente la agrega escaneando un QR (sin instalar nada), el equipo suma sellos desde el
celular, y al completarla se libera una recompensa.

## Cómo se levanta en local

```bash
pnpm install
cp .env.example .env                      # los valores por defecto ya funcionan
pnpm infra:up                             # postgres, redis, mailpit y minio en Docker
pnpm certs:dev                            # certificados de desarrollo para wallet
pnpm db:migrate && pnpm db:seed           # esquema y datos de prueba
pnpm dev                                  # las cuatro apps a la vez
```

| Servicio | URL | Qué es |
|---|---|---|
| Marketing | http://localhost:3000 | Sitio público en español e inglés |
| Panel | http://localhost:3001 | Panel del negocio, escáner y kiosko |
| Tarjeta | http://localhost:3002 | Alta, tarjeta del cliente y página del negocio |
| API | http://localhost:8080 | REST, webhooks y wallet. Documentación en `/docs` |
| Correo | http://localhost:58025 | Todo el correo que envía la plataforma |
| Archivos | http://localhost:59001 | Consola de MinIO |

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
  api/    Fastify sobre Node 22. API, webhooks, wallet y worker de trabajos.
  app/    Panel del negocio, escáner PWA y pantalla de kiosko.
  pass/   Superficies del cliente: alta, tarjeta y página pública del negocio.
  web/    Sitio de marketing con blog en MDX y páginas por sector.
packages/
  db/       Esquema Drizzle, migraciones y seed.
  shared/   Esquemas zod, matriz de planes y cliente HTTP tipado.
  wallet/   Generación y firma de pases de Apple y Google.
  ui/       Tokens de marca y utilidades compartidas.
  config/   Presets de TypeScript y Vitest.
```

## Comandos

```bash
pnpm dev            # todas las apps
pnpm typecheck      # tipos en todo el monorepo
pnpm test           # unitarios e integración
pnpm test:e2e       # Playwright, requiere pnpm dev corriendo
pnpm db:reset       # borra y recrea la base local
pnpm infra:logs     # logs de los contenedores
```

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md), por qué el sistema está partido así.
- [Modelo de datos](docs/DATA-MODEL.md), qué guarda cada tabla y por qué.
- [Operación](docs/RUNBOOK.md), qué hacer cuando algo falla.
- [Producción](docs/DEPLOYMENT.md), lo que falta para desplegar.
- [Wallet](docs/WALLET-SETUP.md), certificados de Apple y Google paso a paso.
