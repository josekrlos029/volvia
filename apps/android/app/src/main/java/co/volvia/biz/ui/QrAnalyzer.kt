package co.volvia.biz.ui

import android.annotation.SuppressLint
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage

/**
 * Decodes QR codes from the camera stream.
 *
 * The repeat window is the part that matters at a counter: the same card stays in frame
 * for several seconds after it is stamped, and without it one customer would be stamped
 * ten times while they put their phone away.
 */
class QrAnalyzer(
    private val onCode: (String) -> Unit,
    private val repeatWindowMillis: Long = 4_000,
    private val now: () -> Long = System::currentTimeMillis,
) : ImageAnalysis.Analyzer {

    // Lazy because ML Kit needs an Android runtime: creating it eagerly would mean the
    // repeat-window logic could only ever be tested on a device.
    private val scanner by lazy { BarcodeScanning.getClient() }
    private var last: Pair<String, Long>? = null

    /** Visible for testing: the whole decision, with no camera in the way. */
    fun accepts(code: String): Boolean {
        val previous = last
        if (previous != null && previous.first == code &&
            now() - previous.second < repeatWindowMillis
        ) {
            return false
        }
        last = code to now()
        return true
    }

    @SuppressLint("UnsafeOptInUsageError")
    override fun analyze(image: ImageProxy) {
        val source = image.image
        if (source == null) {
            image.close()
            return
        }

        val input = InputImage.fromMediaImage(source, image.imageInfo.rotationDegrees)
        scanner.process(input)
            .addOnSuccessListener { barcodes ->
                barcodes.firstOrNull { it.format == Barcode.FORMAT_QR_CODE }
                    ?.rawValue
                    ?.let { if (accepts(it)) onCode(it) }
            }
            .addOnCompleteListener { image.close() }
    }
}
