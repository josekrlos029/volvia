import Combine
import Foundation
import SwiftUI

/// What the scanner is showing right now.
enum ScanOutcome: Equatable {
    case stamped(StampResult)
    /// Taken at the counter, waiting for the network. The customer is told the same
    /// thing either way, because for them it is the same thing.
    case queued(customerHint: String)
    case failed(String)
}

/// The app, in one place.
///
/// Small enough that splitting it into a view model per screen would add indirection
/// without adding clarity: there is one session, one queue and one thing the staff
/// member is doing.
@MainActor
final class AppModel: ObservableObject {
    @Published var outcome: ScanOutcome?
    @Published var isSending = false

    let session = SessionStore()
    let queue = StampQueue()

    private var client: APIClient!
    private var forwarders: Set<AnyCancellable> = []

    init(baseURL: URL = AppModel.defaultBaseURL) {
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

        let store = session
        client = APIClient(
            baseURL: baseURL,
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
    }

    /// Release builds get `https://api.somosvolvia.com` through `VOLVIA_API_URL` in
    /// project.yml; Debug builds get localhost and can be pointed elsewhere (the isolated
    /// stack on :8081, say) with the `VOLVIA_API_URL` environment variable of the scheme.
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

    func signIn(email: String, password: String) async throws {
        let pair = try await client.logIn(email: email, password: password)
        session.save(pair)
        await flush()
    }

    func signOut() {
        session.signOut()
        outcome = nil
    }

    /// One scan, from the camera to the answer on screen.
    ///
    /// The stamp is put in the queue before it is sent. That ordering is the whole
    /// design: nothing a staff member does at the counter can be lost by a network
    /// that chose that second to drop.
    func handleScan(_ raw: String) async {
        guard let token = CardToken.parse(raw) else {
            outcome = .failed("Ese código no es una tarjeta de Volvia.")
            return
        }

        let stamp = PendingStamp(cardToken: token)
        queue.enqueue(stamp)

        isSending = true
        defer { isSending = false }

        do {
            let result = try await client.stamp(stamp)
            queue.remove(stamp.id)
            outcome = .stamped(result)
        } catch let error as APIError where error.isTransient {
            outcome = .queued(customerHint: String(token.prefix(6)))
        } catch let error as APIError {
            queue.remove(stamp.id)
            outcome = .failed(message(for: error))
        } catch {
            outcome = .queued(customerHint: String(token.prefix(6)))
        }
    }

    func redeem(grantId: String) async {
        do {
            _ = try await client.redeem(grantId: grantId)
            outcome = nil
        } catch let error as APIError {
            outcome = .failed(message(for: error))
        } catch {
            outcome = .failed("No pudimos entregar la recompensa.")
        }
    }

    /// Empties the queue. Called on launch, after signing in, and when the app returns
    /// to the foreground — the three moments where connection is likely to be back.
    func flush() async {
        guard session.isSignedIn else { return }
        #if targetEnvironment(simulator)
        // A fixed screenshot state must not drain its fake queue against a real server.
        if SimulatorFixtures.state != nil { return }
        #endif
        await queue.flush { [client] stamp in
            do {
                return .success(try await client!.stamp(stamp))
            } catch let error as APIError {
                return .failure(error)
            } catch {
                return .failure(.offline)
            }
        }
    }

    private func message(for error: APIError) -> String {
        switch error.code {
        case "CUSTOMER_CARD_NOT_FOUND", "CARD_NOT_FOUND": return "Esa tarjeta ya no existe."
        case "CARD_NOT_ACTIVE": return "Esa tarjeta no está activa."
        case "CUSTOMER_CARD_BLOCKED": return "Esa tarjeta está bloqueada."
        // The API's codes (apps/api/src/modules/loyalty/service.ts); the older names stay
        // in case a build meets a server that still emits them.
        case "STAMP_COOLDOWN_ACTIVE", "STAMP_TOO_SOON": return "Ya tiene un sello muy reciente."
        case "STAMP_DAILY_CAP_REACHED", "DAILY_CAP_REACHED": return "Llegó al tope de sellos de hoy."
        case "FORBIDDEN", "NOT_A_MEMBER": return "Esa tarjeta no es de este negocio."
        default: return error.message
        }
    }
}

extension StampQueue {
    /// Takes one stamp out by identity, used when a scan succeeded on the first try.
    func remove(_ id: UUID) {
        removeMatching(id)
    }
}
