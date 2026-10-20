#if targetEnvironment(simulator)
import Foundation

/// Fixed, believable app states for the simulator, where there is no camera and no need
/// for a backend to take a store screenshot.
///
/// Driven by environment variables, set in the Xcode scheme or with `simctl launch`
/// (`SIMCTL_CHILD_VOLVIA_SIM_STATE=reward`):
///
/// - `VOLVIA_SIM_STATE`: one of `login`, `aim`, `stamped`, `reward`, `queued`, `failed`,
///   `account`, and since 1.2 `preview`, `today`, `customers`, `profile`, `enroll`,
///   `enrolled`, `stats`, `kiosk`, `more`. Replaces whatever session and queue the
///   simulator had with a fixture. While set, the network is never touched: every request
///   is answered by `FixtureURLProtocol` with the made-up data below.
/// - `VOLVIA_SIM_SCAN`: what "Simular lectura" feeds the scanner. Defaults to a demo card
///   URL; put a real token here to exercise the real `/v1/stamp` against a local API.
///
/// This file does not exist in device builds.
enum SimulatorState: String {
    case login, aim, stamped, reward, queued, failed, account
    case preview, today, customers, profile, enroll, enrolled, stats, kiosk, more

    /// The 1.1 states show a staff member at the counter; the 1.2 ones an owner, who
    /// sees every screen.
    var role: String {
        switch self {
        case .login, .aim, .stamped, .reward, .queued, .failed, .account: return "staff"
        default: return "owner"
        }
    }
}

