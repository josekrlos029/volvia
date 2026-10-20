package co.volvia.biz.ui.campaigns

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.core.ActiveHours
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.Audience
import co.volvia.biz.core.AudienceReach
import co.volvia.biz.core.CampaignCreate
import co.volvia.biz.core.CampaignList
import co.volvia.biz.core.Messages
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * A ready-made campaign, the same nine as the dashboard (apps/app/src/components/CampaignComposer.tsx):
 * the offer, the timing and the wording are already sensible; only the words are edited here.
 */
data class CampaignTemplate(
    val id: String,
    val name: String,
    val description: String,
    val headline: String,
    val body: String,
    val offer: JsonObject,
    val offerLabel: String,
    val days: Int,
    val segment: String = "all",
    val hours: ActiveHours? = null,
    val passOverride: JsonObject,
)

private fun offer(kind: String, build: kotlinx.serialization.json.JsonObjectBuilder.() -> Unit = {}) =
    buildJsonObject { put("kind", kind); build() }

private fun pass(header: String?, banner: String, endsOnFirstStamp: Boolean = false) = buildJsonObject {
    header?.let { put("header", it) }
    put("banner", buildJsonObject { put("kind", "preset"); put("value", banner) })
    put("endsOnFirstStamp", endsOnFirstStamp)
}

val CAMPAIGN_TEMPLATES = listOf(
    CampaignTemplate(
        "slow_day", "Día flojo", "Para llenar el día más tranquilo de tu semana.",
        "Hoy tus sellos valen doble", "Pásate hoy y suma dos sellos en lugar de uno.",
        offer("multiplier") { put("factor", 2) }, "Sellos x2", 1,
        passOverride = pass("HOY DOBLE", "sparkle", endsOnFirstStamp = true),
    ),
    CampaignTemplate(
        "happy_hour", "Hora feliz", "Mueve gente a las horas muertas de la tarde.",
        "De 3 a 6 sumas doble", "Esta semana, cada visita entre las 3 y las 6 suma dos sellos.",
        offer("multiplier") { put("factor", 2) }, "Sellos x2 de 3 a 6 p. m.", 7,
        hours = ActiveHours("15:00", "18:00"),
        passOverride = pass("HORA FELIZ", "stars"),
    ),
    CampaignTemplate(
        "win_back", "Recupéralos", "Para quienes llevan más de lo normal sin aparecer.",
        "Te dejamos un sello de regalo", "Hace rato no te vemos, {{name}}. Pasa y encuentra un sello ya puesto en tu tarjeta.",
        offer("bonus_stamps") { put("amount", 1) }, "1 sello de regalo", 14, segment = "missing",
        passOverride = pass("TE EXTRAÑAMOS", "hearts", endsOnFirstStamp = true),
    ),
    CampaignTemplate(
        "double_stamps", "Sellos dobles", "Un empujón corto, sin regalar nada de tu margen.",
        "Fin de semana de sellos dobles", "Viernes, sábado y domingo cada visita cuenta por dos.",
        offer("multiplier") { put("factor", 2) }, "Sellos x2", 3,
        passOverride = pass("SELLOS DOBLES", "sparkle"),
    ),
    CampaignTemplate(
        "spend_and_get", "Gasta y gana", "Sube el ticket medio sin tocar los precios.",
        "Un sello extra en tu próxima visita", "Llévate algo más y te ponemos un sello de más. Van {{stamps}} de tu tarjeta.",
        offer("bonus_stamps") { put("amount", 1) }, "1 sello extra", 7,
        passOverride = pass(null, "gift", endsOnFirstStamp = true),
    ),
    CampaignTemplate(
        "new_offer", "Novedad", "Cuenta una novedad sin regalar sellos.",
        "Algo nuevo en la carta", "Estrenamos algo y queremos que lo pruebes tú primero, {{name}}.",
        offer("message_only"), "Solo mensaje", 10,
        passOverride = pass(null, "confetti"),
    ),
    CampaignTemplate(
        "vip_thanks", "Gracias, habitual", "Un gesto para quienes sostienen el negocio.",
        "Esto es solo para los de siempre", "Gracias por volver tanto, {{name}}. La próxima te invitamos nosotros.",
        offer("instant_reward") { put("title", "Invitación de la casa") }, "Premio: Invitación de la casa", 14, segment = "regulars",
        passOverride = pass("PARA TI", "gift"),
    ),
    CampaignTemplate(
        "last_chance", "Última llamada", "Empuja a quien va a medio camino y se está enfriando.",
        "Tu recompensa está por vencer", "Te quedan {{remaining}} sellos. No dejes que se enfríe la tarjeta.",
        offer("message_only"), "Solo mensaje", 5, segment = "returning",
        passOverride = pass("ÚLTIMA LLAMADA", "sale"),
    ),
    CampaignTemplate(
        "special_deal", "Oferta puntual", "Para una ocasión suelta: un puente, una fecha, una sobra de stock.",
        "Solo hoy, a partir de las {{hour}}", "Una oferta corta para quien pueda pasarse. Te esperamos en {{business}}.",
        offer("message_only"), "Solo mensaje", 1,
        passOverride = pass("SOLO HOY", "sale"),
    ),
)

