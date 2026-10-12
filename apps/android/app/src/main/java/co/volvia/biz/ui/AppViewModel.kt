package co.volvia.biz.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.BuildConfig
import co.volvia.biz.core.ApiClient
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.CardToken
import co.volvia.biz.core.Membership
import co.volvia.biz.core.Messages
import co.volvia.biz.core.PendingStamp
import co.volvia.biz.core.RejectedStamp
import co.volvia.biz.core.SessionStore
import co.volvia.biz.core.StampQueue
import co.volvia.biz.core.StampResult
import co.volvia.biz.core.TokenPair
import java.io.File
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

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
    val userName: String = "",
    val memberships: List<Membership> = emptyList(),
    val selectedOrgId: String? = null,
    val pendingCount: Int = 0,
    /** Stamps the server refused while flushing the queue. Shown until someone reads them. */
    val rejected: List<RejectedStamp> = emptyList(),
    val outcome: ScanOutcome? = null,
    val isWorking: Boolean = false,
    val signInError: String? = null,
    val googleAvailable: Boolean = false,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val session = SessionStore(application)
    private val queue = StampQueue(File(application.filesDir, "pending-stamps.json"))
    private val client = ApiClient(BuildConfig.API_URL, session)

    val googleWebClientId: String = BuildConfig.GOOGLE_WEB_CLIENT_ID

    /**
     * One stamp request on the wire at a time. A scan is queued before it is sent, so a
     * flush that starts meanwhile (the app resuming, "Enviar ahora") would send the same
     * idempotency key concurrently and the scan would get CONFLICT ("already being
     * processed") and show a failure for a stamp that did go through. Serialised, the
     * second request gets the server's replayed result instead.
     */
    private val sendLock = Mutex()

    private val _state = MutableStateFlow(snapshot())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        flush()
    }

    fun signIn(email: String, password: String) = authenticate { client.logIn(email, password) }

    fun signInWithGoogle(idToken: String) = authenticate { client.logInWithGoogle(idToken) }

    /** The account picker is about to open; lock the buttons until it answers. */
    fun googleStarted() {
        _state.value = _state.value.copy(isWorking = true, signInError = null)
    }

    /** Closing the picker is a choice, not an error: nothing is shown. */
    fun googleCancelled() {
        _state.value = _state.value.copy(isWorking = false)
    }

    fun googleFailed(message: String) {
        _state.value = _state.value.copy(isWorking = false, signInError = message)
    }

    private fun authenticate(call: suspend () -> TokenPair) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isWorking = true, signInError = null)
            try {
                session.save(call())
                _state.value = snapshot()
                flush()
            } catch (error: ApiException) {
                _state.value = _state.value.copy(isWorking = false, signInError = Messages.signIn(error))
            } catch (_: Exception) {
                _state.value = _state.value.copy(isWorking = false, signInError = Messages.GENERIC)
            }
        }
    }

    fun signOut() {
        session.signOut()
        _state.value = snapshot()
    }

    fun selectOrg(orgId: String) {
        val membership = session.user?.memberships?.firstOrNull { it.orgId == orgId } ?: return
        session.select(membership)
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
        val token = CardToken.parse(raw)
        if (token == null) {
            _state.value = _state.value.copy(outcome = ScanOutcome.Failed(Messages.NOT_A_CARD))
            return
        }

        val stamp = PendingStamp(cardToken = token, occurredAtIso = Instant.now().toString())
        queue.enqueue(stamp)
        _state.value = snapshot().copy(isWorking = true)

        viewModelScope.launch {
            try {
                val result = sendLock.withLock { client.stamp(stamp) }
                queue.remove(stamp.id)
                _state.value = snapshot(ScanOutcome.Stamped(result))
            } catch (error: ApiException) {
                if (error.isTransient) {
                    _state.value = snapshot(ScanOutcome.Queued)
                } else {
                    queue.remove(stamp.id)
                    _state.value = snapshot(ScanOutcome.Failed(Messages.stamp(error)))
                }
            } catch (_: Exception) {
                // An answer we could not read. The stamp stays queued; the idempotency key
                // makes the retry safe if the server did apply it.
                _state.value = snapshot(ScanOutcome.Queued)
            }
        }
    }

    fun redeem(grantId: String) {
        viewModelScope.launch {
            try {
                client.redeem(grantId)
                _state.value = snapshot()
            } catch (error: ApiException) {
                _state.value = snapshot(ScanOutcome.Failed(Messages.stamp(error)))
            } catch (_: Exception) {
                _state.value = snapshot(ScanOutcome.Failed(Messages.REDEEM_FAILED))
            }
        }
    }

    fun dismissOutcome() {
        _state.value = _state.value.copy(outcome = null)
    }

    fun clearRejected() {
        queue.clearRejected()
        _state.value = snapshot(_state.value.outcome)
    }

    /**
     * Empties the queue. Called on launch, after signing in, when the app returns to the
     * foreground, and from "Enviar ahora" in the account sheet.
     */
    fun flush() {
        if (!session.isSignedIn) return
        viewModelScope.launch {
            sendLock.withLock {
                queue.flush { pending ->
                    runCatching { client.stamp(pending) }
                }
            }
            _state.value = snapshot(_state.value.outcome)
        }
    }

    /** The current truth, with the outcome the caller wants to show alongside it. */
    private fun snapshot(outcome: ScanOutcome? = null) = UiState(
        isSignedIn = session.isSignedIn,
        businessName = session.membership?.orgName ?: "Volvia Biz",
        userName = session.user?.name.orEmpty(),
        memberships = session.user?.memberships.orEmpty(),
        selectedOrgId = session.membership?.orgId,
        pendingCount = queue.pending.size,
        rejected = queue.rejected,
        outcome = outcome.takeIf { session.isSignedIn },
        googleAvailable = googleWebClientId.isNotBlank(),
    )
}
