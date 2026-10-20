import XCTest
@testable import VolviaBiz

/// The API's answers, copied from a real run against the isolated stack, must decode.
/// The dates carry milliseconds, which the stock `.iso8601` strategy refuses.
final class ModelDecodingTests: XCTestCase {
    func testDecodesALookup() throws {
        let json = ##"{"customerCardId":"295fdf4b-a8d4-412e-ab22-125842480b47","cardToken":"ph623FDt-pTP062Xupo5ccsErF4T4Jzr","customer":{"id":"2cd86361-e4bd-4ae3-b473-c7f286f5acf2","firstName":"Juan","phone":null,"notes":"","totalStamps":5,"joinedAt":"2026-10-20T01:34:43.049Z"},"card":{"id":"3e7e9836-2648-4861-987c-ffc9fa956ba9","name":"Club Raíces","stampsRequired":8,"ruleMode":"per_visit","minSpendAmount":null,"maxStampsPerScan":5},"stampsCount":5,"lastStampAt":"2026-10-20T01:34:46.723Z","cooldownSecondsLeft":0,"pendingRewards":[{"grantId":"1e10221b-b006-4d16-910c-1ebc17fb54e8","title":"Postre gratis","code":"TUTXV5","expiresAt":null}],"design":{"businessName":"Café Raíces iOS","cardName":"Club Raíces","logoUrl":null,"backgroundColor":"#1E3A8A","foregroundColor":"#FFFFFF","accentColor":"#FB923C","emptyStampColor":"#3A56A6","stampStyle":"circle","stampIcon":{"kind":"preset","value":"star"},"rewardPositions":[4,8],"nextReward":{"atStamp":8,"title":"Café gratis"}}}"##
        let lookup = try JSONDecoder.volvia.decode(CardLookup.self, from: Data(json.utf8))
        XCTAssertEqual(lookup.card.maxStampsPerScan, 5)
        XCTAssertFalse(lookup.requiresAmount)
        XCTAssertEqual(lookup.pendingRewards.first?.code, "TUTXV5")
        XCTAssertNotNil(lookup.lastStampAt)

        let look = CardLook(lookup)
        XCTAssertEqual(look.filled, 5)
        XCTAssertEqual(look.remainingLine, "Le faltan 3 para Café gratis")
    }

    func testDecodesAStampWithItsEventId() throws {
        let json = ##"{"customerCardId":"295fdf4b-a8d4-412e-ab22-125842480b47","eventId":"7e037f2d-aa5e-43fa-bfc8-04ad60f581ba","stampsAdded":5,"stampsCount":5,"stampsRequired":8,"cycleIndex":0,"unlockedRewards":[{"grantId":"1e10221b-b006-4d16-910c-1ebc17fb54e8","title":"Postre gratis","description":"","code":"TUTXV5","expiresAt":null}],"pendingRewards":[],"customer":{"id":"2cd86361-e4bd-4ae3-b473-c7f286f5acf2","firstName":"Juan","isNew":true},"replayed":false}"##
        let result = try JSONDecoder.volvia.decode(StampResult.self, from: Data(json.utf8))
        XCTAssertEqual(result.eventId, "7e037f2d-aa5e-43fa-bfc8-04ad60f581ba")
        XCTAssertEqual(result.customerCardId, "295fdf4b-a8d4-412e-ab22-125842480b47")
    }

    func testDecodesMyActivity() throws {
        let json = ##"{"items":[{"kind":"stamp","id":"7e037f2d-aa5e-43fa-bfc8-04ad60f581ba","at":"2026-10-20T01:34:46.722Z","customerCardId":"295fdf4b-a8d4-412e-ab22-125842480b47","customerId":"2cd86361-e4bd-4ae3-b473-c7f286f5acf2","firstName":"Juan","cardName":"Club Raíces","delta":5,"rewardTitle":null,"canVoid":true}]}"##
        let activity = try JSONDecoder.volvia.decode(MyActivity.self, from: Data(json.utf8))
        XCTAssertEqual(activity.items.first?.canVoid, true)
    }

    func testDecodesARedemptionWithMilliseconds() throws {
        // 1.1 decoded this with `.iso8601` and failed on the milliseconds.
        let json = ##"{"grantId":"1e10221b-b006-4d16-910c-1ebc17fb54e8","title":"Postre gratis","redeemedAt":"2026-10-20T01:40:00.123Z","customer":{"id":"c","firstName":"Juan"},"stampsCount":5,"stampsRequired":8,"remainingPending":0}"##
        let result = try JSONDecoder.volvia.decode(RedeemResult.self, from: Data(json.utf8))
        XCTAssertNotNil(result.redeemedAt)
        XCTAssertEqual(result.customer?.firstName, "Juan")
    }

    func testDecodesTheOrgAndFindsThePassApp() throws {
        let json = ##"{"id":"40a7f8b3-a701-445e-bea7-2499a3f86205","name":"Café Raíces iOS","slug":"cafe-raices-ios","logoUrl":null,"currency":"cop","timezone":"America/Bogota","settings":{"legalName":"","privacyEmail":""},"entitlements":{"plan":"free","effectivePlan":"free","features":{"full_analytics":true,"kiosk_mode":false},"limits":{"locations":1,"activeCards":null}},"publicUrl":"http://localhost:3012/b/cafe-raices-ios"}"##
        let org = try JSONDecoder.volvia.decode(OrgInfo.self, from: Data(json.utf8))
        XCTAssertEqual(org.passBaseURL, "http://localhost:3012")
        XCTAssertEqual(org.privacyURL?.absoluteString, "http://localhost:3012/b/cafe-raices-ios/privacidad")
        XCTAssertTrue(org.has("full_analytics"))
        XCTAssertFalse(org.has("kiosk_mode"))
        XCTAssertEqual(org.legalDisplayName, "Café Raíces iOS")
        XCTAssertEqual(org.entitlements.limits["activeCards"], .some(nil))
    }
}

/// What staff type at the counter, normalised the way the API's `phoneSchema` does.
final class CounterInputTests: XCTestCase {
    func testPhoneNumbers() {
        XCTAssertEqual(PhoneNumber.parse("+57 "), .empty)
        XCTAssertEqual(PhoneNumber.parse(""), .empty)
        XCTAssertEqual(PhoneNumber.parse("+57 300 123 4567"), .valid("+573001234567"))
        XCTAssertEqual(PhoneNumber.parse("300-123-4567"), .valid("3001234567"))
        XCTAssertEqual(PhoneNumber.parse("+57 30a"), .invalid)
        XCTAssertEqual(PhoneNumber.parse("12"), .invalid)
    }

    func testPesosWithThousandsSeparators() {
        XCTAssertEqual(Money.format(25_000), "$ 25.000")
        XCTAssertEqual(Money.format(1_250_000), "$ 1.250.000")
        XCTAssertEqual(Money.parse("25.000"), 25_000)
        XCTAssertNil(Money.parse(""))
    }

    func testWhatsAppLinks() {
        XCTAssertEqual(
            WhatsApp.url(phone: "+573001234567", text: "Hola")?.absoluteString,
            "https://wa.me/573001234567?text=Hola"
        )
        XCTAssertEqual(WhatsApp.url(phone: nil, text: "Hola")?.absoluteString, "https://wa.me/?text=Hola")
    }
}
