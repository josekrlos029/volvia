package co.volvia.biz.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import co.volvia.biz.core.ScanOutcomeUi
import java.util.concurrent.Executors

/** The screen the app lives on. */
@Composable
fun ScanScreen(
    state: UiState,
    onScan: (String) -> Unit,
    onRedeem: (String) -> Unit,
    onDismiss: () -> Unit,
    onSignOut: () -> Unit,
) {
    val context = LocalContext.current
    var hasCamera by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }

    val request = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        hasCamera = it
    }

    LaunchedEffect(Unit) {
        if (!hasCamera) request.launch(Manifest.permission.CAMERA)
    }

    Box(Modifier.fillMaxSize()) {
        if (hasCamera) {
            CameraPreview(onCode = onScan, modifier = Modifier.fillMaxSize())
        }

        Column(Modifier.fillMaxSize()) {
            ScanHeader(state.businessName, state.pendingCount, onAccount = onSignOut)
            Spacer(Modifier.weight(1f))

            val outcome = state.outcome
            if (outcome != null) {
                Box(Modifier.padding(horizontal = 16.dp, vertical = 24.dp)) {
                    ScanOutcomeCard(outcome.toUi(), onRedeem = onRedeem, onDismiss = onDismiss)
                }
            } else {
                AimFrame(
                    Modifier
                        .align(Alignment.CenterHorizontally)
                        .padding(bottom = 90.dp),
                )
            }
        }
    }
}

private fun ScanOutcome.toUi(): ScanOutcomeUi = when (this) {
    is ScanOutcome.Stamped -> ScanOutcomeUi.stamped(result)
    ScanOutcome.Queued -> ScanOutcomeUi.queued()
    is ScanOutcome.Failed -> ScanOutcomeUi.failed(message)
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
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val analyzer = remember { QrAnalyzer(onCode) }
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