@MainActor
enum SimulatorFixtures {
    nonisolated static var state: SimulatorState? {
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

    /// A session whose every request is answered from the fixtures, while a state is set.
    static var urlSession: URLSession? {
        guard state != nil else { return nil }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FixtureURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    static let customerId = FixtureData.camilaId

    static var enrollResult: EnrollResult {
        EnrollResult(
            customerId: FixtureData.camilaId,
            isNew: true,
            cardToken: "demo0123456789abcdefghijklmnopqr",
            cardUrl: "https://tarjeta.somosvolvia.com/c/demo0123456789abcdefghijklmnopqr",
            walletPasses: .init(appleUrl: nil, googleUrl: nil),
            stamp: result(stamps: 1, unlocked: [], pending: [])
        )
    }

    static func apply(to model: AppModel) {
        guard let state else { return }

        // The simulator keychain and Application Support survive reinstalls; start clean.
        model.session.signOut()
        model.queue.removeAll()
        model.outcome = nil
        model.session.quickStamp = true

        if state == .login { return }

        model.session.save(TokenPair(
            accessToken: "simulator",
            refreshToken: "simulator",
            expiresIn: 900,
            user: FixtureData.user(role: state.role)
        ))

        switch state {
        case .login, .aim:
            break
        case .stamped:
            model.outcome = .stamped(result(stamps: 6, unlocked: [], pending: []), at: Date())
        case .reward:
            model.outcome = .stamped(result(
                stamps: 8,
                unlocked: [UnlockedReward(grantId: "sim-grant", title: "Café gratis", description: "Un café de la casa", code: "RAIZ-7Q2K")],
                pending: []
            ), at: Date())
        case .queued:
            for _ in 0..<3 { model.queue.enqueue(PendingStamp(cardToken: "sim-pending-0123456789abcdef")) }
            model.outcome = .queued(customerHint: "demo01")
        case .failed:
            model.outcome = .failed("Esa tarjeta ya no existe.")
        case .account, .more:
            for _ in 0..<2 { model.queue.enqueue(PendingStamp(cardToken: "sim-pending-0123456789abcdef")) }
            model.tab = .more
        case .preview:
            if let lookup = try? JSONDecoder.volvia.decode(CardLookup.self, from: FixtureData.json(FixtureData.lookup())) {
                model.preview = StampPreview(lookup: lookup)
            }
        case .today:
            model.tab = .today
        case .customers, .profile, .enroll, .enrolled:
            model.tab = .customers
        case .stats, .kiosk:
            model.tab = .more
        }
    }

    static func result(stamps: Int, unlocked: [UnlockedReward], pending: [PendingReward]) -> StampResult {
        StampResult(
            customerCardId: FixtureData.camilaCardId,
            eventId: "00000000-0000-4000-8000-0000000000e1",
            stampsAdded: 1,
            stampsCount: stamps,
            stampsRequired: 8,
            cycleIndex: 0,
            unlockedRewards: unlocked,
            pendingRewards: pending,
            customer: StampCustomer(id: FixtureData.camilaId, firstName: "Camila", isNew: false),
            replayed: false,
            design: StampResultDesign(
                businessName: "Café Raíces",
                cardName: "Club Raíces",
                logoUrl: nil,
                backgroundColor: "#2B1D14",
                foregroundColor: "#FFFFFF",
                accentColor: "#D9A35F",
                emptyStampColor: "#4A3A2E",
                stampStyle: "circle",
                stampIcon: StampIcon(kind: "preset", value: "coffee"),
                rewardPositions: [8],
                nextReward: unlocked.isEmpty ? NextReward(atStamp: 8, title: "Café gratis") : nil
            )
        )
    }
}

/// Answers the app's requests from `FixtureData` instead of the network.
final class FixtureURLProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let (status, body) = FixtureData.response(for: request)
        let response = HTTPURLResponse(
            url: request.url!, statusCode: status, httpVersion: "HTTP/1.1",
            headerFields: ["content-type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

/// Made-up data for the screenshots: a coffee shop in Bogotá with regulars.
enum FixtureData {
    static let orgId = "00000000-0000-4000-8000-000000000001"
    static let cardId = "00000000-0000-4000-8000-0000000000c1"
    static let camilaId = "00000000-0000-4000-8000-0000000000a1"
    static let camilaCardId = "00000000-0000-4000-8000-0000000000b1"
    static let locationIds = ["00000000-0000-4000-8000-0000000000d1", "00000000-0000-4000-8000-0000000000d2"]

    static func user(role: String) -> SessionUser {
        SessionUser(
            id: "sim-user",
            email: "ana@cafe-raices.test",
            name: "Ana Rodríguez",
            memberships: [
                Membership(orgId: orgId, orgName: "Café Raíces", orgSlug: "cafe-raices", role: role, locationId: nil),
                Membership(orgId: "sim-barber", orgName: "Barbería Nueve", orgSlug: "barberia-nueve", role: "staff", locationId: nil),
            ]
        )
    }

    static func json(_ value: Any) -> Data {
        (try? JSONSerialization.data(withJSONObject: value)) ?? Data("{}".utf8)
    }

    private static func iso(_ offset: TimeInterval) -> String {
        ISO8601DateFormatter().string(from: Date().addingTimeInterval(offset))
    }

    static func response(for request: URLRequest) -> (Int, Data) {
        let path = request.url?.path ?? ""
        let method = request.httpMethod ?? "GET"
        let role = SimulatorFixtures.state?.role ?? "staff"

        guard method == "GET" else {
            // Writes never leave the simulator in a fixture state.
            return (503, json(["error": ["code": "SERVICE_UNAVAILABLE", "message": "fixture"]]))
        }

        switch path {
        case "/v1/auth/me":
            let user = user(role: role)
            return (200, json([
                "id": user.id, "email": user.email, "name": user.name,
                "memberships": user.memberships.map {
                    ["orgId": $0.orgId, "orgName": $0.orgName, "orgSlug": $0.orgSlug, "role": $0.role, "locationId": NSNull()]
                },
            ]))
        case "/v1/org": return (200, json(org()))
        case "/v1/org/locations":
            return (200, json([
                ["id": locationIds[0], "name": "Chapinero", "address": "Cra. 13 #54-20", "isActive": true],
                ["id": locationIds[1], "name": "Usaquén", "address": "Cl. 119 #6-14", "isActive": true],
            ]))
        case "/v1/cards": return (200, json([card()]))
        case "/v1/lookup": return (200, json(lookup()))
        case "/v1/activity/mine": return (200, json(["items": mine()]))
        case "/v1/analytics/pulse": return (200, json(pulse()))
        case "/v1/analytics/overview": return (200, json(overview()))
        case "/v1/analytics/timeseries": return (200, json(timeseries()))
        case "/v1/analytics/busiest": return (200, json(busiest()))
        case "/v1/analytics/retention": return (200, json(retention()))
        case "/v1/customers": return (200, json(customers()))
        case "/v1/customers/\(camilaId)": return (200, json(detail()))
        case "/v1/messages":
            return (200, json(["messages": [message()], "thisMonth": ["used": 1, "limit": 4]]))
        case "/v1/campaigns":
            return (200, json(["campaigns": [campaign()], "thisMonth": ["used": 1, "limit": 4]]))
        case "/v1/segments":
            return (200, json(["segments": [], "suggested": [
                ["key": "birthday_this_month", "name": "Cumplen este mes", "count": 6],
                ["key": "one_stamp_away", "name": "A un sello de la recompensa", "count": 11],
            ]]))
        case "/v1/org/members":
            return (200, json(["members": [
                ["id": "00000000-0000-4000-8000-0000000000f1", "userId": "sim-user", "name": "Ana Rodríguez",
                 "email": "ana@cafe-raices.test", "role": "owner", "locationId": NSNull(), "joinedAt": iso(-86_400 * 120)],
                ["id": "00000000-0000-4000-8000-0000000000f2", "userId": "sim-user-2", "name": "Julián Pardo",
                 "email": "julian@cafe-raices.test", "role": "staff", "locationId": locationIds[1], "joinedAt": iso(-86_400 * 30)],
            ], "pending": [
                ["id": "00000000-0000-4000-8000-0000000000f3", "email": "sofia@cafe-raices.test", "role": "staff", "expiresAt": iso(86_400 * 6)],
            ], "seats": 2, "seatLimit": 5]))
        default:
            return (404, json(["error": ["code": "NOT_FOUND", "message": "fixture"]]))
        }
    }

    static func design() -> [String: Any] {
        [
            "businessName": "Café Raíces", "cardName": "Club Raíces", "logoUrl": NSNull(),
            "backgroundColor": "#2B1D14", "foregroundColor": "#FFFFFF", "accentColor": "#D9A35F",
            "emptyStampColor": "#4A3A2E", "stampStyle": "circle",
            "stampIcon": ["kind": "preset", "value": "coffee"], "rewardPositions": [4, 8],
            "nextReward": ["atStamp": 8, "title": "Café gratis"],
        ]
    }

    static func org() -> [String: Any] {
        let features = [
            "customer_contact_details", "customer_messages", "campaigns", "full_analytics",
            "team_accounts", "kiosk_mode", "multi_location",
        ]
        return [
            "id": orgId, "name": "Café Raíces", "slug": "cafe-raices", "logoUrl": NSNull(),
            "currency": "cop", "timezone": "America/Bogota",
            "settings": ["legalName": "Café Raíces S.A.S.", "privacyEmail": "datos@cafe-raices.test"],
            "entitlements": [
                "effectivePlan": "business",
                "features": Dictionary(uniqueKeysWithValues: features.map { ($0, true) }),
                "limits": ["locations": 2, "staffSeats": 5, "messagesPerMonth": 4, "campaignsPerMonth": 4],
            ],
            "publicUrl": "https://tarjeta.somosvolvia.com/b/cafe-raices",
        ]
    }

    static func card() -> [String: Any] {
        [
            "id": cardId, "name": "Club Raíces", "status": "active", "stampsRequired": 8,
            "rules": ["mode": "per_visit", "minSpendAmount": NSNull(), "maxStampsPerScan": 3, "kioskEnabled": true],
            "design": ["backgroundColor": "#2B1D14", "foregroundColor": "#FFFFFF", "accentColor": "#D9A35F"],
            "joinSlug": "club-raices", "joinUrl": "https://tarjeta.somosvolvia.com/j/club-raices",
        ]
    }

    static func lookup() -> [String: Any] {
        [
            "customerCardId": camilaCardId, "cardToken": "demo0123456789abcdefghijklmnopqr",
            "customer": ["id": camilaId, "firstName": "Camila", "phone": "+573001234567", "notes": "Café sin azúcar",
                         "totalStamps": 22, "joinedAt": iso(-86_400 * 90)],
            "card": ["id": cardId, "name": "Club Raíces", "stampsRequired": 8, "ruleMode": "per_visit",
                     "minSpendAmount": NSNull(), "maxStampsPerScan": 3],
            "stampsCount": 6, "lastStampAt": iso(-86_400 * 3), "cooldownSecondsLeft": 0,
            "pendingRewards": [["grantId": "00000000-0000-4000-8000-0000000000e2", "title": "Postre gratis",
                                "code": "RAIZ-4M8P", "expiresAt": NSNull()]],
            "design": design(),
        ]
    }

    static func mine() -> [[String: Any]] {
        [
            ["kind": "stamp", "id": "00000000-0000-4000-8000-0000000000e3", "at": iso(-120), "customerCardId": camilaCardId,
             "customerId": camilaId, "firstName": "Camila", "cardName": "Club Raíces", "delta": 2, "rewardTitle": NSNull(), "canVoid": true],
            ["kind": "redeem", "id": "00000000-0000-4000-8000-0000000000e4", "at": iso(-2_400), "customerCardId": camilaCardId,
             "customerId": camilaId, "firstName": "Mateo", "cardName": "Club Raíces", "delta": 0, "rewardTitle": "Café gratis", "canVoid": false],
            ["kind": "stamp", "id": "00000000-0000-4000-8000-0000000000e5", "at": iso(-5_400), "customerCardId": camilaCardId,
             "customerId": camilaId, "firstName": "Lucía", "cardName": "Club Raíces", "delta": 1, "rewardTitle": NSNull(), "canVoid": false],
        ]
    }

    static func pulse() -> [String: Any] {
        let calendar = Calendar.current
        let soon = calendar.date(byAdding: .day, value: 3, to: Date())!
        let later = calendar.date(byAdding: .day, value: 9, to: Date())!
        return [
            "today": ["stamps": 38, "joins": 5, "rewards": 4],
            "activity": [
                ["kind": "stamp", "customerId": camilaId, "firstName": "Camila", "at": iso(-120), "count": 2],
                ["kind": "join", "customerId": camilaId, "firstName": "Valentina", "at": iso(-900), "count": 0],
                ["kind": "stamp", "customerId": camilaId, "firstName": "Andrés", "at": iso(-1_800), "count": 1],
            ],
            "birthdays": [
                ["customerId": camilaId, "firstName": "Camila", "month": calendar.component(.month, from: soon), "day": calendar.component(.day, from: soon)],
                ["customerId": camilaId, "firstName": "Esteban", "month": calendar.component(.month, from: later), "day": calendar.component(.day, from: later)],
            ],
        ]
    }

    static func overview() -> [String: Any] {
        [
            "customers": ["total": 412, "new": 57, "changePct": 12.4],
            "stamps": ["total": 1_284, "changePct": 8.1],
            "rewards": ["unlocked": 96, "redeemed": 81, "redemptionRate": 84],
            "repeatRate": 63, "averageVisitsPerCustomer": 3.1, "medianDaysBetweenVisits": 9,
            "activeCards": 1, "pageViews": 230,
        ]
    }

    static func timeseries() -> [[String: Any]] {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return (0..<30).map { index in
            let day = calendar.date(byAdding: .day, value: index - 29, to: Date())!
            let weekday = calendar.component(.weekday, from: day)
            let base = [1: 22, 2: 30, 3: 34, 4: 38, 5: 44, 6: 58, 7: 64][weekday] ?? 30
            let stamps = base + (index * 7) % 11
            return ["date": formatter.string(from: day), "stamps": stamps, "joins": (index * 5) % 4,
                    "rewardsUnlocked": stamps / 12, "rewardsRedeemed": stamps / 14]
        }
    }

    static func busiest() -> [String: Any] {
        let days = [0: 120, 1: 160, 2: 175, 3: 190, 4: 230, 5: 310, 6: 340]
        let hours: [Int: Int] = [7: 40, 8: 95, 9: 120, 10: 80, 11: 60, 12: 110, 13: 140, 14: 70,
                                 15: 65, 16: 90, 17: 130, 18: 150, 19: 100, 20: 50, 21: 20]
        return [
            "byWeekday": (0..<7).map { ["weekday": $0, "stamps": days[$0] ?? 0] },
            "byHour": (0..<24).map { ["hour": $0, "stamps": hours[$0] ?? 0] },
        ]
    }

    static func retention() -> [String: Any] {
        ["cohorts": [
            ["cohort": "2026-05", "size": 64, "values": [100, 58, 44, 39, 35, 31]],
            ["cohort": "2026-06", "size": 71, "values": [100, 61, 47, 40, 36, NSNull()]],
            ["cohort": "2026-07", "size": 83, "values": [100, 55, 45, 41, NSNull(), NSNull()]],
            ["cohort": "2026-08", "size": 69, "values": [100, 63, 50, NSNull(), NSNull(), NSNull()]],
            ["cohort": "2026-09", "size": 77, "values": [100, 59, NSNull(), NSNull(), NSNull(), NSNull()]],
            ["cohort": "2026-10", "size": 48, "values": [100, NSNull(), NSNull(), NSNull(), NSNull(), NSNull()]],
        ]]
    }

    static func customers() -> [String: Any] {
        let names = ["Camila", "Mateo", "Lucía", "Andrés", "Valentina", "Santiago", "Isabella", "Esteban", "Mariana", "Julián"]
        let items: [[String: Any]] = names.enumerated().map { index, name in
            [
                "id": index == 0 ? camilaId : "00000000-0000-4000-8000-00000000010\(index)",
                "firstName": name, "email": "\(name.lowercased())@correo.test", "phone": NSNull(),
                "birthdayMonth": NSNull(), "birthdayDay": NSNull(),
                "totalStamps": 30 - index * 3, "totalRewards": 3 - index / 4,
                "joinedAt": iso(-86_400 * Double(120 - index * 9)), "lastStampAt": iso(-3_600 * Double(index * 7 + 1)),
            ]
        }
        return ["items": items, "page": 1, "pageSize": 30, "total": names.count, "hasMore": false, "masked": false]
    }

    static func detail() -> [String: Any] {
        [
            "customer": [
                "id": camilaId, "firstName": "Camila", "email": "camila@correo.test", "phone": "+573001234567",
                "birthdayMonth": 11, "birthdayDay": 2, "marketingConsent": true, "notes": "Café sin azúcar. Prefiere la mesa de la ventana.",
                "totalStamps": 22, "totalRewards": 2, "joinedAt": iso(-86_400 * 90), "lastStampAt": iso(-86_400 * 3),
            ],
            "cards": [[
                "id": camilaCardId, "token": "demo0123456789abcdefghijklmnopqr", "cardName": "Club Raíces",
                "stampsCount": 6, "stampsRequired": 8, "cycleIndex": 2, "lifetimeStamps": 22, "status": "active",
                "joinedAt": iso(-86_400 * 90), "lastStampAt": iso(-86_400 * 3),
            ]],
            "rewards": [
                ["id": "00000000-0000-4000-8000-0000000000e2", "title": "Postre gratis", "code": "RAIZ-4M8P", "status": "pending",
                 "grantedAt": iso(-86_400 * 3), "redeemedAt": NSNull(), "expiresAt": NSNull()],
                ["id": "00000000-0000-4000-8000-0000000000e6", "title": "Café gratis", "code": "RAIZ-7Q2K", "status": "redeemed",
                 "grantedAt": iso(-86_400 * 30), "redeemedAt": iso(-86_400 * 29), "expiresAt": NSNull()],
            ],
            "activity": [
                ["id": "00000000-0000-4000-8000-0000000000e7", "delta": 1, "source": "staff_scan", "occurredAt": iso(-86_400 * 3), "resultingCount": 6],
                ["id": "00000000-0000-4000-8000-0000000000e8", "delta": 2, "source": "staff_scan", "occurredAt": iso(-86_400 * 10), "resultingCount": 5],
                ["id": "00000000-0000-4000-8000-0000000000e9", "delta": 1, "source": "kiosk", "occurredAt": iso(-86_400 * 17), "resultingCount": 3],
            ],
            "masked": false,
        ]
    }

    static func message() -> [String: Any] {
        ["id": "00000000-0000-4000-8000-000000000201", "headline": "Llegó el café de temporada",
         "body": "Pásate esta semana a probarlo.", "status": "sent", "scheduledAt": NSNull(), "sentAt": iso(-86_400 * 2),
         "targetedCount": 180, "deliveredCount": 164, "createdAt": iso(-86_400 * 2)]
    }

    static func campaign() -> [String: Any] {
        ["id": "00000000-0000-4000-8000-000000000301", "name": "Sellos dobles", "template": "double_stamps",
         "status": "running", "headline": "Fin de semana de sellos dobles", "body": "Viernes, sábado y domingo cada visita cuenta por dos.",
         "startsAt": iso(-86_400), "endsAt": iso(86_400 * 2), "stats": ["stamps": 46, "redeemed": 3, "targeted": 210, "delivered": 188]]
    }
}
#endif
