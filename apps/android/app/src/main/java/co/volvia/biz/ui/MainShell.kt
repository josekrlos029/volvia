package co.volvia.biz.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import co.volvia.biz.ui.campaigns.CampaignsScreen
import co.volvia.biz.ui.campaigns.CampaignsViewModel
import co.volvia.biz.ui.customers.CustomersScreen
import co.volvia.biz.ui.customers.CustomersViewModel
import co.volvia.biz.ui.customers.EnrollScreen
import co.volvia.biz.ui.customers.EnrollViewModel
import co.volvia.biz.ui.customers.ProfileScreen
import co.volvia.biz.ui.customers.ProfileViewModel
import co.volvia.biz.ui.kiosk.KioskScreen
import co.volvia.biz.ui.kiosk.KioskViewModel
import co.volvia.biz.ui.messages.MessagesScreen
import co.volvia.biz.ui.messages.MessagesViewModel
import co.volvia.biz.ui.more.JoinQrScreen
import co.volvia.biz.ui.more.MoreScreen
import co.volvia.biz.ui.scan.OutcomeOverlay
import co.volvia.biz.ui.scan.PreviewSheet
import co.volvia.biz.ui.scan.ScanScreen
import co.volvia.biz.ui.scan.ScanViewModel
import co.volvia.biz.ui.stats.StatsScreen
import co.volvia.biz.ui.stats.StatsViewModel
import co.volvia.biz.ui.team.TeamScreen
import co.volvia.biz.ui.team.TeamViewModel
import co.volvia.biz.ui.today.TodayScreen
import co.volvia.biz.ui.today.TodayViewModel

enum class Tab(val label: String, val icon: ImageVector) {
    Scan("Escanear", Icons.Filled.QrCodeScanner),
    Today("Hoy", Icons.Filled.Today),
    Customers("Clientes", Icons.Filled.People),
    More("Más", Icons.Filled.Menu),
}

/** A screen pushed over the tabs. A plain back stack: the app has no deep links to resolve. */
sealed interface Route {
    data class Profile(val customerId: String) : Route
    data object Enroll : Route
    data class JoinQr(val cardId: String?) : Route
    data object Stats : Route
    data object Messages : Route
    data object Campaigns : Route
    data object Team : Route
    data object Kiosk : Route
}

/**
 * What the app is once signed in: four tabs and whatever was pushed on top of them.
 *
 * The scan ViewModel lives at this level, not inside the tab, so "Sumar sello" from a
 * customer's profile opens the same sheet and the same queue as the camera.
 */
@Composable
fun MainShell(app: UiState, model: AppViewModel, scanModel: ScanViewModel, navigator: Navigator) {
    val scan by scanModel.state.collectAsStateWithLifecycle()
    // Every business gets its own copies: switching business must not show the last one's list.
    val orgKey = app.selectedOrgId.orEmpty()

    BackHandler(enabled = navigator.stack.isNotEmpty()) { navigator.pop() }
    BackHandler(enabled = navigator.stack.isEmpty() && navigator.tab != Tab.Scan) { navigator.tab = Tab.Scan }

    val top = navigator.stack.lastOrNull()
    Box(Modifier.fillMaxSize()) {
        if (top == null) {
            Scaffold(
                bottomBar = {
                    NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                        Tab.entries.forEach { tab ->
                            NavigationBarItem(
                                selected = navigator.tab == tab,
                                onClick = { navigator.tab = tab },
                                icon = { Icon(tab.icon, contentDescription = null) },
                                label = { Text(tab.label) },
                            )
                        }
                    }
                },
                // The camera tab draws under the status bar itself.
                contentWindowInsets = WindowInsets(0),
                containerColor = MaterialTheme.colorScheme.background,
            ) { padding ->
                Box(Modifier.padding(padding).fillMaxSize()) {
                    when (navigator.tab) {
                        Tab.Scan -> ScanScreen(app, scan, scanModel)
                        Tab.Today -> {
                            val today: TodayViewModel = viewModel(key = "today-$orgKey")
                            TodayScreen(app, today, onCustomer = { navigator.push(Route.Profile(it)) })
                        }
                        Tab.Customers -> {
                            val customers: CustomersViewModel = viewModel(key = "customers-$orgKey")
                            CustomersScreen(
                                app,
                                customers,
                                onCustomer = { navigator.push(Route.Profile(it)) },
                                onEnroll = { navigator.push(Route.Enroll) },
                            )
                        }
                        Tab.More -> MoreScreen(app, model, onOpen = navigator::push)
                    }
                    if (navigator.tab != Tab.Scan) {
                        // A stamp added from a profile still gets its result card.
                        OutcomeOverlay(scan, scanModel, Modifier.align(Alignment.BottomCenter))
                    }
                }
            }
        } else {
            Box(Modifier.fillMaxSize()) {
                RouteScreen(top, app, scanModel, navigator, orgKey)
                OutcomeOverlay(scan, scanModel, Modifier.align(Alignment.BottomCenter).navigationBarsPadding())
            }
        }

        scan.preview?.let { PreviewSheet(it, scanModel) }
    }
}

@Composable
private fun RouteScreen(route: Route, app: UiState, scanModel: ScanViewModel, navigator: Navigator, orgKey: String) {
    when (route) {
        is Route.Profile -> {
            val profile: ProfileViewModel = viewModel(key = "profile-$orgKey-${route.customerId}")
            LaunchedEffect(route.customerId) { profile.load(route.customerId) }
            ProfileScreen(app, profile, onBack = navigator::pop, onStamp = scanModel::openForCustomerCard)
        }
        Route.Enroll -> {
            val enroll: EnrollViewModel = viewModel(key = "enroll-$orgKey")
            EnrollScreen(
                app,
                enroll,
                onBack = {
                    enroll.reset()
                    navigator.pop()
                },
                onOpenCustomer = { customerId ->
                    enroll.reset()
                    navigator.replaceTop(Route.Profile(customerId))
                },
            )
        }
        is Route.JoinQr -> JoinQrScreen(app, route.cardId, onBack = navigator::pop)
        Route.Stats -> StatsScreen(viewModel<StatsViewModel>(key = "stats-$orgKey"), onBack = navigator::pop)
        Route.Messages -> MessagesScreen(app, viewModel<MessagesViewModel>(key = "messages-$orgKey"), onBack = navigator::pop)
        Route.Campaigns -> CampaignsScreen(app, viewModel<CampaignsViewModel>(key = "campaigns-$orgKey"), onBack = navigator::pop)
        Route.Team -> TeamScreen(app, viewModel<TeamViewModel>(key = "team-$orgKey"), onBack = navigator::pop)
        Route.Kiosk -> KioskScreen(app, viewModel<KioskViewModel>(key = "kiosk-$orgKey"), onExit = navigator::pop)
    }
}

/** The selected tab and the pushed screens; owned by the activity so debug intents can drive it. */
class Navigator {
    var tab by mutableStateOf(Tab.Scan)
    val stack = mutableStateListOf<Route>()

    fun push(route: Route) {
        stack.add(route)
    }

    fun pop() {
        if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex)
    }

    fun replaceTop(route: Route) {
        pop()
        push(route)
    }

    fun reset() {
        stack.clear()
        tab = Tab.Scan
    }
}
