import XCTest
@testable import VolviaBiz

/// How a failure is classified decides whether a customer's stamp is kept or thrown
/// away, so the classification is worth pinning down.
final class APIErrorTests: XCTestCase {
    func testTreatsNetworkAndServerFailuresAsWorthRetrying() {
        XCTAssertTrue(APIError.offline.isTransient)
        XCTAssertTrue(APIError(status: 500, code: "INTERNAL", message: "").isTransient)
        XCTAssertTrue(APIError(status: 429, code: "RATE_LIMITED", message: "").isTransient)
    }

    func testDoesNotRetryWhatWillNeverSucceed() {
        // A card that does not exist will not start existing on the fourth attempt.
        XCTAssertFalse(APIError(status: 404, code: "CUSTOMER_CARD_NOT_FOUND", message: "").isTransient)
        XCTAssertFalse(APIError(status: 403, code: "FORBIDDEN", message: "").isTransient)
    }

    func testReadsTheApiErrorEnvelope() {
        let body = Data(#"{"error":{"code":"STAMP_TOO_SOON","message":"demasiado pronto"}}"#.utf8)
        let error = APIError.decode(status: 409, data: body)

        XCTAssertEqual(error.code, "STAMP_TOO_SOON")
        XCTAssertEqual(error.message, "demasiado pronto")
    }

    func testFallsBackWhenTheBodyIsNotOurs() {
        // A proxy or a load balancer answering instead of the API.
        let error = APIError.decode(status: 502, data: Data("<html>bad gateway</html>".utf8))
        XCTAssertEqual(error.code, "INTERNAL")
        XCTAssertTrue(error.isTransient)
    }
}

/// The counter's business refusals and the plan gate.
final class APIErrorRefusalTests: XCTestCase {
    func testCooldownAndDailyCapAreNotTransientDespiteThe429() {
        XCTAssertFalse(APIError(status: 429, code: "STAMP_COOLDOWN_ACTIVE", message: "").isTransient)
        XCTAssertFalse(APIError(status: 429, code: "STAMP_DAILY_CAP_REACHED", message: "").isTransient)
        // A real rate limit is still worth waiting out.
        XCTAssertTrue(APIError(status: 429, code: "RATE_LIMITED", message: "").isTransient)
    }

    func testReadsThePlanThatUnlocksAFeature() {
        let body = Data(#"{"error":{"code":"FEATURE_NOT_IN_PLAN","message":"feature full_analytics is not included in your plan","upgradeTo":"business","requestId":"x"}}"#.utf8)
        let error = APIError.decode(status: 402, data: body)
        XCTAssertTrue(error.isPlanGate)
        XCTAssertEqual(error.upgradeTo, "business")
        XCTAssertEqual(PlanName.label(error.upgradeTo), "Negocio")
    }

    func testReadsHowLongTheCooldownHasLeft() {
        let body = Data(#"{"error":{"code":"STAMP_COOLDOWN_ACTIVE","message":"this customer was stamped very recently","details":[{"path":"retryAfterSeconds","message":"240"}]}}"#.utf8)
        let error = APIError.decode(status: 429, data: body)
        XCTAssertEqual(error.retryAfterSeconds, 240)
        XCTAssertFalse(error.isTransient)
        XCTAssertEqual(AppModel.cooldownMessage(seconds: error.retryAfterSeconds), "Ya recibió sello hace poco (espera 4 min).")

        // Without details (an older server) it still decodes.
        let bare = APIError.decode(status: 429, data: Data(#"{"error":{"code":"STAMP_COOLDOWN_ACTIVE","message":"x"}}"#.utf8))
        XCTAssertNil(bare.retryAfterSeconds)
    }

    @MainActor
    func testSpeaksSpanishAtTheCounter() {
        let model = AppModel(baseURL: URL(string: "http://127.0.0.1:9")!)
        XCTAssertEqual(model.message(for: APIError(status: 429, code: "STAMP_DAILY_CAP_REACHED", message: "")),
                       "Llegó al límite de sellos de hoy.")
        XCTAssertEqual(model.message(for: APIError(status: 409, code: "REWARD_ALREADY_REDEEMED", message: "")),
                       "Ese premio ya se entregó.")
        XCTAssertEqual(model.message(for: APIError(status: 422, code: "VALIDATION_FAILED", message: "purchase below the minimum")),
                       "La compra no alcanza el mínimo para sellar.")
        XCTAssertTrue(model.message(for: APIError(status: 409, code: "STAMP_VOID_NOT_ALLOWED", message: "")).hasPrefix("Ya no se puede deshacer"))
        XCTAssertEqual(AppModel.cooldownMessage(seconds: 125), "Ya recibió sello hace poco (espera 3 min).")
        XCTAssertEqual(AppModel.cooldownMessage(seconds: 0), "Ya recibió sello hace poco.")
    }
}
