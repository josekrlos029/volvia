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
