# Modelo de datos

32 tablas. Lo que sigue explica las decisiones que no se leen solas en el esquema.

## Identidad y negocio

`users` guarda a la persona; `organizations` al negocio; `memberships` los une con un rol
(`owner`, `admin`, `staff`). Un miembro de mostrador puede quedar atado a una sede.

`users.token_version` es un contador. Al subirlo, todos los tokens de acceso emitidos para
esa persona dejan de valer de inmediato, sin esperar a que expiren.

`organizations.customer_count` está desnormalizado a propósito: decide el límite de la
prueba premium y se lee en casi toda petición autenticada. Contar en vivo sería un
`COUNT(*)` por request.

`organizations.settings` es un `jsonb` con lo que es preferencia y no identidad: cada
cuánto espera el negocio que vuelva un buen cliente, sus datos legales, el texto del botón
de su página y si las peticiones de reseña están en pausa. Añadir una preferencia no
necesita migración, y `orgSettingsSchema` le pone forma al leerlo.

`locations.latitude` y `locations.longitude` van juntas o ninguna: media coordenada
pondría la sede en el ecuador. Son lo único que necesita el pase de wallet para aparecer
cuando el cliente se acerca; el texto que lo acompaña se genera desde el estado de la
tarjeta y no se guarda.

Cerrar un negocio es un borrado suave (`deleted_at`). Desde ese momento sus tarjetas dejan
de admitir gente y las de sus clientes dejan de abrirse, aunque sus propias filas sigan
marcadas como activas: la comprobación está en la organización, no en la tarjeta.

## Tarjetas

`stamp_cards` guarda diseño y reglas como `jsonb` porque ambos evolucionan seguido y no se
consultan por campo. `join_slug` es el identificador público que va en el QR.

`rewards` está aparte, con único en `(card_id, at_stamp)`: dos recompensas no pueden vivir
en el mismo sello.

`stamp_cards.initial_stamps` son los sellos que ya trae la tarjeta al entregarse. Se
aplican en el mismo `join` y quedan registrados en `stamp_events`, así que la historia
explica de dónde salieron en vez de aparecer de la nada.

`stamp_cards.messages` guarda lo que la tarjeta le dice al cliente: unas frases que rotan
entre visitas y otras escritas para un número exacto de sellos. La elección es
determinista a partir del contador, que es lo que permite seguir cacheando la respuesta
pública.

Mientras una tarjeta tenga clientes, no se puede cambiar su longitud, sus recompensas ni
su regalo inicial: eso reescribiría un trato que alguien ya empezó a cumplir. Los colores
y las palabras sí.

## Clientes y sellos

`customer_cards.token` es el identificador público de la tarjeta de una persona: opaco, no
adivinable, y el mismo que sirve de serial del pase de wallet.

`stamp_events` es un libro que solo crece. El único en
`(customer_card_id, idempotency_key)` es la garantía real contra el doble sellado. Cada
fila guarda el total resultante, así que la historia se audita sin recalcular.

Los cumpleaños se guardan como mes y día, nunca el año. No hace falta la edad para felicitar
a alguien.

Los cinco segmentos de comunidad (habituales, vuelven, nuevos, se alejan, perdidos) no se
guardan: se calculan desde `joined_at`, `last_stamp_at` y `total_stamps` contra la
frecuencia que el negocio configuró. `classifyCustomer` es la definición y el SQL de
`lib/segments.ts` es la misma regla para contar miles de filas sin traerlas. Cada cliente
cae en exactamente uno, así que los cinco suman el total.

`customer_segments` guarda los segmentos que el negocio define: un punto de partida (uno de
los cinco, los compuestos `cold`/`recurring`, o todos) y los filtros encima, como `jsonb`.
No guarda a quién contiene: la regla se evalúa cada vez, así que un segmento no envejece.
Los segmentos sugeridos por Volvia no están en la base: viven en código, y solo se vuelven
una fila cuando el negocio guarda una copia para afinarla. El borrado es suave porque un
mensaje programado puede seguir apuntando a un segmento que su dueño acaba de quitar.

## Mensajes

`messages` es un aviso puntual al pase de wallet. `message_deliveries` tiene una fila por
tarjeta de cliente, única por mensaje: es lo que hace idempotente el envío, porque un
reintento del worker no inserta nada nuevo y nadie recibe dos veces el mismo push. Cada
fila pasa de `queued` a `delivered`, `failed` o `skipped_no_pass` (el cliente no tiene el
pase en el móvil), y `delivered_count` se deriva de ahí en vez de adivinarse. El mensaje
pasa a `sent` cuando no queda ninguna fila en cola.

## Analítica

`analytics_daily` es un rollup por organización, tarjeta, sede y día, con los sellos por
hora en un array de 24 posiciones.

Su restricción única lleva `nulls not distinct`. Sin eso, las filas con `location_id` nulo
nunca colisionarían (Postgres trata cada nulo como distinto), el upsert nunca acertaría y
habría una fila por sello en vez de una por día. Es exactamente el error que tuvo esta
tabla antes de corregirse.

## Outbox

`outbox` lleva todo lo que tiene efecto fuera de Postgres. Se escribe en la misma
transacción que el cambio que lo origina, y se drena aparte. Esa es la única forma de que un
sello confirmado siempre tenga su push, y uno revertido nunca lo tenga.

## Wallet

`wallet_passes` guarda un pase por plataforma y por tarjeta de cliente.
`apple_pass_registrations` guarda los dispositivos que pidieron actualizaciones.

No se guarda el token de autenticación del pase: se deriva por HMAC del serial. Es estable
entre descargas y no hay nada más que proteger en la base.

## Borrado de datos personales

Cuando un cliente pide que lo borren, se eliminan sus respuestas, se marca su tarjeta como
borrada y sus datos personales se reemplazan. Los conteos de visitas quedan, sin nada que
identifique a una persona: el negocio conserva su historia y la persona desaparece de ella.
