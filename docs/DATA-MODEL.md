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

## Tarjetas

`stamp_cards` guarda diseño y reglas como `jsonb` porque ambos evolucionan seguido y no se
consultan por campo. `join_slug` es el identificador público que va en el QR.

`rewards` está aparte, con único en `(card_id, at_stamp)`: dos recompensas no pueden vivir
en el mismo sello.

## Clientes y sellos

`customer_cards.token` es el identificador público de la tarjeta de una persona: opaco, no
adivinable, y el mismo que sirve de serial del pase de wallet.

`stamp_events` es un libro que solo crece. El único en
`(customer_card_id, idempotency_key)` es la garantía real contra el doble sellado. Cada
fila guarda el total resultante, así que la historia se audita sin recalcular.

Los cumpleaños se guardan como mes y día, nunca el año. No hace falta la edad para felicitar
a alguien.

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
