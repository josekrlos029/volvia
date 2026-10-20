package co.volvia.biz.ui.stats

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import co.volvia.biz.core.Busiest
import co.volvia.biz.core.Overview
import co.volvia.biz.core.Plans
import co.volvia.biz.core.Retention
import co.volvia.biz.core.TimeseriesPoint
import co.volvia.biz.ui.ErrorState
import co.volvia.biz.ui.LoadingState
import co.volvia.biz.ui.PlanSheet
import co.volvia.biz.ui.PushedScreen
import co.volvia.biz.ui.Section
import co.volvia.biz.ui.SectionPage
import co.volvia.biz.ui.customers.MONTHS
import co.volvia.biz.ui.theme.VolviaColors

@Composable
fun StatsScreen(model: StatsViewModel, onBack: () -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    var gate by remember { mutableStateOf<String?>(null) }

    PushedScreen("Estadísticas", onBack = onBack) { padding ->
        SectionPage(padding) {
            Text("Últimos 30 días", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp))
            PartView(state.overview, onGate = { gate = it }) { Kpis(it) }

            Section("Sellos por día") {
                PartView(state.series, onGate = { gate = it }) { DailyChart(it) }
            }

            Section("Horas pico", footer = "Últimos 90 días, en la hora del negocio.") {
                PartView(state.busiest, onGate = { gate = it }) { BusyHeat(it) }
            }

            Section("Retención", footer = "Qué parte de cada mes de inscritos sigue sellando los meses siguientes.") {
                PartView(state.retention, onGate = { gate = it }) { RetentionTable(it) }
            }
        }
    }
    gate?.let { PlanSheet(it) { gate = null } }
}

