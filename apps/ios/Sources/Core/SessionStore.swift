import Foundation
import Security

/// Where the session lives between launches.
///
/// Tokens go to the keychain, never to UserDefaults: a staff phone is shared, left on a
/// counter and occasionally lost, and a refresh token in a plist is readable by anything
/// that can reach a backup.
@MainActor
final class SessionStore: ObservableObject {
    @Published private(set) var user: SessionUser?
    @Published private(set) var membership: Membership?

    private let keychain = Keychain(service: "co.volvia.biz")
    private let selectedOrgKey = "selectedOrgId"

    var accessToken: String? { keychain.read("accessToken") }
    var refreshToken: String? { keychain.read("refreshToken") }
    var isSignedIn: Bool { membership != nil && accessToken != nil }

    func restore() {
        guard keychain.read("accessToken") != nil,
              let data = keychain.read("user")?.data(using: .utf8),
              let stored = try? JSONDecoder().decode(SessionUser.self, from: data)
        else { return }

        user = stored
        let selected = UserDefaults.standard.string(forKey: selectedOrgKey)
        membership = stored.memberships.first { $0.orgId == selected } ?? stored.memberships.first
    }

    func save(_ tokens: TokenPair) {
        keychain.write("accessToken", tokens.accessToken)
        keychain.write("refreshToken", tokens.refreshToken)
        if let encoded = try? JSONEncoder().encode(tokens.user),
           let json = String(data: encoded, encoding: .utf8) {
            keychain.write("user", json)
        }

        user = tokens.user
        let selected = UserDefaults.standard.string(forKey: selectedOrgKey)
        membership = tokens.user.memberships.first { $0.orgId == selected }
            ?? tokens.user.memberships.first
    }

    func updateAccessToken(_ token: String) {
        keychain.write("accessToken", token)
    }

    func select(_ membership: Membership) {
        self.membership = membership
        UserDefaults.standard.set(membership.orgId, forKey: selectedOrgKey)
    }

    /// Clears the session but never the pending queue: stamps already taken from real
    /// customers are not ours to discard because somebody signed out.
    func signOut() {
        keychain.delete("accessToken")
        keychain.delete("refreshToken")
        keychain.delete("user")
        user = nil
        membership = nil
    }
}

/// A keychain wrapper small enough to read in one sitting.
struct Keychain: Sendable {
    let service: String

    private func query(_ account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    func read(_ account: String) -> String? {
        var request = query(account)
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        guard SecItemCopyMatching(request as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func write(_ account: String, _ value: String) {
        let data = Data(value.utf8)
        var request = query(account)
        // Readable only while the phone is unlocked, and never restored to a new device.
        request[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly

        SecItemDelete(request as CFDictionary)
        request[kSecValueData as String] = data
        SecItemAdd(request as CFDictionary, nil)
    }

    func delete(_ account: String) {
        SecItemDelete(query(account) as CFDictionary)
    }
}
