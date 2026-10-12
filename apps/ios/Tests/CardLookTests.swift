import XCTest
@testable import VolviaBiz

final class CardLookTests: XCTestCase {
    private let design = StampResultDesign(
        businessName: "Café Raíces",
        cardName: "Club Raíces",
        logoUrl: nil,
        backgroundColor: "#2B1D14",
        foregroundColor: "#FFFFFF",
        accentColor: "#D9A35F",
        emptyStampColor: "#4A3A2E",
        stampStyle: "circle",
        stampIcon: StampIcon(kind: "preset", value: "coffee"),
        rewardPositions: [10],
        nextReward: NextReward(atStamp: 10, title: "Café gratis")
    )

    private func result(_ count: Int, unlocked: [UnlockedReward] = []) -> StampResult {
        StampResult(
            stampsAdded: 1, stampsCount: count, stampsRequired: 10, cycleIndex: 0,
            unlockedRewards: unlocked, pendingRewards: [],
            customer: StampCustomer(id: "c", firstName: "Laura", isNew: false),
            replayed: false, design: design
        )
    }

    func testThePaleAccentTakesTheDarkCardColourAsItsMark() {
        let look = CardLook(result(4))!
        XCTAssertEqual(look.onAccent, CardRGB(hex: "#2B1D14"))
    }

    func testDrawsTheBusinessGlyphAndSaysWhatIsLeft() {
        let look = CardLook(result(7))!
        XCTAssertEqual(look.glyph, "Stamps/coffee")
        XCTAssertEqual(look.columns, 5)
        XCTAssertEqual(look.remainingLine, "Le faltan 3 para Café gratis")
    }

    func testFillsTheCardWhenTheRewardRestartsTheCycle() {
        let look = CardLook(result(0, unlocked: [
            UnlockedReward(grantId: "g", title: "Café gratis", description: "", code: "AB12"),
        ]))!
        XCTAssertEqual(look.filled, 10)
        XCTAssertNil(look.remainingLine)
    }

    func testAnOlderReplayWithoutTheDesignStaysPlain() throws {
        let json = #"{"stampsAdded":1,"stampsCount":2,"stampsRequired":8,"cycleIndex":0,"unlockedRewards":[],"pendingRewards":[],"customer":{"id":"c","firstName":"Ana","isNew":false},"replayed":false}"#
        let decoded = try JSONDecoder().decode(StampResult.self, from: Data(json.utf8))
        XCTAssertNil(CardLook(decoded))
    }

    func testEveryPresetHasAGlyphInTheAssetCatalogue() {
        for name in ["coffee", "burger", "pizza", "ice-cream", "scissors", "nail", "dumbbell", "paw", "car", "heart", "star", "leaf", "gift", "check"] {
            XCTAssertNotNil(UIImage(named: "Stamps/\(name)"), name)
        }
    }
}