@Composable
private fun <T> PartView(part: Part<T>, onGate: (String?) -> Unit, content: @Composable (T) -> Unit) {
    when (part) {
        Part.Loading -> LoadingState()
        is Part.Failed -> ErrorState(part.message)
        is Part.Gated -> Row(
            Modifier.fillMaxWidth().clickable { onGate(part.upgradeTo) }.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(Icons.Outlined.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Text("Disponible en el plan ${Plans.name(part.upgradeTo)}", fontSize = 15.sp, modifier = Modifier.weight(1f))
            Text("Ver", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
        }
        is Part.Ready -> content(part.value)
    }
}

@Composable
private fun Kpis(overview: Overview) {
    val tiles = listOf(
        Triple("Clientes", overview.customers.total.toString(), "+${overview.customers.new} nuevos"),
        Triple("Sellos", overview.stamps.total.toString(), change(overview.stamps.changePct)),
        Triple("Premios entregados", overview.rewards.redeemed.toString(), "de ${overview.rewards.unlocked} ganados"),
        Triple("Vuelven", if (overview.limited) "—" else "${trim(overview.repeatRate)} %", "repiten visita"),
        Triple("Visitas por cliente", trim(overview.averageVisitsPerCustomer), "en promedio"),
        Triple("Días entre visitas", overview.medianDaysBetweenVisits?.let(::trim) ?: "—", "mediana"),
    )
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        tiles.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { (label, value, detail) ->
                    Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface, modifier = Modifier.weight(1f)) {
                        Column(
                            Modifier.padding(14.dp).semantics(mergeDescendants = true) { contentDescription = "$label: $value, $detail" },
                            verticalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(value, fontSize = 24.sp, fontWeight = FontWeight.Bold, style = TextStyle(fontFeatureSettings = "tnum"))
                            Text(detail, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
        if (overview.limited) {
            Text(
                "Recurrencia y días entre visitas: disponibles en el plan ${Plans.name(overview.upgradeTo)}.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Thirty bars of stamps with the day's sign-ups as a line on top, drawn with Canvas. */
@Composable
private fun DailyChart(points: List<TimeseriesPoint>) {
    if (points.isEmpty()) {
        ErrorState("Sin datos todavía.")
        return
    }
    val maxStamps = points.maxOf { it.stamps }.coerceAtLeast(1)
    val maxJoins = points.maxOf { it.joins }.coerceAtLeast(1)
    val scale = maxOf(maxStamps, maxJoins)
    val total = points.sumOf { it.stamps }
    val joins = points.sumOf { it.joins }
    val busiest = points.maxBy { it.stamps }
    val track = MaterialTheme.colorScheme.outlineVariant
    val description = "$total sellos y $joins inscritos en 30 días. El día con más sellos fue el ${shortDate(busiest.date)} con ${busiest.stamps}."

    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Legend(VolviaColors.Violet, "Sellos ($total)")
            Legend(VolviaColors.Orange, "Inscritos ($joins)")
        }
        Canvas(Modifier.fillMaxWidth().height(160.dp).semantics { contentDescription = description }) {
            val gap = 3.dp.toPx()
            val barWidth = ((size.width - gap * (points.size - 1)) / points.size).coerceAtLeast(1f)
            drawLine(track, Offset(0f, size.height), Offset(size.width, size.height), strokeWidth = 1.dp.toPx())
            points.forEachIndexed { index, point ->
                val height = size.height * point.stamps / scale
                val x = index * (barWidth + gap)
                if (height > 0f) {
                    drawRoundRect(
                        VolviaColors.Violet,
                        topLeft = Offset(x, size.height - height),
                        size = Size(barWidth, height),
                        cornerRadius = CornerRadius(barWidth / 3, barWidth / 3),
                    )
                }
            }
            val path = Path()
            points.forEachIndexed { index, point ->
                val x = index * (barWidth + gap) + barWidth / 2
                val y = size.height - size.height * point.joins / scale
                if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(path, VolviaColors.Orange, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round))
        }
        Row {
            Text(shortDate(points.first().date), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
            Text("máx. $scale", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(shortDate(points.last().date), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
        }
    }
}

@Composable
private fun Legend(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.size(10.dp).background(color, RoundedCornerShape(3.dp)))
        Text(label, fontSize = 13.sp)
    }
}

private val WEEKDAYS = listOf("Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb")
private val WEEKDAY_NAMES = listOf("domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado")

/**
 * The API counts stamps by weekday and by hour separately (not per weekday-and-hour), so
 * the heat map is two strips that share one colour scale per strip, darkest = busiest.
 */
@Composable
private fun BusyHeat(busiest: Busiest) {
    val empty = MaterialTheme.colorScheme.surfaceVariant
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        val days = (0..6).map { day -> busiest.byWeekday.firstOrNull { it.weekday == day }?.stamps ?: 0 }
        val topDay = days.indices.maxBy { days[it] }
        Text(
            if (days.sum() == 0) "Aún no hay sellos suficientes." else "El día más movido es el ${WEEKDAY_NAMES[topDay]}.",
            fontSize = 14.sp,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            val max = days.maxOrNull()?.coerceAtLeast(1) ?: 1
            days.forEachIndexed { index, value ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(34.dp)
                            .background(lerp(empty, VolviaColors.Violet, value.toFloat() / max), RoundedCornerShape(6.dp))
                            .semantics { contentDescription = "${WEEKDAYS[index]}: $value sellos" },
                    )
                    Text(WEEKDAYS[index], fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        val hours = (0..23).map { hour -> busiest.byHour.firstOrNull { it.hour == hour }?.stamps ?: 0 }
        val topHour = hours.indices.maxBy { hours[it] }
        if (hours.sum() > 0) Text("La hora pico empieza a las ${hourLabel(topHour)}", fontSize = 14.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            val max = hours.maxOrNull()?.coerceAtLeast(1) ?: 1
            hours.forEachIndexed { hour, value ->
                Box(
                    Modifier
                        .weight(1f)
                        .height(34.dp)
                        .background(lerp(empty, VolviaColors.Orange, value.toFloat() / max), RoundedCornerShape(3.dp))
                        .semantics { contentDescription = "${hourLabel(hour)}: $value sellos" },
                )
            }
        }
        Row {
            listOf("0 h", "6 h", "12 h", "18 h", "23 h").forEachIndexed { index, label ->
                Text(
                    label,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                    textAlign = when (index) {
                        0 -> TextAlign.Start
                        4 -> TextAlign.End
                        else -> TextAlign.Center
                    },
                )
            }
        }
    }
}

@Composable
private fun RetentionTable(retention: Retention) {
    if (retention.cohorts.isEmpty()) {
        ErrorState("Hace falta al menos un mes de inscritos.")
        return
    }
    val empty = MaterialTheme.colorScheme.surfaceVariant
    val columns = retention.cohorts.maxOf { it.values.size }
    Column(Modifier.padding(12.dp).horizontalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Mes", fontSize = 12.sp, modifier = Modifier.width(76.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Inscritos", fontSize = 12.sp, modifier = Modifier.width(60.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
            repeat(columns) { Text("M$it", fontSize = 12.sp, modifier = Modifier.width(44.dp), textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        retention.cohorts.forEach { cohort ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(monthLabel(cohort.cohort), fontSize = 13.sp, modifier = Modifier.width(76.dp))
                Text(cohort.size.toString(), fontSize = 13.sp, modifier = Modifier.width(60.dp))
                cohort.values.forEach { value ->
                    Box(
                        Modifier
                            .size(44.dp, 30.dp)
                            .background(
                                if (value == null) Color.Transparent else lerp(empty, VolviaColors.Navy, (value / 100).toFloat().coerceIn(0f, 1f)),
                                RoundedCornerShape(5.dp),
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            value?.let { "${it.toInt()}%" } ?: "",
                            fontSize = 11.sp,
                            color = if ((value ?: 0.0) > 55) Color.White else MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }
        }
    }
}

private fun change(pct: Double?): String = when {
    pct == null -> "sin comparación"
    pct >= 0 -> "+${trim(pct)} % vs. antes"
    else -> "${trim(pct)} % vs. antes"
}

private fun trim(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString() else String.format(java.util.Locale.forLanguageTag("es-CO"), "%.1f", value)

private fun shortDate(iso: String): String {
    val parts = iso.split("-")
    val month = parts.getOrNull(1)?.toIntOrNull() ?: return iso
    return "${parts.getOrNull(2)?.trimStart('0')} ${MONTHS[month - 1].take(3).lowercase()}"
}

private fun monthLabel(cohort: String): String {
    val parts = cohort.split("-")
    val month = parts.getOrNull(1)?.toIntOrNull() ?: return cohort
    return "${MONTHS[month - 1].take(3).lowercase()} ${parts[0]}"
}

private fun hourLabel(hour: Int): String = when {
    hour == 0 -> "12 a. m."
    hour < 12 -> "$hour a. m."
    hour == 12 -> "12 p. m."
    else -> "${hour - 12} p. m."
}
