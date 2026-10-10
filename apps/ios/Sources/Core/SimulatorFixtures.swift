#if targetEnvironment(simulator)
import Foundation

/// Fixed, believable app states for the simulator, where there is no camera and no need
/// for a backend to take a store screenshot.
///
/// Driven by environment variables, set in the Xcode scheme or with `simctl launch`
/// (`SIMCTL_CHILD_VOLVIA_SIM_STATE=reward`):
///
/// - `VOLVIA_SIM_STATE`: one of `login`, `aim`, `stamped`, `reward`, `queued`, `failed`,
///   `account`. Replaces whatever session and queue the simulator had with a fixture.
///   While set, the network is never touched.
/// - `VOLVIA_SIM_SCAN`: what "Simular lectura" feeds the scanner. Defaults to a demo card
///   URL; put a real token here to exercise the real `/v1/stamp` against a local API.
///
/// This file does not exist in device builds.
enum SimulatorState: String {
    case login, aim, stamped, reward, queued, failed, account
}

@MainActor
enum SimulatorFixtures {
    static var state: SimulatorState? {
        ProcessInfo.processInfo.environment["VOLVIA_SIM_STATE"].flatMap(SimulatorState.init)
    }

    /// Codes the "Simular lectura" control can feed the scanner. `VOLVIA_SIM_SCAN` holds
    /// one value, or several separated by `|`, each optionally labelled: `Ana=https://…`.
    static var scanCodes: [(label: String, code: String)] {
        guard let raw = ProcessInfo.processInfo.environment["VOLVIA_SIM_SCAN"], !raw.isEmpty else { return [] }
        return raw.split(separator: "|").map { entry in
            let parts = entry.split(separator: "=", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            return parts.count == 2 ? (parts[0], parts[1]) : (String(entry.suffix(8)), String(entry))
        }
    }

    /// What the screenshot fixtures and tests feed the scanner when nothing is configured.
    static var scanCode: String {
        scanCodes.first?.code ?? "https://tarjeta.somosvolvia.com/c/demo0123456789abcdefghijklmnopqr"
    }

    static func apply(to model: AppModel) {
        guard let state else { return }

        // The simulator keychain and Application Support survive reinstalls; start clean.
        model.session.signOut()
        model.queue.removeAll()
        model.outcome = nil

        if state == .login { return }

        model.session.save(TokenPair(
            accessToken: "simulator",
            refreshToken: "simulator",
            expiresIn: 900,
            user: SessionUser(
                id: "sim-user",
                email: "ana@cafe-raices.test",
                name: "Ana Rodríguez",
                memberships: [
                    Membership(orgId: "sim-cafe", orgName: "Café Raíces", orgSlug: "cafe-raices", role: "staff", locationId: nil),
                    Membership(orgId: "sim-barber", orgName: "Barbería Nueve", orgSlug: "barberia-nueve", role: "staff", locationId: nil),
                ]
            )
        ))

        switch state {
        case .login, .aim:
            break
        case .stamped:
            model.outcome = .stamped(result(stamps: 6, unlocked: [], pending: []))
        case .reward:
            model.outcome = .stamped(result(
                stamps: 8,
                unlocked: [UnlockedReward(grantId: "sim-grant", title: "Café gratis", description: "Un café de la casa", code: "RAIZ-7Q2K")],
                pending: []
            ))
        case .queued:
            for _ in 0..<3 { model.queue.enqueue(PendingStamp(cardToken: "sim-pending-0123456789abcdef")) }
            model.outcome = .queued(customerHint: "demo01")
        case .failed:
            model.outcome = .failed("Esa tarjeta ya no existe.")
        case .account:
            for _ in 0..<2 { model.queue.enqueue(PendingStamp(cardToken: "sim-pending-0123456789abcdef")) }
        }
    }

    private static func result(stamps: Int, unlocked: [UnlockedReward], pending: [PendingReward]) -> StampResult {
        StampResult(
            stampsAdded: 1,
            stampsCount: stamps,
            stampsRequired: 8,
            cycleIndex: 0,
            unlockedRewards: unlocked,
            pendingRewards: pending,
            customer: StampCustomer(id: "sim-customer", firstName: "Camila", isNew: false),
            replayed: false
        )
    }
}
#endif
