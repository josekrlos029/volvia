package co.volvia.biz.core

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Where the session lives between launches.
 *
 * Encrypted preferences, not plain ones: a staff phone is shared, left on a counter and
 * occasionally lost, and a refresh token in a plain XML file is readable by anything
 * that can reach a backup.
 */
class SessionStore(context: Context) : TokenSource {
    private val json = Json { ignoreUnknownKeys = true }

    private val prefs: SharedPreferences = runCatching {
        val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        EncryptedSharedPreferences.create(
            context,
            "volvia-session",
            key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        ) as SharedPreferences
    }.getOrElse {
        // A device whose keystore is broken still has to let somebody stamp. Falling
        // back is better than a till that cannot open, and the tokens are short-lived.
        context.getSharedPreferences("volvia-session", Context.MODE_PRIVATE)
    }

    var user: SessionUser? = readUser()
        private set

    var membership: Membership? = readMembership()
        private set

    val isSignedIn: Boolean get() = membership != null && accessToken() != null

    override fun accessToken(): String? = prefs.getString("accessToken", null)

    override fun refreshToken(): String? = prefs.getString("refreshToken", null)

    override fun orgId(): String? = membership?.orgId

    override fun onRefreshed(accessToken: String) {
        prefs.edit().putString("accessToken", accessToken).apply()
    }

    override fun onSignedOut() = signOut()

    fun save(pair: TokenPair) {
        prefs.edit()
            .putString("accessToken", pair.accessToken)
            .putString("refreshToken", pair.refreshToken)
            .putString("user", json.encodeToString(pair.user))
            .apply()

        user = pair.user
        val selected = prefs.getString("orgId", null)
        membership = pair.user.memberships.firstOrNull { it.orgId == selected }
            ?: pair.user.memberships.firstOrNull()
    }

    fun select(value: Membership) {
        membership = value
        prefs.edit().putString("orgId", value.orgId).apply()
    }

    /**
     * A fresher copy of the user from `/v1/auth/me`: a role or a pinned location changed
     * in the dashboard reaches the counter without signing out and in again.
     */
    fun updateUser(value: SessionUser) {
        prefs.edit().putString("user", json.encodeToString(value)).apply()
        user = value
        val selected = membership?.orgId
        membership = value.memberships.firstOrNull { it.orgId == selected } ?: value.memberships.firstOrNull()
    }

    /** The location this phone stamps for, remembered per business. */
    fun locationId(orgId: String): String? = prefs.getString("location.$orgId", null)

    fun setLocationId(orgId: String, locationId: String?) {
        prefs.edit().apply {
            if (locationId == null) remove("location.$orgId") else putString("location.$orgId", locationId)
        }.apply()
    }

    /**
     * "Sellado rápido": one stamp the moment a card is read, the 1.1 behaviour. On by
     * default so nobody who already uses the app finds the counter slower after updating.
     */
    var quickStamp: Boolean
        get() = prefs.getBoolean("quickStamp", true)
        set(value) = prefs.edit().putBoolean("quickStamp", value).apply()

    /**
     * Clears the session but never the pending queue: stamps already taken from real
     * customers are not ours to discard because somebody signed out.
     */
    fun signOut() {
        prefs.edit().remove("accessToken").remove("refreshToken").remove("user").apply()
        user = null
        membership = null
        onChange?.invoke()
    }

    /** Told when the session ends, including a refresh the server refused mid-request. */
    var onChange: (() -> Unit)? = null

    private fun readUser(): SessionUser? =
        prefs.getString("user", null)?.let { stored ->
            runCatching { json.decodeFromString<SessionUser>(stored) }.getOrNull()
        }

    private fun readMembership(): Membership? {
        val stored = readUser() ?: return null
        val selected = prefs.getString("orgId", null)
        return stored.memberships.firstOrNull { it.orgId == selected }
            ?: stored.memberships.firstOrNull()
    }
}
