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
    val role: String,
    val locationId: String? = null,
)

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
    val stampsAdded: Int,
    val stampsCount: Int,
    val stampsRequired: Int,
    val cycleIndex: Int = 0,
    val unlockedRewards: List<UnlockedReward> = emptyList(),
    val pendingRewards: List<PendingReward> = emptyList(),
    val customer: StampCustomer,
    val replayed: Boolean = false,
)

@Serializable
data class RedeemResult(val grantId: String, val title: String)

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
data class StampRequest(
    val cardToken: String,
    val count: Int,
    val idempotencyKey: String,
    val occurredAt: String,
)

@Serializable
data class RedeemRequest(val grantId: String, val idempotencyKey: String)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
private data class ApiErrorEnvelope(val error: Body) {
    @Serializable
    data class Body(@SerialName("code") val code: String, val message: String)
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
) : Exception(message) {

    val isTransient: Boolean
        get() = status == 0 || status >= 500 || status == 408 || status == 429

    /** The server already applied this exact scan. */
    val isAlreadyApplied: Boolean get() = code == "CONFLICT"

    val isAuthError: Boolean get() = status == 401

    companion object {
        val offline = ApiException(0, "OFFLINE", "sin conexión")

        fun decode(status: Int, body: String, json: kotlinx.serialization.json.Json): ApiException =
            runCatching { json.decodeFromString<ApiErrorEnvelope>(body) }
                .map { ApiException(status, it.error.code, it.error.message) }
                .getOrElse { ApiException(status, "INTERNAL", "error $status") }
    }
}
