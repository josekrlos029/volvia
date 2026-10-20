package co.volvia.biz.ui.today

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Cake
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import co.volvia.biz.core.ActivityItem
import co.volvia.biz.core.Dates
import co.volvia.biz.ui.ConfirmDialog
import co.volvia.biz.ui.EmptyState
import co.volvia.biz.ui.ErrorState
import co.volvia.biz.ui.LoadingState
import co.volvia.biz.ui.RowDivider
import co.volvia.biz.ui.Section
import co.volvia.biz.ui.TabTitle
import co.volvia.biz.ui.UiState

/** "Hoy": what happened today, my own scans with their undo, and birthdays coming up. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(app: UiState, model: TodayViewModel, onCustomer: (String) -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    var confirm by remember { mutableStateOf<ActivityItem?>(null) }
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.notice) {
        state.notice?.let {
            snackbar.showSnackbar(it)
            model.clearNotice()
        }
    }

    Box(Modifier.fillMaxSize().statusBarsPadding()) {
        PullToRefreshBox(isRefreshing = state.isRefreshing, onRefresh = model::refresh, modifier = Modifier.fillMaxSize()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 120.dp)) {
                item { TabTitle("Hoy", app.locationName?.takeIf { it != app.businessName }?.let { "${app.businessName} · $it" } ?: app.businessName) }

                val pulse = state.pulse
                when {
                    state.isLoading -> item { LoadingState() }
                    pulse == null -> item { ErrorState(state.error ?: "No pudimos cargar el día.", onRetry = model::refresh) }
                    else -> {
                        item {
                            Row(
                                Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                Kpi("Sellos", pulse.today.stamps, Modifier.weight(1f))
                                Kpi("Inscritos", pulse.today.joins, Modifier.weight(1f))
                                Kpi("Premios", pulse.today.rewards, Modifier.weight(1f))
                            }
                        }

                        item {
                            Section("Mis sellos de hoy", Modifier.padding(horizontal = 16.dp)) {
                                if (state.mine.isEmpty()) {
                                    EmptyState("Todavía nada", "Los sellos que pongas hoy aparecen aquí, con su opción de deshacer.")
                                }
                                state.mine.forEachIndexed { index, item ->
                                    if (index > 0) RowDivider()
                                    MineRow(item, onOpen = { onCustomer(item.customerId) }, onUndo = { confirm = item })
                                }
                            }
                        }

                        item {
                            Section("Actividad reciente", Modifier.padding(horizontal = 16.dp)) {
                                if (pulse.activity.isEmpty()) EmptyState("Sin movimiento todavía")
                                pulse.activity.forEachIndexed { index, entry ->
                                    if (index > 0) RowDivider()
                                    Line(
                                        title = entry.firstName,
                                        detail = when (entry.kind) {
                                            "join" -> "Se inscribió"
                                            "stamp" -> if (entry.count < 0) "Sello deshecho (${entry.count})" else "+${entry.count} ${if (entry.count == 1) "sello" else "sellos"}"
                                            else -> "Premio"
                                        },
                                        trailing = Dates.relative(entry.at),
                                        onClick = { onCustomer(entry.customerId) },
                                    )
                                }
                            }
                        }

                        item {
                            Section(
                                "Cumpleaños, próximos 14 días",
                                Modifier.padding(horizontal = 16.dp),
                            ) {
                                if (pulse.birthdays.isEmpty()) EmptyState("Nadie cumple en estos días")
                                pulse.birthdays.forEachIndexed { index, birthday ->
                                    if (index > 0) RowDivider()
                                    val days = Dates.daysUntil(birthday.month, birthday.day)
                                    Row(
                                        Modifier
                                            .fillMaxWidth()
                                            .clickable { onCustomer(birthday.customerId) }
                                            .padding(horizontal = 16.dp, vertical = 12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                                    ) {
                                        Icon(Icons.Outlined.Cake, contentDescription = null, tint = MaterialTheme.colorScheme.tertiary)
                                        Column(Modifier.weight(1f)) {
                                            Text(birthday.firstName, fontSize = 16.sp, fontWeight = FontWeight.Medium)
                                            Text(Dates.dayMonth(birthday.month, birthday.day), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }
                                        Text(
                                            when (days) {
                                                0 -> "Hoy"
                                                1 -> "Mañana"
                                                else -> "En $days días"
                                            },
                                            fontSize = 14.sp,
                                            fontWeight = if (days == 0) FontWeight.SemiBold else FontWeight.Normal,
                                            color = if (days == 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp))
    }

    confirm?.let { item ->
        ConfirmDialog(
            title = "¿Quitar ${if (item.delta == 1) "1 sello" else "${item.delta} sellos"} a ${item.firstName}?",
            body = "${item.cardName} · ${Dates.clock(item.at)}",
            confirm = "Quitar",
            destructive = true,
            onConfirm = {
                confirm = null
                model.void(item)
            },
            onDismiss = { confirm = null },
        )
    }
}

@Composable
private fun Kpi(label: String, value: Int, modifier: Modifier = Modifier) {
    Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface, modifier = modifier) {
        Column(
            Modifier.padding(14.dp).semantics(mergeDescendants = true) { contentDescription = "$value $label hoy" },
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(value.toString(), fontSize = 26.sp, fontWeight = FontWeight.Bold, style = TextStyle(fontFeatureSettings = "tnum"))
            Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun MineRow(item: ActivityItem, onOpen: () -> Unit, onUndo: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onOpen).padding(start = 16.dp, end = 8.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(item.firstName, fontSize = 16.sp, fontWeight = FontWeight.Medium)
            Text(
                "${describe(item)} · ${item.cardName} · ${Dates.clock(item.at)}",
                fontSize = 13.sp,
                color = colors.onSurfaceVariant,
                maxLines = 2,
            )
        }
        if (item.kind == "stamp" && item.canVoid) {
            TextButton(onClick = onUndo) { Text("Deshacer") }
        }
    }
}

private fun describe(item: ActivityItem): String = when (item.kind) {
    "stamp" -> "+${item.delta} ${if (item.delta == 1) "sello" else "sellos"}"
    "void" -> "Deshecho (${item.delta})"
    "redeem" -> "Entregó ${item.rewardTitle ?: "un premio"}"
    else -> item.kind
}

@Composable
private fun Line(title: String, detail: String, trailing: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.Medium)
            Text(detail, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(trailing, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
