import Foundation

/// Every endpoint the app calls, and the transport under them.
///
/// One silent token refresh per request, exactly like the web client: a staff member in
/// the middle of a queue should never be asked to sign in again because an access token
/// expired fifteen minutes ago.
///
/// Request bodies are built inside the actor from typed arguments, so nothing that is not
/// `Sendable` ever crosses into it.
actor APIClient {
    private let baseURL: URL
    private let session: URLSession
    private var isRefreshing = false

    /// Reading the session from an actor means the token is always the current one, even
    /// when four scans land at once.
    private let tokens: @Sendable () async -> (access: String?, refresh: String?, orgId: String?)
    private let onRefreshed: @Sendable (String) async -> Void
    private let onSignedOut: @Sendable () async -> Void

    init(
        baseURL: URL,
        session: URLSession = .shared,
        tokens: @escaping @Sendable () async -> (access: String?, refresh: String?, orgId: String?),
        onRefreshed: @escaping @Sendable (String) async -> Void,
        onSignedOut: @escaping @Sendable () async -> Void
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokens = tokens
        self.onRefreshed = onRefreshed
        self.onSignedOut = onSignedOut
    }

    // MARK: - Session

    func logIn(email: String, password: String) async throws -> TokenPair {
        try await send(
            "/v1/auth/login",
            body: ["email": email, "password": password],
            authenticated: false
        )
    }

    /// The identity token from `ASAuthorizationAppleIDCredential`. The name travels
    /// separately because Apple puts it in the credential, not in the token, and only
    /// the first time.
    func logIn(appleIdentityToken token: String, name: String?) async throws -> TokenPair {
        var body: [String: Any] = ["identityToken": token]
        if let name, !name.isEmpty { body["name"] = name }
        return try await send("/v1/auth/apple/native", body: body, authenticated: false)
    }

    /// The ID token the Google Sign-In SDK returns for the iOS client.
    func logIn(googleIdToken token: String) async throws -> TokenPair {
        try await send("/v1/auth/google/native", body: ["idToken": token], authenticated: false)
    }

    func me() async throws -> SessionUser {
        try await send("/v1/auth/me", method: "GET")
    }

    /// Revokes the session on the server. Best effort: signing out on the phone must
    /// work with no signal too.
    func logOut(refreshToken: String?) async {
        var body: [String: Any] = [:]
        if let refreshToken { body["refreshToken"] = refreshToken }
        let _: Empty? = try? await send("/v1/auth/logout", body: body, allowsEmpty: true)
    }

    // MARK: - Organisation

    func org() async throws -> OrgInfo {
        try await send("/v1/org", method: "GET")
    }

    func locations() async throws -> [OrgLocation] {
        try await send("/v1/org/locations", method: "GET")
    }

    func cards() async throws -> [LoyaltyCard] {
        try await send("/v1/cards", method: "GET")
    }

    /// The counter's sign-up QR as a PNG, drawn by the API with the business's logo.
    func cardQR(cardId: String, size: Int = 1024) async throws -> Data {
        try await raw("/v1/cards/\(cardId)/qr", query: ["format": "png", "size": "\(size)"])
    }

    // MARK: - Counter

    func stamp(_ pending: PendingStamp) async throws -> StampResult {
        try await send("/v1/stamp", body: pending.requestBody)
    }

    func lookup(cardToken: String? = nil, customerCardId: String? = nil) async throws -> CardLookup {
        var query: [String: String] = [:]
        if let cardToken { query["cardToken"] = cardToken }
        if let customerCardId { query["customerCardId"] = customerCardId }
        return try await send("/v1/lookup", method: "GET", query: query)
    }

    func voidStamp(eventId: String, reason: String? = nil) async throws -> VoidResult {
        var body: [String: Any] = [:]
        if let reason, !reason.isEmpty { body["reason"] = reason }
        return try await send("/v1/stamp/\(eventId)/void", body: body)
    }

    func redeem(grantId: String, locationId: String?) async throws -> RedeemResult {
        try await redeem(["grantId": grantId], locationId: locationId)
    }

    /// The short code a customer reads out, typed at the counter.
    func redeem(code: String, locationId: String?) async throws -> RedeemResult {
        try await redeem(["code": code], locationId: locationId)
    }

    private func redeem(_ reference: [String: Any], locationId: String?) async throws -> RedeemResult {
        var body = reference
        body["idempotencyKey"] = "ios-redeem-\(UUID().uuidString)"
        if let locationId { body["locationId"] = locationId }
        return try await send("/v1/redeem", body: body)
    }

    func enroll(_ form: EnrollForm, locationId: String?) async throws -> EnrollResult {
        var body: [String: Any] = [
            "cardId": form.cardId,
            "firstName": form.firstName,
            "email": form.email,
            "marketingConsent": form.marketingConsent,
            "dataConsent": true,
            "stampNow": form.stampNow,
            "idempotencyKey": form.idempotencyKey,
        ]
        if let phone = form.phone { body["phone"] = phone }
        if let birthday = form.birthday {
            body["birthday"] = ["month": birthday.month, "day": birthday.day]
        }
        if let locationId { body["locationId"] = locationId }
        return try await send("/v1/enroll", body: body)
    }

    func myActivity() async throws -> MyActivity {
        try await send("/v1/activity/mine", method: "GET")
    }

    // MARK: - Customers

    func customers(search: String, page: Int, pageSize: Int = 30) async throws -> CustomerPage {
        var query = ["page": "\(page)", "pageSize": "\(pageSize)"]
        let trimmed = search.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty { query["search"] = trimmed }
        return try await send("/v1/customers", method: "GET", query: query)
    }

    func customer(id: String) async throws -> CustomerDetail {
        try await send("/v1/customers/\(id)", method: "GET")
    }

    func updateCustomer(id: String, patch: CustomerPatch) async throws {
        var body: [String: Any] = ["notes": patch.notes]
        body["phone"] = patch.phone.map { $0 as Any } ?? NSNull()
        body["birthday"] = patch.birthday.map { ["month": $0.month, "day": $0.day] as Any } ?? NSNull()
        let _: Empty? = try await send("/v1/customers/\(id)", method: "PATCH", body: body, allowsEmpty: true)
    }

    func adjust(customerCardId: String, delta: Int, reason: String) async throws -> AdjustResult {
        try await send("/v1/adjust", body: [
            "customerCardId": customerCardId,
            "delta": delta,
            "reason": reason,
            "idempotencyKey": "ios-adjust-\(UUID().uuidString)",
        ])
    }

    // MARK: - Analytics

    func pulse() async throws -> Pulse {
        try await send("/v1/analytics/pulse", method: "GET")
    }

    func overview() async throws -> AnalyticsOverview {
        try await send("/v1/analytics/overview", method: "GET", query: ["preset": "30d"])
    }

    func timeseries() async throws -> [TimeseriesPoint] {
        try await send("/v1/analytics/timeseries", method: "GET", query: ["preset": "30d"])
    }

    func busiest() async throws -> Busiest {
        try await send("/v1/analytics/busiest", method: "GET", query: ["preset": "90d"])
    }

    func retention() async throws -> Retention {
        try await send("/v1/analytics/retention", method: "GET", query: ["months": "6"])
    }

    // MARK: - Messages and campaigns

    func segments() async throws -> SegmentList {
        try await send("/v1/segments", method: "GET")
    }

    func messages() async throws -> MessageList {
        try await send("/v1/messages", method: "GET")
    }

    func previewMessage(_ audience: Audience) async throws -> AudiencePreview {
        try await send("/v1/messages/preview", body: audience.json)
    }

    /// Creates the message and sends it straight away, as the web composer does.
    func sendMessage(headline: String, body text: String, audience: Audience) async throws -> OutboundMessage {
        let created: OutboundMessage = try await send("/v1/messages", body: [
            "headline": headline,
            "body": text,
            "audience": audience.json,
            "scheduledAt": NSNull(),
        ])
        return try await send("/v1/messages/\(created.id)/send", body: ["scheduledAt": NSNull()])
    }

    func cancelMessage(id: String) async throws -> OutboundMessage {
        try await send("/v1/messages/\(id)/cancel", body: [:])
    }

    func campaigns() async throws -> CampaignList {
        try await send("/v1/campaigns", method: "GET")
    }

    func previewCampaign(_ audience: Audience) async throws -> AudiencePreview {
        try await send("/v1/campaigns/preview", body: audience.json)
    }

    func launchCampaign(_ draft: CampaignDraft) async throws -> Campaign {
        let created: Campaign = try await send("/v1/campaigns", body: draft.requestBody)
        return try await send("/v1/campaigns/\(created.id)/launch", body: [:])
    }

    func cancelCampaign(id: String) async throws -> Campaign {
        try await send("/v1/campaigns/\(id)/cancel", body: [:])
    }

    // MARK: - Team

    func team() async throws -> Team {
        try await send("/v1/org/members", method: "GET")
    }

    func invite(email: String, role: String, locationId: String?) async throws {
        let _: Empty? = try await send("/v1/org/members/invite", body: [
            "email": email,
            "role": role,
            "locationId": locationId.map { $0 as Any } ?? NSNull(),
        ], allowsEmpty: true)
    }

    func updateMember(id: String, role: String?, locationId: String??) async throws {
        var body: [String: Any] = [:]
        if let role { body["role"] = role }
        if let locationId { body["locationId"] = locationId.map { $0 as Any } ?? NSNull() }
        let _: Empty? = try await send("/v1/org/members/\(id)", method: "PATCH", body: body, allowsEmpty: true)
    }

    func removeMember(id: String) async throws {
        let _: Empty? = try await send("/v1/org/members/\(id)", method: "DELETE", allowsEmpty: true)
    }

    func revokeInvite(id: String) async throws {
        let _: Empty? = try await send("/v1/org/invites/\(id)", method: "DELETE", allowsEmpty: true)
    }

    // MARK: - Kiosk

    func openKiosk(cardId: String, locationId: String) async throws -> KioskSession {
        try await send("/v1/kiosk/session", body: [
            "cardId": cardId,
            "locationId": locationId,
            "deviceLabel": "Volvia Biz iOS",
        ])
    }

    func kioskNonce(_ kiosk: KioskSession) async throws -> KioskNonce {
        try await send("/v1/kiosk/nonce", body: ["sessionId": kiosk.sessionId, "secret": kiosk.secret])
    }

    func kioskStatus(_ kiosk: KioskSession) async throws -> KioskStatus {
        try await send("/v1/kiosk/status", body: ["sessionId": kiosk.sessionId, "secret": kiosk.secret])
    }

    func closeKiosk(_ kiosk: KioskSession) async throws {
        let _: Empty? = try await send("/v1/kiosk/session/\(kiosk.sessionId)", method: "DELETE", allowsEmpty: true)
    }

    // MARK: - Transport

    /// Stands in for a body the app does not read (204, or a `{ sent: true }`).
    struct Empty: Decodable, Sendable {}

    private func send<T: Decodable>(
        _ path: String,
        method: String = "POST",
        query: [String: String] = [:],
        body: [String: Any]? = nil,
        authenticated: Bool = true,
        allowsEmpty: Bool = false
    ) async throws -> T {
        let encoded = try body.map { try JSONSerialization.data(withJSONObject: $0) }
        let (data, status) = try await perform(
            path, method: method, query: query, body: encoded ?? (method == "POST" ? Data("{}".utf8) : nil),
            authenticated: authenticated, isRetry: false
        )

        if allowsEmpty, data.isEmpty || status == 204 {
            // Callers asking for an optional `Empty` get nil back; nothing to decode.
            if let empty = Optional<Empty>.none as? T { return empty }
        }

        do {
            return try JSONDecoder.volvia.decode(T.self, from: data)
        } catch {
            if allowsEmpty, let empty = Optional<Empty>.none as? T { return empty }
            throw APIError(status: status, code: "DECODE", message: "respuesta inesperada")
        }
    }

    private func raw(_ path: String, query: [String: String]) async throws -> Data {
        try await perform(path, method: "GET", query: query, body: nil, authenticated: true, isRetry: false).data
    }

    private func perform(
        _ path: String,
        method: String,
        query: [String: String],
        body: Data?,
        authenticated: Bool,
        isRetry: Bool
    ) async throws -> (data: Data, status: Int) {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            components.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            request.httpBody = body
        }
        request.timeoutInterval = 15

        let current = await tokens()
        if authenticated {
            guard let access = current.access else {
                await onSignedOut()
                throw APIError(status: 401, code: "UNAUTHENTICATED", message: "sesión cerrada")
            }
            request.setValue("Bearer \(access)", forHTTPHeaderField: "authorization")
            if let orgId = current.orgId {
                request.setValue(orgId, forHTTPHeaderField: "x-org-id")
            }
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            // No signal, airplane mode, a dead router. Not the server's fault and not
            // the customer's problem: the queue keeps it.
            throw APIError.offline
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        if status == 401, authenticated, !isRetry {
            if await refreshTokens() {
                return try await perform(
                    path, method: method, query: query, body: body, authenticated: true, isRetry: true
                )
            }
            await onSignedOut()
        }

        guard (200..<300).contains(status) else {
            throw APIError.decode(status: status, data: data)
        }
        return (data, status)
    }

    private func refreshTokens() async -> Bool {
        guard !isRefreshing, let refresh = await tokens().refresh else { return false }
        isRefreshing = true
        defer { isRefreshing = false }

        var request = URLRequest(url: baseURL.appendingPathComponent("/v1/auth/refresh"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["refreshToken": refresh])

        guard let (data, response) = try? await session.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let pair = try? JSONDecoder().decode(TokenPair.self, from: data)
        else { return false }

        await onRefreshed(pair.accessToken)
        return true
    }
}

/// What the staff member typed in the sign-up form, already validated.
struct EnrollForm: Sendable, Hashable {
    let cardId: String
    let firstName: String
    let email: String
    /// E.164 (`+573001234567`), or nil when left blank.
    let phone: String?
    let birthday: Birthday?
    let marketingConsent: Bool
    let stampNow: Bool
    /// Fixed for the life of the form, so a double tap or a retry signs up once.
    let idempotencyKey: String
}

struct Birthday: Codable, Sendable, Hashable {
    let month: Int
    let day: Int
}

/// The admin's edit of a customer: notes, phone and birthday. Nil clears the field.
struct CustomerPatch: Sendable, Hashable {
    let notes: String
    let phone: String?
    let birthday: Birthday?
}

/// A campaign as the template picker leaves it, ready for `POST /v1/campaigns`.
struct CampaignDraft: Sendable, Hashable {
    let name: String
    let template: String
    let headline: String
    let body: String
    let offer: CampaignOffer
    let audience: Audience
    let startsAt: Date
    let endsAt: Date
    let activeHours: (from: String, to: String)?
    let passHeader: String?
    let passBanner: String?
    let endsOnFirstStamp: Bool

    static func == (lhs: CampaignDraft, rhs: CampaignDraft) -> Bool {
        lhs.template == rhs.template && lhs.headline == rhs.headline && lhs.body == rhs.body
            && lhs.startsAt == rhs.startsAt && lhs.endsAt == rhs.endsAt
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(template)
        hasher.combine(headline)
        hasher.combine(body)
    }

    var requestBody: [String: Any] {
        let iso = ISO8601DateFormatter()
        return [
            "name": name,
            "template": template,
            "headline": headline,
            "body": body,
            "offer": offer.json,
            "audience": audience.json,
            "startsAt": iso.string(from: startsAt),
            "endsAt": iso.string(from: endsAt),
            "sendPush": true,
            "activeWeekdays": [Int](),
            "activeHours": activeHours.map { ["from": $0.from, "to": $0.to] as Any } ?? NSNull(),
            "passOverride": [
                "header": passHeader.map { $0 as Any } ?? NSNull(),
                "text": NSNull(),
                "banner": passBanner.map { ["kind": "preset", "value": $0] as Any } ?? NSNull(),
                "stampStyle": NSNull(),
                "endsOnFirstStamp": endsOnFirstStamp,
            ] as [String: Any],
        ]
    }
}

/// What a campaign does to the card while it runs (`campaignOfferSchema`).
enum CampaignOffer: Sendable, Hashable {
    case bonusStamps(Int)
    case multiplier(Int)
    case instantReward(String)
    case messageOnly

    var json: [String: Any] {
        switch self {
        case .bonusStamps(let amount): return ["kind": "bonus_stamps", "amount": amount]
        case .multiplier(let factor): return ["kind": "multiplier", "factor": factor]
        case .instantReward(let title): return ["kind": "instant_reward", "title": title]
        case .messageOnly: return ["kind": "message_only"]
        }
    }

    var summary: String {
        switch self {
        case .bonusStamps(let amount): return amount == 1 ? "1 sello de regalo" : "\(amount) sellos de regalo"
        case .multiplier(let factor): return "Sellos x\(factor)"
        case .instantReward(let title): return title
        case .messageOnly: return "Solo mensaje"
        }
    }
}
