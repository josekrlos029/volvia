package co.volvia.biz.core

/**
 * What the outcome card shows, already turned into words.
 *
 * Keeping the wording out of the composable means the three cases — stamped, queued,
 * refused — can be checked in a plain JVM test, which is where they belong: getting
 * "sello guardado" wrong when the wifi drops is worse than any layout bug.
 */
data class ScanOutcomeUi(
    val title: String,
    val body: String,
    val rewardGrantId: String? = null,
    val rewardTitle: String? = null,
    /** Shown under a reward unlocked by this very scan, so staff can match it on the till. */
    val rewardCode: String? = null,
    /** Unlocked now (prominent) versus earned earlier and still waiting (secondary). */
    val rewardIsNew: Boolean = false,
    /** The card's own look; null for a queued scan, a refusal, or an old replayed result. */
    val card: CardLook? = null,
) {
    companion object {
        fun stamped(result: StampResult): ScanOutcomeUi {
            val unlocked = result.unlockedRewards.firstOrNull()
            val waiting = result.pendingRewards.firstOrNull()
            // Completing the card starts a new cycle at 0 on the server; "0 de 10" next to
            // "¡Ganó…!" reads like the stamp was lost, so show the full card instead.
            val shown = if (unlocked != null && result.stampsCount == 0) result.stampsRequired else result.stampsCount

            return ScanOutcomeUi(
                title = result.customer.firstName,
                body = "$shown de ${result.stampsRequired} sellos",
                rewardGrantId = unlocked?.grantId ?: waiting?.grantId,
                rewardTitle = when {
                    unlocked != null -> "¡Ganó ${unlocked.title}!"
                    waiting != null -> "Tiene ${waiting.title} sin recoger"
                    else -> null
                },
                rewardCode = unlocked?.code,
                rewardIsNew = unlocked != null,
                card = result.design?.let { CardLook.from(it, shown, result.stampsRequired, unlocked != null) },
            )
        }

        fun queued() = ScanOutcomeUi(
            title = "Sello guardado",
            body = "Sin conexión ahora mismo. Se envía solo cuando vuelva; el cliente ya lo tiene.",
        )

        fun failed(message: String) = ScanOutcomeUi(title = "No se pudo sellar", body = message)

        /** After "Deshacer": what was taken back and where the card stands now. */
        fun voided(result: VoidResult, firstName: String): ScanOutcomeUi {
            val removed = if (result.stampsRemoved == 1) "1 sello" else "${result.stampsRemoved} sellos"
            val revoked = when (result.rewardsRevoked) {
                0 -> ""
                1 -> " También se anuló el premio que había ganado."
                else -> " También se anularon ${result.rewardsRevoked} premios."
            }
            return ScanOutcomeUi(
                title = "Sello deshecho",
                body = "Se quitó $removed a $firstName. Ahora tiene ${result.stampsCount} de ${result.stampsRequired}.$revoked",
            )
        }

        fun redeemed(result: RedeemResult): ScanOutcomeUi = ScanOutcomeUi(
            title = "Premio entregado",
            body = listOfNotNull(
                result.customer?.firstName?.let { "${result.title} para $it." } ?: "${result.title}.",
                when (result.remainingPending) {
                    0 -> null
                    1 -> "Le queda 1 premio más por entregar."
                    else -> "Le quedan ${result.remainingPending} premios por entregar."
                },
            ).joinToString(" "),
        )
    }
}

/**
 * The stamped card, in the business's colours, ready to draw.
 *
 * Colours are already resolved to ARGB and the mark colours chosen by contrast, so the
 * composable only paints and the decisions stay testable here.
 */
data class CardLook(
    val businessName: String,
    val cardName: String,
    val logoUrl: String?,
    val background: Long,
    val foreground: Long,
    val accent: Long,
    val empty: Long,
    /** The mark inside a filled slot, and text on the accent. */
    val onAccent: Long,
    val stampStyle: String,
    /** A preset glyph name (`coffee`, `ice-cream`…), or null when the card uses an emoji or picture. */
    val glyph: String?,
    val emoji: String?,
    val imageUrl: String?,
    val filled: Int,
    val total: Int,
    val rewardPositions: List<Int>,
    /** "Le faltan 3 para Café gratis"; null once the scan unlocked something. */
    val remainingLine: String?,
) {
    /** Columns that fill every row, the same choice as the web grid. */
    val columns: Int
        get() = if (total <= 6) total else listOf(6, 5, 4, 3).firstOrNull { total % it == 0 } ?: 5

    companion object {
        fun from(design: StampResultDesign, filled: Int, total: Int, unlocked: Boolean): CardLook {
            val background = CardColors.argb(design.backgroundColor)
            val foreground = CardColors.argb(design.foregroundColor)
            val accent = CardColors.argb(design.accentColor)
            val next = design.nextReward
            val remaining = next?.let { it.atStamp - filled }
            return CardLook(
                businessName = design.businessName,
                cardName = design.cardName,
                logoUrl = design.logoUrl,
                background = background,
                foreground = foreground,
                accent = accent,
                empty = CardColors.argb(design.emptyStampColor),
                onAccent = CardColors.readableOn(accent, listOf(background, foreground)),
                stampStyle = design.stampStyle,
                glyph = design.stampIcon.value.takeIf { design.stampIcon.kind == "preset" },
                emoji = design.stampIcon.value.takeIf { design.stampIcon.kind == "emoji" },
                imageUrl = design.stampIcon.value.takeIf { design.stampIcon.kind == "image" },
                filled = filled,
                total = total,
                rewardPositions = design.rewardPositions,
                remainingLine = if (!unlocked && next != null && remaining != null && remaining > 0) {
                    "Le ${if (remaining == 1) "falta 1" else "faltan $remaining"} para ${next.title}"
                } else {
                    null
                },
            )
        }
    }
}
