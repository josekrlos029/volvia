import Combine
import Foundation
import SwiftUI
import UIKit

/// What the counter is showing right now.
enum ScanOutcome: Equatable {
    /// Landed. `at` is when, so "Deshacer" can disappear after the undo window.
    case stamped(StampResult, at: Date)
    /// Taken at the counter, waiting for the network. The customer is told the same
    /// thing either way, because for them it is the same thing.
    case queued(customerHint: String)
    case failed(String)
    case voided(VoidResult, name: String)
    case redeemed(RedeemResult)
    /// Anything else worth a sentence: an undo that was refused, a reward that was not.
    case notice(title: String, message: String)
}

enum AppTab: Hashable {
    case scan, today, customers, more
}

/// The scanned card, open in the preview sheet before anything is added to it.
struct StampPreview: Identifiable, Equatable {
    let id = UUID()
    let lookup: CardLookup
}

/// "Disponible en el plan X", shown instead of an error when the plan is the reason.
struct PlanGate: Identifiable, Equatable {
    let id = UUID()
    let plan: String?
    let isLimit: Bool
}

/// The app, in one place.
///
/// The counter's state (session, queue, outcome, the preview being shown) lives here; the
/// management screens load their own data through `api` and only come back here for the
/// things every screen shares: the business, its locations and cards, error wording and
/// the plan sheet.
@MainActor
final class AppModel: ObservableObject {
    @Published var outcome: ScanOutcome?
    @Published var isSending = false
    @Published var tab: AppTab = .scan
    @Published var preview: StampPreview?
    @Published var planGate: PlanGate?

    /// The business behind the selected membership: entitlements, settings, public URL.
    @Published private(set) var org: OrgInfo?
    @Published private(set) var locations: [OrgLocation] = []
    @Published private(set) var cards: [LoyaltyCard] = []
    /// Bumped after every stamp, undo, redemption or adjustment, so a profile or the
    /// "Hoy" list on screen reloads without polling.
    @Published private(set) var revision = 0

    let session = SessionStore()
    let queue = StampQueue()
    let api: APIClient

    /// How long a staff member may undo their own scan (`STAMP_VOID_WINDOW_MINUTES`).
    static let undoWindow: TimeInterval = 5 * 60

    private var forwarders: Set<AnyCancellable> = []

    init(baseURL: URL = AppModel.defaultBaseURL) {
        let store = session
        var urlSession = URLSession.shared
        #if targetEnvironment(simulator)
        if let fixtures = SimulatorFixtures.urlSession { urlSession = fixtures }
        #endif
        api = APIClient(
            baseURL: baseURL,
            session: urlSession,
            tokens: { @Sendable in
                await MainActor.run {
                    (store.accessToken, store.refreshToken, store.membership?.orgId)
                }
            },
            onRefreshed: { @Sendable token in
                await MainActor.run { store.updateAccessToken(token) }
            },
            onSignedOut: { @Sendable in
                await MainActor.run { store.signOut() }
            }
        )

        // Views observe this object, but the session and the queue are objects of their own:
        // without this, signing in or queueing a stamp would not redraw until the next launch.
        for publisher in [session.objectWillChange, queue.objectWillChange] {
            publisher
                .sink { [weak self] _ in MainActor.assumeIsolated { self?.objectWillChange.send() } }
                .store(in: &forwarders)
        }

        session.restore()
        #if targetEnvironment(simulator)
        SimulatorFixtures.apply(to: self)
        #endif
    }

    /// Release builds get `https://api.somosvolvia.com` through `VOLVIA_API_URL` in
    /// project.yml; Debug builds get localhost and can be pointed elsewhere (the isolated
    /// stack, say) with the `VOLVIA_API_URL` environment variable of the scheme.
    static var defaultBaseURL: URL {
        #if DEBUG
        if let override = ProcessInfo.processInfo.environment["VOLVIA_API_URL"],
           let url = URL(string: override), url.scheme != nil {
            return url
        }
        #endif
        let configured = Bundle.main.object(forInfoDictionaryKey: "VolviaAPIURL") as? String
        return URL(string: configured ?? "http://localhost:8080")!
    }

