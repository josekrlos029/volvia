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
}
