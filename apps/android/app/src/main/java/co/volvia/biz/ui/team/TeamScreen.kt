package co.volvia.biz.ui.team

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import co.volvia.biz.core.Dates
import co.volvia.biz.core.Location
import co.volvia.biz.core.Member
import co.volvia.biz.core.Roles
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
import co.volvia.biz.ui.customers.Initial
import co.volvia.biz.ui.customers.Picker

@Composable
fun TeamScreen(app: UiState, model: TeamViewModel, onBack: () -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var inviting by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Member?>(null) }
    var removing by remember { mutableStateOf<Member?>(null) }
    val locations = app.locations

    LaunchedEffect(state.notice) {
        state.notice?.let {
            snackbar.showSnackbar(it)
            model.clearNotice()
        }
    }

    PushedScreen(
        "Equipo",
        onBack = onBack,
        actions = {
            IconButton(onClick = { inviting = true }) {
                Icon(Icons.Filled.PersonAdd, contentDescription = "Invitar a alguien")
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize()) {
            SectionPage(padding) {
                val team = state.team
                when {
                    state.isLoading -> LoadingState()
                    team == null -> ErrorState(state.error ?: "No pudimos cargar el equipo.", onRetry = model::load)
                    else -> {
                        team.seatLimit?.let {
                            Text("${team.seats} de $it puestos ocupados", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp))
                        }
                        Section("Personas") {
                            team.members.forEachIndexed { index, member ->
                                if (index > 0) RowDivider()
                                val canEdit = app.isOwner && member.role != "owner"
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .clickable(enabled = canEdit) { editing = member }
                                        .padding(horizontal = 16.dp, vertical = 11.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    Initial(member.name.ifBlank { member.email })
                                    Column(Modifier.weight(1f)) {
                                        Text(member.name.ifBlank { member.email }, fontSize = 16.sp, fontWeight = FontWeight.Medium)
                                        Text(
                                            listOfNotNull(Roles.label(member.role), locations.firstOrNull { it.id == member.locationId }?.name).joinToString(" · "),
                                            fontSize = 13.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    if (canEdit) Text("Editar", color = MaterialTheme.colorScheme.primary, fontSize = 14.sp)
                                }
                            }
                        }
                        Section("Invitaciones pendientes") {
                            if (team.pending.isEmpty()) EmptyState("Ninguna pendiente")
                            team.pending.forEachIndexed { index, invite ->
                                if (index > 0) RowDivider()
                                Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text(invite.email, fontSize = 15.sp)
                                        Text("${Roles.label(invite.role)} · vence ${Dates.date(invite.expiresAt)}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    TextButton(onClick = { model.revoke(invite.id) }, enabled = !state.isWorking) { Text("Anular") }
                                }
                            }
                        }
                        if (!app.isOwner) {
                            Text("Solo el dueño puede cambiar roles o quitar a alguien.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp))
                        }
                    }
                }
            }
            SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp))
        }
    }

    if (inviting) {
        if (!app.has("team_accounts")) {
            PlanSheet("business") { inviting = false }
        } else {
            MemberSheet(
                title = "Invitar a alguien",
                member = null,
                locations = locations,
                working = state.isWorking,
                onSubmit = { email, role, location, done -> model.invite(email, role, location, done) },
                onDismiss = { inviting = false },
            )
        }
    }
    state.gatedTo?.let { gate ->
        PlanSheet(gate) {
            model.clearGate()
            inviting = false
        }
    }
    editing?.let { member ->
        MemberSheet(
            title = member.name.ifBlank { member.email },
            member = member,
            locations = locations,
            working = state.isWorking,
            onSubmit = { _, role, location, done -> model.update(member.id, role, location, done) },
            onRemove = {
                editing = null
                removing = member
            },
            onDismiss = { editing = null },
        )
    }
    removing?.let { member ->
        ConfirmDialog(
            title = "¿Quitar a ${member.name.ifBlank { member.email }}?",
            body = "Deja de poder entrar a este negocio desde la app y el panel.",
            confirm = "Quitar",
            destructive = true,
            onConfirm = {
                removing = null
                model.remove(member.id, member.name.ifBlank { member.email })
            },
            onDismiss = { removing = null },
        )
    }
}

/** Invite (email, role, location) or, for the owner, change someone's role and location. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MemberSheet(
    title: String,
    member: Member?,
    locations: List<Location>,
    working: Boolean,
    onSubmit: (String, String, String?, (String?) -> Unit) -> Unit,
    onDismiss: () -> Unit,
    onRemove: (() -> Unit)? = null,
) {
    var email by remember { mutableStateOf(member?.email.orEmpty()) }
    var role by remember { mutableStateOf(member?.role ?: "staff") }
    var locationId by remember { mutableStateOf(member?.locationId) }
    var error by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = MaterialTheme.colorScheme.background, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(title, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            if (member == null) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it.trim() },
                    label = { Text("Correo") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    shape = RoundedCornerShape(9.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Text("Rol", fontSize = 14.sp, fontWeight = FontWeight.Medium)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf("staff", "admin").forEachIndexed { index, value ->
                    SegmentedButton(
                        selected = role == value,
                        onClick = { role = value },
                        shape = SegmentedButtonDefaults.itemShape(index, 2),
                    ) { Text(Roles.label(value)) }
                }
            }
            Text(
                if (role == "admin") "Ve estadísticas, envía mensajes y administra clientes." else "Sella, entrega premios e inscribe clientes.",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (locations.size > 1) {
                Picker(
                    label = "Sede",
                    value = locations.firstOrNull { it.id == locationId }?.name ?: "Todas las sedes",
                    options = listOf("" to "Todas las sedes") + locations.map { it.id to it.name },
                    onPick = { id -> locationId = id.ifEmpty { null } },
                )
            }
            InlineError(error)
            Button(
                onClick = {
                    onSubmit(email, role, locationId) { failure ->
                        error = failure
                        if (failure == null) onDismiss()
                    }
                },
                enabled = !working && (member != null || email.contains('@')),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) { Text(if (member == null) "Enviar invitación" else "Guardar", fontWeight = FontWeight.SemiBold) }
            onRemove?.let {
                TextButton(onClick = it, modifier = Modifier.fillMaxWidth()) {
                    Text("Quitar del equipo", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
