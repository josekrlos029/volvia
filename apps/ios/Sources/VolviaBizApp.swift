import SwiftUI

@main
struct VolviaBizApp: App {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            Group {
                if model.session.isSignedIn {
                    ScanScreen()
                } else {
                    LoginView()
                }
            }
            .environmentObject(model)
            .onChange(of: scenePhase) { _, phase in
                // Coming back to the foreground is the likeliest moment for the
                // connection to have returned.
                if phase == .active {
                    Task { await model.flush() }
                }
            }
        }
    }
}
