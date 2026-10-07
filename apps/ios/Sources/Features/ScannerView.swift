import AVFoundation
import SwiftUI

/// The camera, and nothing else on screen.
///
/// A staff member holds the phone in one hand with a queue in front of them. Everything
/// that is not the viewfinder — counters, menus, settings — belongs on another screen.
struct ScannerView: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    func makeUIViewController(context: Context) -> ScannerViewController {
        let controller = ScannerViewController()
        controller.onCode = onCode
        return controller
    }

    func updateUIViewController(_ controller: ScannerViewController, context: Context) {
        controller.onCode = onCode
    }
}

final class ScannerViewController: UIViewController {
    var onCode: ((String) -> Void)?

    /// `AVCaptureSession` is safe to drive from any queue as long as the calls are
    /// serialised, which is what `sessionQueue` is for. Starting it on the main thread
    /// blocks the first frame long enough to be visible.
    private nonisolated(unsafe) let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "co.volvia.biz.camera")
    private var preview: AVCaptureVideoPreviewLayer?
    /// The same card stays in frame for several seconds after it is stamped. Without
    /// this, one customer would be stamped ten times while they put their phone away.
    private var lastCode: (value: String, at: Date)?
    private let repeatWindow: TimeInterval = 4

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configure()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        start()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        // The camera light staying on after the screen is gone reads as a bug and
        // drains a phone that has to last a full shift.
        if session.isRunning {
            let session = self.session
            sessionQueue.async { session.stopRunning() }
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    private func configure() {
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input)
        else { return }

        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { return }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        preview = layer
    }

    private func start() {
        let session = self.session
        let queue = sessionQueue
        AVCaptureDevice.requestAccess(for: .video) { granted in
            guard granted, !session.isRunning else { return }
            queue.async { session.startRunning() }
        }
    }

    func accepts(_ code: String, now: Date = Date()) -> Bool {
        if let last = lastCode, last.value == code, now.timeIntervalSince(last.at) < repeatWindow {
            return false
        }
        lastCode = (code, now)
        return true
    }
}

/// The output's delegate queue is `.main`, so this callback is genuinely main-actor
/// isolated. `@preconcurrency` is how that is stated to a protocol declared before the
/// annotations existed.
extension ScannerViewController: @preconcurrency AVCaptureMetadataOutputObjectsDelegate {
    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput objects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard let object = objects.first as? AVMetadataMachineReadableCodeObject,
              let value = object.stringValue,
              accepts(value)
        else { return }

        AudioServicesPlaySystemSound(1057)
        onCode?(value)
    }
}

import AudioToolbox
