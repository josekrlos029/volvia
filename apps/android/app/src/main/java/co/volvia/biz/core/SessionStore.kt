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
     * Clears the session but never the pending queue: stamps already taken from real
     * customers are not ours to discard because somebody signed out.
     */
    fun signOut() {
        prefs.edit().remove("accessToken").remove("refreshToken").remove("user").apply()
        user = null
        membership = null
    }

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
