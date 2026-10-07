import XCTest
@testable import VolviaBiz

/// What the camera reads is not always what we expect, and the staff member holding the
/// phone has no way to tell a good QR from a bad one. These are the shapes that reach us.
final class CardTokenTests: XCTestCase {
    private let token = "DAAhsNXnnW5ZCHA9rKVHMke7m0B7mVaE"

    func testReadsTheTokenFromACardUrl() {
        XCTAssertEqual(CardToken.parse("https://tarjeta.somosvolvia.com/c/\(token)"), token)
    }

    func testIgnoresAQueryString() {
        // The customer opened their card from an email, and the tracking stayed on.
        XCTAssertEqual(CardToken.parse("https://tarjeta.somosvolvia.com/c/\(token)?stamped=1"), token)
    }

    func testAcceptsABareToken() {
        // Typed in by hand when a screen is too cracked to scan.
        XCTAssertEqual(CardToken.parse(token), token)
    }

    func testTrimsWhatTheCameraLeavesBehind() {
        XCTAssertEqual(CardToken.parse("  https://tarjeta.somosvolvia.com/c/\(token)\n"), token)
    }

    func testRejectsSomebodyElsesQrCode() {
        // A wifi code, a payment code, a product barcode: all plausible at a counter.
        XCTAssertNil(CardToken.parse("WIFI:S:CafeLuna;T:WPA;P:12345678;;"))
        XCTAssertNil(CardToken.parse("https://example.com/"))
        XCTAssertNil(CardToken.parse("7501234567890"))
        XCTAssertNil(CardToken.parse(""))
    }

    func testRejectsSomethingTooShortToBeAToken() {
        XCTAssertNil(CardToken.parse("https://tarjeta.somosvolvia.com/c/abc123"))
    }

    func testRejectsCharactersATokenNeverContains() {
        XCTAssertNil(CardToken.parse("https://tarjeta.somosvolvia.com/c/\(token)<script>"))
    }
}