    // MARK: - Session

    func signIn(email: String, password: String) async throws {
        let pair = try await api.logIn(email: email, password: password)
        session.save(pair)
        await afterSignIn()
    }

    func signIn(appleIdentityToken token: String, name: String?) async throws {
        let pair = try await api.logIn(appleIdentityToken: token, name: name)
        session.save(pair)
        await afterSignIn()
    }

    func signIn(googleIdToken token: String) async throws {
        let pair = try await api.logIn(googleIdToken: token)
        session.save(pair)
        await afterSignIn()
    }

    private func afterSignIn() async {
        tab = .scan
        await loadContext()
        await flush()
    }

    /// Google Sign-In only works when the iOS client ID was baked into the build.
    static var googleSignInAvailable: Bool {
        guard let id = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String else {
            return false
        }
        return !id.isEmpty && !id.hasPrefix("$(")
    }

    /// Revokes the session on the server, then forgets it here. The pending queue stays:
    /// those stamps belong to customers, not to whoever was signed in.
    func signOut() async {
        await api.logOut(refreshToken: session.refreshToken)
        signOutLocally()
    }

    func signOutLocally() {
        session.signOut()
        outcome = nil
        preview = nil
        org = nil
        locations = []
        cards = []
    }

    func switchOrg(to membership: Membership) async {
        session.select(membership)
        org = nil
        locations = []
        cards = []
        outcome = nil
        await loadContext()
    }

    /// The business, its locations and cards, and a fresh copy of the user's roles.
    /// Loaded at launch, after signing in and after switching business.
    func loadContext() async {
        guard session.isSignedIn else { return }
        async let me = try? api.me()
        async let org = try? api.org()
        async let locations = try? api.locations()
        async let cards = try? api.cards()

        if let fresh = await me { session.update(fresh) }
        self.org = await org ?? self.org
        self.locations = (await locations ?? self.locations).filter { $0.isActive ?? true }
        self.cards = await cards ?? self.cards
    }

    var role: String { session.membership?.role ?? "staff" }
    var isAdmin: Bool { session.membership?.isAdmin ?? false }
    var isOwner: Bool { session.membership?.isOwner ?? false }
    var activeCards: [LoyaltyCard] { cards.filter(\.isActive) }

    /// The location sent with stamps, redemptions and sign-ups. With one location there
    /// is nothing to choose and the API fills it in.
    var locationId: String? {
        if let stored = session.locationId, locations.isEmpty || locations.contains(where: { $0.id == stored }) {
            return stored
        }
        return locations.count == 1 ? locations[0].id : nil
    }

    // MARK: - Counter

    /// One scan, from the camera to the answer on screen.
    ///
    /// With "Sellado rápido" on, a card that needs nothing else (no purchase amount) gets
    /// one stamp straight away, exactly like 1.1. Otherwise the card opens in the preview
    /// sheet first; and when there is no network to look it up, the counter still does not
    /// stop: one stamp goes to the queue, as it always did.
    func handleScan(_ raw: String) async {
        guard let token = CardToken.parse(raw) else {
            outcome = .failed("Ese código no es una tarjeta de Volvia.")
            Haptics.error()
            return
        }

        let anyNeedsAmount = activeCards.contains { $0.rules.mode == "min_spend" }
        if session.quickStamp && !anyNeedsAmount {
            await quickStamp(token)
            return
        }

        isSending = true
        do {
            let lookup = try await api.lookup(cardToken: token)
            isSending = false
            if session.quickStamp && !lookup.requiresAmount {
                await quickStamp(token)
            } else {
                outcome = nil
                preview = StampPreview(lookup: lookup)
            }
        } catch let error as APIError where error.isTransient {
            isSending = false
            await quickStamp(token)
        } catch let error as APIError {
            isSending = false
            outcome = .failed(message(for: error))
            Haptics.error()
        } catch {
            isSending = false
            await quickStamp(token)
        }
    }

    /// Opens the preview for a card picked from a customer's profile.
    func openPreview(customerCardId: String) async -> String? {
        do {
            preview = StampPreview(lookup: try await api.lookup(customerCardId: customerCardId))
            return nil
        } catch {
            return describe(error)
        }
    }

