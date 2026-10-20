package co.volvia.biz

import co.volvia.biz.core.ApiException
import co.volvia.biz.core.Messages
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The copy is the same as iOS; these pin the codes the API actually sends. */
class MessagesTest {
    private fun error(code: String, message: String = "raw") = ApiException(400, code, message)

    @Test
    fun `sign in explains the common refusals`() {
        assertEquals("Correo o contraseña incorrectos.", Messages.signIn(error("INVALID_CREDENTIALS")))
        assertTrue(Messages.signIn(ApiException.offline).startsWith("Sin conexión"))
        assertTrue(Messages.signIn(error("ACCOUNT_NOT_FOUND")).contains("invite desde el panel"))
        assertEquals("Ese método de entrada no está disponible ahora.", Messages.signIn(error("SERVICE_UNAVAILABLE")))
    }

    @Test
    fun `sign in falls back to the server message`() {
        assertEquals("algo nuevo", Messages.signIn(error("SOMETHING_NEW", "algo nuevo")))
    }

    @Test
    fun `stamp errors cover both the current and the legacy codes`() {
        assertEquals(Messages.stamp(error("CARD_NOT_FOUND")), Messages.stamp(error("CUSTOMER_CARD_NOT_FOUND")))
        assertEquals("Esa tarjeta está bloqueada.", Messages.stamp(error("CUSTOMER_CARD_BLOCKED")))
        assertEquals(Messages.stamp(error("STAMP_TOO_SOON")), Messages.stamp(error("STAMP_COOLDOWN_ACTIVE")))
        assertEquals(Messages.stamp(error("DAILY_CAP_REACHED")), Messages.stamp(error("STAMP_DAILY_CAP_REACHED")))
        assertEquals("Esa tarjeta no es de este negocio.", Messages.stamp(error("NOT_A_MEMBER")))
    }

    @Test
    fun `cooldown and daily cap read as the spec says`() {
        assertEquals("Ya recibió sello hace poco.", Messages.stamp(error("STAMP_COOLDOWN_ACTIVE")))
        assertEquals("Llegó al límite de sellos de hoy.", Messages.stamp(error("STAMP_DAILY_CAP_REACHED")))
        assertEquals("Ya recibió sello hace poco (espera 3 min)", Messages.cooldown(150))
        assertEquals("Ya recibió sello hace poco (espera 1 min)", Messages.cooldown(1))
        val decoded = ApiException.decode(
            429,
            """{"error":{"code":"STAMP_COOLDOWN_ACTIVE","message":"x","details":[{"path":"retryAfterSeconds","message":"240"}]}}""",
            kotlinx.serialization.json.Json { ignoreUnknownKeys = true },
        )
        assertEquals("Ya recibió sello hace poco (espera 4 min)", Messages.stamp(decoded))
    }

    @Test
    fun `a missing or short purchase amount is explained`() {
        assertEquals("Escribe el monto de la compra.", Messages.stamp(ApiException(422, "VALIDATION_FAILED", "purchase amount required")))
        assertEquals(
            "La compra no alcanza el mínimo para sellar.",
            Messages.stamp(ApiException(422, "VALIDATION_FAILED", "purchase below the minimum")),
        )
    }

    @Test
    fun `undo and redeem refusals are in spanish`() {
        assertTrue(Messages.void(error("STAMP_VOID_NOT_ALLOWED")).startsWith("Ya no se puede deshacer"))
        assertEquals("Ese premio ya se entregó.", Messages.redeem(error("REWARD_ALREADY_REDEEMED")))
        assertTrue(Messages.redeem(error("REWARD_NOT_AVAILABLE")).startsWith("Ese premio no está disponible"))
    }

    @Test
    fun `a plan gate names the plan instead of failing`() {
        val gate = ApiException(402, "FEATURE_NOT_IN_PLAN", "feature kiosk_mode is not included", upgradeTo = "business")
        assertTrue(gate.isPlanGate)
        assertEquals("Disponible en el plan Negocio.", Messages.load(gate))
    }
}
