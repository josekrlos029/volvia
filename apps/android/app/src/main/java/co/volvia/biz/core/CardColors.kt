package co.volvia.biz.core

import kotlin.math.pow

/**
 * Colour arithmetic for marks drawn over a business's own palette, the same WCAG
 * relative-luminance maths as `packages/shared/src/color.ts`. Pure Kotlin, so the
 * choices it makes are checked in a JVM test.
 */
object CardColors {
    /** `#RRGGBB` (or `#RGB`) as an opaque ARGB value; black when it does not parse. */
    fun argb(hex: String): Long {
        val value = hex.trim().removePrefix("#")
        val full = if (value.length == 3) value.map { "$it$it" }.joinToString("") else value
        val rgb = full.toLongOrNull(16)?.takeIf { full.length == 6 } ?: 0L
        return 0xFF000000L or rgb
    }

    fun luminance(argb: Long): Double {
        fun channel(shift: Int): Double {
            val c = ((argb shr shift) and 0xFF) / 255.0
            return if (c <= 0.03928) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
        }
        return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
    }

    fun contrast(a: Long, b: Long): Double {
        val la = luminance(a)
        val lb = luminance(b)
        return (maxOf(la, lb) + 0.05) / (minOf(la, lb) + 0.05)
    }

    /** Whichever candidate reads best on `background`. */
    fun readableOn(background: Long, candidates: List<Long>): Long =
        candidates.maxByOrNull { contrast(background, it) } ?: 0xFF000000L
}
