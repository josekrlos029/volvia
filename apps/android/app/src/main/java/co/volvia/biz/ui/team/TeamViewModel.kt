package co.volvia.biz.ui.team

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.Email
import co.volvia.biz.core.InviteRequest
import co.volvia.biz.core.Messages
import co.volvia.biz.core.TeamPage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class TeamState(
    val team: TeamPage? = null,
    val isLoading: Boolean = true,
    val error: String? = null,
    val isWorking: Boolean = false,
    val notice: String? = null,
    /** A 402 from inviting: shown as the plan sheet. */
    val gatedTo: String? = null,
)

/** "Equipo": who can use the app for this business, and the invitations still open. */
class TeamViewModel(application: Application) : AndroidViewModel(application) {
    private val client = AppServices.get(application).client

    private val _state = MutableStateFlow(TeamState())
    val state: StateFlow<TeamState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            try {
                _state.value = _state.value.copy(team = client.team(), isLoading = false, error = null)
            } catch (error: ApiException) {
                _state.value = _state.value.copy(isLoading = false, error = Messages.load(error))
            } catch (_: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = Messages.GENERIC)
            }
        }
    }

    /** Returns the error for the invite sheet, or null once the email went out. */
    fun invite(email: String, role: String, locationId: String?, onDone: (String?) -> Unit) {
        if (!Email.isValid(email)) {
            onDone("Escribe un correo válido.")
            return
        }
        act(onDone, success = "Invitación enviada a ${email.trim()}") {
            client.invite(InviteRequest(email.trim().lowercase(), role, locationId))
        }
    }

    fun update(membershipId: String, role: String, locationId: String?, onDone: (String?) -> Unit) =
        act(onDone, success = "Cambios guardados") { client.updateMember(membershipId, role, locationId) }

    /** Errors here have no form to sit next to, so they go to the snackbar. */
    fun remove(membershipId: String, name: String) =
        act(::toNotice, success = "$name ya no tiene acceso") { client.removeMember(membershipId) }

    fun revoke(inviteId: String) =
        act(::toNotice, success = "Invitación anulada") { client.revokeInvite(inviteId) }

    private fun toNotice(error: String?) {
        error?.let { _state.value = _state.value.copy(notice = it) }
    }

    private fun act(onDone: (String?) -> Unit, success: String, call: suspend () -> Unit) {
        _state.value = _state.value.copy(isWorking = true)
        viewModelScope.launch {
            val error = try {
                call()
                null
            } catch (error: ApiException) {
                if (error.isPlanGate && error.code == "FEATURE_NOT_IN_PLAN") {
                    _state.value = _state.value.copy(gatedTo = error.upgradeTo ?: "business")
                    ""
                } else if (error.code == "PLAN_LIMIT_REACHED") {
                    "Llegaste al máximo de personas de tu plan."
                } else {
                    Messages.load(error)
                }
            } catch (_: Exception) {
                Messages.GENERIC
            }
            _state.value = _state.value.copy(isWorking = false, notice = if (error == null) success else _state.value.notice)
            if (error == null) load()
            // An empty error means the plan sheet is already up: nothing more to say.
            onDone(error?.takeIf { it.isNotEmpty() })
        }
    }

    fun clearNotice() {
        _state.value = _state.value.copy(notice = null)
    }

    fun clearGate() {
        _state.value = _state.value.copy(gatedTo = null)
    }
}
