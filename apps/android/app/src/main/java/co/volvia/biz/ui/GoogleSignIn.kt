package co.volvia.biz.ui

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import co.volvia.biz.core.Messages
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

sealed interface GoogleSignInResult {
    data class Token(val idToken: String) : GoogleSignInResult
    data object Cancelled : GoogleSignInResult
    data class Failed(val message: String) : GoogleSignInResult
}

/**
 * "Entrar con Google" through Credential Manager.
 *
 * The token is requested for the *web* client ID, which the API already accepts. Google
 * also checks that this app's package and signing certificate are registered as an
 * Android OAuth client in the same Cloud project; without that it fails here.
 *
 * [activityContext] must be an Activity: the account picker is shown over it.
 */
suspend fun requestGoogleIdToken(activityContext: Context, webClientId: String): GoogleSignInResult {
    val request = GetCredentialRequest.Builder()
        .addCredentialOption(GetSignInWithGoogleOption.Builder(webClientId).build())
        .build()

    return try {
        val credential = CredentialManager.create(activityContext)
            .getCredential(activityContext, request)
            .credential
        if (credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            GoogleSignInResult.Token(GoogleIdTokenCredential.createFrom(credential.data).idToken)
        } else {
            GoogleSignInResult.Failed(Messages.GOOGLE_NO_IDENTITY)
        }
    } catch (_: GetCredentialCancellationException) {
        GoogleSignInResult.Cancelled
    } catch (_: GetCredentialException) {
        GoogleSignInResult.Failed(Messages.GOOGLE_FAILED)
    } catch (_: Exception) {
        GoogleSignInResult.Failed(Messages.GOOGLE_NO_IDENTITY)
    }
}
