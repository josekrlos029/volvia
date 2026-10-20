package co.volvia.biz.ui.more

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.Tablet
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.volvia.biz.BuildConfig
import co.volvia.biz.core.Plans
import co.volvia.biz.core.Roles
import co.volvia.biz.ui.ActionRow
import co.volvia.biz.ui.AppViewModel
import co.volvia.biz.ui.ConfirmDialog
import co.volvia.biz.ui.InfoRow
import co.volvia.biz.ui.NavRow
import co.volvia.biz.ui.PlanSheet
import co.volvia.biz.ui.Route
import co.volvia.biz.ui.RowDivider
import co.volvia.biz.ui.Section
import co.volvia.biz.ui.SectionPage
import co.volvia.biz.ui.TabTitle
import co.volvia.biz.ui.UiState

/**
 * "Más": the business and location this phone works for, the counter's own settings,
 * the queue, and — for admins and owners — the rest of the business.
 */
@Composable
fun MoreScreen(app: UiState, model: AppViewModel, onOpen: (Route) -> Unit) {
    val colors = MaterialTheme.colorScheme
    var planGate by remember { mutableStateOf<String?>(null) }
    var confirmSignOut by remember { mutableStateOf(false) }
    val org = app.org?.org

    // Plan-gated rooms open the plan sheet straight away instead of a screen that fails.
    fun openGated(feature: String, route: Route) {
        if (app.has(feature)) onOpen(route) else planGate = "business"
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        SectionPage {
            TabTitle("Más", app.userName.ifBlank { null }, inset = 4.dp)

            Section("Negocio") {
                InfoRow("Negocio", app.businessName)
                RowDivider()
                InfoRow("Tu rol", Roles.label(app.role))
                org?.let {
                    RowDivider()
                    InfoRow("Plan", Plans.name(it.entitlements.effectivePlan) + if (it.entitlements.inPremiumTrial) " (prueba)" else "")
                }
            }

            if (app.memberships.size > 1) {
                Section("Cambiar de negocio") {
                    app.memberships.forEachIndexed { index, membership ->
                        if (index > 0) RowDivider()
                        CheckRow(membership.orgName, selected = membership.orgId == app.selectedOrgId) { model.selectOrg(membership.orgId) }
                    }
                }
            }

            // A member pinned to one location, or a business with one, has nothing to choose.
            if (app.pinnedLocationId == null && app.locations.size > 1) {
                Section("Sede", footer = "Los sellos, premios e inscripciones de este celular se cuentan en esta sede.") {
                    app.locations.forEachIndexed { index, location ->
                        if (index > 0) RowDivider()
                        CheckRow(location.name, detail = location.address, selected = location.id == app.locationId) {
                            model.selectLocation(location.id)
                        }
                    }
                }
            } else if (app.pinnedLocationId != null && app.locationName != null) {
                Section("Sede") { InfoRow("Sede", app.locationName!!) }
            }

            Section("Mostrador") {
                NavRow("QR de inscripción", icon = Icons.Outlined.QrCode2) {
                    val cards = app.org?.activeCards.orEmpty()
                    onOpen(Route.JoinQr(cards.singleOrNull()?.id))
                }
                RowDivider()
                Row(
                    Modifier.fillMaxWidth().padding(start = 16.dp, end = 12.dp, top = 6.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Sellado rápido", fontSize = 16.sp)
                        Text(
                            if (app.quickStamp) "Suma 1 sello apenas lee la tarjeta." else "Muestra la tarjeta antes de sellar.",
                            fontSize = 13.sp,
                            color = colors.onSurfaceVariant,
                        )
                    }
                    Switch(checked = app.quickStamp, onCheckedChange = model::setQuickStamp)
                }
            }

            Section("Sellos por enviar") {
                if (app.pendingCount == 0 && app.rejected.isEmpty()) {
                    Text(
                        "Todo enviado",
                        fontSize = 16.sp,
                        color = colors.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                    )
                }
                if (app.pendingCount > 0) {
                    InfoRow("Pendientes", app.pendingCount.toString())
                    RowDivider()
                    ActionRow("Enviar ahora") { model.flush() }
                }
                app.rejected.forEachIndexed { index, rejected ->
                    if (index > 0 || app.pendingCount > 0) RowDivider()
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                        Text("Rechazado", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        Text(rejected.reason, fontSize = 13.sp, color = colors.onSurfaceVariant)
                    }
                }
                if (app.rejected.isNotEmpty()) {
                    RowDivider()
                    ActionRow("Entendido", color = colors.error) { model.clearRejected() }
                }
            }

            if (app.isAdmin) {
                Section("Administrar") {
                    NavRow("Estadísticas", icon = Icons.Outlined.BarChart) { onOpen(Route.Stats) }
                    RowDivider()
                    NavRow("Mensajes", icon = Icons.Outlined.Notifications, locked = !app.has("customer_messages")) {
                        openGated("customer_messages", Route.Messages)
                    }
                    RowDivider()
                    NavRow("Campañas", icon = Icons.Outlined.Campaign, locked = !app.has("campaigns")) {
                        openGated("campaigns", Route.Campaigns)
                    }
                    RowDivider()
                    NavRow("Equipo", icon = Icons.Outlined.Groups) { onOpen(Route.Team) }
                    RowDivider()
                    NavRow("Modo kiosko", icon = Icons.Outlined.Tablet, locked = !app.has("kiosk_mode")) {
                        openGated("kiosk_mode", Route.Kiosk)
                    }
                }
            }

            Section(null) {
                ActionRow("Cerrar sesión", color = colors.error) { confirmSignOut = true }
            }

            Text(
                "Volvia Biz ${BuildConfig.VERSION_NAME}",
                fontSize = 12.sp,
                color = colors.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }

    planGate?.let { PlanSheet(it) { planGate = null } }
    if (confirmSignOut) {
        ConfirmDialog(
            title = "¿Cerrar sesión?",
            body = if (app.pendingCount > 0) "Los ${app.pendingCount} sellos por enviar se quedan en este celular y se envían al volver a entrar." else null,
            confirm = "Cerrar sesión",
            destructive = true,
            onConfirm = {
                confirmSignOut = false
                model.signOut()
            },
            onDismiss = { confirmSignOut = false },
        )
    }
}

@Composable
private fun CheckRow(title: String, detail: String? = null, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 16.sp)
            detail?.takeIf { it.isNotBlank() }?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        if (selected) Icon(Icons.Filled.Check, contentDescription = "Seleccionado", tint = MaterialTheme.colorScheme.primary)
    }
}