    private func quickStamp(_ token: String) async {
        let stamp = PendingStamp(cardToken: token, locationId: locationId)
        _ = await submit(stamp, hint: String(token.prefix(6)))
    }

    /// The preview's "Sellar N". Returns the reason when the server refused, so the sheet
    /// can stay open and say it next to the field that caused it.
    func stamp(_ lookup: CardLookup, count: Int, purchaseAmount: Int?, note: String?) async -> String? {
        let stamp = PendingStamp(
            cardToken: lookup.cardToken,
            customerCardId: lookup.customerCardId,
            count: count,
            purchaseAmount: purchaseAmount,
            note: note?.trimmingCharacters(in: .whitespacesAndNewlines),
            locationId: locationId
        )
        if let refusal = await submit(stamp, hint: lookup.customer.firstName) {
            return refusal
        }
        preview = nil
        return nil
    }

    /// Queue first, then send. That ordering is the whole design: nothing a staff member
    /// does at the counter can be lost by a network that chose that second to drop.
    private func submit(_ stamp: PendingStamp, hint: String) async -> String? {
        queue.enqueue(stamp)
        isSending = true
        defer { isSending = false }

        do {
            let result = try await api.stamp(stamp)
            queue.remove(stamp.id)
            outcome = .stamped(result, at: Date())
            revision += 1
            Haptics.success()
            return nil
        } catch let error as APIError where error.isTransient {
            outcome = .queued(customerHint: hint)
            preview = nil
            Haptics.success()
            return nil
        } catch let error as APIError {
            queue.remove(stamp.id)
            let text = await refusal(for: error, stamp: stamp)
            if preview == nil { outcome = .failed(text) }
            Haptics.error()
            return text
        } catch {
            outcome = .queued(customerHint: hint)
            preview = nil
            return nil
        }
    }

    /// A cooldown says how long to wait: in the error's details on current servers, and
    /// through a lookup on older ones that do not send it.
    private func refusal(for error: APIError, stamp: PendingStamp) async -> String {
        guard error.code == "STAMP_COOLDOWN_ACTIVE" else { return message(for: error) }
        if let seconds = error.retryAfterSeconds { return Self.cooldownMessage(seconds: seconds) }
        let lookup = try? await api.lookup(cardToken: stamp.cardToken, customerCardId: stamp.cardToken == nil ? stamp.customerCardId : nil)
        return Self.cooldownMessage(seconds: lookup?.cooldownSecondsLeft)
    }

    nonisolated static func cooldownMessage(seconds: Int?) -> String {
        guard let seconds, seconds > 0 else { return "Ya recibió sello hace poco." }
        let minutes = max(1, Int((Double(seconds) / 60).rounded(.up)))
        return "Ya recibió sello hace poco (espera \(minutes) min)."
    }

    /// Takes a scan back: wrong customer, wrong count.
    func undo(eventId: String, customerName: String) async {
        do {
            let result = try await api.voidStamp(eventId: eventId)
            outcome = .voided(result, name: customerName)
            revision += 1
            Haptics.warning()
        } catch {
            outcome = .notice(title: "No se pudo deshacer", message: describe(error) ?? "")
            Haptics.error()
        }
    }

    /// Hands over a reward already earned. Returns the error wording, nil on success.
    @discardableResult
    func redeem(grantId: String) async -> String? {
        do {
            let result = try await api.redeem(grantId: grantId, locationId: locationId)
            outcome = .redeemed(result)
            revision += 1
            Haptics.success()
            return nil
        } catch {
            let text = describe(error) ?? "No pudimos entregar la recompensa."
            if preview == nil { outcome = .notice(title: "No se pudo entregar", message: text) }
            Haptics.error()
            return text
        }
    }

    /// A reward code the customer reads out. Returns the error wording, nil on success.
    func redeem(code: String) async -> String? {
        do {
            let result = try await api.redeem(code: code.uppercased(), locationId: locationId)
            outcome = .redeemed(result)
            revision += 1
            Haptics.success()
            return nil
        } catch {
            Haptics.error()
            return describe(error) ?? "No pudimos entregar la recompensa."
        }
    }

