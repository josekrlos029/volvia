import Foundation

/// The shapes the API speaks, mirrored from `packages/shared/src/schemas`.
///
/// Hand-written rather than generated: a code generator in the loop would be more
/// machinery than the thing it generates. Fields the app never reads are left out; the
/// decoder ignores them. The management screens' shapes live in `ManageModels.swift`.

struct Membership: Codable, Sendable, Identifiable, Hashable {
    let orgId: String
    let orgName: String
    let orgSlug: String
    let role: String
    let locationId: String?

    var id: String { orgId }

    /// Admins and owners see the management screens; staff only the counter.
    var isAdmin: Bool { role == "admin" || role == "owner" }
    var isOwner: Bool { role == "owner" }
}

struct SessionUser: Codable, Sendable {
    let id: String
    let email: String
    let name: String
    let memberships: [Membership]
}

struct TokenPair: Codable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let user: SessionUser
}

// MARK: - Stamping

struct UnlockedReward: Codable, Sendable, Hashable {
    let grantId: String
    let title: String
    let description: String
    let code: String
}

struct PendingReward: Codable, Sendable, Hashable {
    let grantId: String
    let title: String
    let code: String
}

struct StampCustomer: Codable, Sendable, Hashable {
    let id: String
    let firstName: String
    let isNew: Bool
}

struct StampResult: Codable, Sendable, Hashable {
    /// Absent only in fixtures written before 1.2; the API always sends it.
    var customerCardId: String? = nil
    /// The ledger row this scan wrote, so it can be undone for a few minutes.
    var eventId: String? = nil
    let stampsAdded: Int
    let stampsCount: Int
    let stampsRequired: Int
    let cycleIndex: Int
    let unlockedRewards: [UnlockedReward]
    let pendingRewards: [PendingReward]
    let customer: StampCustomer
    let replayed: Bool
    /// Absent on a replay of a scan the server recorded before it sent the card's look.
    var design: StampResultDesign? = nil

    init(
        customerCardId: String? = nil,
        eventId: String? = nil,
        stampsAdded: Int,
        stampsCount: Int,
        stampsRequired: Int,
        cycleIndex: Int,
        unlockedRewards: [UnlockedReward],
        pendingRewards: [PendingReward],
        customer: StampCustomer,
        replayed: Bool,
        design: StampResultDesign? = nil
    ) {
        self.customerCardId = customerCardId
        self.eventId = eventId
        self.stampsAdded = stampsAdded
        self.stampsCount = stampsCount
        self.stampsRequired = stampsRequired
        self.cycleIndex = cycleIndex
        self.unlockedRewards = unlockedRewards
        self.pendingRewards = pendingRewards
        self.customer = customer
        self.replayed = replayed
        self.design = design
    }
}

/// A stamp glyph: one of the presets, an emoji, or an uploaded picture's URL.
struct StampIcon: Codable, Sendable, Hashable {
    let kind: String
    let value: String
}

struct NextReward: Codable, Sendable, Hashable {
    let atStamp: Int
    let title: String
}

/// How the stamped card looks, so the result can be shown in the business's colours.
struct StampResultDesign: Codable, Sendable, Hashable {
    let businessName: String
    let cardName: String
    let logoUrl: String?
    let backgroundColor: String
    let foregroundColor: String
    let accentColor: String
    let emptyStampColor: String
    let stampStyle: String
    let stampIcon: StampIcon
    let rewardPositions: [Int]
    let nextReward: NextReward?
}

/// `POST /v1/redeem`. The extras arrived after 1.1 and are optional so a replay of an
/// older answer still decodes.
struct RedeemResult: Codable, Sendable, Hashable {
    struct Customer: Codable, Sendable, Hashable {
        let id: String
        let firstName: String
    }

    let grantId: String
    let title: String
    let redeemedAt: Date?
    var customer: Customer? = nil
    var stampsCount: Int? = nil
    var stampsRequired: Int? = nil
    var remainingPending: Int? = nil
}

/// `GET /v1/lookup`: the scanned card before anything is added to it.
struct CardLookup: Codable, Sendable, Hashable {
    struct Customer: Codable, Sendable, Hashable {
        let id: String
        let firstName: String
        let phone: String?
        let notes: String?
        let totalStamps: Int
        let joinedAt: Date
    }

    struct Card: Codable, Sendable, Hashable {
        let id: String
        let name: String
        let stampsRequired: Int
        /// `per_visit`, `per_purchase` or `min_spend`.
        let ruleMode: String
        /// Whole pesos for COP.
        let minSpendAmount: Int?
        let maxStampsPerScan: Int
    }

    struct Reward: Codable, Sendable, Hashable, Identifiable {
        let grantId: String
        let title: String
        let code: String
        let expiresAt: Date?

        var id: String { grantId }
    }

