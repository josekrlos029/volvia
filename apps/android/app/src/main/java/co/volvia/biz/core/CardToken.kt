package co.volvia.biz.core

/**
 * Pulls the card token out of whatever the camera read.
 *
 * The QR on a customer's phone encodes the full card URL. Parsing it here rather than at
 * the call site means a staff member can also scan a printed link, a shortened one with
 * a query string, or type a token by hand, and all three behave the same.
 */
object CardToken {
    /** Tokens are 32 url-safe characters; anything shorter is a different QR entirely. */
    const val MINIMUM_LENGTH = 16

    fun parse(raw: String): String? {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return null

        val withoutQuery = trimmed.substringBefore('?')
        val candidate = withoutQuery.substringAfterLast('/')
        if (candidate.length < MINIMUM_LENGTH) return null
        if (!candidate.all { it.isLetterOrDigit() || it == '-' || it == '_' }) return null

        return candidate
    }
}
