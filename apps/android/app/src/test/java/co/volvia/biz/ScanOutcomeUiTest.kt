package co.volvia.biz

import co.volvia.biz.core.ApiException
import co.volvia.biz.core.PendingReward
import co.volvia.biz.core.ScanOutcomeUi
import co.volvia.biz.core.StampCustomer
import co.volvia.biz.core.StampResult
import co.volvia.biz.core.UnlockedReward
import co.volvia.biz.ui.QrAnalyzer
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScanOutcomeUiTest {
    private fun result(
        unlocked: List<UnlockedReward> = emptyList(),
        waiting: List<PendingReward> = emptyList(),
    ) = StampResult(
        stampsAdded = 1,
        stampsCount = 7,
        stampsRequired = 10,
        unlockedRewards = unlocked,
        pendingRewards = waiting,
        customer = StampCustomer("id", "María", false),
    )

    @Test
    fun `leads with the name and the progress`() {
        val ui = ScanOutcomeUi.stamped(result())
        assertEquals("María", ui.title)
        assertEquals("7 de 10 sellos", ui.body)
        assertNull(ui.rewardGrantId)
    }

    @Test
    fun `offers to hand over a reward the scan just unlocked`() {
        val ui = ScanOutcomeUi.stamped(
            result(unlocked = listOf(UnlockedReward("g1", "Café gratis", "", "AB12"))),
        )
        assertEquals("g1", ui.rewardGrantId)
        assertTrue(ui.rewardTitle!!.contains("Café gratis"))
    }

    @Test
    fun `remembers a reward earned earlier and never collected`() {
        val ui = ScanOutcomeUi.stamped(result(waiting = listOf(PendingReward("g2", "Postre", "CD34"))))
        assertEquals("g2", ui.rewardGrantId)
        assertTrue(ui.rewardTitle!!.contains("sin recoger"))
    }

    @Test
    fun `tells the customer the same thing when there is no signal`() {
        // From the counter, a queued stamp and a sent one are the same event.
        val ui = ScanOutcomeUi.queued()
        assertEquals("Sello guardado", ui.title)
        assertTrue(ui.body.contains("Se envía solo"))
    }
}

class ApiExceptionTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `treats network and server failures as worth retrying`() {
        assertTrue(ApiException.offline.isTransient)
        assertTrue(ApiException(500, "INTERNAL", "").isTransient)
        assertTrue(ApiException(429, "RATE_LIMITED", "").isTransient)
    }

    @Test
    fun `does not retry what will never succeed`() {
        // A card that does not exist will not start existing on the fourth attempt.
        assertFalse(ApiException(404, "CUSTOMER_CARD_NOT_FOUND", "").isTransient)
        assertFalse(ApiException(403, "FORBIDDEN", "").isTransient)
    }

    @Test
    fun `reads the api error envelope`() {
        val error = ApiException.decode(
            409,
            """{"error":{"code":"STAMP_TOO_SOON","message":"demasiado pronto"}}""",
            json,
        )
        assertEquals("STAMP_TOO_SOON", error.code)
        assertEquals("demasiado pronto", error.message)
    }

    @Test
    fun `falls back when the body is not ours`() {
        // A proxy or a load balancer answering instead of the API.
        val error = ApiException.decode(502, "<html>bad gateway</html>", json)
        assertEquals("INTERNAL", error.code)
        assertTrue(error.isTransient)
    }
}

class QrAnalyzerTest {
    @Test
    fun `ignores the same card while it is still in frame`() {
        var clock = 0L
        val analyzer = QrAnalyzer(onCode = {}, repeatWindowMillis = 4_000, now = { clock })

        assertTrue(analyzer.accepts("token-a"))
        clock = 1_000
        // The customer is still putting their phone away.
        assertFalse(analyzer.accepts("token-a"))
    }

    @Test
    fun `accepts the same card again once the window has passed`() {
        var clock = 0L
        val analyzer = QrAnalyzer(onCode = {}, repeatWindowMillis = 4_000, now = { clock })

        assertTrue(analyzer.accepts("token-a"))
        clock = 5_000
        assertTrue(analyzer.accepts("token-a"))
    }

    @Test
    fun `never makes the next customer wait`() {
        var clock = 0L
        val analyzer = QrAnalyzer(onCode = {}, repeatWindowMillis = 4_000, now = { clock })

        assertTrue(analyzer.accepts("token-a"))
        clock = 500
        // A different card, half a second later: the queue is moving.
        assertTrue(analyzer.accepts("token-b"))
    }
}
