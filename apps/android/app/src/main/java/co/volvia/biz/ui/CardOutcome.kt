package co.volvia.biz.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.annotation.DrawableRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.volvia.biz.R
import co.volvia.biz.core.CardLook
import co.volvia.biz.core.ScanOutcomeUi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * The scan result in the business's own colours: the person at the counter sees at a
 * glance that the stamp landed on the right card, how far along the customer is, and
 * any reward to hand over, in the accent the customer knows from their own card.
 */
@Composable
fun BrandedOutcomeCard(
    outcome: ScanOutcomeUi,
    card: CardLook,
    onRedeem: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val background = Color(card.background)
    val foreground = Color(card.foreground)
    val accent = Color(card.accent)
    val onAccent = Color(card.onAccent)

    Surface(
        shape = RoundedCornerShape(18.dp),
        color = background,
        contentColor = foreground,
        shadowElevation = 8.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                BusinessBadge(card, accent, onAccent)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        card.cardName.uppercase(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 1.4.sp,
                        color = foreground.copy(alpha = 0.7f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(outcome.title, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                ProgressRing(card.filled, card.total, accent, foreground.copy(alpha = 0.18f))
            }

            StampGrid(card, accent, onAccent)

            card.remainingLine?.let {
                Text(it, fontSize = 15.sp, color = foreground.copy(alpha = 0.85f))
            }

            outcome.rewardGrantId?.let { grantId ->
                if (outcome.rewardIsNew) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(accent)
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        outcome.rewardTitle?.let { Text(it, color = onAccent, fontSize = 18.sp, fontWeight = FontWeight.SemiBold) }
                        outcome.rewardCode?.let {
                            Text(
                                "Código $it",
                                color = onAccent.copy(alpha = 0.85f),
                                fontSize = 15.sp,
                                style = TextStyle(fontFeatureSettings = "tnum"),
                            )
                        }
                    }
                    Button(
                        onClick = { onRedeem(grantId) },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = onAccent),
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Entregar ahora", fontWeight = FontWeight.SemiBold) }
                } else {
                    outcome.rewardTitle?.let { Text(it, fontSize = 15.sp, fontWeight = FontWeight.Medium) }
                    OutlinedButton(
                        onClick = { onRedeem(grantId) },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = foreground),
                    ) { Text("Entregar ahora") }
                }
            }

            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) {
                Text("Siguiente cliente", color = foreground, fontSize = 15.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}

/** The business's logo, or its initial on the accent when it has none. */
@Composable
private fun BusinessBadge(card: CardLook, accent: Color, onAccent: Color) {
    val logo = card.logoUrl?.let { rememberRemoteBitmap(it) }
    Box(
        Modifier
            .size(42.dp)
            .clip(CircleShape)
            .background(if (logo != null) Color.White else accent),
        contentAlignment = Alignment.Center,
    ) {
        if (logo != null) {
            Image(logo.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            Text(card.businessName.take(1).uppercase(), color = onAccent, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** How far through the card the customer is, as a ring with the count inside. */
@Composable
private fun ProgressRing(filled: Int, total: Int, color: Color, track: Color) {
    val fraction = if (total > 0) (filled.toFloat() / total).coerceIn(0f, 1f) else 0f
    Box(
        Modifier
            .size(56.dp)
            .semantics { contentDescription = "$filled de $total sellos" },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize().padding(4.dp)) {
            val stroke = 4.dp.toPx()
            val inset = stroke / 2
            val arcSize = Size(size.width - stroke, size.height - stroke)
            drawArc(track, 0f, 360f, false, Offset(inset, inset), arcSize, style = Stroke(stroke))
            drawArc(color, -90f, 360f * fraction, false, Offset(inset, inset), arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
        }
        Text("$filled/$total", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, style = TextStyle(fontFeatureSettings = "tnum"))
    }
}

/** The customer's stamps in miniature, laid out like the web card so the two agree. */
@Composable
private fun StampGrid(card: CardLook, accent: Color, onAccent: Color) {
    val columns = card.columns.coerceAtLeast(1)
    val empty = Color(card.empty)
    val shape = slotShape(card.stampStyle)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        (1..card.total).chunked(columns).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.forEach { position ->
                    val filled = position <= card.filled
                    val reward = position in card.rewardPositions
                    Box(
                        Modifier
                            .weight(1f)
                            .aspectRatio(1f)
                            .clip(shape)
                            .background(if (filled) accent else Color.Transparent)
                            .border(2.dp, if (filled) accent else if (reward) accent.copy(alpha = 0.7f) else empty, shape),
                        contentAlignment = Alignment.Center,
                    ) {
                        when {
                            filled && card.emoji != null -> Text(card.emoji, fontSize = 16.sp)
                            filled -> Glyph(glyphRes(card.glyph), onAccent)
                            reward -> Glyph(R.drawable.stamp_gift, accent)
                        }
                    }
                }
                // Keep a short last row on the same grid as the rows above it.
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun Glyph(@DrawableRes res: Int, tint: Color) {
    Icon(painterResource(res), contentDescription = null, tint = tint, modifier = Modifier.fillMaxSize(0.55f))
}

private fun slotShape(style: String): Shape = when (style) {
    "rounded" -> RoundedCornerShape(30)
    "square" -> RoundedCornerShape(6.dp)
    else -> CircleShape
}

/** The generated glyph for a preset; an uploaded picture falls back to the check. */
@DrawableRes
private fun glyphRes(name: String?): Int = when (name) {
    "coffee" -> R.drawable.stamp_coffee
    "burger" -> R.drawable.stamp_burger
    "pizza" -> R.drawable.stamp_pizza
    "ice-cream" -> R.drawable.stamp_ice_cream
    "scissors" -> R.drawable.stamp_scissors
    "nail" -> R.drawable.stamp_nail
    "dumbbell" -> R.drawable.stamp_dumbbell
    "paw" -> R.drawable.stamp_paw
    "car" -> R.drawable.stamp_car
    "heart" -> R.drawable.stamp_heart
    "star" -> R.drawable.stamp_star
    "leaf" -> R.drawable.stamp_leaf
    else -> R.drawable.stamp_check
}

private val imageClient: OkHttpClient by lazy {
    OkHttpClient.Builder().callTimeout(8, TimeUnit.SECONDS).build()
}
private val imageCache = android.util.LruCache<String, Bitmap>(16)

/** A small remote picture (the business logo), cached for the session; null until it lands. */
@Composable
private fun rememberRemoteBitmap(url: String): Bitmap? {
    var bitmap by remember(url) { mutableStateOf(imageCache.get(url)) }
    LaunchedEffect(url) {
        if (bitmap != null) return@LaunchedEffect
        bitmap = withContext(Dispatchers.IO) {
            runCatching {
                imageClient.newCall(Request.Builder().url(url).build()).execute().use { response ->
                    response.body?.byteStream()?.let(BitmapFactory::decodeStream)
                }
            }.getOrNull()
        }?.also { imageCache.put(url, it) }
    }
    return bitmap
}
