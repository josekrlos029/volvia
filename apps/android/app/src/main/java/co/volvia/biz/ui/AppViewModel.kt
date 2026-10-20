package co.volvia.biz.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.BuildConfig
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.Location
import co.volvia.biz.core.Membership
import co.volvia.biz.core.Messages
import co.volvia.biz.core.OrgContext
import co.volvia.biz.core.RejectedStamp
import co.volvia.biz.core.TokenPair
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock

/**
 * The session: who is signed in, for which business, at which location, and what is still
 * waiting in the queue. Each tab has its own ViewModel (ui/scan, ui/today…); this one is
 * what they all hang off.
 */
data class UiState(
    val isSignedIn: Boolean = false,
    val businessName: String = "",
    val userName: String = "",
    val memberships: List<Membership> = emptyList(),
    val selectedOrgId: String? = null,
    /** `owner`, `admin` or `staff`. */
    val role: String = "staff",
    /** Set when this member may only work at one location. */
    val pinnedLocationId: String? = null,
    val pendingCount: Int = 0,
    /** Stamps the server refused while flushing the queue. Shown until someone reads them. */
    val rejected: List<RejectedStamp> = emptyList(),
    val isWorking: Boolean = false,
    val signInError: String? = null,
    val googleAvailable: Boolean = false,
    /** Null until `GET /v1/org` answers; the tabs work without it, just less informed. */
    val org: OrgContext? = null,
    val locationId: String? = null,
    val quickStamp: Boolean = true,
) {
    val isAdmin: Boolean get() = role == "owner" || role == "admin"
    val isOwner: Boolean get() = role == "owner"
    val locations: List<Location> get() = org?.locations.orEmpty()
    /** Only worth showing when there is more than one location to tell apart. */
    val locationName: String? get() = locations.takeIf { it.size > 1 }?.firstOrNull { it.id == locationId }?.name

    /** Plan features from `/v1/org`. Unknown (not loaded yet) counts as available: the API still gates. */
    fun has(feature: String): Boolean = org?.org?.entitlements?.features?.get(feature) ?: true
}

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val services = AppServices.get(application)
    private val session = services.session
    private val queue = services.queue
    private val client = services.client

    val googleWebClientId: String = BuildConfig.GOOGLE_WEB_CLIENT_ID

    private val _state = MutableStateFlow(snapshot())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        viewModelScope.launch { services.queueState.collect { refresh() } }
        viewModelScope.launch { services.orgContext.collect { refresh() } }
        viewModelScope.launch { services.signedOut.collect { refresh() } }
        if (session.isSignedIn) loadBusiness(refreshUser = true)
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
                refresh()
                loadBusiness()
                flush()
            } catch (error: ApiException) {
                _state.value = _state.value.copy(isWorking = false, signInError = Messages.signIn(error))
            } catch (_: Exception) {
                _state.value = _state.value.copy(isWorking = false, signInError = Messages.GENERIC)
            }
        }
    }

    /**
     * Revokes the session on the server, then forgets it here. The queue stays: stamps
     * already taken from real customers are sent by whoever signs in next.
     */
    fun signOut() {
        val refresh = session.refreshToken()
        viewModelScope.launch {
            refresh?.let { runCatching { client.logOut(it) } }
            session.signOut()
            services.orgContext.value = null
            refresh()
        }
    }

    fun selectOrg(orgId: String) {
        val membership = session.user?.memberships?.firstOrNull { it.orgId == orgId } ?: return
        session.select(membership)
        services.orgContext.value = null
        refresh()
        loadBusiness()
    }

    fun selectLocation(locationId: String) {
        val orgId = session.membership?.orgId ?: return
        session.setLocationId(orgId, locationId)
        refresh()
    }

    fun setQuickStamp(enabled: Boolean) {
        session.quickStamp = enabled
        refresh()
    }

    /**
     * The plan, locations and cards of the business in use. Also re-reads `/auth/me` on
     * launch, so a role changed in the dashboard shows up without signing in again.
     */
    fun loadBusiness(refreshUser: Boolean = false) {
        if (!session.isSignedIn) return
        viewModelScope.launch {
            if (refreshUser) {
                runCatching { client.me() }.getOrNull()?.let { session.updateUser(it) }
            }
            val expectedOrg = session.membership?.orgId
            try {
                val org = async { client.org() }
                val locations = async { runCatching { client.locations() }.getOrDefault(emptyList()) }
                val cards = async { runCatching { client.cards() }.getOrDefault(emptyList()) }
                val context = OrgContext(org.await(), locations.await(), cards.await())
                // A switch while this was loading wins.
                if (session.membership?.orgId == expectedOrg) services.orgContext.value = context
            } catch (_: Exception) {
                // Offline at launch: the counter still works, "Más" just knows less.
            }
            refresh()
        }
    }

    fun clearRejected() {
        queue.clearRejected()
        services.publishQueue()
    }

    /**
     * Empties the queue. Called on launch, after signing in, when the app returns to the
     * foreground, and from "Enviar ahora" in "Más".
     */
    fun flush() {
        if (!session.isSignedIn) return
        viewModelScope.launch {
            services.sendLock.withLock {
                queue.flush { pending ->
                    runCatching { client.stamp(pending) }
                }
            }
            services.publishQueue()
            services.announceCardChanged()
        }
    }

    private fun refresh() {
        _state.value = snapshot().copy(
            isWorking = _state.value.isWorking && !session.isSignedIn,
            signInError = _state.value.signInError.takeIf { !session.isSignedIn },
        )
    }

    /** The current truth. */
    private fun snapshot(): UiState {
        val queueState = services.queueState.value
        val membership = session.membership
        return UiState(
            isSignedIn = session.isSignedIn,
            businessName = membership?.orgName ?: "Volvia Biz",
            userName = session.user?.name.orEmpty(),
            memberships = session.user?.memberships.orEmpty(),
            selectedOrgId = membership?.orgId,
            role = membership?.role ?: "staff",
            pinnedLocationId = membership?.locationId,
            pendingCount = queueState.pendingCount,
            rejected = queueState.rejected,
            googleAvailable = googleWebClientId.isNotBlank(),
            org = services.orgContext.value?.takeIf { it.org.id == membership?.orgId },
            locationId = services.currentLocationId(),
            quickStamp = session.quickStamp,
        )
    }
}
