package co.volvia.biz.ui.scan

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.volvia.biz.core.ApiException
import co.volvia.biz.core.AppServices
import co.volvia.biz.core.CardLookup
import co.volvia.biz.core.CardToken
import co.volvia.biz.core.Messages
import co.volvia.biz.core.PendingStamp
import co.volvia.biz.core.RedeemResult
import co.volvia.biz.core.StampResult
import co.volvia.biz.core.VoidResult
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock

/** What the scanner is showing right now. */
sealed interface ScanOutcome {
    /**
     * [undoUntil] is when "Deshacer" disappears (epoch millis), or null when the scan
     * cannot be undone from here: no event id, or it went through the queue.
     */
    data class Stamped(val result: StampResult, val undoUntil: Long? = null) : ScanOutcome

    /**
     * Taken at the counter, waiting for the network. The customer is told the same thing
     * either way, because for them it is the same thing.
     */
    data object Queued : ScanOutcome

    data class Failed(val message: String) : ScanOutcome

    data class Voided(val result: VoidResult, val firstName: String) : ScanOutcome

    data class Redeemed(val result: RedeemResult) : ScanOutcome
}

/** The sheet between reading a card and stamping it. */
data class PreviewState(
    val cardToken: String? = null,
    val customerCardId: String? = null,
    val lookup: CardLookup? = null,
    val isLoading: Boolean = true,
    val error: String? = null,
    val count: Int = 1,
    /** Digits only; formatted with thousands dots by the field. */
    val amount: String = "",
    val note: String = "",
    val isWorking: Boolean = false,
    /** A reward handed over from the sheet, said once and then gone. */
    val notice: String? = null,
)

data class ScanState(
    val outcome: ScanOutcome? = null,
    val isWorking: Boolean = false,
    val preview: PreviewState? = null,
)

class ScanViewModel(application: Application) : AndroidViewModel(application) {
    private val services = AppServices.get(application)
    private val session = services.session
    private val queue = services.queue
    private val client = services.client

    private val _state = MutableStateFlow(ScanState())
    val state: StateFlow<ScanState> = _state.asStateFlow()

    /**
     * One scan, from the camera to the answer on screen.
     *
     * With "Sellado rápido" on, a card stamps one the moment it is read, exactly as in
     * 1.1. Otherwise (or when a card needs the purchase amount) the card is looked up
     * first and the sheet asks how many.
     */
    fun handleScan(raw: String) {
        val token = CardToken.parse(raw)
        if (token == null) {
            _state.value = _state.value.copy(outcome = ScanOutcome.Failed(Messages.NOT_A_CARD), preview = null)
            return
        }
        // A second card read while the sheet is open replaces it: the queue moved on.
        val quick = session.quickStamp
        val anyMinSpend = services.orgContext.value?.activeCards?.any { it.rules.mode == "min_spend" } ?: false
        if (quick && !anyMinSpend) {
            stampQuick(token)
        } else {
            openPreview(cardToken = token, stampIfQuick = quick)
        }
    }

    /** "Sumar sello" from a customer's profile: the same sheet, by customer card id. */
    fun openForCustomerCard(customerCardId: String) {
        openPreview(customerCardId = customerCardId, stampIfQuick = false)
    }

    private fun openPreview(cardToken: String? = null, customerCardId: String? = null, stampIfQuick: Boolean) {
        _state.value = _state.value.copy(
            outcome = null,
            preview = PreviewState(cardToken = cardToken, customerCardId = customerCardId),
        )
        viewModelScope.launch {
            try {
                val lookup = client.lookup(cardToken = cardToken, customerCardId = customerCardId)
                if (stampIfQuick && !lookup.card.needsAmount && cardToken != null) {
                    // Quick stamping, and this card does not need an amount after all.
                    _state.value = _state.value.copy(preview = null)
                    stampQuick(cardToken)
                    return@launch
                }
                updatePreview { it.copy(lookup = lookup, isLoading = false, error = null) }
            } catch (error: ApiException) {
                if (error.isTransient && cardToken != null) {
                    // No network to look the card up: the 1.1 behaviour, one stamp into the queue.
                    _state.value = _state.value.copy(preview = null)
                    stampQuick(cardToken)
                } else {
                    updatePreview { it.copy(isLoading = false, error = Messages.stamp(error)) }
                }
            } catch (_: Exception) {
                updatePreview { it.copy(isLoading = false, error = Messages.GENERIC) }
            }
        }
    }

