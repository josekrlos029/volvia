package co.volvia.biz.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The shapes the API speaks, mirrored from `packages/shared/src/schemas`.
 *
 * `ignoreUnknownKeys` on the parser means a field added to the API never breaks a
 * version of this app that is already on somebody's phone.
 */
@Serializable
data class Membership(
    val orgId: String,
    val orgName: String,
    val orgSlug: String,
    /** `owner`, `admin` or `staff`: decides which parts of "Más" exist at all. */
    val role: String,
    /** Set when the member is pinned to one location; the API enforces it either way. */
    val locationId: String? = null,
) {
    val isAdmin: Boolean get() = role == "owner" || role == "admin"
    val isOwner: Boolean get() = role == "owner"
}

@Serializable
data class SessionUser(
    val id: String,
    val email: String,
    val name: String,
    val memberships: List<Membership>,
)

@Serializable
data class TokenPair(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int,
    val user: SessionUser,
)

@Serializable
data class UnlockedReward(
    val grantId: String,
    val title: String,
    val description: String = "",
    val code: String,
)

@Serializable
data class PendingReward(val grantId: String, val title: String, val code: String)

@Serializable
data class StampCustomer(val id: String, val firstName: String, val isNew: Boolean)

@Serializable
data class StampResult(
    val customerCardId: String? = null,
    /** The ledger row this scan wrote; what "Deshacer" sends back. Absent on old replays. */
    val eventId: String? = null,
    val stampsAdded: Int,
    val stampsCount: Int,
    val stampsRequired: Int,
    val cycleIndex: Int = 0,
    val unlockedRewards: List<UnlockedReward> = emptyList(),
    val pendingRewards: List<PendingReward> = emptyList(),
    val customer: StampCustomer,
    val replayed: Boolean = false,
    /** Absent on a replay of a scan the server recorded before it sent the card's look. */
    val design: StampResultDesign? = null,
)

/** A stamp glyph: one of the presets, an emoji, or an uploaded picture's URL. */
@Serializable
data class StampIcon(val kind: String, val value: String)

@Serializable
data class NextReward(val atStamp: Int, val title: String)

/** How the stamped card looks, so the result can be shown in the business's colours. */
@Serializable
data class StampResultDesign(
    val businessName: String,
    val cardName: String,
    val logoUrl: String? = null,
    val backgroundColor: String,
    val foregroundColor: String,
    val accentColor: String,
    val emptyStampColor: String,
    val stampStyle: String = "circle",
    val stampIcon: StampIcon = StampIcon("preset", "star"),
    val rewardPositions: List<Int> = emptyList(),
    val nextReward: NextReward? = null,
)

@Serializable
data class RedeemCustomer(val id: String, val firstName: String)

@Serializable
data class RedeemResult(
    val grantId: String,
    val title: String,
    val customer: RedeemCustomer? = null,
    val stampsCount: Int = 0,
    val stampsRequired: Int = 0,
    val remainingPending: Int = 0,
)

/**
 * Request bodies, as types rather than string templates.
 *
 * A hand-built JSON string works until a customer's name or a password contains a
 * quote. Letting the serializer do it removes a whole class of bug that would only
 * show up on somebody else's data.
 */
@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class GoogleLoginRequest(val idToken: String)

/** Nulls are left out on the wire (`explicitNulls = false`): the API's fields are optional, not nullable. */
@Serializable
data class StampRequest(
    val cardToken: String? = null,
    val customerCardId: String? = null,
    val count: Int,
    val locationId: String? = null,
    val idempotencyKey: String,
    /** Whole pesos, required by a `min_spend` card. */
    val purchaseAmount: Long? = null,
    val occurredAt: String,
    val note: String? = null,
)

/** One of `grantId`, `code` (typed at the till) or `cardToken` (the oldest reward waiting). */
@Serializable
data class RedeemRequest(
    val grantId: String? = null,
    val code: String? = null,
    val cardToken: String? = null,
    val locationId: String? = null,
    val idempotencyKey: String,
)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
private data class ApiErrorEnvelope(val error: Body) {
    @Serializable
    data class Body(
        @SerialName("code") val code: String,
        val message: String,
        /** The plan that would unlock a FEATURE_NOT_IN_PLAN / PLAN_LIMIT_REACHED. */
        val upgradeTo: String? = null,
        val details: List<Detail> = emptyList(),
    )

    @Serializable
    data class Detail(val path: String, val message: String)
}

/**
 * An error the API returned, with its code intact.
 *
 * Whether it is transient decides whether a customer's stamp is kept or discarded, so
 * the classification lives here rather than being re-decided at each call site.
 */
data class ApiException(
    val status: Int,
    val code: String,
    override val message: String,
    val upgradeTo: String? = null,
    /** Seconds until the cooldown ends, when the API said so. */
    val retryAfterSeconds: Int? = null,
) : Exception(message) {

    /**
     * Worth retrying later. A 429 is usually the rate limiter, but the cooldown and the
     * daily cap also answer 429, and those are the card's rules saying no: retrying them
     * from the queue would only turn a clear "not yet" into a rejection hours later.
     */
    val isTransient: Boolean
        get() = when {
            code in BUSINESS_REFUSALS -> false
            else -> status == 0 || status >= 500 || status == 408 || status == 429
        }

    /** The plan does not include this; shown as "Disponible en el plan X", never as an error. */
    val isPlanGate: Boolean get() = code == "FEATURE_NOT_IN_PLAN" || code == "PLAN_LIMIT_REACHED"

    /** The server already applied this exact scan. */
    val isAlreadyApplied: Boolean get() = code == "CONFLICT"

    val isAuthError: Boolean get() = status == 401

    companion object {
        val offline = ApiException(0, "OFFLINE", "sin conexión")

        /** Permanent "no" from the card's rules, whatever the HTTP status says. */
        val BUSINESS_REFUSALS = setOf("STAMP_COOLDOWN_ACTIVE", "STAMP_DAILY_CAP_REACHED")

        fun decode(status: Int, body: String, json: kotlinx.serialization.json.Json): ApiException =
            runCatching { json.decodeFromString<ApiErrorEnvelope>(body) }
                .map { envelope ->
                    val error = envelope.error
                    ApiException(
                        status,
                        error.code,
                        error.message,
                        error.upgradeTo,
                        error.details.firstOrNull { it.path == "retryAfterSeconds" }?.message?.toIntOrNull(),
                    )
                }
                .getOrElse { ApiException(status, "INTERNAL", "error $status") }
    }
}
