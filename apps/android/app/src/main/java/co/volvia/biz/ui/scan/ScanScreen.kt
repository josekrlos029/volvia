package co.volvia.biz.ui.scan

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.LocalLifecycleOwner
import co.volvia.biz.ui.UiState
import androidx.compose.material3.CircularProgressIndicator
import java.util.concurrent.Executors

/**
 * Debug builds only: a photo of a counter instead of the camera, for store screenshots on
 * the emulator (whose camera is a virtual living room). The image ships only in
 * src/debug, so release builds can't show it even if the flag were set.
 */
object DebugCamera {
    var simulated by mutableStateOf(false)
}

/**
 * The "Escanear" tab: the camera, and nothing between it and the next customer. The
 * preview sheet and the "Código" sheet open over it; the result slides up from below.
 */
@Composable
fun ScanScreen(app: UiState, scan: ScanState, model: ScanViewModel) {
    val context = LocalContext.current
    fun granted() = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED

    var hasCamera by remember { mutableStateOf(granted()) }
    var asked by remember { mutableStateOf(false) }
    var showCode by remember { mutableStateOf(false) }

    val request = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        hasCamera = it
        asked = true
    }

    LaunchedEffect(Unit) {
        if (!hasCamera) request.launch(Manifest.permission.CAMERA)
    }

    // The header is always dark over the camera: white status bar icons, whatever the theme.
    val view = androidx.compose.ui.platform.LocalView.current
    DisposableEffect(view) {
        val window = (view.context as? android.app.Activity)?.window
        val controller = window?.let { androidx.core.view.WindowCompat.getInsetsController(it, view) }
        val previous = controller?.isAppearanceLightStatusBars
        controller?.isAppearanceLightStatusBars = false
        onDispose { previous?.let { controller.isAppearanceLightStatusBars = it } }
    }

    // Coming back from Settings with the permission granted should just work.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { hasCamera = granted() }

    // A short tick on every accepted read, like iOS (system sound 1057): at a noisy counter
    // it is how staff know the phone saw the card before the card is pulled away.
    val tone = remember { runCatching { ToneGenerator(AudioManager.STREAM_SYSTEM, 60) }.getOrNull() }
    DisposableEffect(Unit) { onDispose { tone?.release() } }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        val simulatedPhoto = remember {
            if (co.volvia.biz.BuildConfig.DEBUG) {
                context.resources.getIdentifier("sim_camera", "drawable", context.packageName)
            } else {
                0
            }
        }
        if (DebugCamera.simulated && simulatedPhoto != 0) {
            androidx.compose.foundation.Image(
                painter = androidx.compose.ui.res.painterResource(simulatedPhoto),
                contentDescription = null,
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else if (hasCamera) {
            CameraPreview(
                onCode = { code ->
                    // While the sheet is open the camera keeps running but does not stamp:
                    // the customer in front of the staff member is the one in the sheet.
                    if (scan.preview == null) {
                        tone?.startTone(ToneGenerator.TONE_PROP_BEEP, 70)
                        model.handleScan(code)
                    }
                },
                modifier = Modifier.fillMaxSize(),
            )
        } else if (asked) {
            CameraDenied(Modifier.align(Alignment.Center))
        }

        Column(Modifier.fillMaxSize()) {
            ScanHeader(app.businessName, app.locationName, app.pendingCount, onCode = { showCode = true })
            Spacer(Modifier.weight(1f))

            OutcomeOverlay(scan, model)

            if (scan.outcome == null && hasCamera) {
                AimFrame(
                    Modifier
                        .align(Alignment.CenterHorizontally)
                        .padding(bottom = 90.dp),
                )
            }
        }

        if (scan.isWorking && scan.preview == null) {
            CircularProgressIndicator(
                color = Color.White,
                strokeWidth = 3.dp,
                modifier = Modifier.align(Alignment.Center).size(36.dp),
            )
        }
    }

    if (showCode) {
        RedeemCodeSheet(model = model, onDismiss = { showCode = false })
    }
}

/** Without the camera the app cannot do its one job, so say why and where to fix it. */
@Composable
private fun CameraDenied(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            "Volvia Biz usa la cámara para leer el código de la tarjeta de tus clientes y sumarles un sello.",
            color = Color.White,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
        )
        Button(
            onClick = {
                context.startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)),
                )
            },
            shape = RoundedCornerShape(12.dp),
        ) { Text("Permitir la cámara") }
    }
}

/**
 * CameraX preview with ML Kit decoding on a background executor.
 *
 * `STRATEGY_KEEP_ONLY_LATEST` matters at a counter: a phone that falls behind decoding
 * frames would stamp from an image taken three seconds ago, which is the previous
 * customer.
 */
@Composable
private fun CameraPreview(onCode: (String) -> Unit, modifier: Modifier = Modifier) {
    val lifecycleOwner = LocalLifecycleOwner.current
    val latestOnCode by rememberUpdatedState(onCode)
    val analyzer = remember { QrAnalyzer(onCode = { latestOnCode(it) }) }
    val executor = remember { Executors.newSingleThreadExecutor() }

    DisposableEffect(Unit) {
        onDispose { executor.shutdown() }
    }

    AndroidView(
        modifier = modifier,
        factory = { viewContext ->
            val previewView = PreviewView(viewContext)
            val providerFuture = ProcessCameraProvider.getInstance(viewContext)

            providerFuture.addListener({
                val provider = providerFuture.get()
                val preview = Preview.Builder().build().also {
                    it.surfaceProvider = previewView.surfaceProvider
                }

                val analysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also { it.setAnalyzer(executor, analyzer) }

                runCatching {
                    provider.unbindAll()
                    provider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        analysis,
                    )
                }
            }, ContextCompat.getMainExecutor(viewContext))

            previewView
        },
    )
}
