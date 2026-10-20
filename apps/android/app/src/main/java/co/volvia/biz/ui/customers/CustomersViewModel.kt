package co.volvia.biz.ui.customers

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.CustomerListItem
import co.volvia.biz.core.Messages
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch

data class CustomersState(
    val query: String = "",
    val items: List<CustomerListItem> = emptyList(),
    val total: Int = 0,
    val page: Int = 0,
    val hasMore: Boolean = false,
    val isLoading: Boolean = true,
    val isLoadingMore: Boolean = false,
    val error: String? = null,
    /** Contact details hidden by the plan; the list says so instead of looking broken. */
    val masked: Boolean = false,
)

/** "Clientes": search as you type (300 ms after the last key) and an endless list. */
@OptIn(FlowPreview::class)
class CustomersViewModel(application: Application) : AndroidViewModel(application) {
    private val services = AppServices.get(application)
    private val client = services.client

    private val _state = MutableStateFlow(CustomersState())
    val state: StateFlow<CustomersState> = _state.asStateFlow()

    private val query = MutableStateFlow("")
    private var job: Job? = null
    private var fixture = false

    init {
        viewModelScope.launch {
            query.drop(1).debounce(300).distinctUntilChanged().collect { reload() }
        }
        reload()
        viewModelScope.launch { services.cardChanged.collect { if (!fixture) reload(quiet = true) } }
    }

    fun search(value: String) {
        _state.value = _state.value.copy(query = value)
        query.value = value.trim()
    }

    fun reload(quiet: Boolean = false) {
        if (fixture) return
        job?.cancel()
        _state.value = _state.value.copy(isLoading = !quiet, error = null)
        job = viewModelScope.launch {
            try {
                val page = client.customers(query.value, page = 1)
                if (fixture) return@launch
                _state.value = _state.value.copy(
                    items = page.items,
                    total = page.total,
                    page = 1,
                    hasMore = page.hasMore,
                    isLoading = false,
                    masked = page.masked,
                )
            } catch (error: ApiException) {
                _state.value = _state.value.copy(isLoading = false, error = Messages.load(error))
            } catch (_: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = Messages.GENERIC)
            }
        }
    }

    /** The next page, asked for as the list nears its end. */
    fun loadMore() {
        val current = _state.value
        if (fixture || !current.hasMore || current.isLoadingMore || current.isLoading) return
        _state.value = current.copy(isLoadingMore = true)
        viewModelScope.launch {
            try {
                val page = client.customers(query.value, page = current.page + 1)
                val known = _state.value.items.map { it.id }.toSet()
                _state.value = _state.value.copy(
                    items = _state.value.items + page.items.filterNot { it.id in known },
                    page = page.page,
                    hasMore = page.hasMore,
                    isLoadingMore = false,
                )
            } catch (_: Exception) {
                // The next scroll tries again.
                _state.value = _state.value.copy(isLoadingMore = false)
            }
        }
    }

    /** Debug fixtures only. */
    fun showFixture(items: List<CustomerListItem>) {
        fixture = true
        _state.value = CustomersState(items = items, total = items.size, page = 1, isLoading = false)
    }
}
