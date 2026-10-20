package co.volvia.biz.core

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/** A QR code as modules (true = dark), ready to paint at any size. */
class QrMatrix(val size: Int, private val modules: BooleanArray) {
    operator fun get(x: Int, y: Int): Boolean = modules[y * size + x]
}

/**
 * QR codes drawn on the phone rather than downloaded: the customer's card after signing
 * up, the counter's sign-up code and the kiosk's rotating code all have to appear
 * instantly, and the kiosk one changes every thirty seconds.
 */
object QrCode {
    fun encode(text: String): QrMatrix {
        val hints = mapOf(
            // M survives a scratched screen or glare without making the code too dense.
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
            // The quiet zone is drawn by the caller as padding, in the right colour.
            EncodeHintType.MARGIN to 0,
            EncodeHintType.CHARACTER_SET to "UTF-8",
        )
        val bits = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, hints)
        val size = bits.width
        val modules = BooleanArray(size * size) { index -> bits.get(index % size, index / size) }
        return QrMatrix(size, modules)
    }
}
