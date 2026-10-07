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
) {
    companion object {
        fun stamped(result: StampResult): ScanOutcomeUi {
            val unlocked = result.unlockedRewards.firstOrNull()
            val waiting = result.pendingRewards.firstOrNull()

            return ScanOutcomeUi(
                title = result.customer.firstName,
                body = "${result.stampsCount} de ${result.stampsRequired} sellos",
                rewardGrantId = unlocked?.grantId ?: waiting?.grantId,
                rewardTitle = when {
                    unlocked != null -> "¡Ganó ${unlocked.title}!"
                    waiting != null -> "Tiene ${waiting.title} sin recoger"
                    else -> null
                },
            )
        }

        fun queued() = ScanOutcomeUi(
            title = "Sello guardado",
            body = "Sin conexión ahora mismo. Se envía solo cuando vuelva; el cliente ya lo tiene.",
        )

        fun failed(message: String) = ScanOutcomeUi(title = "No se pudo sellar", body = message)
    }
}
