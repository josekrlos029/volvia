package co.volvia.biz.ui.kiosk

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.KioskLastStamp
import co.volvia.biz.core.KioskSession
import co.volvia.biz.core.Messages
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class KioskState(
    val cardId: String? = null,
    val locationId: String? = null,
    val session: KioskSession? = null,
    val isOpening: Boolean = false,
    /** What the QR encodes right now: `<PASS_URL>/k/<nonce>`. */
    val qrUrl: String? = null,
    val secondsLeft: Int = 0,
    /** Set for three seconds after a stamp lands: "¡Sello sumado!". */
    val celebrating: KioskLastStamp? = null,
    val error: String? = null,
    val gatedTo: String? = null,
)

/**
 * The kiosk, the same loop as the web screen (apps/app/src/components/Kiosk.tsx): a QR
 * whose nonce rotates every 30 seconds, a poll every 3 seconds for the last stamp, and a
 * celebration when one lands. The nonce is single-use, so a photo of the screen is useless.
 */
class KioskViewModel(application: Application) : AndroidViewModel(application) {
    private val services = AppServices.get(application)
    private val client = services.client

    private val _state = MutableStateFlow(KioskState())
    val state: StateFlow<KioskState> = _state.asStateFlow()

    private var loop: Job? = null
    private var seenStampAt: Long? = null

    fun choose(cardId: String?, locationId: String?) {
        _state.value = _state.value.copy(cardId = cardId, locationId = locationId, error = null)
    }

    fun open() {
        val cardId = _state.value.cardId ?: return
        val locationId = _state.value.locationId ?: return
        _state.value = _state.value.copy(isOpening = true, error = null)
        viewModelScope.launch {
            try {
                val session = client.openKiosk(cardId, locationId)
                seenStampAt = null
                _state.value = _state.value.copy(session = session, isOpening = false)
                run(session)
            } catch (error: ApiException) {
                _state.value = _state.value.copy(
                    isOpening = false,
                    gatedTo = if (error.code == "FEATURE_NOT_IN_PLAN") error.upgradeTo ?: "business" else null,
                    error = when {
                        error.code == "FEATURE_NOT_IN_PLAN" -> null
                        error.code == "CONFLICT" -> "El modo kiosko está apagado en esta tarjeta. Actívalo desde el panel."
                        else -> Messages.load(error)
                    },
                )
            } catch (_: Exception) {
                _state.value = _state.value.copy(isOpening = false, error = Messages.GENERIC)
            }
        }
    }

    private fun run(session: KioskSession) {
        loop?.cancel()
        loop = viewModelScope.launch {
            // Countdown and rotation.
            launch {
                while (isActive) {
                    if (_state.value.qrUrl == null || _state.value.secondsLeft <= 0) rotate(session)
                    delay(1_000)
                    _state.value = _state.value.copy(secondsLeft = (_state.value.secondsLeft - 1).coerceAtLeast(0))
                }
            }
            // The status poll.
            launch {
                while (isActive) {
                    delay(STATUS_POLL_MS)
                    val answer = runCatching { client.kioskStatus(session) }.getOrNull()
                    // A missed poll is harmless; the next one catches up.
                    if (answer == null) continue
                    val last = answer.lastStamp
                    // The first answer only sets the baseline: a stamp from before the screen
                    // opened is not news.
                    val seen = seenStampAt
                    if (seen == null) {
                        seenStampAt = last?.at ?: 0
                    } else if (last != null && last.at > seen) {
                        seenStampAt = last.at
                        celebrate(last)
                    }
                }
            }
        }
    }

    private suspend fun rotate(session: KioskSession) {
        try {
            val issued = client.kioskNonce(session)
            val base = passBase()
            _state.value = _state.value.copy(qrUrl = "$base/k/${issued.nonce}", secondsLeft = issued.expiresInSeconds, error = null)
        } catch (error: ApiException) {
            if (error.code == "UNAUTHENTICATED") {
                loop?.cancel()
                _state.value = _state.value.copy(session = null, qrUrl = null, error = "Se perdió la sesión del kiosko. Vuelve a abrirlo.")
            }
            // Offline: keep the old code up and try again next second.
        } catch (_: Exception) {
        }
    }

    private fun celebrate(stamp: KioskLastStamp) {
        _state.value = _state.value.copy(celebrating = stamp, secondsLeft = 0)
        viewModelScope.launch {
            delay(CELEBRATION_MS)
            if (_state.value.celebrating == stamp) _state.value = _state.value.copy(celebrating = null)
        }
    }

    /** Leaving the kiosk closes the session on the server, so the old QR stops working. */
    fun close(onClosed: () -> Unit) {
        loop?.cancel()
        val session = _state.value.session
        _state.value = KioskState(cardId = _state.value.cardId, locationId = _state.value.locationId)
        viewModelScope.launch {
            session?.let { runCatching { client.closeKiosk(it.sessionId) } }
            onClosed()
        }
    }

    fun clearGate() {
        _state.value = _state.value.copy(gatedTo = null)
    }

    /** Debug fixtures only: a kiosk screen with a code on it and no server behind. */
    fun showFixture(qrUrl: String) {
        _state.value = KioskState(session = KioskSession("fixture", "fixture"), qrUrl = qrUrl, secondsLeft = 24)
    }

    private fun passBase(): String {
        val context = services.orgContext.value
        context?.org?.passBaseUrl?.takeIf { it.startsWith("http") }?.let { return it }
        // Every card's join link lives on the same site: <PASS_URL>/j/<slug>.
        return context?.cards?.firstOrNull { it.joinUrl.contains("/j/") }?.joinUrl?.substringBefore("/j/").orEmpty()
    }

    @OptIn(kotlinx.coroutines.DelicateCoroutinesApi::class)
    override fun onCleared() {
        // Leaving without "Salir" (the app killed) still frees the session.
        _state.value.session?.takeIf { it.sessionId != "fixture" }?.let { session ->
            kotlinx.coroutines.GlobalScope.launch { runCatching { client.closeKiosk(session.sessionId) } }
        }
    }

    companion object {
        const val STATUS_POLL_MS = 3_000L
        const val CELEBRATION_MS = 3_000L
    }
}
