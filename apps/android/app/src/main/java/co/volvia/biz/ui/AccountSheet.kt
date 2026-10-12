package co.volvia.biz.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * "Cuenta": who is signed in, which business they are stamping for, what is still
 * waiting to be sent, and the way out. Same sections as AccountSheet on iOS
 * (apps/ios/Sources/Features/ScanScreen.swift).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountSheet(state: UiState, model: AppViewModel, onDismiss: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.background,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(Modifier.fillMaxWidth()) {
                Text(
                    "Cuenta",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.align(Alignment.Center),
                )
                TextButton(onClick = onDismiss, modifier = Modifier.align(Alignment.CenterEnd)) {
                    Text("Listo", fontWeight = FontWeight.SemiBold)
                }
            }

            Section("Tu cuenta") {
                Row(label = "Nombre", value = state.userName.ifBlank { "—" })
                RowDivider()
                Row(label = "Negocio", value = state.businessName.ifBlank { "—" })
            }

            if (state.memberships.size > 1) {
                Section("Cambiar de negocio") {
                    state.memberships.forEachIndexed { index, membership ->
                        if (index > 0) RowDivider()
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickable {
                                    model.selectOrg(membership.orgId)
                                    onDismiss()
                                }
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(membership.orgName, fontSize = 16.sp, modifier = Modifier.weight(1f))
                            if (membership.orgId == state.selectedOrgId) {
                                Icon(Icons.Filled.Check, contentDescription = "Actual", tint = colors.primary)
                            }
                        }
                    }
                }
            }

            Section("Sellos por enviar") {
                if (state.pendingCount == 0 && state.rejected.isEmpty()) {
                    Text(
                        "Todo enviado",
                        fontSize = 16.sp,
                        color = colors.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                    )
                }
                if (state.pendingCount > 0) {
                    Row(label = "Pendientes", value = state.pendingCount.toString())
                    RowDivider()
                    ActionRow("Enviar ahora", color = colors.primary) { model.flush() }
                }
                state.rejected.forEachIndexed { index, rejected ->
                    if (index > 0 || state.pendingCount > 0) RowDivider()
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                        Text("Rechazado", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        Text(rejected.reason, fontSize = 13.sp, color = colors.onSurfaceVariant)
                    }
                }
                if (state.rejected.isNotEmpty()) {
                    RowDivider()
                    ActionRow("Entendido", color = colors.error) { model.clearRejected() }
                }
            }

            Section(null) {
                ActionRow("Cerrar sesión", color = colors.error) {
                    model.signOut()
                    onDismiss()
                }
            }
        }
    }
}

@Composable
private fun Section(title: String?, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        title?.let {
            Text(
                it.uppercase(),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 16.dp),
            )
        }
        Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
            Column(content = content)
        }
    }
}

@Composable
private fun Row(label: String, value: String) {
    androidx.compose.foundation.layout.Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontSize = 16.sp, modifier = Modifier.weight(1f))
        Text(value, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ActionRow(label: String, color: androidx.compose.ui.graphics.Color, onClick: () -> Unit) {
    Text(
        label,
        fontSize = 16.sp,
        color = color,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
    )
}

@Composable
private fun RowDivider() {
    HorizontalDivider(Modifier.padding(start = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
}
