package co.volvia.biz.ui.today

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.core.ActivityItem
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.Messages
import co.volvia.biz.core.Pulse
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class TodayState(
    val pulse: Pulse? = null,
    val mine: List<ActivityItem> = emptyList(),
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    /** A one-off line after an undo: "Se quitó 1 sello a Ana" or why it could not be. */
    val notice: String? = null,
)

/** "Hoy": the business's day so far, and this staff member's own scans with their undo. */
class TodayViewModel(application: Application) : AndroidViewModel(application) {
    private val services = AppServices.get(application)
    private val client = services.client

    private val _state = MutableStateFlow(TodayState())
    val state: StateFlow<TodayState> = _state.asStateFlow()

    private var fixture = false

    init {
        load()
        // A stamp at the counter shows up here without pulling down.
        viewModelScope.launch { services.cardChanged.collect { if (!fixture) load(quiet = true) } }
    }

    fun refresh() = load(pulled = true)

    private fun load(pulled: Boolean = false, quiet: Boolean = false) {
        if (fixture) return
        _state.value = _state.value.copy(
            isLoading = _state.value.pulse == null && !quiet,
            isRefreshing = pulled,
        )
        viewModelScope.launch {
            try {
                // "Mis sellos" is open to every role; the pulse too. Load them side by side.
                val pulse = async { client.pulse() }
                val mine = async { runCatching { client.myActivity().items }.getOrNull() }
                val loadedPulse = pulse.await()
                if (fixture) return@launch
                _state.value = _state.value.copy(
                    pulse = loadedPulse,
                    mine = mine.await() ?: _state.value.mine,
                    isLoading = false,
                    isRefreshing = false,
                    error = null,
                )
            } catch (error: ApiException) {
                _state.value = _state.value.copy(isLoading = false, isRefreshing = false, error = Messages.load(error))
            } catch (_: Exception) {
                _state.value = _state.value.copy(isLoading = false, isRefreshing = false, error = Messages.GENERIC)
            }
        }
    }

    fun void(item: ActivityItem) {
        viewModelScope.launch {
            val notice = try {
                val result = client.voidStamp(item.id)
                services.announceCardChanged()
                "Se ${if (result.stampsRemoved == 1) "quitó 1 sello" else "quitaron ${result.stampsRemoved} sellos"} a ${item.firstName}."
            } catch (error: ApiException) {
                Messages.void(error)
            } catch (_: Exception) {
                Messages.GENERIC
            }
            _state.value = _state.value.copy(notice = notice)
            load(quiet = true)
        }
    }

    fun clearNotice() {
        _state.value = _state.value.copy(notice = null)
    }

    /** Debug fixtures only. */
    fun showFixture(pulse: Pulse, mine: List<ActivityItem>) {
        fixture = true
        _state.value = TodayState(pulse = pulse, mine = mine, isLoading = false)
    }
}
