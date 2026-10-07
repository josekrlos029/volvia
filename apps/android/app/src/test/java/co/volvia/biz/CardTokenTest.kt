package co.volvia.biz

import co.volvia.biz.core.CardToken
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * What the camera reads is not always what we expect, and the staff member holding the
 * phone has no way to tell a good QR from a bad one. These are the shapes that reach us.
 */
class CardTokenTest {
    private val token = "DAAhsNXnnW5ZCHA9rKVHMke7m0B7mVaE"

    @Test
    fun `reads the token from a card url`() {
        assertEquals(token, CardToken.parse("https://tarjeta.volvia.co/c/$token"))
    }

    @Test
    fun `ignores a query string`() {
        assertEquals(token, CardToken.parse("https://tarjeta.volvia.co/c/$token?stamped=1"))
    }

    @Test
    fun `accepts a bare token`() {
        assertEquals(token, CardToken.parse(token))
    }

    @Test
    fun `trims what the camera leaves behind`() {
        assertEquals(token, CardToken.parse("  https://tarjeta.volvia.co/c/$token\n"))
    }

    @Test
    fun `rejects somebody elses qr code`() {
        assertNull(CardToken.parse("WIFI:S:CafeLuna;T:WPA;P:12345678;;"))
        assertNull(CardToken.parse("https://example.com/"))
        assertNull(CardToken.parse("7501234567890"))
        assertNull(CardToken.parse(""))
    }

    @Test
    fun `rejects something too short to be a token`() {
        assertNull(CardToken.parse("https://tarjeta.volvia.co/c/abc123"))
    }
}
