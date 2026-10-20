package co.volvia.biz.core

import java.io.IOException
import java.net.URLEncoder
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

/** What the client needs to know about the session, without owning it. */
interface TokenSource {
    fun accessToken(): String?
    fun refreshToken(): String?
    fun orgId(): String?
    fun onRefreshed(accessToken: String)
    fun onSignedOut()
}

/**
 * The endpoints this app needs, and nothing else.
 *
 * One silent token refresh per request, exactly like the web client: a staff member in
 * the middle of a queue should never be asked to sign in again because an access token
 * expired fifteen minutes ago.
 */
class ApiClient(
    private val baseUrl: String,
    private val tokens: TokenSource,
    private val http: OkHttpClient = defaultClient(),
) {
    // `explicitNulls = false`: an unset optional (a location, a note) is left out of the
    // body instead of being sent as null, which the API's optional-but-not-nullable fields
    // would refuse.
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }
    private val mediaType = "application/json".toMediaType()

    // ── Session ────────────────────────────────────────────────────────────────

    suspend fun logIn(email: String, password: String): TokenPair =
        post(
            "/v1/auth/login",
            json.encodeToString(LoginRequest(email, password)),
            authenticated = false,
        ).let { json.decodeFromString(it) }

    /** A Google ID token from Credential Manager. Never creates an account (`allowSignup: false`). */
    suspend fun logInWithGoogle(idToken: String): TokenPair =
        post(
            "/v1/auth/google/native",
            json.encodeToString(GoogleLoginRequest(idToken)),
            authenticated = false,
        ).let { json.decodeFromString(it) }

    /** Who this is now: memberships change when the owner adds or removes someone. */
    suspend fun me(): SessionUser = decode(send("GET", "/v1/auth/me"))

    /** Revokes the session on the server. Best effort: signing out never waits on it. */
    suspend fun logOut(refreshToken: String) {
        send("POST", "/v1/auth/logout", json.encodeToString(LogoutRequest(refreshToken)))
    }

    // ── The counter ────────────────────────────────────────────────────────────

    suspend fun stamp(pending: PendingStamp): StampResult =
        post(
            "/v1/stamp",
            json.encodeToString(
                StampRequest(
                    cardToken = pending.cardToken,
                    customerCardId = pending.customerCardId.takeIf { pending.cardToken == null },
                    count = pending.count,
                    locationId = pending.locationId,
                    idempotencyKey = pending.idempotencyKey,
                    purchaseAmount = pending.purchaseAmount,
                    occurredAt = pending.occurredAtIso,
                    note = pending.note?.takeIf { it.isNotBlank() },
                ),
            ),
        ).let { json.decodeFromString(it) }

    suspend fun lookup(cardToken: String? = null, customerCardId: String? = null): CardLookup {
        val query = if (cardToken != null) {
            "cardToken=${cardToken.encoded()}"
        } else {
            "customerCardId=${customerCardId.orEmpty().encoded()}"
        }
        return decode(send("GET", "/v1/lookup?$query"))
    }

    suspend fun voidStamp(eventId: String, reason: String? = null): VoidResult =
        decode(send("POST", "/v1/stamp/${eventId.encoded()}/void", json.encodeToString(VoidRequest(reason))))

    suspend fun redeem(grantId: String, locationId: String? = null): RedeemResult =
        redeem(RedeemRequest(grantId = grantId, locationId = locationId, idempotencyKey = key("redeem")))

    suspend fun redeemCode(code: String, locationId: String? = null): RedeemResult =
        redeem(RedeemRequest(code = code.trim().uppercase(), locationId = locationId, idempotencyKey = key("redeem")))

    private suspend fun redeem(request: RedeemRequest): RedeemResult =
        post("/v1/redeem", json.encodeToString(request)).let { json.decodeFromString(it) }

    suspend fun enroll(request: EnrollRequest): EnrollResult =
        decode(send("POST", "/v1/enroll", json.encodeToString(request)))

    suspend fun myActivity(): ActivityPage = decode(send("GET", "/v1/activity/mine"))

    suspend fun adjust(customerCardId: String, delta: Int, reason: String) {
        send("POST", "/v1/adjust", json.encodeToString(AdjustRequest(customerCardId, delta, reason, key("adjust"))))
    }

    // ── Business ───────────────────────────────────────────────────────────────

    suspend fun org(): OrgInfo = decode(send("GET", "/v1/org"))

    suspend fun locations(): List<Location> = decode(send("GET", "/v1/org/locations"))

    suspend fun cards(): List<CardSummary> = decode(send("GET", "/v1/cards"))

    suspend fun team(): TeamPage = decode(send("GET", "/v1/org/members"))

    suspend fun invite(request: InviteRequest) {
        send("POST", "/v1/org/members/invite", json.encodeToString(request))
    }

    /** `locationId` explicitly null unpins the member, so it is always sent. */
    suspend fun updateMember(membershipId: String, role: String, locationId: String?) {
        val body = buildString {
            append("{\"role\":").append(json.encodeToString(role))
            append(",\"locationId\":").append(if (locationId == null) "null" else json.encodeToString(locationId))
            append("}")
        }
        send("PATCH", "/v1/org/members/${membershipId.encoded()}", body)
    }

    suspend fun removeMember(membershipId: String) {
        send("DELETE", "/v1/org/members/${membershipId.encoded()}")
    }

    suspend fun revokeInvite(inviteId: String) {
        send("DELETE", "/v1/org/invites/${inviteId.encoded()}")
    }

    // ── Customers ──────────────────────────────────────────────────────────────

    suspend fun customers(search: String, page: Int, pageSize: Int = 30): CustomerPage {
        val query = buildString {
            append("page=$page&pageSize=$pageSize")
            if (search.isNotBlank()) append("&search=").append(search.trim().encoded())
        }
        return decode(send("GET", "/v1/customers?$query"))
    }

    suspend fun customer(id: String): CustomerDetail = decode(send("GET", "/v1/customers/${id.encoded()}"))

    /** A hand-built body: a cleared birthday or phone must go as an explicit null. */
    suspend fun updateCustomer(id: String, body: JsonObject) {
        send("PATCH", "/v1/customers/${id.encoded()}", json.encodeToString(body))
    }

    // ── Insights ───────────────────────────────────────────────────────────────

    suspend fun pulse(): Pulse = decode(send("GET", "/v1/analytics/pulse"))

    suspend fun overview(): Overview = decode(send("GET", "/v1/analytics/overview?preset=30d"))

    suspend fun timeseries(): List<TimeseriesPoint> = decode(send("GET", "/v1/analytics/timeseries?preset=30d"))

    suspend fun busiest(): Busiest = decode(send("GET", "/v1/analytics/busiest?preset=90d"))

    suspend fun retention(): Retention = decode(send("GET", "/v1/analytics/retention?months=6"))

    // ── Messages and campaigns ─────────────────────────────────────────────────

    suspend fun messages(): MessageList = decode(send("GET", "/v1/messages"))

    suspend fun segments(): SegmentList = decode(send("GET", "/v1/segments"))

    suspend fun previewMessage(audience: Audience): AudienceReach =
        decode(send("POST", "/v1/messages/preview", json.encodeToString(audience)))

    /** Created as a draft, then sent: the same two steps as the dashboard. */
    suspend fun sendMessage(message: MessageCreate): MessageRow {
        val created: MessageRow = decode(send("POST", "/v1/messages", json.encodeToString(message)))
        return decode(send("POST", "/v1/messages/${created.id.encoded()}/send", "{}"))
    }

    suspend fun cancelMessage(id: String) {
        send("POST", "/v1/messages/${id.encoded()}/cancel", "{}")
    }

    suspend fun campaigns(): CampaignList = decode(send("GET", "/v1/campaigns"))

    suspend fun previewCampaign(audience: Audience): AudienceReach =
        decode(send("POST", "/v1/campaigns/preview", json.encodeToString(audience)))

    suspend fun createCampaign(campaign: CampaignCreate): CampaignRow =
        decode(send("POST", "/v1/campaigns", json.encodeToString(campaign)))

    suspend fun launchCampaign(id: String): CampaignRow =
        decode(send("POST", "/v1/campaigns/${id.encoded()}/launch", "{}"))

    suspend fun cancelCampaign(id: String): CampaignRow =
        decode(send("POST", "/v1/campaigns/${id.encoded()}/cancel", "{}"))

    // ── Kiosk ──────────────────────────────────────────────────────────────────

    suspend fun openKiosk(cardId: String, locationId: String): KioskSession =
        decode(
            send(
                "POST",
                "/v1/kiosk/session",
                json.encodeToString(KioskSessionRequest(cardId, locationId, "Volvia Biz Android")),
            ),
        )

    /** Kiosk polling is unauthenticated: the session secret is the credential. */
    suspend fun kioskNonce(session: KioskSession): KioskNonce =
        decode(send("POST", "/v1/kiosk/nonce", json.encodeToString(session), authenticated = false))

    suspend fun kioskStatus(session: KioskSession): KioskStatus =
        decode(send("POST", "/v1/kiosk/status", json.encodeToString(session), authenticated = false))

    suspend fun closeKiosk(sessionId: String) {
        send("DELETE", "/v1/kiosk/session/${sessionId.encoded()}")
    }

    // ── Plumbing ───────────────────────────────────────────────────────────────

    private inline fun <reified T> decode(text: String): T = json.decodeFromString(text)

    private fun key(prefix: String) = "android-$prefix-${UUID.randomUUID()}"

    private fun String.encoded(): String = URLEncoder.encode(this, "UTF-8")

    private suspend fun post(
        path: String,
        body: String,
        authenticated: Boolean = true,
    ): String = send("POST", path, body, authenticated)

    private suspend fun send(
        method: String,
        path: String,
        body: String? = null,
        authenticated: Boolean = true,
        isRetry: Boolean = false,
    ): String {
        val builder = Request.Builder().url(baseUrl.trimEnd('/') + path)
        when (method) {
            "GET" -> builder.get()
            // Fastify refuses a JSON content type with an empty body, so a bare DELETE
            // goes without either.
            "DELETE" -> if (body != null) builder.delete(body.toRequestBody(mediaType)) else builder.delete()
            else -> builder.method(method, (body ?: "{}").toRequestBody(mediaType))
        }

        if (authenticated) {
            val access = tokens.accessToken()
            if (access == null) {
                tokens.onSignedOut()
                throw ApiException(401, "UNAUTHENTICATED", "sesión cerrada")
            }
            builder.header("authorization", "Bearer $access")
            tokens.orgId()?.let { builder.header("x-org-id", it) }
        }

        val response = try {
            http.newCall(builder.build()).await()
        } catch (_: IOException) {
            // No signal, airplane mode, a dead router. Not the server's fault and not
            // the customer's problem: the queue keeps it.
            throw ApiException.offline
        }
        val text = response.text

        if (response.code == 401 && authenticated && !isRetry) {
            if (refreshTokens()) return send(method, path, body, authenticated = true, isRetry = true)
            tokens.onSignedOut()
        }

        if (response.code !in 200..299) throw ApiException.decode(response.code, text, json)
        return text
    }

    private suspend fun refreshTokens(): Boolean {
        val refresh = tokens.refreshToken() ?: return false
        val request = Request.Builder()
            .url(baseUrl.trimEnd('/') + "/v1/auth/refresh")
            .post(json.encodeToString(RefreshRequest(refresh)).toRequestBody(mediaType))
            .build()

        return runCatching {
            val response = http.newCall(request).await()
            if (response.code !in 200..299) return false

            val pair = json.decodeFromString<TokenPair>(response.text)
            tokens.onRefreshed(pair.accessToken)
            true
        }.getOrDefault(false)
    }

    companion object {
        fun defaultClient(): OkHttpClient =
            OkHttpClient.Builder()
                // A staff member with a customer in front of them will not wait longer.
                .callTimeout(java.time.Duration.ofSeconds(15))
                .build()
    }
}

/** A response already read to the end: status and body, nothing left on the socket. */
private class Answer(val code: Int, val text: String)

/**
 * Bridges OkHttp's callback API into a coroutine, cancellation included.
 *
 * The body is read here, on OkHttp's own thread: the caller resumes on the main thread,
 * and reading a large body there throws NetworkOnMainThreadException.
 */
private suspend fun Call.await(): Answer = suspendCancellableCoroutine { continuation ->
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) {
            val answer = try {
                response.use { Answer(it.code, it.body?.string().orEmpty()) }
            } catch (error: IOException) {
                continuation.resumeWithException(error)
                return
            }
            continuation.resume(answer)
        }

        override fun onFailure(call: Call, e: IOException) = continuation.resumeWithException(e)
    })
    continuation.invokeOnCancellation { runCatching { cancel() } }
}
