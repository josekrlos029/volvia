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
escrita en la misma transacción que el cambio de estado, y drenada aparte con
`for update skip locked` (varios drenajes a la vez toman lotes disjuntos).

Quién drena depende de dónde corre. En producción no hay ningún proceso encendido todo el
tiempo, porque la API escala a cero y un worker fijo sería el único coste constante del
producto. En su lugar, el drenaje y los trabajos programados son dos endpoints de la API
(`/internal/jobs/outbox` y `/internal/jobs/cron`) protegidos por un secreto: Cloud
Scheduler llama al segundo cada minuto, y la API llama al primero sobre sí misma justo
después de cada petición que escribe, para que un sello llegue al teléfono en segundos y
no al minuto siguiente. En local, `worker.ts` llama a los mismos dos ticks con un
temporizador.

Los trabajos programados corren detrás de un lock distribuido en Redis, porque dos ticks
pueden solaparse y el correo de cumpleaños debe salir una sola vez.

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

Las coordenadas de las sedes forman parte del contenido del pase: con ellas, el propio
sistema operativo muestra la tarjeta cuando el cliente se acerca al local. Por eso mover
una sede encola, por el outbox, una actualización para cada pase del negocio, igual que
un sello.

El pase es la tarjeta, no una ficha con un número: el strip con los sellos, el lockup
Volvia · negocio de la cabecera y el icono se dibujan en el servidor a partir del diseño
(`packages/wallet/src/render`, SVG rasterizado con resvg, sin texto ni fuentes). Apple los
lleva dentro del `.pkpass`; Google los pide por URL a la API, con una huella del estado en
la URL para invalidar su caché. Un cambio de diseño encola una actualización por pase
instalado, igual que un sello. Detalle en `docs/WALLET-SETUP.md`, "Imágenes del pase".

### Mensajes push

El cliente no tiene app: el único canal para avisarle algo es el pase. Un mensaje a un
segmento se resuelve con las mismas condiciones SQL que la vista previa del panel, se
anota una entrega por tarjeta y se encola una actualización de pase por cada una.

En Apple, el aviso en pantalla de bloqueo lo produce el propio pase: el campo `message`
lleva `changeMessage`, y el teléfono muestra el texto nuevo cuando lo descarga tras el
push vacío de APNs. El campo existe desde la instalación, con un texto neutro, porque Apple
solo avisa de campos que ya conocía. Dos mensajes seguidos con el mismo cuerpo no avisan
dos veces; es una limitación de la plataforma y no vale la pena rodearla. El campo de
oferta de las campañas también lleva `changeMessage`, así que una campaña avisa igual.

En Google no hay pase que descargar: la notificación es `loyaltyObject.addMessage` con
`TEXT_AND_NOTIFY`, y el texto se renderiza para cada cliente antes de enviarlo. Google
limita cuántos mensajes recibe un objeto al día; si rechaza uno, la entrega queda como
fallida con el motivo y el mensaje termina igual.

En modo `stub` no se envía nada, pero las entregas se marcan como si sí: así el flujo
completo se prueba en local sin certificados reales.

## Pagos

`PaymentProviderAdapter` es la costura entre Volvia y quien cobra. Stripe cubre tarjeta
internacional; Wompi cubre Colombia, donde un checkout solo con tarjeta perdería a la
mayoría del mercado. Wompi no tiene suscripciones, así que cada pago extiende el periodo:
por eso su webhook emite una activación por pago en vez de seguir una suscripción remota.

Los webhooks se registran antes de procesarse y se aplican de forma idempotente, porque
llegan desordenados y más de una vez.
