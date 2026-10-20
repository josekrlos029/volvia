package co.volvia.biz.ui.customers

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import co.volvia.biz.core.CardLook
import co.volvia.biz.core.CustomerCardRow
import co.volvia.biz.core.CustomerDetail
import co.volvia.biz.core.Dates
import co.volvia.biz.core.Phone
import co.volvia.biz.core.WhatsApp
import co.volvia.biz.ui.EmptyState
import co.volvia.biz.ui.ErrorState
import co.volvia.biz.ui.InfoRow
import co.volvia.biz.ui.InlineError
import co.volvia.biz.ui.LoadingState
import co.volvia.biz.ui.PushedScreen
import co.volvia.biz.ui.RowDivider
import co.volvia.biz.ui.Section
import co.volvia.biz.ui.UiState
import co.volvia.biz.ui.openUrl
import co.volvia.biz.ui.scan.BrandedCardFace

/** A customer, from the list or from "Hoy". */
@Composable
fun ProfileScreen(app: UiState, model: ProfileViewModel, onBack: () -> Unit, onStamp: (String) -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var editing by remember { mutableStateOf(false) }
    var adjusting by remember { mutableStateOf<CustomerCardRow?>(null) }

    LaunchedEffect(state.notice) {
        state.notice?.let {
            snackbar.showSnackbar(it)
            model.clearNotice()
        }
    }

    val detail = state.detail
    PushedScreen(
        detail?.customer?.firstName ?: "Cliente",
        onBack = onBack,
        actions = {
            if (app.isAdmin && detail != null) {
                IconButton(onClick = { editing = true }) { Icon(Icons.Outlined.Edit, contentDescription = "Editar cliente") }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                detail != null -> ProfileBody(app, detail, state, model, onStamp, onAdjust = { adjusting = it })
                state.isLoading -> LoadingState()
                else -> ErrorState(state.error ?: "No pudimos abrir este cliente.", onRetry = model::reload)
            }
            SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp))
        }
    }

    if (editing && detail != null) {
        EditSheet(detail, state.isSaving, model, onDismiss = { editing = false })
    }
    adjusting?.let { card ->
        AdjustSheet(card, state.isSaving, model, onDismiss = { adjusting = null })
    }
}