    fun setCount(value: Int) = updatePreview { preview ->
        val max = preview.lookup?.card?.maxStampsPerScan ?: 1
        preview.copy(count = value.coerceIn(1, max.coerceAtLeast(1)))
    }

    fun setAmount(value: String) = updatePreview { it.copy(amount = value.filter(Char::isDigit).take(12)) }

    fun setNote(value: String) = updatePreview { it.copy(note = value.take(200)) }

    fun closePreview() {
        _state.value = _state.value.copy(preview = null)
    }

    /** "Sellar N" in the sheet. */
    fun stampFromPreview() {
        val preview = _state.value.preview ?: return
        val lookup = preview.lookup ?: return
        val amount = preview.amount.toLongOrNull()
        if (lookup.card.needsAmount && amount == null) {
            updatePreview { it.copy(error = "Escribe el monto de la compra.") }
            return
        }
        val stamp = PendingStamp(
            cardToken = preview.cardToken,
            customerCardId = lookup.customerCardId.takeIf { preview.cardToken == null },
            count = preview.count,
            purchaseAmount = amount.takeIf { lookup.card.needsAmount },
            note = preview.note.trim().takeIf { it.isNotEmpty() },
            locationId = services.currentLocationId(),
            occurredAtIso = Instant.now().toString(),
        )
        updatePreview { it.copy(isWorking = true, error = null) }
        send(stamp, keepPreviewOnRefusal = true)
    }

    /** One stamp, straight away: the 1.1 counter. */
    private fun stampQuick(token: String) {
        send(
            PendingStamp(
                cardToken = token,
                locationId = services.currentLocationId(),
                occurredAtIso = Instant.now().toString(),
            ),
            keepPreviewOnRefusal = false,
        )
    }

    /**
     * The stamp is put in the queue before it is sent. That ordering is the whole
     * design: nothing a staff member does at the counter can be lost by a network that
     * chose that second to drop.
     */
    private fun send(stamp: PendingStamp, keepPreviewOnRefusal: Boolean) {
        queue.enqueue(stamp)
        services.publishQueue()
        _state.value = _state.value.copy(isWorking = true)

        viewModelScope.launch {
            try {
                val result = services.sendLock.withLock { client.stamp(stamp) }
                queue.remove(stamp.id)
                val undoUntil = result.eventId?.takeIf { !result.replayed }?.let { System.currentTimeMillis() + UNDO_WINDOW_MS }
                _state.value = _state.value.copy(
                    outcome = ScanOutcome.Stamped(result, undoUntil),
                    isWorking = false,
                    preview = null,
                )
                services.announceCardChanged()
            } catch (error: ApiException) {
                if (error.isTransient) {
                    android.util.Log.w("VolviaBiz", "stamp queued: ${error.status} ${error.code} ${error.message}")
                    _state.value = _state.value.copy(outcome = ScanOutcome.Queued, isWorking = false, preview = null)
                } else {
                    queue.remove(stamp.id)
                    val message = when (error.code) {
                        "STAMP_COOLDOWN_ACTIVE" -> Messages.cooldown(_state.value.preview?.lookup?.cooldownSecondsLeft ?: 0)
                        else -> Messages.stamp(error)
                    }
                    if (keepPreviewOnRefusal && _state.value.preview != null) {
                        // The sheet stays open so the amount can be corrected.
                        updatePreview { it.copy(isWorking = false, error = message) }
                        _state.value = _state.value.copy(isWorking = false)
                    } else {
                        _state.value = _state.value.copy(outcome = ScanOutcome.Failed(message), isWorking = false, preview = null)
                    }
                }
            } catch (error: Exception) {
                // An answer we could not read. The stamp stays queued; the idempotency key
                // makes the retry safe if the server did apply it.
                android.util.Log.w("VolviaBiz", "stamp answer unreadable", error)
                _state.value = _state.value.copy(outcome = ScanOutcome.Queued, isWorking = false, preview = null)
            }
            services.publishQueue()
        }
    }

