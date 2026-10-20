package co.volvia.biz

import co.volvia.biz.core.ActivityPage
import co.volvia.biz.core.CardLookup
import co.volvia.biz.core.EnrollResult
import co.volvia.biz.core.OrgInfo
import co.volvia.biz.core.Overview
import co.volvia.biz.core.Retention
import co.volvia.biz.core.StampResult
import co.volvia.biz.core.TeamPage
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Answers captured from the API on port 8091 (the isolated e2e stack), decoded with the
 * app's own models. If the server's shape drifts from what was copied by hand, this fails
 * on the laptop instead of on somebody's counter.
 */
class ApiShapesTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `decodes a card lookup`() {
        val lookup = json.decodeFromString<CardLookup>(
            """{"customerCardId":"9575d85a-2f20-4c8a-a36f-e4640ef853de","cardToken":"4u8PZIzRoJh_JGFQhsfAm6L12l5ew6aE","customer":{"id":"794ef044-d347-4420-b844-f5a2a7e9fc1f","firstName":"Ana","phone":"3001236280","notes":"","totalStamps":0,"joinedAt":"2026-10-20T02:02:11.428Z"},"card":{"id":"8ea6080a-b9ba-4eba-8382-6f6a6c0acb7b","name":"Club Raíces","stampsRequired":6,"ruleMode":"per_visit","minSpendAmount":null,"maxStampsPerScan":5},"stampsCount":0,"lastStampAt":null,"cooldownSecondsLeft":0,"pendingRewards":[],"design":{"businessName":"Café Raíces 9a17d977","cardName":"Club Raíces","logoUrl":null,"backgroundColor":"#1E3A8A","foregroundColor":"#FFFFFF","accentColor":"#FB923C","emptyStampColor":"#3A56A6","stampStyle":"circle","stampIcon":{"kind":"preset","value":"star"},"rewardPositions":[3,6],"nextReward":{"atStamp":3,"title":"Galleta gratis"}}}""",
        )
        assertEquals("Ana", lookup.customer.firstName)
        assertEquals(5, lookup.card.maxStampsPerScan)
        assertFalse(lookup.card.needsAmount)
        assertEquals(listOf(3, 6), lookup.design.rewardPositions)
        assertNull(lookup.lastStampAt)
    }

    @Test
    fun `decodes a stamp with its event id`() {
        val result = json.decodeFromString<StampResult>(
            """{"customerCardId":"5ce1eaa5-15da-4b18-8372-0917e81583de","eventId":"b86a6c65-b1ea-4030-87aa-afc0cce8f649","stampsAdded":3,"stampsCount":3,"stampsRequired":6,"cycleIndex":0,"unlockedRewards":[{"grantId":"2118d481-4f43-437f-821e-35d400f39fa6","title":"Galleta gratis","description":"","code":"YXFMW7","expiresAt":null}],"pendingRewards":[],"customer":{"id":"a7081dfa-d651-4dbe-ae11-03d2ea91b7a5","firstName":"Camila","isNew":true},"replayed":false,"design":{"businessName":"Café Raíces 9a17d977","cardName":"Club Raíces","logoUrl":null,"backgroundColor":"#1E3A8A","foregroundColor":"#FFFFFF","accentColor":"#FB923C","emptyStampColor":"#3A56A6","stampStyle":"circle","stampIcon":{"kind":"preset","value":"star"},"rewardPositions":[3,6],"nextReward":{"atStamp":6,"title":"Café gratis"}}}""",
        )
        assertEquals("b86a6c65-b1ea-4030-87aa-afc0cce8f649", result.eventId)
        assertEquals("5ce1eaa5-15da-4b18-8372-0917e81583de", result.customerCardId)
        assertEquals("YXFMW7", result.unlockedRewards.single().code)
    }

    @Test
    fun `decodes my activity`() {
        val page = json.decodeFromString<ActivityPage>(
            """{"items":[{"kind":"stamp","id":"b86a6c65-b1ea-4030-87aa-afc0cce8f649","at":"2026-10-20T02:02:26.029Z","customerCardId":"5ce1eaa5-15da-4b18-8372-0917e81583de","customerId":"a7081dfa-d651-4dbe-ae11-03d2ea91b7a5","firstName":"Camila","cardName":"Club Raíces","delta":3,"rewardTitle":null,"canVoid":true}]}""",
        )
        assertTrue(page.items.single().canVoid)
        assertEquals(3, page.items.single().delta)
    }

    @Test
    fun `decodes the org with its plan and public url`() {
        val org = json.decodeFromString<OrgInfo>(
            """{"id":"b0eb13f8-6ad5-422c-a608-3ee4883db5e8","name":"Café Raíces","slug":"cafe-raices","settings":{"legalName":"","privacyEmail":"","visitFrequency":"monthly"},"entitlements":{"plan":"free","effectivePlan":"free","inPremiumTrial":true,"trialCustomersRemaining":30,"features":{"kiosk_mode":true,"full_analytics":false},"limits":{"locations":1,"activeCards":null,"staffSeats":1}},"publicUrl":"https://tarjeta.somosvolvia.com/b/cafe-raices"}""",
        )
        assertTrue(org.entitlements.has("kiosk_mode"))
        assertFalse(org.entitlements.has("full_analytics"))
        assertNull(org.entitlements.limits["activeCards"])
        assertEquals("https://tarjeta.somosvolvia.com", org.passBaseUrl)
        assertEquals("https://tarjeta.somosvolvia.com/b/cafe-raices/privacidad", org.privacyUrl)
    }

    @Test
    fun `decodes analytics`() {
        val overview = json.decodeFromString<Overview>(
            """{"customers":{"total":5,"new":5,"changePct":null},"stamps":{"total":3,"changePct":null},"rewards":{"unlocked":1,"redeemed":0,"redemptionRate":0},"repeatRate":20,"averageVisitsPerCustomer":0.6,"medianDaysBetweenVisits":null,"activeCards":1,"pageViews":0,"limited":false}""",
        )
        assertEquals(0.6, overview.averageVisitsPerCustomer, 0.0)
        val retention = json.decodeFromString<Retention>(
            """{"cohorts":[{"cohort":"2026-10","size":1,"values":[100,null,null,null,null,null]}]}""",
        )
        assertEquals(100.0, retention.cohorts.single().values.first()!!, 0.0)
        assertNull(retention.cohorts.single().values[1])
    }

    @Test
    fun `decodes the team`() {
        val team = json.decodeFromString<TeamPage>(
            """{"members":[{"id":"a8b090c6-ee5b-4fb3-a209-c15ee55663d4","userId":"2b695487","name":"Dueña","email":"o@volvia.test","role":"owner","locationId":null,"joinedAt":"2026-10-20T02:01:53.792Z","lastLoginAt":null}],"pending":[],"seats":1,"seatLimit":1}""",
        )
        assertEquals("owner", team.members.single().role)
        assertEquals(1, team.seatLimit)
    }

    @Test
    fun `decodes an enrolment without a stamp`() {
        val result = json.decodeFromString<EnrollResult>(
            """{"customerId":"c","isNew":false,"cardToken":"t","cardUrl":"https://tarjeta.somosvolvia.com/c/t","walletPasses":{"appleUrl":"a","googleUrl":"g"},"stamp":null}""",
        )
        assertFalse(result.isNew)
        assertNull(result.stamp)
    }
}
