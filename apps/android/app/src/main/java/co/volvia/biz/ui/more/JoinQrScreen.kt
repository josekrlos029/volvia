package co.volvia.biz.ui.more

import android.app.Activity
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.volvia.biz.ui.EmptyState
import co.volvia.biz.ui.NavRow
import co.volvia.biz.ui.PushedScreen
import co.volvia.biz.ui.QrImage
import co.volvia.biz.ui.RowDivider
import co.volvia.biz.ui.Section
import co.volvia.biz.ui.SectionPage
import co.volvia.biz.ui.UiState
import co.volvia.biz.ui.theme.VolviaColors

/**
 * The counter's sign-up QR, full screen, for a customer to scan with their own camera.
 * Drawn here from the card's `joinUrl`, so it appears instantly and works offline.
 */
@Composable
fun JoinQrScreen(app: UiState, cardId: String?, onBack: () -> Unit) {
    var chosen by remember(cardId) { mutableStateOf(cardId) }
    val cards = app.org?.activeCards.orEmpty()
    val card = cards.firstOrNull { it.id == chosen }

    if (card == null) {
        PushedScreen("QR de inscripción", onBack = onBack) { padding ->
            SectionPage(padding) {
                if (cards.isEmpty()) {
                    EmptyState(
                        if (app.org == null) "Cargando tarjetas…" else "No hay tarjetas activas",
                        if (app.org == null) null else "Publica una tarjeta desde el panel para mostrar su QR.",
                    )
                } else {
                    Section("Elige la tarjeta") {
                        cards.forEachIndexed { index, item ->
                            if (index > 0) RowDivider()
                            NavRow(item.name, detail = "${item.stampsRequired} sellos") { chosen = item.id }
                        }
                    }
                }
            }
        }
        return
    }

    // Full brightness while the code is on screen: a dim phone across a counter does not scan.
    val view = LocalView.current
    DisposableEffect(view) {
        val window = (view.context as? Activity)?.window
        val previous = window?.attributes?.screenBrightness
        window?.let {
            it.attributes = it.attributes.apply { screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL }
        }
        // White status bar icons on the navy page.
        val controller = window?.let { androidx.core.view.WindowCompat.getInsetsController(it, view) }
        val lightBars = controller?.isAppearanceLightStatusBars
        controller?.isAppearanceLightStatusBars = false
        onDispose {
            lightBars?.let { controller.isAppearanceLightStatusBars = it }
            window?.let {
                it.attributes = it.attributes.apply {
                    screenBrightness = previous ?: WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
                }
            }
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(VolviaColors.Navy)
            .systemBarsPadding()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(Modifier.fillMaxWidth()) {
            Spacer(Modifier.weight(1f))
            TextButton(onClick = { if (cardId == null && cards.size > 1) chosen = null else onBack() }) {
                Text("Cerrar", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(Modifier.weight(1f))
        Text(app.businessName, color = Color.White.copy(alpha = 0.8f), fontSize = 16.sp, textAlign = TextAlign.Center)
        Text(card.name, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Spacer(Modifier.height(24.dp))
        QrImage(card.joinUrl, Modifier.fillMaxWidth(), description = "Código QR para unirse a ${card.name}")
        Spacer(Modifier.height(24.dp))
        Text(
            "Escanea con la cámara de tu celular para tener tu tarjeta de sellos.",
            color = Color.White,
            fontSize = 18.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.weight(1f))
    }
}
