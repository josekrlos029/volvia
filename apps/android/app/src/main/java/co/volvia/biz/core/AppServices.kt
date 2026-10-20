package co.volvia.biz.core

import android.content.Context
import co.volvia.biz.BuildConfig
import java.io.File
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex

/** What the offline queue looks like right now, for the header and "Sellos por enviar". */
data class QueueState(val pendingCount: Int = 0, val rejected: List<RejectedStamp> = emptyList())

/**
 * The business the phone is working for, loaded on sign-in and on every switch: its plan,
 * its locations and its cards. Null until `GET /v1/org` answers.
 */
data class OrgContext(
    val org: OrgInfo,
    val locations: List<Location> = emptyList(),
    val cards: List<CardSummary> = emptyList(),
) {
    val activeCards: List<CardSummary> get() = cards.filter { it.isActive }
}

/**
 * The one session, queue and client the whole app shares.
 *
 * Each area has its own ViewModel now, but there is still exactly one queue file and one
 * stamp on the wire at a time: splitting the state must not split those.
 */
class AppServices(context: Context) {
    val session = SessionStore(context)
    val queue = StampQueue(File(context.filesDir, "pending-stamps.json"))
    val client = ApiClient(BuildConfig.API_URL, session)

    /**
     * One stamp request on the wire at a time. A scan is queued before it is sent, so a
     * flush that starts meanwhile (the app resuming, "Enviar ahora") would send the same
     * idempotency key concurrently and the scan would get CONFLICT ("already being
     * processed") and show a failure for a stamp that did go through. Serialised, the
     * second request gets the server's replayed result instead.
     */
    val sendLock = Mutex()

    private val _queueState = MutableStateFlow(readQueue())
    val queueState: StateFlow<QueueState> = _queueState.asStateFlow()

    val orgContext = MutableStateFlow<OrgContext?>(null)

    /** Bumped when the server signs us out (a refresh it refused) so the UI follows. */
    private val _signedOut = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val signedOut: SharedFlow<Unit> = _signedOut.asSharedFlow()

    /**
     * Something changed a card: a stamp, an undo, a reward handed over. Today and an open
     * profile reload when they hear it, so nobody reads a number from before the scan.
     */
    private val _cardChanged = MutableSharedFlow<Unit>(extraBufferCapacity = 4)
    val cardChanged: SharedFlow<Unit> = _cardChanged.asSharedFlow()

    init {
        session.onChange = { _signedOut.tryEmit(Unit) }
    }

    fun publishQueue() {
        _queueState.value = readQueue()
    }

    fun announceCardChanged() {
        _cardChanged.tryEmit(Unit)
    }

    /** The location stamps, redemptions and sign-ups are counted at. A pinned member has no choice. */
    fun currentLocationId(): String? {
        val membership = session.membership ?: return null
        membership.locationId?.let { return it }
        val stored = session.locationId(membership.orgId)
        val locations = orgContext.value?.locations.orEmpty()
        return when {
            locations.isEmpty() -> stored
            locations.any { it.id == stored } -> stored
            else -> locations.firstOrNull()?.id
        }
    }

    private fun readQueue() = QueueState(queue.pending.size, queue.rejected)

    companion object {
        @Volatile private var instance: AppServices? = null

        fun get(context: Context): AppServices =
            instance ?: synchronized(this) {
                instance ?: AppServices(context.applicationContext).also { instance = it }
            }
    }
}
