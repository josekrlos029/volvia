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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import co.volvia.biz.ui.AppViewModel
import co.volvia.biz.ui.DebugFixtures
import co.volvia.biz.ui.LoginScreen
import co.volvia.biz.ui.MainShell
import co.volvia.biz.ui.Navigator
import co.volvia.biz.ui.Tab
import co.volvia.biz.ui.scan.ScanViewModel
import co.volvia.biz.ui.theme.VolviaTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val model: AppViewModel by viewModels()
    private val scanModel: ScanViewModel by viewModels()
    private val navigator = Navigator()

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

        handleDebugIntent(intent)

        setContent {
            VolviaTheme {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    val state by model.state.collectAsStateWithLifecycle()

                    // Signing out or switching business starts again from the camera.
                    val sessionKey = "${state.isSignedIn}-${state.selectedOrgId}"
                    var lastSession by rememberSaveable { mutableStateOf(sessionKey) }
                    LaunchedEffect(sessionKey) {
                        if (lastSession != sessionKey) {
                            lastSession = sessionKey
                            navigator.reset()
                        }
                    }

                    if (state.isSignedIn) {
                        MainShell(app = state, model = model, scanModel = scanModel, navigator = navigator)
                    } else {
                        LoginScreen(state = state, model = model)
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDebugIntent(intent)
    }

    /**
     * Debug builds only.
     *
     * Feed a card URL as if the camera had read it, the emulator's answer to "Simular
     * lectura" on the iOS simulator:
     *
     *   adb shell am start --activity-single-top -n co.volvia.biz/.MainActivity \
     *     --es scan https://tarjeta.somosvolvia.com/c/<token>
     *
     * `--ez simCamera true` swaps the camera for a photo of a counter (store screenshots).
     * `--es tab hoy|clientes|mas` opens a tab. `--es simState <name>` shows fake data for
     * screenshots (see [DebugFixtures]); it needs a signed-in session to draw the tabs.
     */
    private fun handleDebugIntent(intent: Intent?) {
        if (!BuildConfig.DEBUG || intent == null) return
        if (intent.hasExtra("simCamera")) {
            co.volvia.biz.ui.scan.DebugCamera.simulated = intent.getBooleanExtra("simCamera", false)
        }
        intent.getStringExtra("tab")?.let { name ->
            intent.removeExtra("tab")
            navigator.stack.clear()
            navigator.tab = when (name) {
                "hoy", "today" -> Tab.Today
                "clientes", "customers" -> Tab.Customers
                "mas", "more" -> Tab.More
                else -> Tab.Scan
            }
        }
        intent.getStringExtra("simState")?.let { name ->
            intent.removeExtra("simState")
            DebugFixtures.apply(this, name, navigator, scanModel)
        }
        val raw = intent.getStringExtra("scan") ?: return
        intent.removeExtra("scan")
        navigator.stack.clear()
        navigator.tab = Tab.Scan
        scanModel.handleScan(raw)
    }
}
