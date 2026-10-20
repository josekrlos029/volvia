package co.volvia.biz.core

import kotlinx.serialization.Serializable

/**
 * What the counter needs beyond a plain scan, mirrored from
 * `packages/shared/src/schemas/loyalty.ts` and `customer.ts`: the card looked up before
 * stamping, the undo, the sign-up at the till and the cashier's own day.
 */

@Serializable
data class LookupCustomer(
    val id: String,
    val firstName: String,
    val phone: String? = null,
    val notes: String? = null,
    val totalStamps: Int = 0,
    val joinedAt: String = "",
)

@Serializable
data class LookupCard(
    val id: String,
    val name: String,
    val stampsRequired: Int,
    /** `per_visit`, `per_purchase` or `min_spend`. */
    val ruleMode: String = "per_visit",
    /** Whole pesos; only meaningful for `min_spend`. */
    val minSpendAmount: Long? = null,
    val maxStampsPerScan: Int = 1,
) {
    val needsAmount: Boolean get() = ruleMode == "min_spend"
}

@Serializable
data class LookupReward(
    val grantId: String,
    val title: String,
    val code: String,
    val expiresAt: String? = null,
)

/** `GET /v1/lookup`: the scanned card before anything is written. */
@Serializable
data class CardLookup(
    val customerCardId: String,
    val cardToken: String,
    val customer: LookupCustomer,
    val card: LookupCard,
    val stampsCount: Int,
    val lastStampAt: String? = null,
    val cooldownSecondsLeft: Int = 0,
    val pendingRewards: List<LookupReward> = emptyList(),
    val design: StampResultDesign,
)

@Serializable
data class VoidRequest(val reason: String? = null)

@Serializable
data class VoidResult(
    val customerCardId: String,
    val stampsCount: Int,
    val stampsRequired: Int,
    val stampsRemoved: Int,
    val rewardsRevoked: Int = 0,
)

@Serializable
data class Birthday(val month: Int, val day: Int)

/** `POST /v1/enroll`. `dataConsent` is the Habeas Data tick and must be literally true. */
@Serializable
data class EnrollRequest(
    val cardId: String,
    val firstName: String,
    val email: String,
    val phone: String? = null,
    val birthday: Birthday? = null,
    val marketingConsent: Boolean = false,
    val dataConsent: Boolean = true,
    val stampNow: Boolean = true,
    val locationId: String? = null,
    val idempotencyKey: String,
)

@Serializable
data class WalletLinks(val appleUrl: String? = null, val googleUrl: String? = null)

@Serializable
data class EnrollResult(
    val customerId: String,
    val isNew: Boolean,
    val cardToken: String,
    /** The customer's card page: the big QR and the WhatsApp link both point here. */
    val cardUrl: String,
    val walletPasses: WalletLinks = WalletLinks(),
    val stamp: StampResult? = null,
)

/** One line of "Mis sellos de hoy". For `stamp`, `id` is the event to undo. */
@Serializable
data class ActivityItem(
    val kind: String,
    val id: String,
    val at: String,
    val customerCardId: String,
    val customerId: String,
    val firstName: String,
    val cardName: String,
    val delta: Int = 0,
    val rewardTitle: String? = null,
    val canVoid: Boolean = false,
)

@Serializable
data class ActivityPage(val items: List<ActivityItem> = emptyList())

@Serializable
data class AdjustRequest(
    val customerCardId: String,
    val delta: Int,
    val reason: String,
    val idempotencyKey: String,
)
