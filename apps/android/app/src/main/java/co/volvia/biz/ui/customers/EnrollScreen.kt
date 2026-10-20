package co.volvia.biz.ui.customers

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.foundation.selection.toggleable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import co.volvia.biz.core.WhatsApp
import co.volvia.biz.ui.InlineError
import co.volvia.biz.ui.PushedScreen
import co.volvia.biz.ui.QrImage
import co.volvia.biz.ui.UiState
import co.volvia.biz.ui.openUrl
import co.volvia.biz.ui.shareText

private val FieldShape = RoundedCornerShape(9.dp)

/**
 * "+ Inscribir": the public join form, filled in by the staff member with the customer in
 * front of them. The Habeas Data box is the one field that can never be skipped.
 */
@Composable
fun EnrollScreen(app: UiState, model: EnrollViewModel, onBack: () -> Unit, onOpenCustomer: (String) -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    val result = state.result
    if (result != null) {
        EnrolledScreen(app, state, onDone = onBack, onOpenCustomer = { onOpenCustomer(result.customerId) })
        return
    }

    val form = state.form
    val cards = app.org?.activeCards.orEmpty()
    val colors = MaterialTheme.colorScheme
    val context = LocalContext.current
    val businessName = app.org?.org?.settings?.legalName?.takeIf { it.isNotBlank() } ?: app.businessName

    PushedScreen("Inscribir cliente", onBack = onBack) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (cards.size > 1) {
                Picker(
                    label = "Tarjeta",
                    value = cards.firstOrNull { it.id == form.cardId }?.name ?: "Elige la tarjeta",
                    options = cards.map { it.id to it.name },
                    onPick = { id -> model.update { it.copy(cardId = id) } },
                )
            } else if (cards.isEmpty() && app.org != null) {
                Text("Este negocio no tiene tarjetas activas. Publica una desde el panel.", color = colors.error, fontSize = 14.sp)
            }

            OutlinedTextField(
                value = form.firstName,
                onValueChange = { value -> model.update { it.copy(firstName = value.take(60)) } },
                label = { Text("Nombre") },
                singleLine = true,
                shape = FieldShape,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = form.email,
                onValueChange = { value -> model.update { it.copy(email = value.trim().take(254)) } },
                label = { Text("Correo") },
                supportingText = { Text("Es la llave de su tarjeta: con él la recupera.") },
                singleLine = true,
                shape = FieldShape,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = form.prefix,
                    onValueChange = { value ->
                        val cleaned = "+" + value.filter(Char::isDigit).take(3)
                        model.update { it.copy(prefix = cleaned) }
                    },
                    label = { Text("País") },
                    singleLine = true,
                    shape = FieldShape,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    modifier = Modifier.width(92.dp),
                )
                OutlinedTextField(
                    value = form.phone,
                    onValueChange = { value -> model.update { it.copy(phone = value.filter { c -> c.isDigit() || c == ' ' }.take(16)) } },
                    label = { Text("Celular (opcional)") },
                    singleLine = true,
                    shape = FieldShape,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone, imeAction = ImeAction.Done),
                    modifier = Modifier.weight(1f),
                )
            }

            Text("Cumpleaños (opcional)", fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Picker(
                    label = "Mes",
                    value = form.birthMonth?.let { MONTHS[it - 1] } ?: "—",
                    options = listOf("" to "Sin cumpleaños") + MONTHS.mapIndexed { index, name -> (index + 1).toString() to name },
                    onPick = { id ->
                        val month = id.toIntOrNull()
                        model.update { it.copy(birthMonth = month, birthDay = if (month == null) null else it.birthDay) }
                    },
                    modifier = Modifier.weight(1.4f),
                )
                Picker(
                    label = "Día",
                    value = form.birthDay?.toString() ?: "—",
                    options = (1..daysIn(form.birthMonth)).map { it.toString() to it.toString() },
                    onPick = { id -> model.update { it.copy(birthDay = id.toIntOrNull()) } },
                    enabled = form.birthMonth != null,
                    modifier = Modifier.weight(1f),
                )
            }

            SwitchRow(
                "Acepta recibir novedades",
                "Promociones y mensajes del negocio en su tarjeta.",
                form.marketingConsent,
            ) { checked -> model.update { it.copy(marketingConsent = checked) } }

            SwitchRow(
                "Sumar el primer sello",
                "Cuenta la visita de hoy.",
                form.stampNow,
            ) { checked -> model.update { it.copy(stampNow = checked) } }

            // Habeas Data (Ley 1581): explicit, never pre-ticked, with the business named.
            Surface(shape = RoundedCornerShape(12.dp), color = colors.surface) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .toggleable(form.dataConsent, role = Role.Checkbox) { checked -> model.update { it.copy(dataConsent = checked) } }
                        .padding(12.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Checkbox(checked = form.dataConsent, onCheckedChange = null)
                    Spacer(Modifier.width(10.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            "El cliente autoriza el tratamiento de sus datos personales según la política de $businessName.",
                            fontSize = 14.sp,
                        )
                        app.org?.org?.privacyUrl?.let { url ->
                            Text(
                                buildAnnotatedString {
                                    withStyle(SpanStyle(color = colors.primary, textDecoration = TextDecoration.Underline)) {
                                        append("Ver la política de datos")
                                    }
                                },
                                fontSize = 14.sp,
                                modifier = Modifier.clickable { openUrl(context, url) },
                            )
                        }
                        Text("Obligatorio", fontSize = 12.sp, color = colors.onSurfaceVariant)
                    }
                }
            }

            InlineError(state.error)

            Button(
                onClick = model::submit,
                enabled = !state.isWorking && model.problem(form, cards.size) == null,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                Text(if (state.isWorking) "Inscribiendo…" else "Inscribir", fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            }
            model.problem(form, cards.size)?.let {
                Text(it, fontSize = 13.sp, color = colors.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

/** The card is the customer's now: a QR to save it, WhatsApp, the share sheet. */
@Composable
private fun EnrolledScreen(app: UiState, state: EnrollState, onDone: () -> Unit, onOpenCustomer: () -> Unit) {
    val result = state.result ?: return
    val context = LocalContext.current
    val colors = MaterialTheme.colorScheme
    val message = WhatsApp.cardMessage(app.businessName, state.enrolledName, result.cardUrl)

    PushedScreen(if (result.isNew) "Cliente inscrito" else "Ya era cliente", onBack = onDone) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(
                if (result.isNew) "¡Listo, ${state.enrolledName}!" else "${state.enrolledName} ya tenía su tarjeta",
                fontSize = 24.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            )
            Text(
                "Que escanee este código con la cámara de su celular para abrir su tarjeta y guardarla.",
                fontSize = 15.sp,
                color = colors.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            QrImage(result.cardUrl, Modifier.fillMaxWidth(0.82f), description = "Código QR de la tarjeta de ${state.enrolledName}")

            val stamp = result.stamp
            when {
                stamp != null -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Filled.Check, contentDescription = null, tint = colors.primary)
                    Text("Primer sello sumado: ${stamp.stampsCount} de ${stamp.stampsRequired}", fontSize = 15.sp)
                }
                state.form.stampNow -> Text(
                    "No se sumó el sello: las reglas de la tarjeta no lo permiten ahora.",
                    fontSize = 14.sp,
                    color = colors.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }

            Button(
                onClick = { openUrl(context, WhatsApp.link(state.enrolledPhone, message)) },
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) { Text("Enviar por WhatsApp", fontSize = 16.sp, fontWeight = FontWeight.SemiBold) }
            OutlinedButton(
                onClick = { shareText(context, message, "Enviar la tarjeta") },
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) { Text("Compartir…", fontSize = 16.sp) }
            TextButton(onClick = onOpenCustomer) { Text("Ver su perfil") }
            TextButton(onClick = onDone, modifier = Modifier.fillMaxWidth()) {
                Text("Listo", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun SwitchRow(title: String, detail: String?, checked: Boolean, onChange: (Boolean) -> Unit) {
    Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
        Row(
            Modifier
                .fillMaxWidth()
                .toggleable(checked, role = Role.Switch, onValueChange = onChange)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 16.sp)
                detail?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            Switch(checked = checked, onCheckedChange = null)
        }
    }
}

/** A labelled field that opens a menu of options; `id` "" means "none". */
@Composable
fun Picker(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    onPick: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            enabled = enabled,
            label = { Text(label) },
            trailingIcon = { Icon(Icons.Filled.ArrowDropDown, contentDescription = null) },
            shape = FieldShape,
            modifier = Modifier.fillMaxWidth(),
        )
        // The text field swallows taps; a transparent layer on top opens the menu.
        Box(Modifier.matchParentSize().clickable(enabled = enabled, role = Role.DropdownList) { open = true })
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { (id, name) ->
                DropdownMenuItem(text = { Text(name) }, onClick = {
                    open = false
                    onPick(id)
                })
            }
        }
    }
}

val MONTHS = listOf(
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
)

private fun daysIn(month: Int?): Int = when (month) {
    2 -> 29
    4, 6, 9, 11 -> 30
    else -> 31
}
