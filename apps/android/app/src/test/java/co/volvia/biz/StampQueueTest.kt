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
}