    let customerCardId: String
    let cardToken: String
    let customer: Customer
    let card: Card
    let stampsCount: Int
    let lastStampAt: Date?
    let cooldownSecondsLeft: Int
    let pendingRewards: [Reward]
    let design: StampResultDesign

    var requiresAmount: Bool { card.ruleMode == "min_spend" }
}

/// `POST /v1/stamp/:eventId/void`.
struct VoidResult: Codable, Sendable, Hashable {
    let customerCardId: String
    let stampsCount: Int
    let stampsRequired: Int
    let stampsRemoved: Int
    let rewardsRevoked: Int
}

/// `POST /v1/enroll`.
struct EnrollResult: Codable, Sendable, Hashable {
    struct WalletPasses: Codable, Sendable, Hashable {
        let appleUrl: String?
        let googleUrl: String?
    }

    let customerId: String
    let isNew: Bool
    let cardToken: String
    let cardUrl: String
    let walletPasses: WalletPasses
    let stamp: StampResult?
}

/// One line of `GET /v1/activity/mine`.
struct MyActivityItem: Codable, Sendable, Hashable, Identifiable {
    /// `stamp`, `void` or `redeem`.
    let kind: String
    let id: String
    let at: Date
    let customerCardId: String
    let customerId: String
    let firstName: String
    let cardName: String
    let delta: Int
    let rewardTitle: String?
    let canVoid: Bool
}

struct MyActivity: Codable, Sendable {
    let items: [MyActivityItem]
}

// MARK: - Organisation

/// `GET /v1/org`, reduced to what the app reads.
struct OrgInfo: Codable, Sendable, Hashable {
    struct Settings: Codable, Sendable, Hashable {
        var legalName: String? = nil
        var privacyEmail: String? = nil
    }

    struct Entitlements: Codable, Sendable, Hashable {
        let effectivePlan: String?
        let features: [String: Bool]
        let limits: [String: Int?]
    }

    let id: String
    let name: String
    let slug: String
    let logoUrl: String?
    let currency: String?
    let timezone: String?
    let settings: Settings?
    let entitlements: Entitlements
    /// `https://tarjeta.somosvolvia.com/b/<slug>`: the pass app's base comes from here.
    let publicUrl: String?

    func has(_ feature: String) -> Bool { entitlements.features[feature] ?? false }

    /// The customer-facing app (`PASS_URL`), where card and kiosk links point.
    var passBaseURL: String? {
        guard let publicUrl, let range = publicUrl.range(of: "/b/") else { return nil }
        return String(publicUrl[..<range.lowerBound])
    }

    /// The business's privacy notice, which the Habeas Data line links to.
    var privacyURL: URL? {
        guard let publicUrl else { return nil }
        return URL(string: "\(publicUrl)/privacidad")
    }

    /// The name the consent line uses: the legal one when the business filled it in.
    var legalDisplayName: String {
        let legal = settings?.legalName?.trimmingCharacters(in: .whitespaces) ?? ""
        let chosen = legal.isEmpty ? name : legal
        // "Café Raíces S.A.S." ends a sentence already; no second period after it.
        return chosen.hasSuffix(".") ? String(chosen.dropLast()) : chosen
    }
}

struct OrgLocation: Codable, Sendable, Hashable, Identifiable {
    let id: String
    let name: String
    let address: String?
    let isActive: Bool?
}

/// `GET /v1/cards`, reduced to what the app reads.
struct LoyaltyCard: Codable, Sendable, Hashable, Identifiable {
    struct Rules: Codable, Sendable, Hashable {
        let mode: String
        let minSpendAmount: Int?
        let maxStampsPerScan: Int
        let kioskEnabled: Bool
    }

    struct Design: Codable, Sendable, Hashable {
        let backgroundColor: String?
        let foregroundColor: String?
        let accentColor: String?
    }

    let id: String
    let name: String
    let status: String
    let stampsRequired: Int
    let rules: Rules
    let design: Design?
    let joinSlug: String?
    let joinUrl: String?

    var isActive: Bool { status == "active" }
}

// MARK: - Customers

struct CustomerListItem: Codable, Sendable, Hashable, Identifiable {
    let id: String
    let firstName: String
    let email: String?
    let phone: String?
    let birthdayMonth: Int?
    let birthdayDay: Int?
    let totalStamps: Int
    let totalRewards: Int
    let joinedAt: Date
    let lastStampAt: Date?
}

struct CustomerPage: Codable, Sendable {
    let items: [CustomerListItem]
    let page: Int
    let pageSize: Int
    let total: Int
    let hasMore: Bool
    let masked: Bool?
}

