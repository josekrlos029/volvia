package co.volvia.biz.ui.stats

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.Busiest
import co.volvia.biz.core.Messages
import co.volvia.biz.core.Overview
import co.volvia.biz.core.Retention
import co.volvia.biz.core.TimeseriesPoint
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** A section that loads on its own: its data, a plan gate, or an error. */
sealed interface Part<out T> {
    data object Loading : Part<Nothing>
    data class Ready<T>(val value: T) : Part<T>
    /** 402: "Disponible en el plan X", drawn as a lock rather than an error. */
    data class Gated(val upgradeTo: String?) : Part<Nothing>
    data class Failed(val message: String) : Part<Nothing>
}

data class StatsState(
    val overview: Part<Overview> = Part.Loading,
    val series: Part<List<TimeseriesPoint>> = Part.Loading,
    val busiest: Part<Busiest> = Part.Loading,
    val retention: Part<Retention> = Part.Loading,
)

/** "Estadísticas": the last 30 days, the busy hours and who keeps coming back. */
class StatsViewModel(application: Application) : AndroidViewModel(application) {
    private val client = AppServices.get(application).client

    private val _state = MutableStateFlow(StatsState())
    val state: StateFlow<StatsState> = _state.asStateFlow()

    private var fixture = false

    init {
        load()
    }

    fun load() {
        if (fixture) return
        _state.value = StatsState()
        viewModelScope.launch {
            val overview = async { part { client.overview() } }
            val series = async { part { client.timeseries() } }
            val busiest = async { part { client.busiest() } }
            val retention = async { part { client.retention() } }
            val loaded = StatsState(overview.await(), series.await(), busiest.await(), retention.await())
            if (!fixture) _state.value = loaded
        }
    }

    private suspend fun <T> part(call: suspend () -> T): Part<T> = try {
        Part.Ready(call())
    } catch (error: ApiException) {
        if (error.isPlanGate) Part.Gated(error.upgradeTo) else Part.Failed(Messages.load(error))
    } catch (_: Exception) {
        Part.Failed(Messages.GENERIC)
    }

    /** Debug fixtures only. */
    fun showFixture(state: StatsState) {
        fixture = true
        _state.value = state
    }
}
