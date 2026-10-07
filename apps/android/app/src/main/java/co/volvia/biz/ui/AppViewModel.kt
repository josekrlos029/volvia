package co.volvia.biz.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.BuildConfig
import co.volvia.biz.core.ApiClient
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.PendingStamp
import co.volvia.biz.core.SessionStore
import co.volvia.biz.core.StampQueue
import co.volvia.biz.core.StampResult
import java.io.File
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** What the scanner is showing right now. */
sealed interface ScanOutcome {
    data class Stamped(val result: StampResult) : ScanOutcome

    /**
     * Taken at the counter, waiting for the network. The customer is told the same thing
     * either way, because for them it is the same thing.
     */
    data object Queued : ScanOutcome

    data class Failed(val message: String) : ScanOutcome
}

data class UiState(
    val isSignedIn: Boolean = false,
    val businessName: String = "",
    val pendingCount: Int = 0,
    val outcome: ScanOutcome? = null,
    val isWorking: Boolean = false,
    val signInError: String? = null,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val session = SessionStore(application)
    private val queue = StampQueue(File(application.filesDir, "pending-stamps.json"))
    private val client = ApiClient(BuildConfig.API_URL, session)

    private val _state = MutableStateFlow(snapshot())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        flush()
    }

    fun signIn(email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isWorking = true, signInError = null)
            try {
                session.save(client.logIn(email, password))
                _state.value = snapshot()
                flush()
            } catch (error: ApiException) {
                _state.value = _state.value.copy(
                    isWorking = false,
                    signInError = when (error.code) {
                        "INVALID_CREDENTIALS" -> "Correo o contraseña incorrectos."
                        "OFFLINE" -> "Sin conexión. Para entrar la primera vez hace falta internet."
                        else -> error.message
                    },
                )
            }
        }
    }

    fun signOut() {
        session.signOut()
        _state.value = snapshot()
    }

    /**
     * One scan, from the camera to the answer on screen.
     *
     * The stamp is put in the queue before it is sent. That ordering is the whole
     * design: nothing a staff member does at the counter can be lost by a network that
     * chose that second to drop.
     */
    fun handleScan(raw: String) {
        val token = co.volvia.biz.core.CardToken.parse(raw)
        if (token == null) {
            _state.value = _state.value.copy(
                outcome = ScanOutcome.Failed("Ese código no es una tarjeta de Volvia."),
            )
            return
        }

        val stamp = PendingStamp(cardToken = token, occurredAtIso = Instant.now().toString())
        queue.enqueue(stamp)
        _state.value = snapshot().copy(isWorking = true)

        viewModelScope.launch {
            try {
                val result = client.stamp(stamp)
                queue.remove(stamp.id)
                _state.value = snapshot(ScanOutcome.Stamped(result))
            } catch (error: ApiException) {
                if (error.isTransient) {
                    _state.value = snapshot(ScanOutcome.Queued)
                } else {
                    queue.remove(stamp.id)
                    _state.value = snapshot(ScanOutcome.Failed(message(error)))
                }
            }
        }
    }

    fun redeem(grantId: String) {
        viewModelScope.launch {
            try {
                client.redeem(grantId)
                _state.value = snapshot()
            } catch (error: ApiException) {
                _state.value = snapshot(ScanOutcome.Failed(message(error)))
            }
        }
    }

    fun dismissOutcome() {
        _state.value = _state.value.copy(outcome = null)
    }

    /**
     * Empties the queue. Called on launch, after signing in, and when the app returns to
     * the foreground — the three moments where connection is likely to be back.
     */
    fun flush() {
        if (!session.isSignedIn) return
        viewModelScope.launch {
            queue.flush { pending ->
                runCatching { client.stamp(pending) }
            }
            _state.value = snapshot(_state.value.outcome)
        }
    }

    /** The current truth, with the outcome the caller wants to show alongside it. */
    private fun snapshot(outcome: ScanOutcome? = null) = UiState(
        isSignedIn = session.isSignedIn,
        businessName = session.membership?.orgName ?: "Volvia Biz",
        pendingCount = queue.pending.size,
        outcome = outcome.takeIf { session.isSignedIn },
    )

    private fun message(error: ApiException) = when (error.code) {
        "CUSTOMER_CARD_NOT_FOUND" -> "Esa tarjeta ya no existe."
        "CARD_NOT_ACTIVE" -> "Esa tarjeta no está activa."
        "STAMP_TOO_SOON" -> "Ya tiene un sello muy reciente."
        "DAILY_CAP_REACHED" -> "Llegó al tope de sellos de hoy."
        "FORBIDDEN", "NOT_A_MEMBER" -> "Esa tarjeta no es de este negocio."
        else -> error.message
    }
}
