package co.volvia.biz.ui

import androidx.activity.ComponentActivity
import androidx.lifecycle.ViewModelProvider
import co.volvia.biz.BuildConfig
import co.volvia.biz.core.ActivityItem
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.Busiest
import co.volvia.biz.core.CardLookup
import co.volvia.biz.core.Cohort
import co.volvia.biz.core.CustomerCardRow
import co.volvia.biz.core.CustomerDetail
import co.volvia.biz.core.CustomerEvent
import co.volvia.biz.core.CustomerGrant
import co.volvia.biz.core.CustomerListItem
import co.volvia.biz.core.CustomerRecord
import co.volvia.biz.core.EnrollResult
import co.volvia.biz.core.HourCount
import co.volvia.biz.core.LookupCard
import co.volvia.biz.core.LookupCustomer
import co.volvia.biz.core.LookupReward
import co.volvia.biz.core.NextReward
import co.volvia.biz.core.Overview
import co.volvia.biz.core.OverviewCustomers
import co.volvia.biz.core.OverviewRewards
import co.volvia.biz.core.OverviewStamps
import co.volvia.biz.core.Pulse
import co.volvia.biz.core.PulseActivity
import co.volvia.biz.core.PulseBirthday
import co.volvia.biz.core.PulseToday
import co.volvia.biz.core.Retention
import co.volvia.biz.core.StampCustomer
import co.volvia.biz.core.StampIcon
import co.volvia.biz.core.StampResult
import co.volvia.biz.core.StampResultDesign
import co.volvia.biz.core.TimeseriesPoint
import co.volvia.biz.core.WeekdayCount
import co.volvia.biz.ui.customers.CustomersViewModel
import co.volvia.biz.ui.customers.EnrollForm
import co.volvia.biz.ui.customers.EnrollState
import co.volvia.biz.ui.customers.EnrollViewModel
import co.volvia.biz.ui.customers.ProfileViewModel
import co.volvia.biz.ui.kiosk.KioskViewModel
import co.volvia.biz.ui.scan.PreviewState
import co.volvia.biz.ui.scan.ScanOutcome
import co.volvia.biz.ui.scan.ScanViewModel
import co.volvia.biz.ui.stats.Part
import co.volvia.biz.ui.stats.StatsState
import co.volvia.biz.ui.stats.StatsViewModel
import co.volvia.biz.ui.today.TodayViewModel
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.sin

/**
 * Debug builds only: fake data for store screenshots and design review, the Android
 * equivalent of `VOLVIA_SIM_STATE` on iOS (apps/ios/Sources/Core/SimulatorFixtures.swift).
 *
 *   adb shell am start --activity-single-top -n co.volvia.biz/.MainActivity --es simState today
 *
 * States: preview, stamped, today, customers, profile, enroll, enrolled, stats, kiosk, more.
 * The tabs only draw for a signed-in session, so sign in first (any account).
 */
object DebugFixtures {
    private val now: Instant get() = Instant.now()

    private val design = StampResultDesign(
        businessName = "Café Raíces",
        cardName = "Club Raíces",
        backgroundColor = "#2B1D14",
        foregroundColor = "#FFFFFF",
        accentColor = "#D9A35F",
        emptyStampColor = "#4A3A2E",
        stampStyle = "circle",
        stampIcon = StampIcon("preset", "coffee"),
        rewardPositions = listOf(5, 10),
        nextReward = NextReward(10, "Café gratis"),
    )

    private val lookup = CardLookup(
        customerCardId = "00000000-0000-4000-8000-000000000001",
        cardToken = "fixture-token-0000000000000000",
        customer = LookupCustomer("00000000-0000-4000-8000-0000000000a1", "Ana", "+573001234567", "Prefiere leche de almendras", 27, "2026-03-02T15:00:00Z"),
        card = LookupCard("00000000-0000-4000-8000-0000000000c1", "Club Raíces", 10, "per_visit", null, 3),
        stampsCount = 6,
        lastStampAt = "2026-10-12T15:00:00Z",
        cooldownSecondsLeft = 0,
        pendingRewards = listOf(LookupReward("00000000-0000-4000-8000-0000000000f1", "Galleta de la casa", "K7Q2M9")),
        design = design,
    )

    private fun ago(minutes: Long) = now.minus(minutes, ChronoUnit.MINUTES).toString()

