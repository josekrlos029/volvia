package co.volvia.biz.ui.scan

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Redeem
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.volvia.biz.core.ScanOutcomeUi
import co.volvia.biz.ui.ConfirmDialog
import kotlinx.coroutines.delay

enum class OutcomeKind { Stamped, Queued, Failed }

/** What happened, in the words a person would use, large enough to read at arm's length. */
@Composable
fun ScanOutcomeCard(
    outcome: ScanOutcomeUi,
    kind: OutcomeKind,
    onRedeem: (String) -> Unit,
    onDismiss: () -> Unit,
    undo: UndoAction? = null,
) {
    outcome.card?.let { card ->
        BrandedOutcomeCard(outcome, card, onRedeem, onDismiss, undo)
        return
    }
    val colors = MaterialTheme.colorScheme
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = colors.surface.copy(alpha = 0.96f),
        shadowElevation = 8.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(outcome.title, fontSize = if (kind == OutcomeKind.Failed) 22.sp else 24.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    outcome.body,
                    fontSize = if (kind == OutcomeKind.Stamped) 17.sp else 15.sp,
                    color = colors.onSurfaceVariant,
                    style = TextStyle(fontFeatureSettings = "tnum"),
                )
            }

            outcome.rewardGrantId?.let { grantId ->
                HorizontalDivider(color = colors.outlineVariant)
                if (outcome.rewardIsNew) {
                    outcome.rewardTitle?.let { Text(it, fontSize = 18.sp, fontWeight = FontWeight.SemiBold) }
                    outcome.rewardCode?.let {
                        Text("Código $it", fontSize = 15.sp, color = colors.onSurfaceVariant)
                    }
                    Button(onClick = { onRedeem(grantId) }, shape = RoundedCornerShape(12.dp)) {
                        Text("Entregar ahora")
                    }
                } else {
                    outcome.rewardTitle?.let { Text(it, fontSize = 15.sp, fontWeight = FontWeight.Medium) }
                    OutlinedButton(onClick = { onRedeem(grantId) }, shape = RoundedCornerShape(12.dp)) {
                        Text("Entregar ahora")
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                undo?.let { TextButton(onClick = it.onUndo) { Text(it.label, fontSize = 15.sp) } }
                TextButton(onClick = onDismiss, modifier = Modifier.weight(1f)) {
                    Text("Siguiente cliente", fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

/**
 * The last outcome, sliding up from the bottom, with "Deshacer" while it lasts. Used over
 * the camera and over any other tab (a stamp added from a customer's profile).
 */
@Composable
fun OutcomeOverlay(state: ScanState, model: ScanViewModel, modifier: Modifier = Modifier) {
    // Keep the last outcome around while the card animates out.
    var shown by remember { mutableStateOf<ScanOutcome?>(null) }
    if (state.outcome != null) shown = state.outcome
    var confirmUndo by remember { mutableStateOf(false) }

    // A buzz the staff member feels with the phone held out to the customer.
    val haptics = LocalHapticFeedback.current
    LaunchedEffect(state.outcome) {
        when (state.outcome) {
            is ScanOutcome.Stamped, is ScanOutcome.Voided, is ScanOutcome.Redeemed, ScanOutcome.Queued ->
                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            else -> Unit
        }
    }

    AnimatedVisibility(
        visible = state.outcome != null,
        modifier = modifier,
        enter = slideInVertically(tween(220)) { it } + fadeIn(tween(220)),
        exit = slideOutVertically(tween(220)) { it } + fadeOut(tween(220)),
    ) {
        shown?.let { outcome ->
            Box(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
                ScanOutcomeCard(
                    outcome.toUi(),
                    kind = outcome.kind(),
                    onRedeem = model::redeem,
                    onDismiss = model::dismissOutcome,
                    undo = rememberUndo(outcome) { confirmUndo = true },
                )
            }
        }
    }

    val stamped = state.outcome as? ScanOutcome.Stamped
    if (confirmUndo && stamped != null) {
        val added = stamped.result.stampsAdded
        ConfirmDialog(
            title = "¿Quitar ${if (added == 1) "1 sello" else "$added sellos"} a ${stamped.result.customer.firstName}?",
            body = if (stamped.result.unlockedRewards.isNotEmpty()) "También se anula el premio que acaba de ganar." else null,
            confirm = "Quitar",
            destructive = true,
            onConfirm = {
                confirmUndo = false
                model.undo()
            },
            onDismiss = { confirmUndo = false },
        )
    }
}

/** "Deshacer (4:59)", ticking down; null once the five minutes are up. */
@Composable
private fun rememberUndo(outcome: ScanOutcome, onUndo: () -> Unit): UndoAction? {
    val until = (outcome as? ScanOutcome.Stamped)?.undoUntil ?: return null
    var now by remember(outcome) { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(outcome) {
        while (now < until) {
            delay(1_000)
            now = System.currentTimeMillis()
        }
    }
    val left = ((until - now) / 1000).coerceAtLeast(0)
    if (left <= 0) return null
    return UndoAction("Deshacer (${left / 60}:${(left % 60).toString().padStart(2, '0')})", onUndo)
}

fun ScanOutcome.toUi(): ScanOutcomeUi = when (this) {
    is ScanOutcome.Stamped -> ScanOutcomeUi.stamped(result)
    ScanOutcome.Queued -> ScanOutcomeUi.queued()
    is ScanOutcome.Failed -> ScanOutcomeUi.failed(message)
    is ScanOutcome.Voided -> ScanOutcomeUi.voided(result, firstName)
    is ScanOutcome.Redeemed -> ScanOutcomeUi.redeemed(result)
}

fun ScanOutcome.kind(): OutcomeKind = when (this) {
    is ScanOutcome.Stamped, is ScanOutcome.Voided, is ScanOutcome.Redeemed -> OutcomeKind.Stamped
    ScanOutcome.Queued -> OutcomeKind.Queued
    is ScanOutcome.Failed -> OutcomeKind.Failed
}

/** The viewfinder frame. Everything that is not the camera belongs on another screen. */
@Composable
fun AimFrame(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(
            Modifier
                .size(228.dp)
                .border(3.dp, Color.White.copy(alpha = 0.9f), RoundedCornerShape(22.dp)),
        )
        Text(
            "Apunta al código del cliente",
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            style = TextStyle(shadow = Shadow(Color.Black.copy(alpha = 0.6f), blurRadius = 8f)),
        )
    }
}

/** Business name, what is waiting to be sent, and "Código" for a reward typed by hand. */
@Composable
fun ScanHeader(businessName: String, locationName: String?, pendingCount: Int, onCode: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.Black.copy(alpha = 0.45f))
            .statusBarsPadding()
            .padding(start = 20.dp, end = 8.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(businessName, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            locationName?.let { Text(it, color = Color.White.copy(alpha = 0.8f), fontSize = 12.sp) }
            if (pendingCount > 0) {
                // The only number worth showing here: stamps taken and not yet sent.
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Outlined.Sync, contentDescription = null, tint = Color.White, modifier = Modifier.size(13.dp))
                    Text("$pendingCount por enviar", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
        TextButton(onClick = onCode) {
            Icon(Icons.Outlined.Redeem, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(6.dp))
            Text("Código", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Medium)
        }
    }
}
