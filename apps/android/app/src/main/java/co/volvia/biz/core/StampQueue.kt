package co.volvia.biz.core

import java.io.File
import java.util.UUID
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/** A stamp that was taken from a real customer and has not reached the server yet. */
@Serializable
data class PendingStamp(
    val id: String = UUID.randomUUID().toString(),
    /** The scanned card. Null only for a stamp started from a customer's profile. */
    val cardToken: String? = null,
    /**
     * Everything below `count` arrived in 1.2. All optional with defaults, so a queue
     * file written by 1.1 (token, count, key, time, attempts) still loads unchanged.
     */
    val customerCardId: String? = null,
    val count: Int = 1,
    /** Whole pesos for a `min_spend` card. */
    val purchaseAmount: Long? = null,
    val note: String? = null,
    /** The location chosen in "Más" at the moment of the scan, not when it is sent. */
    val locationId: String? = null,
    /**
     * Generated once, at the counter, and reused on every retry. It is what makes a
     * retry safe: the server replays the original result instead of stamping twice.
     */
    val idempotencyKey: String = "android-${UUID.randomUUID()}",
    /**
     * When it really happened, so a stamp sent two hours later is not counted at the
     * wrong hour in the business's analytics.
     */
    val occurredAtIso: String,
    val attempts: Int = 0,
)

@Serializable
data class RejectedStamp(val stamp: PendingStamp, val reason: String)

/**
 * The offline queue.
 *
 * The counter does not stop when the wifi does. A stamp is written here first and sent
 * afterwards, so the answer a staff member sees never depends on the network — and the
 * customer, who is standing right there, is never asked to wait or come back.
 *
 * Takes a [File] rather than a Context so the whole thing is testable on the JVM.
 */
class StampQueue(private val file: File, private val maximumAttempts: Int = 8) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    var pending: List<PendingStamp> = load()
        private set

    var rejected: List<RejectedStamp> = emptyList()
        private set

    fun enqueue(stamp: PendingStamp) {
        pending = pending + stamp
        persist()
    }

    /** Takes one entry out by identity: the scan it belongs to already succeeded. */
    fun remove(id: String) {
        pending = pending.filterNot { it.id == id }
        persist()
    }

    fun clearRejected() {
        rejected = emptyList()
    }

    /**
     * Sends everything waiting, oldest first, and stops at the first transient failure.
     *
     * Stopping matters: if the network is down, trying the other forty only burns
     * battery and makes the log harder to read.
     */
    suspend fun flush(send: suspend (PendingStamp) -> Result<StampResult>) {
        while (true) {
            val next = pending.firstOrNull() ?: return
            val outcome = send(next)

            when {
                outcome.isSuccess -> {
                    pending = pending.drop(1)
                    persist()
                }

                else -> {
                    val error = outcome.exceptionOrNull() as? ApiException ?: ApiException.offline
                    when {
                        error.isAlreadyApplied -> {
                            // The server has it. Nothing left to do.
                            pending = pending.drop(1)
                            persist()
                        }

                        error.isTransient -> {
                            val attempted = next.copy(attempts = next.attempts + 1)
                            pending = if (attempted.attempts >= maximumAttempts) {
                                reject(attempted, Messages.stamp(error))
                                pending.drop(1)
                            } else {
                                listOf(attempted) + pending.drop(1)
                            }
                            persist()
                            return
                        }

                        else -> {
                            // In the staff member's words: "Ya recibió sello hace poco", not
                            // the server's English.
                            reject(next, Messages.stamp(error))
                            pending = pending.drop(1)
                            persist()
                        }
                    }
                }
            }
        }
    }

    /** Never deleted in silence: somebody took this from a real customer. */
    private fun reject(stamp: PendingStamp, reason: String) {
        rejected = rejected + RejectedStamp(stamp, reason)
    }

    private fun load(): List<PendingStamp> =
        runCatching {
            if (!file.exists()) emptyList()
            else json.decodeFromString<List<PendingStamp>>(file.readText())
        }.getOrDefault(emptyList())

    private fun persist() {
        runCatching {
            file.parentFile?.mkdirs()
            file.writeText(json.encodeToString(pending))
        }
    }
}
