import GoogleSignIn
import SwiftUI

@main
struct VolviaBizApp: App {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            Group {
                if model.session.isSignedIn {
                    MainTabView()
                } else {
                    LoginView()
                }
            }
            .environmentObject(model)
            // Google's sign-in sheet returns through the reversed-client-id URL scheme.
            .onOpenURL { url in GIDSignIn.sharedInstance.handle(url) }
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

/// Four tabs: the counter first, because that is where the app is used all day.
struct MainTabView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        TabView(selection: $model.tab) {
            ScanScreen()
                .tabItem { Label("Escanear", systemImage: "qrcode.viewfinder") }
                .tag(AppTab.scan)

            TodayScreen()
                .outcomeOverlay()
                .tabItem { Label("Hoy", systemImage: "chart.bar") }
                .tag(AppTab.today)

            CustomersScreen()
                .outcomeOverlay()
                .tabItem { Label("Clientes", systemImage: "person.2") }
                .tag(AppTab.customers)

            MoreScreen()
                .outcomeOverlay()
                .tabItem { Label("Más", systemImage: "ellipsis.circle") }
                .tag(AppTab.more)
        }
        .tint(.volviaNavy)
        .sheet(item: $model.preview) { preview in
            StampPreviewSheet(preview: preview)
        }
        .sheet(item: $model.planGate) { gate in
            PlanSheet(gate: gate)
        }
        // A result belongs to the screen it happened on; changing tabs clears it.
        .onChange(of: model.tab) { _, _ in model.outcome = nil }
        .task(id: model.session.membership?.orgId) {
            await model.loadContext()
            await model.flush()
        }
    }
}

/// The answer to a stamp taken away from the camera (from a profile, say), shown over
/// whichever tab the staff member is on.
private struct OutcomeOverlay: ViewModifier {
    @EnvironmentObject private var model: AppModel

    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if model.tab != .scan, let outcome = model.outcome {
                ScanOutcomeCard(outcome: outcome) { model.outcome = nil }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy(duration: 0.22), value: model.outcome)
    }
}

extension View {
    func outcomeOverlay() -> some View { modifier(OutcomeOverlay()) }
}
