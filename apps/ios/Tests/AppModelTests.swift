import XCTest
@testable import VolviaBiz

final class AppModelTests: XCTestCase {
    /// The Info.plist value is substituted at build time; a literal `$(VOLVIA_API_URL)`
    /// here would mean the project is misconfigured.
    @MainActor
    func testDefaultBaseURLIsAbsolute() {
        let url = AppModel.defaultBaseURL
        XCTAssertNotNil(url.scheme)
        XCTAssertNotNil(url.host)
        XCTAssertFalse(url.absoluteString.contains("$("))
    }

    /// Signing in happens inside `SessionStore`; the root view only observes `AppModel`.
    @MainActor
    func testSessionChangesRedrawTheModel() {
        let model = AppModel(baseURL: URL(string: "http://127.0.0.1:9")!)
        var changes = 0
        let subscription = model.objectWillChange.sink { _ in changes += 1 }
        defer { subscription.cancel() }

        let user = SessionUser(id: "u", email: "a@b.test", name: "A", memberships: [
            Membership(orgId: "o", orgName: "Org", orgSlug: "org", role: "staff", locationId: nil),
        ])
        model.session.save(TokenPair(accessToken: "t", refreshToken: "r", expiresIn: 1, user: user))
        XCTAssertGreaterThan(changes, 0)
        XCTAssertTrue(model.session.isSignedIn)

        let before = changes
        model.queue.enqueue(PendingStamp(cardToken: "0123456789abcdef"))
        XCTAssertGreaterThan(changes, before)

        model.session.signOut()
        model.queue.removeAll()
        XCTAssertFalse(model.session.isSignedIn)
    }

    /// Run with `TEST_RUNNER_VOLVIA_API_URL=http://localhost:8081` to exercise the override.
    @MainActor
    func testEnvironmentOverridesBaseURLInDebug() throws {
        guard let override = ProcessInfo.processInfo.environment["VOLVIA_API_URL"] else {
            throw XCTSkip("VOLVIA_API_URL not set for the test runner")
        }
        XCTAssertEqual(AppModel.defaultBaseURL.absoluteString, override)
    }
}
