package co.volvia.biz

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import co.volvia.biz.ui.AppViewModel
import co.volvia.biz.ui.LoginScreen
import co.volvia.biz.ui.ScanScreen
import co.volvia.biz.ui.theme.VolviaTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val model: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        // The white "V" on navy until the first frame, like the iOS launch screen.
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Coming back to the foreground is the likeliest moment for the connection to
        // have returned. Registered once here, not from inside a composable.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) { model.flush() }
        }

        simulateScan(intent)

        setContent {
            VolviaTheme {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    val state by model.state.collectAsStateWithLifecycle()

                    if (state.isSignedIn) {
                        ScanScreen(state = state, model = model)
                    } else {
                        LoginScreen(state = state, model = model)
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        simulateScan(intent)
    }

    /**
     * Debug builds only: feed a card URL as if the camera had read it, the emulator's
     * answer to "Simular lectura" on the iOS simulator.
     *
     *   adb shell am start --activity-single-top -n co.volvia.biz/.MainActivity \
     *     --es scan https://tarjeta.somosvolvia.com/c/<token>
     *
     * `--ez simCamera true` swaps the camera for a photo of a counter (store screenshots).
     */
    private fun simulateScan(intent: Intent?) {
        if (!BuildConfig.DEBUG) return
        if (intent?.hasExtra("simCamera") == true) {
            co.volvia.biz.ui.DebugCamera.simulated = intent.getBooleanExtra("simCamera", false)
        }
        val raw = intent?.getStringExtra("scan") ?: return
        intent.removeExtra("scan")
        model.handleScan(raw)
    }
}
