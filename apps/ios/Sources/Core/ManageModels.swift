import Foundation

/// The shapes behind "Hoy" and the admin screens (statistics, messages, campaigns,
/// team), copied by hand from the API's services like the rest of `Models.swift`.

// MARK: - Analytics

/// `GET /v1/analytics/pulse`: today at a glance.
struct Pulse: Codable, Sendable, Hashable {
    struct Today: Codable, Sendable, Hashable {
        let stamps: Int
        let joins: Int
        let rewards: Int
    }

    struct Activity: Codable, Sendable, Hashable {
        /// `stamp`, `join` or `reward`.
        let kind: String
        let customerId: String
        let firstName: String
        let at: Date
        let count: Int
    }

    struct BirthdayItem: Codable, Sendable, Hashable, Identifiable {
        let customerId: String
        let firstName: String
        let month: Int
        let day: Int

        var id: String { customerId }
    }

    let today: Today
    let activity: [Activity]
    let birthdays: [BirthdayItem]
}

/// `GET /v1/analytics/overview` for the last 30 days.
struct AnalyticsOverview: Codable, Sendable, Hashable {
    struct Customers: Codable, Sendable, Hashable {
        let total: Int
        let new: Int
        let changePct: Double?
    }

    struct Stamps: Codable, Sendable, Hashable {
        let total: Int
        let changePct: Double?
    }

    struct Rewards: Codable, Sendable, Hashable {
        let unlocked: Int
        let redeemed: Int
        let redemptionRate: Double
    }

    let customers: Customers
    let stamps: Stamps
    let rewards: Rewards
    let repeatRate: Double
    let averageVisitsPerCustomer: Double
    let medianDaysBetweenVisits: Double?
    let activeCards: Int
    let pageViews: Int?
}

/// One day of `GET /v1/analytics/timeseries`. The date stays a string: it is a calendar
/// day in the business's timezone, not an instant.
struct TimeseriesPoint: Codable, Sendable, Hashable, Identifiable {
    let date: String
    let stamps: Int
    let joins: Int
    let rewardsUnlocked: Int
    let rewardsRedeemed: Int

    var id: String { date }

    var day: Date? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let parts = date.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
}

/// `GET /v1/analytics/busiest`. The API sends the two dimensions separately (weekday and
/// hour of day), not a combined grid.
struct Busiest: Codable, Sendable, Hashable {
    struct Weekday: Codable, Sendable, Hashable {
        /// 0 = Sunday, as in JavaScript.
        let weekday: Int
        let stamps: Int
    }

    struct Hour: Codable, Sendable, Hashable {
        let hour: Int
        let stamps: Int
    }

    let byWeekday: [Weekday]
    let byHour: [Hour]
}

/// `GET /v1/analytics/retention`: one row per joining month, each value the share (0-100)
/// of that cohort seen again N months later.
struct Retention: Codable, Sendable, Hashable {
    struct Cohort: Codable, Sendable, Hashable, Identifiable {
        let cohort: String
        let size: Int
        let values: [Double?]

        var id: String { cohort }
    }

    let cohorts: [Cohort]
}

// MARK: - Audiences

/// `GET /v1/segments`: the suggested segments and the business's own.
struct SegmentList: Codable, Sendable, Hashable {
    struct Suggested: Codable, Sendable, Hashable, Identifiable {
        let key: String
        let name: String
        let description: String?
        let count: Int

        var id: String { key }
    }

    struct Saved: Codable, Sendable, Hashable, Identifiable {
        let id: String
        let name: String
        let count: Int?
    }

    let segments: [Saved]
    let suggested: [Suggested]
}

/// Who a message or campaign goes to, in the shape of `audienceSchema`.
struct Audience: Sendable, Hashable {
    var segment: String = "all"
    var suggested: String? = nil
    var segmentId: String? = nil

    var json: [String: Any] {
        [
            "segment": segment,
            "suggested": suggested.map { $0 as Any } ?? NSNull(),
            "segmentId": segmentId.map { $0 as Any } ?? NSNull(),
            "cardIds": [String](),
            "customerIds": [String](),
            "consentOnly": true,
        ]
    }
}

/// `POST /v1/messages/preview` and `/v1/campaigns/preview`.
struct AudiencePreview: Codable, Sendable, Hashable {
    let size: Int
    var withWallet: Int? = nil
}

/// "2 de 4 este mes"; a nil limit is unlimited.
struct MonthlyUsage: Codable, Sendable, Hashable {
    let used: Int
    let limit: Int?

    var remaining: Int? { limit.map { max(0, $0 - used) } }
}

// MARK: - Messages

struct OutboundMessage: Codable, Sendable, Hashable, Identifiable {
    let id: String
    let headline: String
    let body: String
    /// `draft`, `scheduled`, `sending`, `sent` or `failed`.
    let status: String
    let scheduledAt: Date?
    let sentAt: Date?
    let targetedCount: Int
    let deliveredCount: Int
    let createdAt: Date
}

struct MessageList: Codable, Sendable {
    let messages: [OutboundMessage]
    let thisMonth: MonthlyUsage
}

// MARK: - Campaigns

struct Campaign: Codable, Sendable, Hashable, Identifiable {
    struct Stats: Codable, Sendable, Hashable {
        let stamps: Int?
        let redeemed: Int?
        let targeted: Int?
        let delivered: Int?
    }

    let id: String
    let name: String
    let template: String
    /// `draft`, `scheduled`, `running`, `finished` or `cancelled`.
    let status: String
    let headline: String
    let body: String
    let startsAt: Date
    let endsAt: Date
    let stats: Stats?

    var isLive: Bool { status == "scheduled" || status == "running" || status == "draft" }
}

struct CampaignList: Codable, Sendable {
    let campaigns: [Campaign]
    let thisMonth: MonthlyUsage
}

// MARK: - Team

struct TeamMember: Codable, Sendable, Hashable, Identifiable {
    /// The membership id: what PATCH and DELETE take.
    let id: String
    let userId: String
    let name: String
    let email: String
    let role: String
    let locationId: String?
    let joinedAt: Date?
    let lastLoginAt: Date?
}

struct TeamInvite: Codable, Sendable, Hashable, Identifiable {
    let id: String
    let email: String
    let role: String
    let expiresAt: Date?
}

struct Team: Codable, Sendable {
    let members: [TeamMember]
    let pending: [TeamInvite]
    let seats: Int
    let seatLimit: Int?
}

// MARK: - Kiosk

struct KioskSession: Codable, Sendable, Hashable {
    let sessionId: String
    let secret: String
}

struct KioskNonce: Codable, Sendable, Hashable {
    let nonce: String
    let expiresInSeconds: Int
}

struct KioskStatus: Codable, Sendable, Hashable {
    struct LastStamp: Codable, Sendable, Hashable {
        /// Milliseconds since 1970, as JavaScript's `Date.now()`.
        let at: Double
        let rewardUnlocked: Bool
    }

    let lastStamp: LastStamp?
}

/// Role names as the team screen shows them.
enum RoleName {
    static func label(_ role: String) -> String {
        switch role {
        case "owner": return "Dueño"
        case "admin": return "Administrador"
        default: return "Equipo"
        }
    }
}