    /** "Deshacer" on the result, after the confirmation. */
    fun undo() {
        val stamped = _state.value.outcome as? ScanOutcome.Stamped ?: return
        val eventId = stamped.result.eventId ?: return
        _state.value = _state.value.copy(isWorking = true)
        viewModelScope.launch {
            _state.value = try {
                val result = client.voidStamp(eventId)
                services.announceCardChanged()
                _state.value.copy(outcome = ScanOutcome.Voided(result, stamped.result.customer.firstName), isWorking = false)
            } catch (error: ApiException) {
                _state.value.copy(outcome = ScanOutcome.Failed(Messages.void(error)), isWorking = false)
            } catch (_: Exception) {
                _state.value.copy(outcome = ScanOutcome.Failed(Messages.GENERIC), isWorking = false)
            }
        }
    }

    /** "Entregar ahora" on the result card. */
    fun redeem(grantId: String) {
        viewModelScope.launch {
            _state.value = try {
                val result = client.redeem(grantId, services.currentLocationId())
                services.announceCardChanged()
                _state.value.copy(outcome = ScanOutcome.Redeemed(result))
            } catch (error: ApiException) {
                _state.value.copy(outcome = ScanOutcome.Failed(Messages.redeem(error)))
            } catch (_: Exception) {
                _state.value.copy(outcome = ScanOutcome.Failed(Messages.REDEEM_FAILED))
            }
        }
    }

    /** "Entregar" on a pending reward inside the preview sheet; the sheet stays open. */
    fun redeemInPreview(grantId: String) {
        updatePreview { it.copy(isWorking = true, error = null, notice = null) }
        viewModelScope.launch {
            try {
                val result = client.redeem(grantId, services.currentLocationId())
                services.announceCardChanged()
                val preview = _state.value.preview ?: return@launch
                val refreshed = runCatching {
                    client.lookup(cardToken = preview.cardToken, customerCardId = preview.lookup?.customerCardId ?: preview.customerCardId)
                }.getOrNull()
                updatePreview {
                    it.copy(
                        lookup = refreshed ?: it.lookup?.copy(pendingRewards = it.lookup.pendingRewards.filterNot { r -> r.grantId == grantId }),
                        isWorking = false,
                        notice = "Entregado: ${result.title}",
                    )
                }
            } catch (error: ApiException) {
                updatePreview { it.copy(isWorking = false, error = Messages.redeem(error)) }
            } catch (_: Exception) {
                updatePreview { it.copy(isWorking = false, error = Messages.REDEEM_FAILED) }
            }
        }
    }

    /**
     * A reward code typed at the till ("Código"). Returns the error to show in the sheet,
     * or null when it went through and the result card took over.
     */
    suspend fun redeemCode(code: String): String? = try {
        val result = client.redeemCode(code, services.currentLocationId())
        services.announceCardChanged()
        _state.value = _state.value.copy(outcome = ScanOutcome.Redeemed(result), preview = null)
        null
    } catch (error: ApiException) {
        Messages.redeem(error)
    } catch (_: Exception) {
        Messages.REDEEM_FAILED
    }

    fun dismissOutcome() {
        _state.value = _state.value.copy(outcome = null)
    }

    /** Debug fixtures only: show a state without a server. */
    fun showFixture(outcome: ScanOutcome?, preview: PreviewState?) {
        _state.value = ScanState(outcome = outcome, preview = preview)
    }

    private fun updatePreview(change: (PreviewState) -> PreviewState) {
        val current = _state.value.preview ?: return
        _state.value = _state.value.copy(preview = change(current))
    }

    companion object {
        /** The API lets staff undo their own scan for five minutes. */
        const val UNDO_WINDOW_MS = 5 * 60 * 1000L
    }
}
