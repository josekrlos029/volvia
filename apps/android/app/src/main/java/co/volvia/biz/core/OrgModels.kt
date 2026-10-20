package co.volvia.biz.core

import kotlinx.serialization.Serializable

/**
 * The business around the counter: what its plan includes, where it has locations, which
 * cards it runs and who works there. Mirrored from `apps/api/src/modules/orgs/routes.ts`
 * and `cards/routes.ts`.
 */

@Serializable
data class OrgSettings(
    val legalName: String = "",
    val privacyEmail: String = "",
)

@Serializable
data class Entitlements(
    val plan: String = "free",
    val effectivePlan: String = "free",
    val inPremiumTrial: Boolean = false,
    val features: Map<String, Boolean> = emptyMap(),
    /** `null` means unlimited. */
    val limits: Map<String, Int?> = emptyMap(),
) {
    fun has(feature: String): Boolean = features[feature] == true
}

/** `GET /v1/org`. */
@Serializable
data class OrgInfo(
    val id: String,
    val name: String,
    val slug: String = "",
    val logoUrl: String? = null,
    val currency: String = "COP",
    val timezone: String = "America/Bogota",
    val settings: OrgSettings = OrgSettings(),
    val entitlements: Entitlements = Entitlements(),
    /** `<PASS_URL>/b/<slug>`: the base of every customer-facing link. */
    val publicUrl: String = "",
) {
    /** The customer site's origin, e.g. `https://tarjeta.somosvolvia.com`. */
    val passBaseUrl: String get() = publicUrl.substringBefore("/b/")

    /** The business's privacy notice on the customer site, the one the join form links to. */
    val privacyUrl: String? get() = publicUrl.takeIf { it.isNotBlank() }?.let { "$it/privacidad" }
}

@Serializable
data class Location(
    val id: String,
    val name: String,
    val address: String? = null,
)

@Serializable
data class CardRules(
    val mode: String = "per_visit",
    val minSpendAmount: Long? = null,
    val maxStampsPerScan: Int = 1,
    val kioskEnabled: Boolean = false,
)

/** `GET /v1/cards`, the parts the app uses. */
@Serializable
data class CardSummary(
    val id: String,
    val name: String,
    /** `draft`, `active` or `archived`. */
    val status: String,
    val stampsRequired: Int = 0,
    val joinSlug: String = "",
    /** `<PASS_URL>/j/<joinSlug>`: the counter's sign-up QR. */
    val joinUrl: String = "",
    val rules: CardRules = CardRules(),
    val holders: Int = 0,
) {
    val isActive: Boolean get() = status == "active"
}

@Serializable
data class Member(
    val id: String,
    val userId: String = "",
    val name: String,
    val email: String,
    val role: String,
    val locationId: String? = null,
    val joinedAt: String = "",
    val lastLoginAt: String? = null,
)

@Serializable
data class PendingInvite(
    val id: String,
    val email: String,
    val role: String,
    val expiresAt: String = "",
)

@Serializable
data class TeamPage(
    val members: List<Member> = emptyList(),
    val pending: List<PendingInvite> = emptyList(),
    val seats: Int = 0,
    val seatLimit: Int? = null,
)

@Serializable
data class InviteRequest(val email: String, val role: String, val locationId: String? = null)

@Serializable
data class LogoutRequest(val refreshToken: String)

/** Plan ids as the dashboard names them (apps/app/src/lib/format.ts). */
object Plans {
    fun name(id: String?): String = when (id) {
        "free" -> "Gratis"
        "pro" -> "Pro"
        "business" -> "Negocio"
        "multi" -> "Multi"
        null, "" -> "superior"
        else -> id.replaceFirstChar { it.uppercase() }
    }
}

object Roles {
    fun label(role: String): String = when (role) {
        "owner" -> "Dueño"
        "admin" -> "Administrador"
        "staff" -> "Equipo"
        else -> role
    }
}