    /// Something changed a card outside the counter (an adjustment, a sign-up).
    func noteChange() {
        revision += 1
    }

    /// Empties the queue. Called on launch, after signing in, and when the app returns
    /// to the foreground — the three moments where connection is likely to be back.
    func flush() async {
        guard session.isSignedIn else { return }
        #if targetEnvironment(simulator)
        // A fixed screenshot state must not drain its fake queue against a real server.
        if SimulatorFixtures.state != nil { return }
        #endif
        let api = self.api
        await queue.flush { stamp in
            do {
                return .success(try await api.stamp(stamp))
            } catch let error as APIError {
                // The rejection is shown to a person later: in Spanish, not in the API's words.
                return .failure(APIError(
                    status: error.status, code: error.code, message: self.message(for: error)
                ))
            } catch {
                return .failure(.offline)
            }
        }
    }

    // MARK: - Errors

    /// The wording for a failure, or nil when the plan sheet was shown instead.
    func describe(_ error: Error) -> String? {
        guard let error = error as? APIError else { return "Algo salió mal. Intenta de nuevo." }
        if error.isPlanGate {
            planGate = PlanGate(plan: error.upgradeTo, isLimit: error.code == "PLAN_LIMIT_REACHED")
            return nil
        }
        return message(for: error)
    }

    nonisolated func message(for error: APIError) -> String {
        switch error.code {
        case "OFFLINE": return "Sin conexión. Intenta de nuevo en un momento."
        case "CUSTOMER_CARD_NOT_FOUND", "CARD_NOT_FOUND": return "Esa tarjeta ya no existe."
        case "CARD_NOT_ACTIVE": return "Esa tarjeta no está activa."
        case "CUSTOMER_CARD_BLOCKED": return "Esa tarjeta está bloqueada."
        // The API's codes (apps/api/src/modules/loyalty/service.ts); the older names stay
        // in case a build meets a server that still emits them.
        case "STAMP_COOLDOWN_ACTIVE", "STAMP_TOO_SOON": return Self.cooldownMessage(seconds: error.retryAfterSeconds)
        case "STAMP_DAILY_CAP_REACHED", "DAILY_CAP_REACHED": return "Llegó al límite de sellos de hoy."
        case "STAMP_VOID_NOT_ALLOWED":
            return "Ya no se puede deshacer: pasaron más de 5 minutos, no fue tu escaneo o la tarjeta tuvo otro movimiento."
        case "REWARD_NOT_AVAILABLE": return "Ese premio no está disponible: no existe o ya venció."
        case "REWARD_ALREADY_REDEEMED": return "Ese premio ya se entregó."
        case "VALIDATION_FAILED":
            if error.message.contains("purchase amount required") { return "Escribe el monto de la compra." }
            if error.message.contains("below the minimum") { return "La compra no alcanza el mínimo para sellar." }
            return "Revisa los datos e intenta de nuevo."
        case "FORBIDDEN", "NOT_A_MEMBER": return "No tienes permiso para esto en este negocio."
        case "NOT_FOUND": return "No lo encontramos."
        case "CONFLICT": return "Eso ya se está procesando. Espera un momento."
        case "EMAIL_TAKEN", "ALREADY_MEMBER": return "Ese correo ya está en el equipo."
        case "FEATURE_NOT_IN_PLAN": return "Disponible en el plan \(PlanName.label(error.upgradeTo))."
        case "PLAN_LIMIT_REACHED": return "Llegaste al límite de tu plan."
        case "UNAUTHENTICATED": return "Tu sesión se cerró. Vuelve a entrar."
        default:
            return error.status >= 500 ? "El servidor no respondió. Intenta de nuevo." : error.message
        }
    }
}

extension StampQueue {
    /// Takes one stamp out by identity, used when a scan succeeded on the first try.
    func remove(_ id: UUID) {
        removeMatching(id)
    }
}

/// The counter is loud; a buzz says "done" without looking at the screen.
@MainActor
enum Haptics {
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func warning() { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
    static func error() { UINotificationFeedbackGenerator().notificationOccurred(.error) }
}
