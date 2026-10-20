package co.volvia.biz.ui.campaigns

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import co.volvia.biz.core.CampaignRow
import co.volvia.biz.core.Dates
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
import co.volvia.biz.ui.messages.ReachLine
import co.volvia.biz.ui.messages.Usage

@Composable
fun CampaignsScreen(app: UiState, model: CampaignsViewModel, onBack: () -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var confirmCancel by remember { mutableStateOf<CampaignRow?>(null) }
    LaunchedEffect(state.notice) {
        state.notice?.let {
            snackbar.showSnackbar(it)
            model.clearNotice()
        }
    }

    state.draft?.let {
        BackHandler { model.closeDraft() }
        DraftView(it, model)
        return
    }
    if (state.picking) {
        BackHandler { model.pick(false) }
        TemplatePicker(model)
        return
    }

    PushedScreen("Campañas", onBack = onBack) { padding ->
        Box(Modifier.fillMaxSize()) {
            SectionPage(padding) {
                val list = state.list
                when {
                    state.gatedTo != null -> {
                        EmptyState("Campañas no incluidas", "Ofertas con sellos dobles, regalos y mensajes, con otro plan.")
                        PlanSheet(state.gatedTo) { onBack() }
                    }
                    state.isLoading -> LoadingState()
                    list == null -> ErrorState(state.error ?: "No pudimos cargar las campañas.", onRetry = model::load)
                    else -> {
                        Usage(list.thisMonth, "campañas")
                        Button(
                            onClick = { model.pick(true) },
                            enabled = list.thisMonth.remaining != 0,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(50.dp),
                        ) { Text("Nueva campaña", fontWeight = FontWeight.SemiBold) }

                        val (live, past) = list.campaigns.partition { it.isLive }
                        Section("Activas") {
                            if (live.isEmpty()) EmptyState("Ninguna en marcha")
                            live.forEachIndexed { index, campaign ->
                                if (index > 0) RowDivider()
                                CampaignLine(campaign, onCancel = { confirmCancel = campaign })
                            }
                        }
                        Section("Pasadas") {
                            if (past.isEmpty()) EmptyState("Aún no hay campañas terminadas")
                            past.forEachIndexed { index, campaign ->
                                if (index > 0) RowDivider()
                                CampaignLine(campaign, onCancel = null)
                            }
                        }
                    }
                }
            }
            SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp))
        }
    }

    confirmCancel?.let { campaign ->
        ConfirmDialog(
            title = "¿Cancelar “${campaign.name}”?",
            body = "La oferta deja de aplicarse en las tarjetas desde ahora.",
            confirm = "Cancelar campaña",
            destructive = true,
            onConfirm = {
                confirmCancel = null
                model.cancel(campaign.id)
            },
            onDismiss = { confirmCancel = null },
        )
    }
}

@Composable
private fun CampaignLine(campaign: CampaignRow, onCancel: (() -> Unit)?) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(campaign.name, fontSize = 16.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            Text(statusLabel(campaign.status), fontSize = 13.sp, color = MaterialTheme.colorScheme.primary)
        }
        Text(campaign.headline, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${Dates.date(campaign.startsAt)} – ${Dates.date(campaign.endsAt)} · ${campaign.stats.targeted} alcanzados · ${campaign.stats.stamps} sellos",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            onCancel?.let { TextButton(onClick = it) { Text("Cancelar") } }
        }
    }
}

private fun statusLabel(status: String) = when (status) {
    "draft" -> "Borrador"
    "scheduled" -> "Programada"
    "running" -> "En curso"
    "finished" -> "Terminada"
    "cancelled" -> "Cancelada"
    else -> status
}

@Composable
private fun TemplatePicker(model: CampaignsViewModel) {
    PushedScreen("Elige una plantilla", onBack = { model.pick(false) }) { padding ->
        SectionPage(padding) {
            Section(null) {
                CAMPAIGN_TEMPLATES.forEachIndexed { index, template ->
                    if (index > 0) RowDivider()
                    Column(
                        Modifier.fillMaxWidth().clickable { model.choose(template) }.padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Row {
                            Text(template.name, fontSize = 16.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                            Text("${template.days} ${if (template.days == 1) "día" else "días"}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(template.description, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(template.offerLabel, fontSize = 13.sp, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
    }
}

@Composable
private fun DraftView(draft: DraftState, model: CampaignsViewModel) {
    var confirm by remember { mutableStateOf(false) }
    val canLaunch = draft.name.trim().length >= 2 && draft.headline.trim().length >= 2 && draft.body.trim().length >= 2 && !draft.isLaunching

    PushedScreen(draft.template.name, onBack = model::closeDraft) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(draft.template.offerLabel, fontSize = 15.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.primary)
            OutlinedTextField(
                value = draft.name,
                onValueChange = { value -> model.edit { it.copy(name = value.take(80)) } },
                label = { Text("Nombre interno") },
                singleLine = true,
                shape = RoundedCornerShape(9.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.headline,
                onValueChange = { value -> model.edit { it.copy(headline = value.take(60)) } },
                label = { Text("Título") },
                supportingText = { Text("${draft.headline.length}/60") },
                singleLine = true,
                shape = RoundedCornerShape(9.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.body,
                onValueChange = { value -> model.edit { it.copy(body = value.take(240)) } },
                label = { Text("Mensaje") },
                supportingText = { Text("${draft.body.length}/240") },
                minLines = 3,
                shape = RoundedCornerShape(9.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Dura", fontSize = 16.sp, modifier = Modifier.weight(1f))
                FilledTonalIconButton(onClick = { model.edit { it.copy(days = (it.days - 1).coerceAtLeast(1)) } }) {
                    Icon(Icons.Filled.Remove, contentDescription = "Un día menos")
                }
                Text(
                    "${draft.days} ${if (draft.days == 1) "día" else "días"}",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.widthIn(min = 76.dp),
                )
                FilledTonalIconButton(onClick = { model.edit { it.copy(days = (it.days + 1).coerceAtMost(60)) } }) {
                    Icon(Icons.Filled.Add, contentDescription = "Un día más")
                }
            }
            ReachLine(draft.reach, draft.isCounting)
            InlineError(draft.error)
            Button(
                onClick = { confirm = true },
                enabled = canLaunch,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) { Text(if (draft.isLaunching) "Lanzando…" else "Lanzar campaña", fontWeight = FontWeight.SemiBold) }
        }
    }

    if (confirm) {
        ConfirmDialog(
            title = "¿Lanzar “${draft.name.trim()}”?",
            body = "Empieza ahora y dura ${draft.days} ${if (draft.days == 1) "día" else "días"}. ${draft.reach?.size?.let { "Llega a $it clientes." } ?: ""}",
            confirm = "Lanzar",
            onConfirm = {
                confirm = false
                model.launch()
            },
            onDismiss = { confirm = false },
        )
    }
}
