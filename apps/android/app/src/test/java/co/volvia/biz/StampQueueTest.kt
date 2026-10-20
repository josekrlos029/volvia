package co.volvia.biz

import co.volvia.biz.core.ApiException
import co.volvia.biz.core.PendingStamp
import co.volvia.biz.core.StampCustomer
import co.volvia.biz.core.StampQueue
import co.volvia.biz.core.StampResult
import java.io.File
import java.nio.file.Files
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * The queue is the part of this app that can lose somebody's stamp, so it is the part
 * worth testing hardest. Every case here happened at a real counter: no signal, a flaky
 * connection, a server that already had the stamp, a card that no longer exists.
 */
class StampQueueTest {
    private lateinit var directory: File
    private lateinit var queue: StampQueue

    private fun stamp(token: String) =
        PendingStamp(cardToken = token, occurredAtIso = "2026-10-07T10:00:00Z")

    private fun result() = StampResult(
        stampsAdded = 1,
        stampsCount = 3,
        stampsRequired = 10,
        customer = StampCustomer("id", "María", false),
    )

    @Before
    fun setUp() {
        directory = Files.createTempDirectory("volvia-queue").toFile()
        queue = StampQueue(File(directory, "pending.json"))
    }

    @After
    fun tearDown() {
        directory.deleteRecursively()
    }

    @Test
    fun `every stamp carries its own idempotency key`() {
        // Two scans of the same card must not collapse into one on the server.
        assertTrue(stamp("token-one").idempotencyKey != stamp("token-one").idempotencyKey)
    }

    @Test
    fun `sends everything when the network is back`() = runTest {
        queue.enqueue(stamp("a"))
        queue.enqueue(stamp("b"))

        queue.flush { Result.success(result()) }

        assertTrue(queue.pending.isEmpty())
    }

    @Test
    fun `keeps the stamp when there is no signal`() = runTest {
        queue.enqueue(stamp("a"))

        queue.flush { Result.failure(ApiException.offline) }

        assertEquals(1, queue.pending.size)
        assertEquals(1, queue.pending.first().attempts)
    }

    @Test
    fun `stops at the first failure instead of burning through the rest`() = runTest {
        listOf("a", "b", "c").forEach { queue.enqueue(stamp(it)) }

        var attempts = 0
        queue.flush {
            attempts += 1
            Result.failure(ApiException.offline)
        }

        // One call, not three: the network is down, the other two would fail the same.
        assertEquals(1, attempts)
        assertEquals(3, queue.pending.size)
    }

    @Test
    fun `drops a stamp the server already has`() = runTest {
        queue.enqueue(stamp("a"))

        queue.flush { Result.failure(ApiException(409, "CONFLICT", "ya aplicado")) }

        // Replaying an idempotency key is the server saying "I have it", not an error.
        assertTrue(queue.pending.isEmpty())
        assertTrue(queue.rejected.isEmpty())
    }

    @Test
    fun `remembers a rejection instead of deleting it quietly`() = runTest {
        queue.enqueue(stamp("a"))

        queue.flush {
            Result.failure(ApiException(404, "CUSTOMER_CARD_NOT_FOUND", "no existe"))
        }

        assertTrue(queue.pending.isEmpty())
        // Somebody took this stamp from a real customer; they get told it did not land.
        assertEquals(1, queue.rejected.size)
    }

    @Test
    fun `gives up after enough failed attempts`() = runTest {
        queue.enqueue(stamp("a"))

        repeat(8) { queue.flush { Result.failure(ApiException.offline) } }

        assertTrue(queue.pending.isEmpty())
        assertEquals(1, queue.rejected.size)
    }

    @Test
    fun `survives the app being closed`() {
        val file = File(directory, "pending.json")
        StampQueue(file).enqueue(stamp("survives"))

        // A staff phone gets killed by Android all the time. The stamp has to still be here.
        val reopened = StampQueue(file)
        assertEquals(1, reopened.pending.size)
        assertEquals("survives", reopened.pending.first().cardToken)
    }

    @Test
    fun `takes one out when its scan succeeded immediately`() {
        val first = stamp("a")
        queue.enqueue(first)
        queue.enqueue(stamp("b"))

        queue.remove(first.id)

        assertEquals(1, queue.pending.size)
        assertEquals("b", queue.pending.first().cardToken)
    }

    @Test
    fun `still reads a queue written by 1-1`() {
        // Exactly what 1.1 persisted: no customer card, amount, note or location.
        val file = File(directory, "pending.json")
        file.writeText(
            """[{"id":"q1","cardToken":"legacy-token-0000000000","count":1,""" +
                """"idempotencyKey":"android-1","occurredAtIso":"2026-10-07T10:00:00Z","attempts":2}]""",
        )

        val queue = StampQueue(file)

        val pending = queue.pending.single()
        assertEquals("legacy-token-0000000000", pending.cardToken)
        assertEquals("android-1", pending.idempotencyKey)
        assertEquals(2, pending.attempts)
        assertNull(pending.customerCardId)
        assertNull(pending.purchaseAmount)
        assertNull(pending.note)
        assertNull(pending.locationId)
    }

    @Test
    fun `keeps the amount, note, count and location across a restart`() {
        val file = File(directory, "pending.json")
        StampQueue(file).enqueue(
            PendingStamp(
                customerCardId = "6f1c0d5e-0000-4000-8000-000000000001",
                count = 3,
                purchaseAmount = 25_000,
                note = "Mesa 4",
                locationId = "6f1c0d5e-0000-4000-8000-0000000000aa",
                occurredAtIso = "2026-10-19T12:00:00Z",
            ),
        )

        val restored = StampQueue(file).pending.single()
        assertNull(restored.cardToken)
        assertEquals("6f1c0d5e-0000-4000-8000-000000000001", restored.customerCardId)
        assertEquals(3, restored.count)
        assertEquals(25_000L, restored.purchaseAmount)
        assertEquals("Mesa 4", restored.note)
        assertEquals("6f1c0d5e-0000-4000-8000-0000000000aa", restored.locationId)
    }

    @Test
    fun `a cooldown is a refusal, not a reason to retry`() = runTest {
        queue.enqueue(stamp("a"))
        queue.enqueue(stamp("b"))

        var attempts = 0
        queue.flush {
            attempts += 1
            // 429 like the rate limiter, but the card's own rule: it will not change by retrying.
            Result.failure(ApiException(429, "STAMP_COOLDOWN_ACTIVE", "this customer was stamped very recently"))
        }

        assertEquals(2, attempts)
        assertTrue(queue.pending.isEmpty())
        assertEquals(listOf("Ya recibió sello hace poco.", "Ya recibió sello hace poco."), queue.rejected.map { it.reason })
    }

    @Test
    fun `the daily cap is told in spanish when it rejects a queued stamp`() = runTest {
        queue.enqueue(stamp("a"))

        queue.flush { Result.failure(ApiException(429, "STAMP_DAILY_CAP_REACHED", "daily stamp limit reached")) }

        assertEquals("Llegó al límite de sellos de hoy.", queue.rejected.single().reason)
    }

    @Test
    fun `the rate limiter is still worth waiting out`() = runTest {
        queue.enqueue(stamp("a"))

        queue.flush { Result.failure(ApiException(429, "RATE_LIMITED", "slow down")) }

        assertEquals(1, queue.pending.size)
        assertTrue(queue.rejected.isEmpty())
    }
}
