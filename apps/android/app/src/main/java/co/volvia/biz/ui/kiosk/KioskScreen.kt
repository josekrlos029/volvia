package co.volvia.biz.ui.kiosk

import android.app.Activity
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import co.volvia.biz.ui.ConfirmDialog
import co.volvia.biz.ui.EmptyState
import co.volvia.biz.ui.InlineError
import co.volvia.biz.ui.PlanSheet
import co.volvia.biz.ui.PushedScreen
import co.volvia.biz.ui.QrImage
import co.volvia.biz.ui.SectionPage
import co.volvia.biz.ui.UiState
import co.volvia.biz.ui.customers.Picker
import co.volvia.biz.ui.theme.VolviaColors

/** "Modo kiosko": pick the card and location, then hand the screen over to customers. */
@Composable
fun KioskScreen(app: UiState, model: KioskViewModel, onExit: () -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    val eligible = app.org?.activeCards.orEmpty().filter { it.rules.kioskEnabled }
    val locations = app.locations.let { all -> app.pinnedLocationId?.let { pinned -> all.filter { it.id == pinned } } ?: all }

    // Sensible defaults: the only eligible card, the location this phone already uses.
    LaunchedEffect(eligible.size, locations.size) {
        if (state.cardId == null || state.locationId == null) {
            model.choose(
                state.cardId ?: eligible.firstOrNull()?.id,
                state.locationId ?: app.locationId?.takeIf { id -> locations.any { it.id == id } } ?: locations.firstOrNull()?.id,
            )
        }
    }

    if (state.session != null) {
        RunningKiosk(app, state, onExit = { model.close(onExit) })
        return
    }

    PushedScreen("Modo kiosko", onBack = onExit) { padding ->
        SectionPage(padding) {
            Text(
                "Deja este celular o una tableta en el mostrador: el cliente escanea el código con su celular y suma su sello solo.",
                fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            when {
                app.org == null -> EmptyState("Cargando tarjetas…")
                eligible.isEmpty() -> EmptyState(
                    "Ninguna tarjeta tiene el kiosko activo",
                    "Actívalo en las reglas de la tarjeta desde el panel web.",
                )
                locations.isEmpty() -> EmptyState("Falta una sede", "Crea una sede desde el panel para usar el kiosko.")
                else -> {
                    if (eligible.size > 1) {
                        Picker(
                            label = "Tarjeta",
                            value = eligible.firstOrNull { it.id == state.cardId }?.name ?: "Elige la tarjeta",
                            options = eligible.map { it.id to it.name },
                            onPick = { model.choose(it, state.locationId) },
                        )
                    } else {
                        Text("Tarjeta: ${eligible.first().name}", fontSize = 16.sp)
                    }
                    if (locations.size > 1) {
                        Picker(
                            label = "Sede",
                            value = locations.firstOrNull { it.id == state.locationId }?.name ?: "Elige la sede",
                            options = locations.map { it.id to it.name },
                            onPick = { model.choose(state.cardId, it) },
                        )
                    } else {
                        Text("Sede: ${locations.first().name}", fontSize = 16.sp)
                    }
                    InlineError(state.error)
                    Button(
                        onClick = model::open,
                        enabled = !state.isOpening && state.cardId != null && state.locationId != null,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                    ) { Text(if (state.isOpening) "Abriendo…" else "Abrir kiosko", fontWeight = FontWeight.SemiBold) }
                    Text(
                        "Para salir, mantén presionada la esquina superior derecha 2 segundos.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
    state.gatedTo?.let { gate ->
        PlanSheet(gate) {
            model.clearGate()
            onExit()
        }
    }
}

@Composable
private fun RunningKiosk(app: UiState, state: KioskState, onExit: () -> Unit) {
    var confirmExit by remember { mutableStateOf(false) }
    val haptics = LocalHapticFeedback.current
    val view = LocalView.current
    val card = app.org?.activeCards?.firstOrNull { it.id == state.cardId }

    // Screen always on, system bars out of the way and, where the system allows it, the
    // app pinned so a customer cannot wander off into the phone.
    DisposableEffect(view) {
        val activity = view.context as? Activity
        val window = activity?.window
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val controller = window?.let { WindowCompat.getInsetsController(it, view) }
        controller?.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller?.hide(WindowInsetsCompat.Type.systemBars())
        // Not for the screenshot fixture: the system's pinning prompt would cover it.
        val pin = state.session?.sessionId != "fixture"
        if (pin) runCatching { activity?.startLockTask() }
        onDispose {
            if (pin) runCatching { activity?.stopLockTask() }
            controller?.show(WindowInsetsCompat.Type.systemBars())
            window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }
    LaunchedEffect(state.celebrating) {
        if (state.celebrating != null) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }
    // Back does nothing on a kiosk: leaving is the long press.
    BackHandler { }

    Box(Modifier.fillMaxSize().background(VolviaColors.Navy)) {
        Column(
            Modifier.fillMaxSize().padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(app.businessName, color = Color.White.copy(alpha = 0.8f), fontSize = 18.sp, textAlign = TextAlign.Center)
            card?.let { Text(it.name, color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
            Spacer(Modifier.height(28.dp))
            state.qrUrl?.let { QrImage(it, Modifier.fillMaxWidth(0.9f), description = "Código QR para sumar un sello") }
                ?: CircularProgressIndicator(color = Color.White)
            Spacer(Modifier.height(28.dp))
            Text(
                "Escanea con la cámara de tu celular para sumar tu sello",
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "El código cambia en ${state.secondsLeft} s",
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 15.sp,
            )
            state.error?.let { Text(it, color = VolviaColors.Orange, fontSize = 15.sp, textAlign = TextAlign.Center) }
        }

        AnimatedVisibility(state.celebrating != null, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize().background(VolviaColors.Violet), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("¡Sello sumado!", color = Color.White, fontSize = 40.sp, fontWeight = FontWeight.Bold)
                    if (state.celebrating?.rewardUnlocked == true) {
                        Text("¡Y ganaste un premio! Muéstralo en caja.", color = Color.White, fontSize = 20.sp, textAlign = TextAlign.Center)
                    }
                }
            }
        }

        // The way out: a two-second hold on the top-right corner, then a confirmation.
        Box(
            Modifier
                .align(Alignment.TopEnd)
                .size(96.dp)
                .semantics { contentDescription = "Salir del modo kiosko: mantén presionado" }
                .pointerInput(Unit) {
                    awaitEachGesture {
                        awaitFirstDown()
                        val released = withTimeoutOrNull(EXIT_HOLD_MS) { waitForUpOrCancellation() }
                        if (released == null) {
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            confirmExit = true
                        }
                    }
                },
        )
    }

    if (confirmExit) {
        ConfirmDialog(
            title = "¿Salir del modo kiosko?",
            body = "El código deja de funcionar y el celular vuelve a la app.",
            confirm = "Salir",
            destructive = true,
            onConfirm = {
                confirmExit = false
                onExit()
            },
            onDismiss = { confirmExit = false },
        )
    }
}

private const val EXIT_HOLD_MS = 2_000L
