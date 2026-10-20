package co.volvia.biz.ui.messages

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import co.volvia.biz.core.AudienceReach
import co.volvia.biz.core.Dates
import co.volvia.biz.core.MessageRow
import co.volvia.biz.core.MonthUsage
import co.volvia.biz.ui.ConfirmDialog
import co.volvia.biz.ui.EmptyState
import co.volvia.biz.ui.ErrorState
import co.volvia.biz.ui.InlineError
import co.volvia.biz.ui.LoadingState
import co.volvia.biz.ui.PlanSheet
import co.volvia.biz.ui.PushedScreen
import co.volvia.biz.ui.RowDivider
import co.volvia.biz.ui.Section
import co.volvia.biz.ui.SectionPage
import co.volvia.biz.ui.UiState

/** The dashboard's limits (packages/shared engagement.ts `messageSchema`). */
private const val HEADLINE_MAX = 60
private const val BODY_MAX = 240

@Composable
fun MessagesScreen(app: UiState, model: MessagesViewModel, onBack: () -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.notice) {
        state.notice?.let {
            snackbar.showSnackbar(it)
            model.clearNotice()
        }
    }

    state.compose?.let { compose ->
        BackHandler { model.closeCompose() }
        ComposeView(state, compose, model)
        return
    }

    PushedScreen("Mensajes", onBack = onBack) { padding ->
        Box(Modifier.fillMaxSize()) {
            SectionPage(padding) {
                val list = state.list
                when {
                    state.gatedTo != null -> {
                        EmptyState("Mensajes no incluidos", "Envía novedades a la tarjeta de tus clientes con otro plan.")
                        PlanSheet(state.gatedTo) { onBack() }
                    }
                    state.isLoading -> LoadingState()
                    list == null -> ErrorState(state.error ?: "No pudimos cargar los mensajes.", onRetry = model::load)
                    else -> {
                        Usage(list.thisMonth, "mensajes")
                        Button(
                            onClick = model::startCompose,
                            enabled = list.thisMonth.remaining != 0,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(50.dp),
                        ) { Text("Nuevo mensaje", fontWeight = FontWeight.SemiBold) }
                        Section("Enviados") {
                            if (list.messages.isEmpty()) EmptyState("Todavía no envías mensajes", "Llegan como notificación a la tarjeta en el celular de tus clientes.")
                            list.messages.forEachIndexed { index, message ->
                                if (index > 0) RowDivider()
                                MessageLine(message, onCancel = { model.cancel(message.id) })
                            }
                        }
                    }
                }
            }
            SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp))
        }
    }
}

@Composable
fun Usage(usage: MonthUsage, noun: String) {
    val text = when (val limit = usage.limit) {
        null -> "${usage.used} $noun este mes · sin límite"
        else -> "${usage.used} de $limit $noun este mes"
    }
    Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.primaryContainer) {
        Text(text, fontSize = 15.sp, color = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.fillMaxWidth().padding(14.dp))
    }
}

@Composable
private fun MessageLine(message: MessageRow, onCancel: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(message.headline, fontSize = 16.sp, fontWeight = FontWeight.Medium)
        Text(message.body, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                when (message.status) {
                    "sent" -> "Enviado ${Dates.relative(message.sentAt)} · ${message.deliveredCount} de ${message.targetedCount}"
                    "scheduled" -> "Programado ${Dates.date(message.scheduledAt)} ${Dates.clock(message.scheduledAt)}"
                    "sending" -> "Enviando…"
                    "failed" -> "No se pudo enviar"
                    else -> "Borrador"
                },
                fontSize = 13.sp,
                color = if (message.status == "failed") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            if (message.status == "scheduled" || message.status == "draft") {
                TextButton(onClick = onCancel) { Text("Cancelar") }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ComposeView(state: MessagesState, compose: ComposeState, model: MessagesViewModel) {
    var confirm by remember { mutableStateOf(false) }
    val reach = compose.reach
    val canSend = compose.headline.trim().length >= 2 && compose.body.trim().length >= 2 && (reach?.size ?: 0) > 0 && !compose.isSending

    PushedScreen("Nuevo mensaje", onBack = model::closeCompose) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedTextField(
                value = compose.headline,
                onValueChange = { value -> model.edit { it.copy(headline = value.take(HEADLINE_MAX)) } },
                label = { Text("Título") },
                supportingText = { Text("${compose.headline.length}/$HEADLINE_MAX") },
                singleLine = true,
                shape = RoundedCornerShape(9.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = compose.body,
                onValueChange = { value -> model.edit { it.copy(body = value.take(BODY_MAX)) } },
                label = { Text("Mensaje") },
                supportingText = { Text("${compose.body.length}/$BODY_MAX · puedes usar {{name}}") },
                minLines = 3,
                shape = RoundedCornerShape(9.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            Text("Para quién", fontSize = 14.sp, fontWeight = FontWeight.Medium)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                state.audiences.forEach { choice ->
                    FilterChip(
                        selected = compose.audienceId == choice.id,
                        onClick = { model.edit { it.copy(audienceId = choice.id) } },
                        label = { Text(choice.label) },
                    )
                }
            }
            ReachLine(reach, compose.isCounting)
            Text(
                "Solo llega a quienes aceptaron recibir novedades y tienen la tarjeta guardada.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            InlineError(compose.error)
            Button(
                onClick = { confirm = true },
                enabled = canSend,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) { Text(if (compose.isSending) "Enviando…" else "Enviar", fontWeight = FontWeight.SemiBold) }
        }
    }

    if (confirm) {
        ConfirmDialog(
            title = "¿Enviar a ${reach?.size ?: 0} clientes?",
            body = "“${compose.headline.trim()}” llega ahora a sus tarjetas. No se puede deshacer.",
            confirm = "Enviar",
            onConfirm = {
                confirm = false
                model.send()
            },
            onDismiss = { confirm = false },
        )
    }
}

@Composable
fun ReachLine(reach: AudienceReach?, counting: Boolean) {
    Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
        Text(
            when {
                counting -> "Contando…"
                reach == null -> "No pudimos contar a quién llega."
                reach.size == 0 -> "Nadie en este grupo puede recibirlo todavía."
                else -> "Lo recibirán ${reach.size} ${if (reach.size == 1) "cliente" else "clientes"} (${reach.withWallet} con la tarjeta en el celular)."
            },
            fontSize = 15.sp,
            modifier = Modifier.fillMaxWidth().padding(14.dp),
        )
    }
}