/// `GET /v1/customers/:id`.
struct CustomerDetail: Codable, Sendable, Hashable {
    struct Customer: Codable, Sendable, Hashable {
        let id: String
        let firstName: String
        let email: String?
        let phone: String?
        let birthdayMonth: Int?
        let birthdayDay: Int?
        let marketingConsent: Bool?
        let notes: String?
        let totalStamps: Int
        let totalRewards: Int
        let joinedAt: Date
        let lastStampAt: Date?
    }

    struct Card: Codable, Sendable, Hashable, Identifiable {
        /// The customer card's id: what `/v1/lookup` and `/v1/stamp` take.
        let id: String
        let token: String?
        let cardName: String
        let stampsCount: Int
        let stampsRequired: Int
        let cycleIndex: Int
        let lifetimeStamps: Int
        let status: String
        let joinedAt: Date
        let lastStampAt: Date?
    }

    struct Reward: Codable, Sendable, Hashable, Identifiable {
        let id: String
        let title: String
        let code: String
        let status: String
        let grantedAt: Date
        let redeemedAt: Date?
        let expiresAt: Date?
    }

    struct Event: Codable, Sendable, Hashable, Identifiable {
        let id: String
        let delta: Int
        let source: String
        let occurredAt: Date
        let resultingCount: Int?
    }

    let customer: CustomerDetail.Customer
    let cards: [Card]
    let rewards: [Reward]
    let activity: [Event]
    let masked: Bool?
}

/// `POST /v1/adjust`.
struct AdjustResult: Codable, Sendable, Hashable {
    let customerCardId: String
    let stampsCount: Int
    let stampsRequired: Int
}

// MARK: - Errors

/// An error the API returned, with its code intact.
///
/// The code is what the screen reacts to; the message is what a person reads when we
/// have nothing better to say than what the server said.
struct APIError: Error, Sendable, Equatable {
    let status: Int
    let code: String
    let message: String
    /// The plan that unlocks the feature, on `FEATURE_NOT_IN_PLAN` / `PLAN_LIMIT_REACHED`.
    var upgradeTo: String? = nil
    /// How long a cooldown has left, from `details` on `STAMP_COOLDOWN_ACTIVE`. Optional:
    /// older servers do not send it.
    var retryAfterSeconds: Int? = nil

    /// Business refusals that come back as 429 but will never succeed on a retry: the
    /// customer was stamped a minute ago, or already got today's stamps. Queueing them
    /// would only turn a clear answer at the counter into a rejection hours later.
    static let permanentRefusals: Set<String> = [
        "STAMP_COOLDOWN_ACTIVE", "STAMP_TOO_SOON", "STAMP_DAILY_CAP_REACHED", "DAILY_CAP_REACHED",
    ]

    /// Worth keeping in the queue and trying again later.
    var isTransient: Bool {
        if Self.permanentRefusals.contains(code) { return false }
        return status == 0 || status >= 500 || status == 408 || status == 429
    }

    /// The server already applied this exact scan.
    var isAlreadyApplied: Bool { code == "CONFLICT" }

    var isAuthError: Bool { status == 401 }

    /// The plan does not include this; shown as an upgrade sheet, never as an error.
    var isPlanGate: Bool { code == "FEATURE_NOT_IN_PLAN" || code == "PLAN_LIMIT_REACHED" }

    static let offline = APIError(status: 0, code: "OFFLINE", message: "sin conexión")
}

private struct APIErrorEnvelope: Decodable {
    struct Detail: Decodable {
        let path: String
        let message: String
    }

    struct Body: Decodable {
        let code: String
        let message: String
        let upgradeTo: String?
        let details: [Detail]?
    }

    let error: Body
}

extension APIError {
    static func decode(status: Int, data: Data) -> APIError {
        if let envelope = try? JSONDecoder().decode(APIErrorEnvelope.self, from: data) {
            return APIError(
                status: status,
                code: envelope.error.code,
                message: envelope.error.message,
                upgradeTo: envelope.error.upgradeTo,
                retryAfterSeconds: envelope.error.details?
                    .first { $0.path == "retryAfterSeconds" }
                    .flatMap { Int($0.message) }
            )
        }
        return APIError(status: status, code: "INTERNAL", message: "error \(status)")
    }
}

/// Plan ids as the business reads them, the same words as the web dashboard.
enum PlanName {
    static func label(_ id: String?) -> String {
        switch id {
        case "pro": return "Pro"
        case "business": return "Negocio"
        case "multi": return "Multi"
        case "free": return "Gratis"
        default: return "superior"
        }
    }
}

extension JSONDecoder {
    /// The API's timestamps carry milliseconds (`2026-10-20T01:34:46.722Z`), which the
    /// stock `.iso8601` strategy refuses; both shapes are accepted here.
    static var volvia: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            if let date = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(raw) {
                return date
            }
            if let date = try? Date.ISO8601FormatStyle().parse(raw) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "fecha inválida: \(raw)")
        }
        return decoder
    }
}
