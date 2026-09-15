# Operación

Qué hacer cuando algo falla, empezando por lo que más falla.

## Comprobaciones rápidas

```bash
curl localhost:8080/healthz     # el proceso vive
curl localhost:8080/readyz      # además alcanza Postgres y Redis
curl localhost:8080/metrics     # métricas Prometheus
```

`/readyz` falla a propósito cuando Postgres o Redis no responden, para que una instancia
enferma salga de rotación en vez de aceptar sellos que no puede guardar.

## Los sellos no llegan a la wallet del cliente

La tarjeta web siempre está al día; la wallet depende del worker.

1. `select status, count(*) from outbox group by status` — si hay muchos en `pending`, el
   worker no está corriendo. Arráncalo con `pnpm --filter @volvia/api worker`.
2. Si hay filas en `failed`, mira `last_error`. Se reintentan seis veces con espera
   creciente antes de quedar ahí.
3. En `WALLET_MODE=stub` el push a Apple se omite a propósito: los certificados de
   desarrollo no autentican contra APNs. El dispositivo igual se actualiza solo cuando
   consulta, así que la tarjeta es correcta, solo no instantánea.

## Un cliente dice que le sellaron dos veces

Casi siempre no ocurrió: busca por `idempotency_key` en `stamp_events`. Un reintento del
escáner comparte clave y se guarda una sola vez.

Si de verdad hay dos eventos con claves distintas, alguien escaneó dos veces sin espera
configurada. `stamp_events` guarda quién, cuándo y desde qué sede.

## Un empleado dice que el escáner no suma

Casi siempre es la cola sin conexión: los sellos quedan guardados en el teléfono y salen
cuando vuelve la señal. La pantalla dice cuántos hay pendientes.

Si el escáner responde error, los casos habituales son espera activa
(`STAMP_COOLDOWN_ACTIVE`), tope diario (`STAMP_DAILY_CAP_REACHED`) o una tarjeta que no es
de ese negocio.

## Alguien no puede entrar

- `TOKEN_REUSED` significa que se presentó un token de refresco viejo. Se asume robo y se
  cierran todas las sesiones de esa cuenta. La persona vuelve a entrar y listo.
- Tras cambiar o restablecer la contraseña se invalidan todos los accesos activos. Es lo
  esperado.
- `RATE_LIMITED` en el login son diez intentos por correo y por IP en quince minutos.

## Un webhook de pago no aplicó el plan

Los webhooks se guardan en `webhook_events` antes de procesarse.

```sql
select provider, type, processed_at, error from webhook_events order by created_at desc limit 20;
```

Con `processed_at` nulo y `error` con contenido, el evento llegó y falló. Con la fila
ausente, nunca llegó: revisa la configuración del proveedor.

Una firma inválida se rechaza sin procesar, que es lo correcto: significa mala
configuración o falsificación.

## Restablecer el entorno local

```bash
pnpm db:reset && pnpm db:migrate && pnpm db:seed
```

`db:reset` se niega a correr contra una base que no sea local.

## Cuando Docker deja de responder

Si `docker ps` se queda colgado y los puertos siguen abiertos pero sin aceptar conexiones,
el demonio está trabado. Reiniciar Docker Desktop lo resuelve. Los datos sobreviven porque
viven en volúmenes con nombre.
