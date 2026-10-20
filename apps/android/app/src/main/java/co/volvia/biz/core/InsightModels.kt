package co.volvia.biz.core

import kotlinx.serialization.Serializable

/** Mirrored from `packages/shared/src/schemas/analytics.ts` and `analytics/service.ts`. */

@Serializable
data class PulseToday(val stamps: Int = 0, val joins: Int = 0, val rewards: Int = 0)

@Serializable
data class PulseActivity(
    /** `stamp`, `join` or `reward`. */
    val kind: String,
    val customerId: String,
    val firstName: String,
    val at: String,
    val count: Int = 0,
)

@Serializable
data class PulseBirthday(val customerId: String, val firstName: String, val month: Int, val day: Int)

@Serializable
data class Pulse(
    val today: PulseToday = PulseToday(),
    val activity: List<PulseActivity> = emptyList(),
    val birthdays: List<PulseBirthday> = emptyList(),
)

@Serializable
data class OverviewCustomers(val total: Int = 0, val new: Int = 0, val changePct: Double? = null)

@Serializable
data class OverviewStamps(val total: Int = 0, val changePct: Double? = null)

@Serializable
data class OverviewRewards(val unlocked: Int = 0, val redeemed: Int = 0, val redemptionRate: Double = 0.0)

@Serializable
data class Overview(
    val customers: OverviewCustomers = OverviewCustomers(),
    val stamps: OverviewStamps = OverviewStamps(),
    val rewards: OverviewRewards = OverviewRewards(),
    val repeatRate: Double = 0.0,
    val averageVisitsPerCustomer: Double = 0.0,
    val medianDaysBetweenVisits: Double? = null,
    val pageViews: Int = 0,
    val activeCards: Int = 0,
    /** The free plan sees the headline numbers only. */
    val limited: Boolean = false,
    val upgradeTo: String? = null,
)

@Serializable
data class TimeseriesPoint(
    val date: String,
    val stamps: Int = 0,
    val joins: Int = 0,
    val rewardsUnlocked: Int = 0,
    val rewardsRedeemed: Int = 0,
)

@Serializable
data class WeekdayCount(val weekday: Int, val stamps: Int)

@Serializable
data class HourCount(val hour: Int, val stamps: Int)

/** Weekday (0 = domingo) and hour totals, in the business's timezone. */
@Serializable
data class Busiest(
    val byWeekday: List<WeekdayCount> = emptyList(),
    val byHour: List<HourCount> = emptyList(),
)

@Serializable
data class Cohort(val cohort: String, val size: Int = 0, val values: List<Double?> = emptyList())

@Serializable
data class Retention(val cohorts: List<Cohort> = emptyList())
