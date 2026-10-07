import Foundation

/// The four endpoints this app needs, and nothing else.
///
/// One silent token refresh per request, exactly like the web client: a staff member in
/// the middle of a queue should never be asked to sign in again because an access token
/// expired fifteen minutes ago.
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

    // MARK: - Endpoints

    func logIn(email: String, password: String) async throws -> TokenPair {
        try await send(
            "/v1/auth/login",
            body: ["email": email, "password": password],
            authenticated: false
        )
    }

    func stamp(_ pending: PendingStamp) async throws -> StampResult {
        try await send(
            "/v1/stamp",
            body: [
                "cardToken": pending.cardToken,
                "count": pending.count,
                "idempotencyKey": pending.idempotencyKey,
                "occurredAt": ISO8601DateFormatter().string(from: pending.occurredAt),
            ]
        )
    }

    func redeem(grantId: String) async throws -> RedeemResult {
        try await send(
            "/v1/redeem",
            body: ["grantId": grantId, "idempotencyKey": "ios-redeem-\(UUID().uuidString)"]
        )
    }

    // MARK: - Transport

    private func send<T: Decodable>(
        _ path: String,
        body: [String: Any],
        authenticated: Bool = true,
        isRetry: Bool = false
    ) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
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
                return try await send(path, body: body, authenticated: true, isRetry: true)
            }
            await onSignedOut()
        }

        guard (200..<300).contains(status) else {
            throw APIError.decode(status: status, data: data)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError(status: status, code: "DECODE", message: "respuesta inesperada")
        }
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
