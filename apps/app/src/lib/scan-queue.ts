'use client'

/**
 * Offline queue for the staff scanner.
 *
 * A counter at a café loses signal constantly, and "the internet is down so no stamp
 * for you" is not an acceptable answer to a paying customer. Scans are recorded locally
 * with their idempotency key and flushed when the connection returns; the key is what
 * makes a replay safe on the server side.
 */

const STORAGE_KEY = 'volvia.scan.queue'

export interface QueuedScan {
  idempotencyKey: string
  cardToken: string
  count: number
  occurredAt: string
  /** Shown in the pending list so staff know who is waiting to be credited. */
  label: string
}

function read(): QueuedScan[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QueuedScan[]) : []
  } catch {
    return []
  }
}

function write(queue: QueuedScan[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // A full or disabled storage must not break scanning; the scan still went through
    // if we were online, and there is nothing useful to do about it if we were not.
  }
}

export function enqueueScan(scan: QueuedScan): void {
  write([...read(), scan])
}

export function pendingScans(): QueuedScan[] {
  return read()
}

export function removeScan(idempotencyKey: string): void {
  write(read().filter((scan) => scan.idempotencyKey !== idempotencyKey))
}

export function clearQueue(): void {
  write([])
}

/**
 * Sends everything queued. Each scan carries the key it was created with, so a scan
 * that actually reached the server before the connection dropped is recognised as a
 * replay and does not stamp twice.
 */
export async function flushQueue(
  send: (scan: QueuedScan) => Promise<void>,
): Promise<{ sent: number; failed: number }> {
  const queue = read()
  let sent = 0
  let failed = 0

  for (const scan of queue) {
    try {
      await send(scan)
      removeScan(scan.idempotencyKey)
      sent += 1
    } catch {
      // Leave it queued and stop: if one request failed the rest probably will too,
      // and hammering a dead connection drains the phone's battery.
      failed += 1
      break
    }
  }

  return { sent, failed }
}

export function newIdempotencyKey(): string {
  return `scan-${crypto.randomUUID()}`
}
