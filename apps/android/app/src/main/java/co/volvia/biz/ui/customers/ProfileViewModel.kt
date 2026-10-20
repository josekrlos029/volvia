package co.volvia.biz.ui.customers

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.CardLookup
import co.volvia.biz.core.CustomerDetail
import co.volvia.biz.core.Messages
import co.volvia.biz.core.Phone
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

data class ProfileState(
    val detail: CustomerDetail? = null,
    /** Per customer card: its colours and the rewards waiting, from `/v1/lookup`. */
    val lookups: Map<String, CardLookup> = emptyMap(),
    val isLoading: Boolean = true,
    val error: String? = null,
    val isSaving: Boolean = false,
    val notice: String? = null,
)

/** One customer: their cards in colour, what they have waiting, their history, and the admin's edits. */
class ProfileViewModel(application: Application) : AndroidViewModel(application) {
    private val services = AppServices.get(application)
    private val client = services.client

    private val _state = MutableStateFlow(ProfileState())
    val state: StateFlow<ProfileState> = _state.asStateFlow()

    private var customerId: String? = null
    private var fixture = false

    init {
        // A stamp added from the sheet, or an undo, must show here straight away.
        viewModelScope.launch { services.cardChanged.collect { if (!fixture) reload() } }
    }

    fun load(id: String) {
        if (fixture || (customerId == id && _state.value.detail != null)) return
        customerId = id
        reload()
    }

    fun reload() {
        if (fixture) return
        val id = customerId ?: return
        viewModelScope.launch {
            try {
                val detail = client.customer(id)
                val lookups = detail.cards
                    .filter { it.status == "active" }
                    .map { card -> async { runCatching { client.lookup(customerCardId = card.id) }.getOrNull() } }
                    .awaitAll()
                    .filterNotNull()
                    .associateBy { it.customerCardId }
                if (fixture) return@launch
                _state.value = _state.value.copy(detail = detail, lookups = lookups, isLoading = false, error = null)
            } catch (error: ApiException) {
                _state.value = _state.value.copy(isLoading = false, error = Messages.load(error))
            } catch (_: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = Messages.GENERIC)
            }
        }
    }

    fun redeem(grantId: String) {
        viewModelScope.launch {
            val notice = try {
                val result = client.redeem(grantId, services.currentLocationId())
                services.announceCardChanged()
                "Entregado: ${result.title}"
            } catch (error: ApiException) {
                Messages.redeem(error)
            } catch (_: Exception) {
                Messages.REDEEM_FAILED
            }
            _state.value = _state.value.copy(notice = notice)
        }
    }

    /**
     * Notes, birthday and phone (admin). Returns an error to show next to the form, or
     * null once saved. A cleared birthday or phone goes as an explicit null.
     */
    fun save(notes: String, phone: String, month: Int?, day: Int?, onDone: (String?) -> Unit) {
        val id = customerId ?: return
        val normalized = phone.takeIf { it.isNotBlank() }?.let { Phone.normalize(it) }
        if (phone.isNotBlank() && normalized == null) {
            onDone("Revisa el celular.")
            return
        }
        if ((month == null) != (day == null)) {
            onDone("Completa el cumpleaños o déjalo vacío.")
            return
        }
        val body = buildJsonObject {
            put("notes", notes.trim().take(1000))
            put("phone", normalized?.let { JsonPrimitive(it) } ?: JsonNull)
            put(
                "birthday",
                if (month != null && day != null) buildJsonObject { put("month", month); put("day", day) } else JsonNull,
            )
        }
        _state.value = _state.value.copy(isSaving = true)
        viewModelScope.launch {
            val error = try {
                client.updateCustomer(id, body)
                null
            } catch (error: ApiException) {
                if (error.code == "VALIDATION_FAILED") "Revisa el celular y el cumpleaños." else Messages.load(error)
            } catch (_: Exception) {
                Messages.GENERIC
            }
            _state.value = _state.value.copy(isSaving = false, notice = if (error == null) "Cambios guardados" else null)
            if (error == null) reload()
            onDone(error)
        }
    }

    /** "Ajustar sellos" (admin): a correction with its reason, always audited by the API. */
    fun adjust(customerCardId: String, delta: Int, reason: String, onDone: (String?) -> Unit) {
        if (delta == 0 || reason.trim().length < 3) {
            onDone("Escribe el motivo (mínimo 3 letras).")
            return
        }
        _state.value = _state.value.copy(isSaving = true)
        viewModelScope.launch {
            val error = try {
                client.adjust(customerCardId, delta, reason.trim())
                null
            } catch (error: ApiException) {
                Messages.load(error)
            } catch (_: Exception) {
                Messages.GENERIC
            }
            _state.value = _state.value.copy(
                isSaving = false,
                notice = if (error == null) "Sellos ajustados (${if (delta > 0) "+" else ""}$delta)" else null,
            )
            if (error == null) services.announceCardChanged()
            onDone(error)
        }
    }

    fun clearNotice() {
        _state.value = _state.value.copy(notice = null)
    }

    /** Debug fixtures only. */
    fun showFixture(detail: CustomerDetail, lookups: Map<String, CardLookup>) {
        fixture = true
        customerId = detail.customer.id
        _state.value = ProfileState(detail = detail, lookups = lookups, isLoading = false)
    }
}
