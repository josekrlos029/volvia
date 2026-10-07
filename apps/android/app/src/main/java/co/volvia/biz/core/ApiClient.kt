package co.volvia.biz.core

import java.io.IOException
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
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
 * The four endpoints this app needs, and nothing else.
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
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val mediaType = "application/json".toMediaType()

    suspend fun logIn(email: String, password: String): TokenPair =
        post(
            "/v1/auth/login",
            json.encodeToString(LoginRequest(email, password)),
            authenticated = false,
        ).let { json.decodeFromString(it) }

    suspend fun stamp(pending: PendingStamp): StampResult =
        post(
            "/v1/stamp",
            json.encodeToString(
                StampRequest(
                    cardToken = pending.cardToken,
                    count = pending.count,
                    idempotencyKey = pending.idempotencyKey,
                    occurredAt = pending.occurredAtIso,
                ),
            ),
        ).let { json.decodeFromString(it) }

    suspend fun redeem(grantId: String): RedeemResult =
        post(
            "/v1/redeem",
            json.encodeToString(
                RedeemRequest(grantId, "android-redeem-${UUID.randomUUID()}"),
            ),
        ).let { json.decodeFromString(it) }

    private suspend fun post(
        path: String,
        body: String,
        authenticated: Boolean = true,
        isRetry: Boolean = false,
    ): String {
        val builder = Request.Builder()
            .url(baseUrl.trimEnd('/') + path)
            .post(body.toRequestBody(mediaType))

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

        val text = response.body?.string().orEmpty()

        if (response.code == 401 && authenticated && !isRetry) {
            if (refreshTokens()) return post(path, body, authenticated = true, isRetry = true)
            tokens.onSignedOut()
        }

        if (!response.isSuccessful) throw ApiException.decode(response.code, text, json)
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
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) return false

            val pair = json.decodeFromString<TokenPair>(text)
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

/** Bridges OkHttp's callback API into a coroutine, cancellation included. */
private suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) = continuation.resume(response)
        override fun onFailure(call: Call, e: IOException) = continuation.resumeWithException(e)
    })
    continuation.invokeOnCancellation { runCatching { cancel() } }
}
