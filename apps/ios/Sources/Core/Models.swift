import Foundation

/// The shapes the API speaks, mirrored from `packages/shared/src/schemas`.
///
/// Hand-written rather than generated: the staff app touches four endpoints, and a
/// code generator in the loop would be more machinery than the thing it generates.

struct Membership: Codable, Sendable, Identifiable, Hashable {
    let orgId: String
    let orgName: String
    let orgSlug: String
    let role: String
    let locationId: String?

    var id: String { orgId }
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

struct RedeemResult: Codable, Sendable, Hashable {
    let grantId: String
    let title: String
    let redeemedAt: Date?
}

/// An error the API returned, with its code intact.
///
/// The code is what the screen reacts to; the message is what a person reads when we
/// have nothing better to say than what the server said.
struct APIError: Error, Sendable, Equatable {
    let status: Int
    let code: String
    let message: String

    /// Worth keeping in the queue and trying again later.
    var isTransient: Bool {
        status == 0 || status >= 500 || status == 408 || status == 429
    }

    /// The server already applied this exact scan.
    var isAlreadyApplied: Bool { code == "CONFLICT" }

    var isAuthError: Bool { status == 401 }

    static let offline = APIError(status: 0, code: "OFFLINE", message: "sin conexión")
}

private struct APIErrorEnvelope: Decodable {
    struct Body: Decodable {
        let code: String
        let message: String
    }

    let error: Body
}

extension APIError {
    static func decode(status: Int, data: Data) -> APIError {
        if let envelope = try? JSONDecoder().decode(APIErrorEnvelope.self, from: data) {
            return APIError(status: status, code: envelope.error.code, message: envelope.error.message)
        }
        return APIError(status: status, code: "INTERNAL", message: "error \(status)")
    }
}
