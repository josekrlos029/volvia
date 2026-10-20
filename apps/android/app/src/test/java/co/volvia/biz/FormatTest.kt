package co.volvia.biz

import co.volvia.biz.core.Dates
import co.volvia.biz.core.Email
import co.volvia.biz.core.Money
import co.volvia.biz.core.Phone
import co.volvia.biz.core.QrCode
import co.volvia.biz.core.WhatsApp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The small conversions the counter screens lean on: pesos, phones, WhatsApp, dates. */
class FormatTest {
    @Test
    fun `pesos with a thousands dot and no cents`() {
        assertEquals("$12.000", Money.cop(12_000))
        assertEquals("$1.250.000", Money.cop(1_250_000))
        assertEquals("$900", Money.cop(900))
        assertEquals("25.000", Money.grouping("25000"))
        assertEquals(25_000L, Money.parse("$ 25.000"))
        assertNull(Money.parse(""))
    }

    @Test
    fun `a colombian mobile becomes e164 with +57`() {
        assertEquals("+573001234567", Phone.normalize("300 123 4567"))
        assertEquals("+573001234567", Phone.normalize("3001234567"))
        assertEquals("+573001234567", Phone.normalize("57 300 123 4567"))
        // A number written with its own country keeps it.
        assertEquals("+5215512345678", Phone.normalize("+52 1 55 1234 5678"))
        assertEquals("+593991234567", Phone.normalize("991234567", prefix = "+593"))
    }

    @Test
    fun `refuses what cannot be a phone`() {
        assertNull(Phone.normalize("123"))
        assertNull(Phone.normalize("llámame"))
        assertNull(Phone.normalize(""))
    }

    @Test
    fun `whatsapp opens the right chat with the message encoded`() {
        assertEquals(
            "https://wa.me/573001234567?text=Hola%20Ana%2C%20tu%20tarjeta%3A%20https%3A%2F%2Ft.co%2Fc%2Fx",
            WhatsApp.link("+573001234567", "Hola Ana, tu tarjeta: https://t.co/c/x"),
        )
        // Stored by the join form without the country code.
        assertEquals("https://wa.me/573001234567", WhatsApp.link("3001234567"))
    }

    @Test
    fun `without a usable number whatsapp lets them pick the contact`() {
        assertEquals("https://wa.me/?text=hola", WhatsApp.link(null, "hola"))
        assertEquals("https://wa.me/?text=hola", WhatsApp.link("+57 *** *** 4567", "hola"))
    }

    @Test
    fun `the card message ends with the link`() {
        val message = WhatsApp.cardMessage("Café Raíces", "Ana", "https://tarjeta.somosvolvia.com/c/abc")
        assertTrue(message.startsWith("Hola Ana"))
        assertTrue(message.endsWith("https://tarjeta.somosvolvia.com/c/abc"))
    }

    @Test
    fun `emails are checked loosely`() {
        assertTrue(Email.isValid("ana@correo.co"))
        assertFalse(Email.isValid("ana@correo"))
        assertFalse(Email.isValid("ana"))
    }

    @Test
    fun `dates said the way people say them`() {
        val zone = ZoneId.of("America/Bogota")
        val now = Instant.parse("2026-10-19T20:00:00Z")
        assertEquals("15 de abril", Dates.dayMonth(4, 15))
        assertEquals("hace 5 min", Dates.relative("2026-10-19T19:55:00Z", now, zone))
        assertEquals("hace 3 h", Dates.relative("2026-10-19T17:00:00Z", now, zone))
        assertEquals("ayer", Dates.relative("2026-10-18T20:00:00Z", now, zone))
        assertEquals("2 mar 2026", Dates.date("2026-03-02T15:00:00Z", zone))
    }

    @Test
    fun `birthdays count down across the new year`() {
        val today = LocalDate.of(2026, 12, 30)
        assertEquals(0, Dates.daysUntil(12, 30, today))
        assertEquals(3, Dates.daysUntil(1, 2, today))
    }

    @Test
    fun `qr codes are square and stable`() {
        val first = QrCode.encode("https://tarjeta.somosvolvia.com/c/4u8PZIzRoJh_JGFQhsfAm6L12l5ew6aE")
        val second = QrCode.encode("https://tarjeta.somosvolvia.com/c/4u8PZIzRoJh_JGFQhsfAm6L12l5ew6aE")
        assertTrue(first.size >= 21)
        assertEquals(first.size, second.size)
        // The finder pattern's corner module is always dark.
        assertTrue(first[0, 0])
        assertTrue(first[first.size - 1, 0])
    }
}
