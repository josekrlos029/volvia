package co.volvia.biz.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** The real Volvia palette (apps/ios/store/lib.mjs), not the placeholder in packages/ui. */
object VolviaColors {
    val Navy = Color(0xFF1E3A8A)
    val Violet = Color(0xFF7C3AED)
    val Orange = Color(0xFFFB923C)
    val OffWhite = Color(0xFFF8FAFC)
    val Ink = Color(0xFF0F172A)
}

private val Light = lightColorScheme(
    primary = VolviaColors.Violet,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFEDE9FE),
    onPrimaryContainer = Color(0xFF2E1065),
    secondary = VolviaColors.Navy,
    onSecondary = Color.White,
    tertiary = VolviaColors.Orange,
    onTertiary = VolviaColors.Ink,
    background = VolviaColors.OffWhite,
    onBackground = VolviaColors.Ink,
    surface = Color.White,
    onSurface = VolviaColors.Ink,
    surfaceVariant = Color(0xFFE2E8F0),
    onSurfaceVariant = Color(0xFF64748B),
    surfaceContainerLow = VolviaColors.OffWhite,
    surfaceContainer = Color.White,
    surfaceContainerHigh = Color.White,
    outline = Color(0xFFCBD5E1),
    outlineVariant = Color(0xFFE2E8F0),
    error = Color(0xFFDC2626),
)

private val Dark = darkColorScheme(
    primary = VolviaColors.Violet,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF2E1065),
    onPrimaryContainer = Color(0xFFEDE9FE),
    secondary = Color(0xFF93C5FD),
    onSecondary = VolviaColors.Ink,
    tertiary = VolviaColors.Orange,
    onTertiary = VolviaColors.Ink,
    background = VolviaColors.Ink,
    onBackground = Color(0xFFF1F5F9),
    surface = Color(0xFF1E293B),
    onSurface = Color(0xFFF1F5F9),
    surfaceVariant = Color(0xFF1E293B),
    onSurfaceVariant = Color(0xFF94A3B8),
    surfaceContainerLow = VolviaColors.Ink,
    surfaceContainer = Color(0xFF1E293B),
    surfaceContainerHigh = Color(0xFF1E293B),
    outline = Color(0xFF475569),
    outlineVariant = Color(0xFF334155),
    error = Color(0xFFF87171),
)

/** Light or dark follows the phone, like iOS. No dynamic colour: the brand wins. */
@Composable
fun VolviaTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
}
