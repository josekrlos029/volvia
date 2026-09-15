# Arquitectura

## Por qué cuatro aplicaciones y no una

Las cuatro superficies tienen necesidades opuestas:

- **Marketing** se genera estático y se cachea agresivamente. Necesita SEO.
- **Panel** exige sesión, nunca se cachea y no debe indexarse.
- **Tarjeta del cliente** cambia con cada sello, se abre desde una wallet en una red
  móvil mala, y tiene que pesar lo mínimo posible.
- **API** escala con el volumen de escaneos, no con el tráfico web.

Meterlas en un solo despliegue obligaría a elegir un perfil de caché para todas. Separadas,
cada una se despliega y escala por su cuenta: las tres de Next van a Vercel, la API a
Cloud Run.

## El endpoint que sostiene el producto

`POST /v1/stamp` es el único camino con presupuesto de latencia (p95 < 200 ms) y el único
donde la corrección importa más que la velocidad. Su diseño:

1. **Idempotencia en Redis.** El escáner genera una clave por intento. Un reintento
   devuelve el resultado original en vez de sellar dos veces.
2. **Transacción con bloqueo de fila.** La tarjeta del cliente se bloquea con
   `for update`, así dos empleados escaneando a la misma persona no cruzan ambos la línea
   de la recompensa.
3. **Índice único como red final.** `(customer_card_id, idempotency_key)` es la garantía
   real; Redis solo es el camino rápido delante de la base.
4. **Outbox en la misma transacción.** El push a la wallet se encola dentro de la
   transacción, así que un sello que se revierte nunca deja un aviso enviado, y un sello
   que se confirma nunca pierde el suyo.

El aislamiento por negocio también vive aquí: la tarjeta se busca por token **y** por
`org_id`, y un token ajeno responde "no encontrada" en vez de revelar que existe.

## Multi-tenencia

Cada tabla de negocio lleva `org_id`. El acceso pasa por `requireOrg(role)`, que resuelve
la membresía del usuario desde la cabecera `x-org-id`, y falla si no existe. Las pruebas
de aislamiento (`tests/e2e/specs/tenancy.spec.ts`) verifican que un negocio no pueda leer,
sellar ni contar los datos de otro.

## Trabajos en segundo plano

Nada con efecto externo se ejecuta dentro de la petición. Todo pasa por la tabla `outbox`,
escrita en la misma transacción que el cambio de estado, y drenada por un worker aparte con
`for update skip locked` (varias instancias toman lotes disjuntos).

El worker también corre los trabajos programados detrás de un lock distribuido en Redis,
porque varias instancias sostienen su propio temporizador y el correo de cumpleaños debe
salir una sola vez.

## Planes

La matriz de planes vive en `packages/shared/src/plans.ts` y es la única fuente de verdad.
La consume el middleware `requireFeature` de la API, los bloqueos del panel y la tabla de
precios del sitio. No puede existir una página que prometa algo que el producto rechace.

Un negocio nuevo tiene todas las funciones premium hasta llegar a 30 clientes. El límite es
de tracción, no de calendario: un negocio que monta su tarjeta despacio no queda castigado.

## Wallet

`WALLET_MODE` decide qué se puede prometer:

- `stub` firma con certificados autofirmados. El `.pkpass` es estructuralmente idéntico al
  real y las pruebas verifican su firma con OpenSSL, pero un iPhone lo rechaza.
- `real` usa el certificado del Pass Type ID de Apple y la cuenta de servicio de Google.

Pasar de uno a otro es cambiar variables de entorno, no código.

El token que Apple exige dentro del pase se deriva por HMAC del serial en vez de guardarse.
Así es estable entre descargas (un dispositivo con una copia vieja sigue autenticando) y no
hay un secreto más que pueda filtrarse desde la base.

## Pagos

`PaymentProviderAdapter` es la costura entre Volvia y quien cobra. Stripe cubre tarjeta
internacional; Wompi cubre Colombia, donde un checkout solo con tarjeta perdería a la
mayoría del mercado. Wompi no tiene suscripciones, así que cada pago extiende el periodo:
por eso su webhook emite una activación por pago en vez de seguir una suscripción remota.

Los webhooks se registran antes de procesarse y se aplican de forma idempotente, porque
llegan desordenados y más de una vez.
