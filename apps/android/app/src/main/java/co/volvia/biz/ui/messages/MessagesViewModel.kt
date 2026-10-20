package co.volvia.biz.ui.messages

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.Audience
import co.volvia.biz.core.AudienceReach
import co.volvia.biz.core.MessageCreate
import co.volvia.biz.core.MessageList
import co.volvia.biz.core.Messages
import co.volvia.biz.core.SavedSegment
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Who a message (or a campaign) goes to: a built-in bucket or a saved segment. */
data class AudienceChoice(val id: String, val label: String, val audience: Audience)

/** The buckets every business has, named as in the dashboard (apps/app/src/lib/segments.ts). */
val BUILT_IN_AUDIENCES = listOf(
    AudienceChoice("all", "Todos", Audience(segment = "all")),
    AudienceChoice("regulars", "Habituales", Audience(segment = "regulars")),
    AudienceChoice("returning", "Vuelven", Audience(segment = "returning")),
    AudienceChoice("new", "Nuevos", Audience(segment = "new")),
    AudienceChoice("missing", "Se alejan", Audience(segment = "missing")),
    AudienceChoice("lost", "Perdidos", Audience(segment = "lost")),
    AudienceChoice("birthday_month", "Cumplen este mes", Audience(segment = "birthday_month")),
)

data class ComposeState(
    val headline: String = "",
    val body: String = "",
    val audienceId: String = "all",
    val reach: AudienceReach? = null,
    val isCounting: Boolean = false,
    val isSending: Boolean = false,
    val error: String? = null,
)

data class MessagesState(
    val list: MessageList? = null,
    val isLoading: Boolean = true,
    val error: String? = null,
    val gatedTo: String? = null,
    val segments: List<SavedSegment> = emptyList(),
    val compose: ComposeState? = null,
    val notice: String? = null,
) {
    val audiences: List<AudienceChoice>
        get() = BUILT_IN_AUDIENCES + segments.map { AudienceChoice(it.id, it.name, Audience(segmentId = it.id)) }
}

/** "Mensajes": a push to the wallet passes, with this month's usage and who it reaches. */
class MessagesViewModel(application: Application) : AndroidViewModel(application) {
    private val client = AppServices.get(application).client

    private val _state = MutableStateFlow(MessagesState())
    val state: StateFlow<MessagesState> = _state.asStateFlow()

    private var counting: Job? = null

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            try {
                val list = client.messages()
                val segments = runCatching { client.segments().segments }.getOrDefault(emptyList())
                _state.value = _state.value.copy(list = list, segments = segments, isLoading = false, error = null)
            } catch (error: ApiException) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    gatedTo = if (error.isPlanGate) error.upgradeTo ?: "business" else null,
                    error = if (error.isPlanGate) null else Messages.load(error),
                )
            } catch (_: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = Messages.GENERIC)
            }
        }
    }

    fun startCompose() {
        _state.value = _state.value.copy(compose = ComposeState())
        count()
    }

    fun closeCompose() {
        _state.value = _state.value.copy(compose = null)
    }

    fun edit(change: (ComposeState) -> ComposeState) {
        val current = _state.value.compose ?: return
        val next = change(current).copy(error = null)
        _state.value = _state.value.copy(compose = next)
        if (next.audienceId != current.audienceId) count()
    }

    /** "Lo recibirán N": asked again whenever the audience changes. */
    private fun count() {
        val compose = _state.value.compose ?: return
        val audience = _state.value.audiences.firstOrNull { it.id == compose.audienceId }?.audience ?: return
        counting?.cancel()
        edit { it.copy(isCounting = true, reach = null) }
        counting = viewModelScope.launch {
            delay(150)
            val reach = runCatching { client.previewMessage(audience) }.getOrNull()
            _state.value.compose?.let { _state.value = _state.value.copy(compose = it.copy(reach = reach, isCounting = false)) }
        }
    }

    fun send() {
        val compose = _state.value.compose ?: return
        val audience = _state.value.audiences.firstOrNull { it.id == compose.audienceId }?.audience ?: return
        edit { it.copy(isSending = true) }
        viewModelScope.launch {
            try {
                client.sendMessage(MessageCreate(compose.headline.trim(), compose.body.trim(), audience))
                _state.value = _state.value.copy(compose = null, notice = "Mensaje enviado")
                load()
            } catch (error: ApiException) {
                val message = when {
                    error.code == "PLAN_LIMIT_REACHED" -> "Llegaste al máximo de mensajes de este mes."
                    else -> Messages.load(error)
                }
                _state.value.compose?.let { _state.value = _state.value.copy(compose = it.copy(isSending = false, error = message)) }
            } catch (_: Exception) {
                _state.value.compose?.let { _state.value = _state.value.copy(compose = it.copy(isSending = false, error = "No pudimos enviar el mensaje.")) }
            }
        }
    }

    fun cancel(id: String) {
        viewModelScope.launch {
            val notice = try {
                client.cancelMessage(id)
                "Envío cancelado"
            } catch (error: ApiException) {
                Messages.load(error)
            }
            _state.value = _state.value.copy(notice = notice)
            load()
        }
    }

    fun clearNotice() {
        _state.value = _state.value.copy(notice = null)
    }
}
