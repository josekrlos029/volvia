import XCTest
@testable import VolviaBiz

/// The queue is the part of this app that can lose somebody's stamp, so it is the part
/// worth testing hardest. Every case here happened at a real counter: no signal, a flaky
/// connection, a server that already had the stamp, a card that no longer exists.
@MainActor
final class StampQueueTests: XCTestCase {
    private var queue: StampQueue!
    private var fileName: String!

    override func setUp() async throws {
        fileName = "test-\(UUID().uuidString).json"
        queue = StampQueue(fileName: fileName)
    }

    override func tearDown() async throws {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.removeItem(at: support.appendingPathComponent(fileName))
    }

    private func result() -> StampResult {
        StampResult(
            stampsAdded: 1,
            stampsCount: 3,
            stampsRequired: 10,
            cycleIndex: 0,
            unlockedRewards: [],
            pendingRewards: [],
            customer: StampCustomer(id: UUID().uuidString, firstName: "María", isNew: false),
            replayed: false
        )
    }

    func testEveryStampCarriesItsOwnIdempotencyKey() {
        // Two scans of the same card must not collapse into one on the server.
        let first = PendingStamp(cardToken: "token-one")
        let second = PendingStamp(cardToken: "token-one")
        XCTAssertNotEqual(first.idempotencyKey, second.idempotencyKey)
    }

    func testSendsEverythingWhenTheNetworkIsBack() async {
        queue.enqueue(PendingStamp(cardToken: "a"))
        queue.enqueue(PendingStamp(cardToken: "b"))

        await queue.flush { _ in .success(self.result()) }

        XCTAssertTrue(queue.pending.isEmpty)
    }

    func testKeepsTheStampWhenThereIsNoSignal() async {
        queue.enqueue(PendingStamp(cardToken: "a"))

        await queue.flush { _ in .failure(.offline) }

        // Still there, and the attempt was counted.
        XCTAssertEqual(queue.pending.count, 1)
        XCTAssertEqual(queue.pending.first?.attempts, 1)
    }

    func testStopsAtTheFirstFailureInsteadOfBurningThroughTheRest() async {
        for token in ["a", "b", "c"] { queue.enqueue(PendingStamp(cardToken: token)) }

        var attempts = 0
        await queue.flush { _ in
            attempts += 1
            return .failure(.offline)
        }

        // One call, not three: the network is down, the other two would fail the same.
        XCTAssertEqual(attempts, 1)
        XCTAssertEqual(queue.pending.count, 3)
    }

    func testDropsAStampTheServerAlreadyHas() async {
        queue.enqueue(PendingStamp(cardToken: "a"))

        await queue.flush { _ in
            .failure(APIError(status: 409, code: "CONFLICT", message: "ya aplicado"))
        }

        // Replaying an idempotency key is the server saying "I have it", not an error.
        XCTAssertTrue(queue.pending.isEmpty)
        XCTAssertTrue(queue.rejected.isEmpty)
    }

    func testRemembersARejectionInsteadOfDeletingItQuietly() async {
        queue.enqueue(PendingStamp(cardToken: "a"))

        await queue.flush { _ in
            .failure(APIError(status: 404, code: "CUSTOMER_CARD_NOT_FOUND", message: "no existe"))
        }

        XCTAssertTrue(queue.pending.isEmpty)
        // Somebody took this stamp from a real customer; they get told it did not land.
        XCTAssertEqual(queue.rejected.count, 1)
    }

    func testGivesUpAfterEnoughFailedAttempts() async {
        queue.enqueue(PendingStamp(cardToken: "a"))

        for _ in 0..<8 {
            await queue.flush { _ in .failure(.offline) }
        }

        XCTAssertTrue(queue.pending.isEmpty)
        XCTAssertEqual(queue.rejected.count, 1)
    }

    func testSurvivesTheAppBeingClosed() async {
        queue.enqueue(PendingStamp(cardToken: "survives"))

        // A staff phone gets killed by iOS all the time. The stamp has to still be here.
        let reopened = StampQueue(fileName: fileName)
        XCTAssertEqual(reopened.pending.count, 1)
        XCTAssertEqual(reopened.pending.first?.cardToken, "survives")
    }

    func testTakesOneOutWhenItsScanSucceededImmediately() {
        let stamp = PendingStamp(cardToken: "a")
        queue.enqueue(stamp)
        queue.enqueue(PendingStamp(cardToken: "b"))

        queue.remove(stamp.id)

        XCTAssertEqual(queue.pending.count, 1)
        XCTAssertEqual(queue.pending.first?.cardToken, "b")
    }
}
