package co.volvia.biz.core

import java.net.URLEncoder
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * The small conversions every screen needs, kept out of the composables so the JVM tests
 * can pin them: pesos with a thousands dot, phones the API accepts, WhatsApp links that
 * open on the right chat, and dates said the way people at a counter say them.
 */
object Money {
    private val spanish = Locale.forLanguageTag("es-CO")
    private val grouped = DecimalFormat("#,##0", DecimalFormatSymbols(spanish).apply { groupingSeparator = '.' })

    /** `12000` → `$12.000`. Whole pesos only: COP has no cents worth typing. */
    fun cop(amount: Long): String = "$" + grouped.format(amount)

    /** Whatever was typed, digits only, as an amount; null when there is nothing. */
    fun parse(input: String): Long? = input.filter(Char::isDigit).take(12).toLongOrNull()

    /** The field's text, regrouped as the person types: `12000` → `12.000`. */
    fun grouping(input: String): String = parse(input)?.let { grouped.format(it) }.orEmpty()
}

object Phone {
    const val DEFAULT_PREFIX = "+57"

    /**
     * A number the API's `phoneSchema` accepts, in E.164: `300 123 4567` → `+573001234567`.
     * A number already written with `+` keeps its own country. Null when it cannot be one.
     */
    fun normalize(input: String, prefix: String = DEFAULT_PREFIX): String? {
        val trimmed = input.trim()
        if (trimmed.isEmpty()) return null
        if (!trimmed.all { it.isDigit() || it in " +()-./" }) return null
        val digits = trimmed.filter(Char::isDigit)
        val full = when {
            trimmed.startsWith("+") -> "+$digits"
            // Typed with the country but no plus: 57 300 123 4567.
            digits.length == 12 && digits.startsWith(prefix.removePrefix("+")) -> "+$digits"
            else -> prefix + digits
        }
        val count = full.count(Char::isDigit)
        return full.takeIf { count in 8..15 }
    }

    /** `+573001234567` → `+57 300 123 4567` for reading; anything else as it came. */
    fun display(phone: String?): String {
        if (phone.isNullOrBlank()) return ""
        if (phone.startsWith("+57") && phone.length == 13) {
            val local = phone.substring(3)
            return "+57 ${local.substring(0, 3)} ${local.substring(3, 6)} ${local.substring(6)}"
        }
        return phone
    }
}

object WhatsApp {
    /**
     * `https://wa.me/<number>?text=…`, or the contact picker (`wa.me/?text=`) when there
     * is no number. A masked number (`+57 *** 4567`) is no number at all.
     */
    fun link(phone: String?, text: String? = null): String {
        // Numbers typed in the join form are stored without the country ("3001234567");
        // wa.me needs it, so they get the default one.
        val usable = phone?.takeUnless { it.isBlank() || it.contains('*') }
        val digits = usable?.let { Phone.normalize(it) ?: it }?.filter(Char::isDigit).orEmpty()
        val query = text?.let { "?text=" + encode(it) }.orEmpty()
        return "https://wa.me/$digits$query"
    }

    /** The message that goes with a card link: short, and the link last so it previews. */
    fun cardMessage(businessName: String, firstName: String, cardUrl: String): String =
        "Hola $firstName, esta es tu tarjeta de $businessName. Ábrela y guárdala en tu celular: $cardUrl"

    // URLEncoder writes spaces as `+`, which WhatsApp shows literally.
    private fun encode(value: String) = URLEncoder.encode(value, "UTF-8").replace("+", "%20")
}

object Email {
    private val pattern = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}$")

    fun isValid(input: String): Boolean = pattern.matches(input.trim())
}

object Dates {
    private val spanish = Locale.forLanguageTag("es-CO")
    private val months = listOf(
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    )
    private val time = DateTimeFormatter.ofPattern("h:mm a", spanish)

    fun parse(iso: String?): Instant? = iso?.let { runCatching { Instant.parse(it) }.getOrNull() }

    /** `15 de abril`. */
    fun dayMonth(month: Int, day: Int): String = "$day de ${months.getOrElse(month - 1) { "" }}"

    /** `3 mar 2026`: the date somebody joined. */
    fun date(iso: String?, zone: ZoneId = ZoneId.systemDefault()): String {
        val instant = parse(iso) ?: return ""
        val local = instant.atZone(zone).toLocalDate()
        return "${local.dayOfMonth} ${months[local.monthValue - 1].take(3)} ${local.year}"
    }

    /** `10:32 a. m.`, the time of something that happened today. */
    fun clock(iso: String?, zone: ZoneId = ZoneId.systemDefault()): String =
        parse(iso)?.atZone(zone)?.format(time).orEmpty()

    /** `hace 3 min`, `hace 2 h`, `ayer`, or the date. */
    fun relative(iso: String?, now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): String {
        val instant = parse(iso) ?: return ""
        val elapsed = Duration.between(instant, now)
        return when {
            elapsed.toMinutes() < 1 -> "ahora"
            elapsed.toMinutes() < 60 -> "hace ${elapsed.toMinutes()} min"
            elapsed.toHours() < 24 && instant.atZone(zone).toLocalDate() == now.atZone(zone).toLocalDate() ->
                "hace ${elapsed.toHours()} h"
            instant.atZone(zone).toLocalDate() == now.atZone(zone).toLocalDate().minusDays(1) -> "ayer"
            else -> date(iso, zone)
        }
    }

    /** How many days until a birthday that has no year: 0 today, 1 tomorrow. */
    fun daysUntil(month: Int, day: Int, today: LocalDate = LocalDate.now()): Int {
        val thisYear = runCatching { LocalDate.of(today.year, month, day) }.getOrNull() ?: return 0
        val next = if (thisYear.isBefore(today)) thisYear.plusYears(1) else thisYear
        return java.time.temporal.ChronoUnit.DAYS.between(today, next).toInt()
    }
}
