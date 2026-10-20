package co.volvia.biz.core

import kotlinx.serialization.Serializable

/** Mirrored from `apps/api/src/modules/customers/service.ts` (`listCustomers`, `getCustomer`). */

@Serializable
data class CustomerListItem(
    val id: String,
    val firstName: String,
    /** Masked (`m***@…`) when the plan has no `customer_contact_details`. */
    val email: String = "",
    val phone: String? = null,
    val birthdayMonth: Int? = null,
    val birthdayDay: Int? = null,
    val marketingConsent: Boolean = false,
    val totalStamps: Int = 0,
    val totalRewards: Int = 0,
    val joinedAt: String = "",
    val lastStampAt: String? = null,
)

@Serializable
data class CustomerPage(
    val items: List<CustomerListItem> = emptyList(),
    val page: Int = 1,
    val pageSize: Int = 20,
    val total: Int = 0,
    val hasMore: Boolean = false,
    val masked: Boolean = false,
)

@Serializable
data class CustomerRecord(
    val id: String,
    val firstName: String,
    val email: String = "",
    val phone: String? = null,
    val birthdayMonth: Int? = null,
    val birthdayDay: Int? = null,
    val marketingConsent: Boolean = false,
    val notes: String = "",
    val totalStamps: Int = 0,
    val totalRewards: Int = 0,
    val joinedAt: String = "",
    val lastStampAt: String? = null,
)

@Serializable
data class CustomerCardRow(
    /** The customer card id: what lookup, stamp and adjust take. */
    val id: String,
    val token: String = "",
    val cardName: String,
    val stampsCount: Int = 0,
    val stampsRequired: Int = 0,
    val cycleIndex: Int = 0,
    val lifetimeStamps: Int = 0,
    val status: String = "active",
    val joinedAt: String = "",
    val lastStampAt: String? = null,
)

@Serializable
data class CustomerGrant(
    val id: String,
    val title: String,
    val code: String = "",
    /** `pending`, `redeemed`, `expired` or `revoked`. */
    val status: String,
    val grantedAt: String = "",
    val redeemedAt: String? = null,
    val expiresAt: String? = null,
)

@Serializable
data class CustomerEvent(
    val id: String,
    val delta: Int,
    val source: String = "",
    val occurredAt: String,
    val resultingCount: Int = 0,
)

@Serializable
data class CustomerDetail(
    val customer: CustomerRecord,
    val cards: List<CustomerCardRow> = emptyList(),
    val rewards: List<CustomerGrant> = emptyList(),
    val activity: List<CustomerEvent> = emptyList(),
    val masked: Boolean = false,
)
