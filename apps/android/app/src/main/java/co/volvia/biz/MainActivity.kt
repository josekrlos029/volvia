package co.volvia.biz

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import co.volvia.biz.ui.AppViewModel
import co.volvia.biz.ui.LoginScreen
import co.volvia.biz.ui.ScanScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            MaterialTheme {
                val model: AppViewModel = viewModel()
                val state by model.state.collectAsState()

                // Coming back to the foreground is the likeliest moment for the
                // connection to have returned.
                lifecycleScope.launch {
                    repeatOnLifecycle(Lifecycle.State.RESUMED) { model.flush() }
                }

                if (state.isSignedIn) {
                    ScanScreen(
                        state = state,
                        onScan = model::handleScan,
                        onRedeem = model::redeem,
                        onDismiss = model::dismissOutcome,
                        onSignOut = model::signOut,
                    )
                } else {
                    LoginScreen(state = state, onSignIn = model::signIn)
                }
            }
        }
    }
}
