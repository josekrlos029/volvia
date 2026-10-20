package co.volvia.biz.ui.scan

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.volvia.biz.core.CardLook
import co.volvia.biz.core.CardLookup
import co.volvia.biz.core.Messages
import co.volvia.biz.core.Money
import co.volvia.biz.ui.ErrorState
import co.volvia.biz.ui.InlineError
import co.volvia.biz.ui.LoadingState

/**
 * Between reading a card and stamping it: who it is, where they are on the card, the
 * rewards waiting for them, and how many stamps this visit is worth (or what they spent).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PreviewSheet(preview: PreviewState, model: ScanViewModel) {
    ModalBottomSheet(
        onDismissRequest = model::closePreview,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.background,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            val lookup = preview.lookup
            when {
                lookup != null -> PreviewBody(lookup, preview, model)
                preview.isLoading -> LoadingState(label = "Buscando la tarjeta…")
                else -> {
                    ErrorState(preview.error ?: Messages.GENERIC)
                    OutlinedButton(onClick = model::closePreview, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                        Text("Cerrar")
                    }
                }
            }
        }
    }
}

@Composable
private fun PreviewBody(lookup: CardLookup, preview: PreviewState, model: ScanViewModel) {
    val colors = MaterialTheme.colorScheme
    val card = CardLook.from(lookup.design, lookup.stampsCount, lookup.card.stampsRequired, unlocked = false)
    BrandedCardFace(card, lookup.customer.firstName)

    if (lookup.cooldownSecondsLeft > 0) {
        Surface(color = colors.tertiary.copy(alpha = 0.16f), shape = RoundedCornerShape(12.dp)) {
            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Outlined.Schedule, contentDescription = null, tint = colors.onSurface)
                Text(
                    "Espera ${(lookup.cooldownSecondsLeft + 59) / 60} min: ya recibió sello hace poco.",
                    fontSize = 15.sp,
                )
            }
        }
    }

    lookup.customer.notes?.takeIf { it.isNotBlank() }?.let {
        Text("Nota: $it", fontSize = 14.sp, color = colors.onSurfaceVariant)
    }

    if (lookup.pendingRewards.isNotEmpty()) {
        Text("PREMIOS POR ENTREGAR", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = colors.onSurfaceVariant)
        Surface(shape = RoundedCornerShape(12.dp), color = colors.surface) {
            Column {
                lookup.pendingRewards.forEachIndexed { index, reward ->
                    if (index > 0) HorizontalDivider(Modifier.padding(start = 16.dp), color = colors.outlineVariant)
                    Row(
                        Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(reward.title, fontSize = 16.sp, fontWeight = FontWeight.Medium)
                            Text("Código ${reward.code}", fontSize = 13.sp, color = colors.onSurfaceVariant)
                        }
                        Button(
                            onClick = { model.redeemInPreview(reward.grantId) },
                            enabled = !preview.isWorking,
                            shape = RoundedCornerShape(10.dp),
                        ) { Text("Entregar") }
                    }
                }
            }
        }
    }
    preview.notice?.let { Text(it, fontSize = 14.sp, color = colors.primary, fontWeight = FontWeight.Medium) }

    val max = lookup.card.maxStampsPerScan.coerceAtLeast(1)
    if (max > 1) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Sellos", fontSize = 16.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            FilledTonalIconButton(onClick = { model.setCount(preview.count - 1) }, enabled = preview.count > 1) {
                Icon(Icons.Filled.Remove, contentDescription = "Un sello menos")
            }
            Text(
                preview.count.toString(),
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.widthIn(min = 44.dp).semantics { contentDescription = "${preview.count} sellos" },
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            FilledTonalIconButton(onClick = { model.setCount(preview.count + 1) }, enabled = preview.count < max) {
                Icon(Icons.Filled.Add, contentDescription = "Un sello más")
            }
        }
    }

    if (lookup.card.needsAmount) {
        val minimum = lookup.card.minSpendAmount
        OutlinedTextField(
            value = preview.amount,
            onValueChange = model::setAmount,
            label = { Text("Monto de la compra") },
            prefix = { Text("$") },
            supportingText = minimum?.let { { Text("Mínimo ${Money.cop(it)} para sellar") } },
            isError = minimum != null && (preview.amount.toLongOrNull() ?: 0) in 1 until minimum,
            singleLine = true,
            visualTransformation = ThousandsTransformation,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Next),
            shape = RoundedCornerShape(9.dp),
            modifier = Modifier.fillMaxWidth(),
        )
    }

    OutlinedTextField(
        value = preview.note,
        onValueChange = model::setNote,
        label = { Text("Nota (opcional)") },
        singleLine = true,
        shape = RoundedCornerShape(9.dp),
        modifier = Modifier.fillMaxWidth(),
    )

    InlineError(preview.error)

    val amountMissing = lookup.card.needsAmount && preview.amount.isBlank()
    Button(
        onClick = model::stampFromPreview,
        enabled = !preview.isWorking && !amountMissing,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth().height(52.dp),
    ) {
        Text(
            when {
                preview.isWorking -> "Sellando…"
                preview.count == 1 -> "Sellar 1"
                else -> "Sellar ${preview.count}"
            },
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
    TextButton(onClick = model::closePreview, modifier = Modifier.fillMaxWidth()) { Text("Cancelar") }
}

/** Shows `12000` as `12.000` without changing what is stored, so the cursor never jumps. */
private object ThousandsTransformation : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val digits = text.text
        val formatted = Money.grouping(digits)
        if (formatted.isEmpty()) return TransformedText(text, OffsetMapping.Identity)
        val mapping = object : OffsetMapping {
            override fun originalToTransformed(offset: Int): Int {
                if (offset <= 0) return 0
                var seen = 0
                formatted.forEachIndexed { index, char ->
                    if (char.isDigit()) seen += 1
                    if (seen == offset) return index + 1
                }
                return formatted.length
            }

            override fun transformedToOriginal(offset: Int): Int =
                formatted.take(offset).count { it.isDigit() }.coerceIn(0, digits.length)
        }
        return TransformedText(AnnotatedString(formatted), mapping)
    }
}
