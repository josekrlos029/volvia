package co.volvia.biz.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/**
 * Messages, campaigns and the kiosk, mirrored from `packages/shared/src/schemas/engagement.ts`,
 * `modules/messages`, `modules/engagement` and `loyalty/kiosk.ts`.
 */

@Serializable
data class Audience(
    /** A built-in bucket (`all`, `regulars`…); ignored when `segmentId` is set. */
    val segment: String = "all",
    val segmentId: String? = null,
    val cardIds: List<String> = emptyList(),
    val customerIds: List<String> = emptyList(),
    /** Promotional sends only reach customers who opted in; the API forces it anyway. */
    val consentOnly: Boolean = true,
)

@Serializable
data class AudienceReach(
    val size: Int = 0,
    val withWallet: Int = 0,
    val applePasses: Int = 0,
    val googlePasses: Int = 0,
)

@Serializable
data class MonthUsage(val used: Int = 0, val limit: Int? = null) {
    val remaining: Int? get() = limit?.let { (it - used).coerceAtLeast(0) }
}

@Serializable
data class MessageRow(
    val id: String,
    val headline: String,
    val body: String = "",
    /** `draft`, `scheduled`, `sending`, `sent` or `failed`. */
    val status: String,
    val scheduledAt: String? = null,
    val sentAt: String? = null,
    val targetedCount: Int = 0,
    val deliveredCount: Int = 0,
    val createdAt: String = "",
)

@Serializable
data class MessageList(
    val messages: List<MessageRow> = emptyList(),
    val thisMonth: MonthUsage = MonthUsage(),
)

@Serializable
data class MessageCreate(val headline: String, val body: String, val audience: Audience)

@Serializable
data class SavedSegment(val id: String, val name: String, val count: Int = 0)

@Serializable
data class SegmentList(val segments: List<SavedSegment> = emptyList())

@Serializable
data class CampaignStats(val targeted: Int = 0, val delivered: Int = 0, val redeemed: Int = 0, val stamps: Int = 0)

@Serializable
data class CampaignRow(
    val id: String,
    val name: String,
    val template: String = "custom",
    /** `draft`, `scheduled`, `running`, `finished` or `cancelled`. */
    val status: String,
    val headline: String = "",
    val body: String = "",
    val startsAt: String = "",
    val endsAt: String = "",
    val stats: CampaignStats = CampaignStats(),
) {
    val isLive: Boolean get() = status == "draft" || status == "scheduled" || status == "running"
}

@Serializable
data class CampaignList(
    val campaigns: List<CampaignRow> = emptyList(),
    val thisMonth: MonthUsage = MonthUsage(),
)

@Serializable
data class ActiveHours(val from: String, val to: String)

/** `POST /v1/campaigns`. The offer and pass override are kept as JSON: they are discriminated unions. */
@Serializable
data class CampaignCreate(
    val name: String,
    val template: String,
    val headline: String,
    val body: String,
    val offer: JsonObject,
    val audience: Audience,
    val startsAt: String,
    val endsAt: String,
    val sendPush: Boolean = true,
    val activeWeekdays: List<Int> = emptyList(),
    val activeHours: ActiveHours? = null,
    val passOverride: JsonObject? = null,
)

@Serializable
data class KioskSessionRequest(val cardId: String, val locationId: String, val deviceLabel: String? = null)

@Serializable
data class KioskSession(val sessionId: String, val secret: String)

@Serializable
data class KioskNonce(val nonce: String, val expiresInSeconds: Int = 30)

@Serializable
data class KioskLastStamp(val at: Long, val rewardUnlocked: Boolean = false)

@Serializable
data class KioskStatus(val lastStamp: KioskLastStamp? = null)