data class DraftState(
    val template: CampaignTemplate,
    val name: String = template.name,
    val headline: String = template.headline,
    val body: String = template.body,
    val days: Int = template.days,
    val reach: AudienceReach? = null,
    val isCounting: Boolean = true,
    val isLaunching: Boolean = false,
    val error: String? = null,
)

data class CampaignsState(
    val list: CampaignList? = null,
    val isLoading: Boolean = true,
    val error: String? = null,
    val gatedTo: String? = null,
    /** Choosing a template. */
    val picking: Boolean = false,
    val draft: DraftState? = null,
    val notice: String? = null,
)

/** "Campañas": what is running, what ran, and a new one from a template. */
class CampaignsViewModel(application: Application) : AndroidViewModel(application) {
    private val services = AppServices.get(application)
    private val client = services.client

    private val _state = MutableStateFlow(CampaignsState())
    val state: StateFlow<CampaignsState> = _state.asStateFlow()

    private var counting: Job? = null

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            try {
                _state.value = _state.value.copy(list = client.campaigns(), isLoading = false, error = null)
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

    fun pick(open: Boolean) {
        _state.value = _state.value.copy(picking = open)
    }

    fun choose(template: CampaignTemplate) {
        _state.value = _state.value.copy(picking = false, draft = DraftState(template))
        val audience = audienceFor(template)
        counting?.cancel()
        counting = viewModelScope.launch {
            val reach = runCatching { client.previewCampaign(audience) }.getOrNull()
            _state.value.draft?.let { _state.value = _state.value.copy(draft = it.copy(reach = reach, isCounting = false)) }
        }
    }

    fun edit(change: (DraftState) -> DraftState) {
        val draft = _state.value.draft ?: return
        _state.value = _state.value.copy(draft = change(draft).copy(error = null))
    }

    fun closeDraft() {
        _state.value = _state.value.copy(draft = null)
    }

    /** Created and launched in one go, as the dashboard does: starts now, ends after `days`. */
    fun launch() {
        val draft = _state.value.draft ?: return
        val template = draft.template
        val now = Instant.now()
        edit { it.copy(isLaunching = true) }
        viewModelScope.launch {
            try {
                val created = client.createCampaign(
                    CampaignCreate(
                        name = draft.name.trim(),
                        template = template.id,
                        headline = draft.headline.trim(),
                        body = draft.body.trim(),
                        offer = template.offer,
                        audience = audienceFor(template),
                        startsAt = now.toString(),
                        endsAt = now.plus(draft.days.toLong(), ChronoUnit.DAYS).toString(),
                        activeHours = template.hours,
                        passOverride = template.passOverride,
                    ),
                )
                client.launchCampaign(created.id)
                _state.value = _state.value.copy(draft = null, notice = "Campaña lanzada")
                load()
            } catch (error: ApiException) {
                val message = if (error.code == "PLAN_LIMIT_REACHED") "Llegaste al máximo de campañas de este mes." else Messages.load(error)
                _state.value.draft?.let { _state.value = _state.value.copy(draft = it.copy(isLaunching = false, error = message)) }
            } catch (_: Exception) {
                _state.value.draft?.let { _state.value = _state.value.copy(draft = it.copy(isLaunching = false, error = "No pudimos lanzar la campaña.")) }
            }
        }
    }

    fun cancel(id: String) {
        viewModelScope.launch {
            val notice = try {
                client.cancelCampaign(id)
                "Campaña cancelada"
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

    /** Every active card, like the dashboard, so the offer applies wherever the customer stamps. */
    private fun audienceFor(template: CampaignTemplate) = Audience(
        segment = template.segment,
        cardIds = services.orgContext.value?.activeCards?.map { it.id }.orEmpty(),
    )
}