    fun apply(activity: ComponentActivity, name: String, navigator: Navigator, scan: ScanViewModel) {
        if (!BuildConfig.DEBUG) return
        val org = AppServices.get(activity).session.membership?.orgId.orEmpty()
        val provider = ViewModelProvider(activity)
        navigator.stack.clear()
        // Each state starts clean: no sheet or result left over from the previous one.
        scan.showFixture(null, null)
        when (name) {
            "preview" -> {
                navigator.tab = Tab.Scan
                scan.showFixture(null, PreviewState(cardToken = lookup.cardToken, lookup = lookup, isLoading = false, count = 2))
            }
            "stamped" -> {
                navigator.tab = Tab.Scan
                val result = StampResult(
                    customerCardId = lookup.customerCardId,
                    eventId = "00000000-0000-4000-8000-0000000000e1",
                    stampsAdded = 2,
                    stampsCount = 8,
                    stampsRequired = 10,
                    customer = StampCustomer(lookup.customer.id, "Ana", false),
                    design = design,
                )
                scan.showFixture(ScanOutcome.Stamped(result, System.currentTimeMillis() + 272_000), null)
            }
            "today" -> {
                navigator.tab = Tab.Today
                provider["today-$org", TodayViewModel::class.java].showFixture(
                    Pulse(
                        today = PulseToday(stamps = 42, joins = 5, rewards = 3),
                        activity = listOf(
                            PulseActivity("stamp", "c1", "Ana", ago(3), 2),
                            PulseActivity("join", "c2", "Julián", ago(18), 0),
                            PulseActivity("stamp", "c3", "Valentina", ago(41), 1),
                            PulseActivity("stamp", "c4", "Mateo", ago(95), 1),
                        ),
                        birthdays = listOf(
                            PulseBirthday("c5", "Camila", LocalDate.now().monthValue, LocalDate.now().dayOfMonth),
                            PulseBirthday("c6", "Santiago", LocalDate.now().plusDays(3).monthValue, LocalDate.now().plusDays(3).dayOfMonth),
                        ),
                    ),
                    listOf(
                        ActivityItem("stamp", "e1", ago(3), "cc1", "c1", "Ana", "Club Raíces", 2, null, canVoid = true),
                        ActivityItem("redeem", "e2", ago(26), "cc7", "c7", "Laura", "Club Raíces", 0, "Café gratis"),
                        ActivityItem("stamp", "e3", ago(41), "cc3", "c3", "Valentina", "Club Raíces", 1, null, canVoid = false),
                    ),
                )
            }
            "customers" -> {
                navigator.tab = Tab.Customers
                provider["customers-$org", CustomersViewModel::class.java].showFixture(
                    listOf("Ana" to 27, "Camila" to 19, "Julián" to 3, "Laura" to 44, "Mateo" to 8, "Santiago" to 12, "Valentina" to 15, "Isabella" to 6)
                        .mapIndexed { index, (name, stamps) ->
                            CustomerListItem(
                                id = "c$index",
                                firstName = name,
                                email = "${name.lowercase()}@correo.co",
                                phone = "+57300${(1234567 + index * 1111).toString().padStart(7, '0')}",
                                totalStamps = stamps,
                                joinedAt = "2026-0${(index % 9) + 1}-10T15:00:00Z",
                                lastStampAt = ago(30L * (index + 1) * 7),
                            )
                        },
                )
            }
            "profile" -> {
                val id = lookup.customer.id
                provider["profile-$org-$id", ProfileViewModel::class.java].showFixture(
                    CustomerDetail(
                        customer = CustomerRecord(
                            id = id,
                            firstName = "Ana",
                            email = "ana@correo.co",
                            phone = "+573001234567",
                            birthdayMonth = 4,
                            birthdayDay = 15,
                            marketingConsent = true,
                            notes = "Prefiere leche de almendras",
                            totalStamps = 27,
                            totalRewards = 2,
                            joinedAt = "2026-03-02T15:00:00Z",
                        ),
                        cards = listOf(CustomerCardRow(lookup.customerCardId, lookup.cardToken, "Club Raíces", 6, 10)),
                        rewards = listOf(
                            CustomerGrant("g1", "Galleta de la casa", "K7Q2M9", "pending", ago(60 * 24 * 3)),
                            CustomerGrant("g2", "Café gratis", "B3X8P1", "redeemed", ago(60 * 24 * 40), ago(60 * 24 * 38)),
                        ),
                        activity = (1..6).map { CustomerEvent("v$it", 1, "staff_scan", ago(60L * 24 * it * 4), 7 - it) },
                    ),
                    mapOf(lookup.customerCardId to lookup),
                )
                navigator.push(Route.Profile(id))
            }
            "enroll" -> {
                provider["enroll-$org", EnrollViewModel::class.java].showFixture(
                    EnrollState(
                        form = EnrollForm(
                            firstName = "Julián",
                            email = "julian@correo.co",
                            phone = "300 555 0199",
                            birthMonth = 8,
                            birthDay = 21,
                            marketingConsent = true,
                            dataConsent = true,
                        ),
                    ),
                )
                navigator.push(Route.Enroll)
            }
            "enrolled" -> {
                provider["enroll-$org", EnrollViewModel::class.java].showFixture(
                    EnrollState(
                        form = EnrollForm(firstName = "Julián", email = "julian@correo.co", dataConsent = true),
                        result = EnrollResult(
                            customerId = "c2",
                            isNew = true,
                            cardToken = "fixture-token-0000000000000000",
                            cardUrl = "https://tarjeta.somosvolvia.com/c/fixture-token-0000000000000000",
                            stamp = StampResult(stampsAdded = 1, stampsCount = 1, stampsRequired = 10, customer = StampCustomer("c2", "Julián", true)),
                        ),
                        enrolledName = "Julián",
                        enrolledPhone = "+573005550199",
                    ),
                )
                navigator.push(Route.Enroll)
            }
            "stats" -> {
                val today = LocalDate.now()
                provider["stats-$org", StatsViewModel::class.java].showFixture(
                    StatsState(
                        overview = Part.Ready(
                            Overview(
                                customers = OverviewCustomers(total = 412, new = 38, changePct = 12.5),
                                stamps = OverviewStamps(total = 1290, changePct = 8.1),
                                rewards = OverviewRewards(unlocked = 74, redeemed = 61, redemptionRate = 82.4),
                                repeatRate = 63.2,
                                averageVisitsPerCustomer = 3.1,
                                medianDaysBetweenVisits = 6.5,
                                activeCards = 1,
                            ),
                        ),
                        series = Part.Ready(
                            (29 downTo 0).map { back ->
                                val day = today.minusDays(back.toLong())
                                val weekend = day.dayOfWeek.value >= 6
                                TimeseriesPoint(
                                    date = day.toString(),
                                    stamps = (34 + 12 * sin(back / 2.3) + if (weekend) 18 else 0).toInt(),
                                    joins = (2 + (back * 7) % 5),
                                )
                            },
                        ),
                        busiest = Part.Ready(
                            Busiest(
                                byWeekday = listOf(120, 150, 160, 170, 210, 320, 260).mapIndexed { day, value -> WeekdayCount(day, value) },
                                byHour = (0..23).map { hour ->
                                    HourCount(hour, if (hour < 7 || hour > 21) 0 else (20 + 60 * sin((hour - 7) / 14.0 * Math.PI)).toInt() + if (hour in 12..13) 40 else 0)
                                },
                            ),
                        ),
                        retention = Part.Ready(
                            Retention(
                                listOf(
                                    Cohort("2026-05", 64, listOf(100.0, 61.0, 48.0, 41.0, 37.0, 35.0)),
                                    Cohort("2026-06", 71, listOf(100.0, 58.0, 45.0, 40.0, 36.0, null)),
                                    Cohort("2026-07", 55, listOf(100.0, 66.0, 51.0, 44.0, null, null)),
                                    Cohort("2026-08", 80, listOf(100.0, 63.0, 50.0, null, null, null)),
                                    Cohort("2026-09", 92, listOf(100.0, 69.0, null, null, null, null)),
                                    Cohort("2026-10", 38, listOf(100.0, null, null, null, null, null)),
                                ),
                            ),
                        ),
                    ),
                )
                navigator.push(Route.Stats)
            }
            "kiosk" -> {
                provider["kiosk-$org", KioskViewModel::class.java].showFixture("https://tarjeta.somosvolvia.com/k/fixture-nonce-000000000000")
                navigator.push(Route.Kiosk)
            }
            "more" -> navigator.tab = Tab.More
        }
    }
}
