package co.volvia.biz.ui.customers

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.Birthday
import co.volvia.biz.core.Email
import co.volvia.biz.core.EnrollRequest
import co.volvia.biz.core.EnrollResult
import co.volvia.biz.core.Messages
import co.volvia.biz.core.Phone
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class EnrollForm(
    val cardId: String? = null,
    val firstName: String = "",
    val email: String = "",
    /** The local number; the prefix is separate and +57 unless changed. */
    val phone: String = "",
    val prefix: String = Phone.DEFAULT_PREFIX,
    val birthMonth: Int? = null,
    val birthDay: Int? = null,
    val marketingConsent: Boolean = false,
    /** Habeas Data. Never pre-ticked: the customer has to say yes. */
    val dataConsent: Boolean = false,
    val stampNow: Boolean = true,
)

data class EnrollState(
    val form: EnrollForm = EnrollForm(),
    val isWorking: Boolean = false,
    val error: String? = null,
    val result: EnrollResult? = null,
    /** Who was just signed up, for the WhatsApp message on the success screen. */
    val enrolledName: String = "",
    val enrolledPhone: String? = null,
    /** One key per attempt at this form: a retry after a timeout must not sign up twice. */
    val idempotencyKey: String = "android-enroll-${UUID.randomUUID()}",
)

/** Signing a customer up at the counter, from "+ Inscribir". */
class EnrollViewModel(application: Application) : AndroidViewModel(application) {
    private val services = AppServices.get(application)
    private val client = services.client

    private val _state = MutableStateFlow(EnrollState())
    val state: StateFlow<EnrollState> = _state.asStateFlow()

    fun update(change: (EnrollForm) -> EnrollForm) {
        _state.value = _state.value.copy(form = change(_state.value.form), error = null)
    }

    /** What is still missing, in the order the form asks for it; null when it can go. */
    fun problem(form: EnrollForm, cardCount: Int): String? = when {
        form.cardId == null && cardCount != 1 -> "Elige la tarjeta."
        form.firstName.isBlank() -> "Escribe el nombre."
        !Email.isValid(form.email) -> "Escribe un correo válido."
        form.phone.isNotBlank() && Phone.normalize(form.phone, form.prefix) == null -> "Revisa el celular."
        (form.birthMonth == null) != (form.birthDay == null) -> "Completa el cumpleaños o déjalo vacío."
        !form.dataConsent -> "Falta la autorización de datos del cliente."
        else -> null
    }

    fun submit() {
        val cards = services.orgContext.value?.activeCards.orEmpty()
        val form = _state.value.form
        problem(form, cards.size)?.let {
            _state.value = _state.value.copy(error = it)
            return
        }
        val cardId = form.cardId ?: cards.singleOrNull()?.id ?: return
        val phone = form.phone.takeIf { it.isNotBlank() }?.let { Phone.normalize(it, form.prefix) }
        _state.value = _state.value.copy(isWorking = true, error = null)
        viewModelScope.launch {
            try {
                val result = client.enroll(
                    EnrollRequest(
                        cardId = cardId,
                        firstName = form.firstName.trim(),
                        email = form.email.trim().lowercase(),
                        phone = phone,
                        birthday = if (form.birthMonth != null && form.birthDay != null) Birthday(form.birthMonth, form.birthDay) else null,
                        marketingConsent = form.marketingConsent,
                        dataConsent = true,
                        stampNow = form.stampNow,
                        locationId = services.currentLocationId(),
                        idempotencyKey = _state.value.idempotencyKey,
                    ),
                )
                services.announceCardChanged()
                _state.value = _state.value.copy(
                    isWorking = false,
                    result = result,
                    enrolledName = form.firstName.trim(),
                    enrolledPhone = phone,
                )
            } catch (error: ApiException) {
                _state.value = _state.value.copy(isWorking = false, error = Messages.enroll(error))
            } catch (_: Exception) {
                _state.value = _state.value.copy(isWorking = false, error = Messages.GENERIC)
            }
        }
    }

    /** "Listo": a clean form, and a fresh key, for the next customer. */
    fun reset() {
        _state.value = EnrollState()
    }

    /** Debug fixtures only. */
    fun showFixture(state: EnrollState) {
        _state.value = state
    }
}
