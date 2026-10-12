package co.volvia.biz

import co.volvia.biz.core.CardColors
import co.volvia.biz.core.NextReward
import co.volvia.biz.core.ScanOutcomeUi
import co.volvia.biz.core.StampCustomer
import co.volvia.biz.core.StampIcon
import co.volvia.biz.core.StampResult
import co.volvia.biz.core.StampResultDesign
import co.volvia.biz.core.UnlockedReward
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CardLookTest {
    private val design = StampResultDesign(
        businessName = "Café Raíces",
        cardName = "Club Raíces",
        backgroundColor = "#2B1D14",
        foregroundColor = "#FFFFFF",
        accentColor = "#D9A35F",
        emptyStampColor = "#4A3A2E",
        stampStyle = "circle",
        stampIcon = StampIcon("preset", "coffee"),
        rewardPositions = listOf(10),
        nextReward = NextReward(10, "Café gratis"),
    )

    private fun result(count: Int, unlocked: List<UnlockedReward> = emptyList()) = StampResult(
        stampsAdded = 1,
        stampsCount = count,
        stampsRequired = 10,
        unlockedRewards = unlocked,
        customer = StampCustomer("id", "Laura", false),
        design = design,
    )

    @Test
    fun `parses hex colours, short and long`() {
        assertEquals(0xFF2B1D14L, CardColors.argb("#2B1D14"))
        assertEquals(0xFFFFFFFFL, CardColors.argb("#fff"))
        assertEquals(0xFF000000L, CardColors.argb("not a colour"))
    }

    @Test
    fun `picks the dark card colour as the mark on a pale accent`() {
        val card = ScanOutcomeUi.stamped(result(4)).card!!
        assertEquals(0xFF2B1D14L, card.onAccent)
    }

    @Test
    fun `draws the business glyph and says what is left`() {
        val card = ScanOutcomeUi.stamped(result(7)).card!!
        assertEquals("coffee", card.glyph)
        assertEquals(5, card.columns)
        assertEquals("Le faltan 3 para Café gratis", card.remainingLine)
    }

    @Test
    fun `fills the card when the reward restarts the cycle`() {
        val card = ScanOutcomeUi.stamped(
            result(0, unlocked = listOf(UnlockedReward("g1", "Café gratis", "", "AB12"))),
        ).card!!
        assertEquals(10, card.filled)
        assertNull(card.remainingLine)
    }

    @Test
    fun `an older replay without the design still decodes, plainly`() {
        val json = Json { ignoreUnknownKeys = true }
        val decoded = json.decodeFromString(
            StampResult.serializer(),
            """{"stampsAdded":1,"stampsCount":2,"stampsRequired":8,"customer":{"id":"c","firstName":"Ana","isNew":false}}""",
        )
        assertNull(ScanOutcomeUi.stamped(decoded).card)
    }
}