@Composable
private fun ProfileBody(
    app: UiState,
    detail: CustomerDetail,
    state: ProfileState,
    model: ProfileViewModel,
    onStamp: (String) -> Unit,
    onAdjust: (CustomerCardRow) -> Unit,
) {
    val context = LocalContext.current
    val colors = MaterialTheme.colorScheme
    val customer = detail.customer
    val passBase = app.org?.org?.passBaseUrl?.takeIf { it.startsWith("http") }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 40.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Initial(customer.firstName, size = 52)
            Column {
                Text(customer.firstName, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                customer.phone?.takeIf { it.isNotBlank() }?.let { Text(Phone.display(Phone.normalize(it) ?: it), fontSize = 15.sp, color = colors.onSurfaceVariant) }
                Text("Cliente desde ${Dates.date(customer.joinedAt)}", fontSize = 13.sp, color = colors.onSurfaceVariant)
            }
        }

        val phone = customer.phone?.takeIf { it.isNotBlank() && !it.contains('*') }
        val firstCard = detail.cards.firstOrNull { it.status == "active" }
        val firstToken = firstCard?.let { state.lookups[it.id]?.cardToken ?: it.token.takeIf { t -> t.isNotBlank() } }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
            if (phone != null) {
                OutlinedButton(onClick = { openUrl(context, WhatsApp.link(phone)) }, shape = RoundedCornerShape(12.dp), modifier = Modifier.weight(1f)) {
                    Icon(Icons.AutoMirrored.Outlined.Chat, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("WhatsApp")
                }
            }
            if (firstToken != null && passBase != null) {
                OutlinedButton(
                    onClick = {
                        val url = "$passBase/c/$firstToken"
                        openUrl(context, WhatsApp.link(phone, WhatsApp.cardMessage(app.businessName, customer.firstName, url)))
                    },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Reenviar tarjeta")
                }
            }
        }

        detail.cards.forEach { card ->
            val lookup = state.lookups[card.id]
            Section(card.cardName) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (lookup != null) {
                        BrandedCardFace(
                            CardLook.from(lookup.design, lookup.stampsCount, lookup.card.stampsRequired, unlocked = false),
                            title = "${lookup.stampsCount} de ${lookup.card.stampsRequired}",
                        )
                    } else {
                        Text("${card.stampsCount} de ${card.stampsRequired} sellos", fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                    }
                    if (card.status != "active") {
                        Text("Esta tarjeta no está activa.", color = colors.error, fontSize = 14.sp)
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { onStamp(card.id) }, shape = RoundedCornerShape(12.dp), modifier = Modifier.weight(1f)) {
                                Text("Sumar sello")
                            }
                            if (app.isAdmin) {
                                OutlinedButton(onClick = { onAdjust(card) }, shape = RoundedCornerShape(12.dp), modifier = Modifier.weight(1f)) {
                                    Text("Ajustar sellos")
                                }
                            }
                        }
                    }
                    lookup?.pendingRewards?.forEach { reward ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(reward.title, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                                Text("Código ${reward.code}", fontSize = 13.sp, color = colors.onSurfaceVariant)
                            }
                            FilledTonalButton(onClick = { model.redeem(reward.grantId) }, shape = RoundedCornerShape(10.dp)) { Text("Canjear") }
                        }
                    }
                }
            }
        }

        if (customer.notes.isNotBlank() || app.isAdmin) {
            Section("Notas") {
                Text(
                    customer.notes.ifBlank { "Sin notas. Toca el lápiz para agregar una." },
                    fontSize = 15.sp,
                    color = if (customer.notes.isBlank()) colors.onSurfaceVariant else colors.onSurface,
                    modifier = Modifier.padding(16.dp),
                )
            }
        }

        Section("Datos") {
            InfoRow("Correo", customer.email)
            RowDivider()
            InfoRow(
                "Cumpleaños",
                if (customer.birthdayMonth != null && customer.birthdayDay != null) Dates.dayMonth(customer.birthdayMonth, customer.birthdayDay) else "—",
            )
            RowDivider()
            InfoRow("Recibe novedades", if (customer.marketingConsent) "Sí" else "No")
            RowDivider()
            InfoRow("Sellos en total", customer.totalStamps.toString())
        }

        Section("Visitas") {
            if (detail.activity.isEmpty()) EmptyState("Todavía no tiene visitas")
            detail.activity.take(15).forEachIndexed { index, event ->
                if (index > 0) RowDivider()
                InfoRow(
                    Dates.relative(event.occurredAt),
                    when {
                        event.delta > 0 -> "+${event.delta} · ${event.resultingCount} en la tarjeta"
                        else -> "${event.delta} · ${event.resultingCount} en la tarjeta"
                    },
                )
            }
        }

        Section("Premios") {
            if (detail.rewards.isEmpty()) EmptyState("Aún no ha ganado premios")
            detail.rewards.forEachIndexed { index, grant ->
                if (index > 0) RowDivider()
                InfoRow(
                    grant.title,
                    when (grant.status) {
                        "pending" -> "Por entregar"
                        "redeemed" -> "Entregado ${Dates.date(grant.redeemedAt)}"
                        "expired" -> "Venció"
                        "revoked" -> "Anulado"
                        else -> grant.status
                    },
                )
            }
        }
        if (detail.masked) {
            Text(
                "Tu plan muestra el correo y el celular ocultos.",
                fontSize = 12.sp,
                color = colors.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** Admin: notes, birthday and phone. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditSheet(detail: CustomerDetail, saving: Boolean, model: ProfileViewModel, onDismiss: () -> Unit) {
    val customer = detail.customer
    var notes by remember { mutableStateOf(customer.notes) }
    // A masked phone is not the real number: start empty rather than save the asterisks.
    var phone by remember { mutableStateOf(customer.phone?.takeUnless { detail.masked || it.contains('*') }.orEmpty()) }
    var month by remember { mutableStateOf(customer.birthdayMonth) }
    var day by remember { mutableStateOf(customer.birthdayDay) }
    var error by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = MaterialTheme.colorScheme.background, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Editar a ${customer.firstName}", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it.take(1000) },
                label = { Text("Notas") },
                minLines = 3,
                shape = RoundedCornerShape(9.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it.filter { c -> c.isDigit() || c in " +" }.take(18) },
                label = { Text("Celular") },
                placeholder = { Text("+57 300 123 4567") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                shape = RoundedCornerShape(9.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Picker(
                    label = "Mes",
                    value = month?.let { MONTHS[it - 1] } ?: "—",
                    options = listOf("" to "Sin cumpleaños") + MONTHS.mapIndexed { index, name -> (index + 1).toString() to name },
                    onPick = { id ->
                        month = id.toIntOrNull()
                        if (month == null) day = null
                    },
                    modifier = Modifier.weight(1.4f),
                )
                Picker(
                    label = "Día",
                    value = day?.toString() ?: "—",
                    options = (1..31).map { it.toString() to it.toString() },
                    onPick = { day = it.toIntOrNull() },
                    enabled = month != null,
                    modifier = Modifier.weight(1f),
                )
            }
            InlineError(error)
            Button(
                onClick = {
                    model.save(notes, phone, month, day) { failure ->
                        error = failure
                        if (failure == null) onDismiss()
                    }
                },
                enabled = !saving,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) { Text(if (saving) "Guardando…" else "Guardar", fontWeight = FontWeight.SemiBold) }
        }
    }
}

/** Admin: add or take away stamps by hand, always with a reason. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdjustSheet(card: CustomerCardRow, saving: Boolean, model: ProfileViewModel, onDismiss: () -> Unit) {
    var delta by remember { mutableIntStateOf(1) }
    var reason by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = MaterialTheme.colorScheme.background, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().imePadding().padding(horizontal = 20.dp).padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Ajustar sellos", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Text("${card.cardName}: tiene ${card.stampsCount} de ${card.stampsRequired}.", fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
                FilledTonalIconButton(onClick = { delta = (delta - 1).let { if (it == 0) -1 else it }.coerceAtLeast(-20) }) {
                    Icon(Icons.Filled.Remove, contentDescription = "Quitar uno")
                }
                Text(
                    if (delta > 0) "+$delta" else "$delta",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.widthIn(min = 80.dp),
                )
                FilledTonalIconButton(onClick = { delta = (delta + 1).let { if (it == 0) 1 else it }.coerceAtMost(20) }) {
                    Icon(Icons.Filled.Add, contentDescription = "Sumar uno")
                }
            }
            OutlinedTextField(
                value = reason,
                onValueChange = { reason = it.take(200) },
                label = { Text("Motivo (obligatorio)") },
                placeholder = { Text("Ej.: se le olvidó sellar ayer") },
                singleLine = true,
                shape = RoundedCornerShape(9.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            InlineError(error)
            Button(
                onClick = {
                    model.adjust(card.id, delta, reason) { failure ->
                        error = failure
                        if (failure == null) onDismiss()
                    }
                },
                enabled = !saving && reason.trim().length >= 3,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) { Text(if (saving) "Guardando…" else "Ajustar ${if (delta > 0) "+$delta" else "$delta"}", fontWeight = FontWeight.SemiBold) }
        }
    }
}
