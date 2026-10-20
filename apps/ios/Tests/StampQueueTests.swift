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

/// 1.2 added the amount, the note, the location and the customer card id to a queued
/// stamp. A phone that updates with stamps still waiting must send them all the same.
@MainActor
final class StampQueueMigrationTests: XCTestCase {
    private var fileName: String!
    private var fileURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(fileName)
    }

    override func setUp() async throws {
        fileName = "migration-\(UUID().uuidString).json"
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
        )
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: fileURL)
    }

    func testReadsAFileWrittenBy11() throws {
        // Exactly what 1.1's JSONEncoder wrote: no 1.2 keys, the date as seconds since 2001.
        let legacy = """
        [{"id":"6F1C2E2A-3A43-4C55-9E0B-0D7C8E0B1A11","cardToken":"DAAhsNXnnW5ZCHA9rKVHMke7m0B7mVaE",\
        "count":1,"idempotencyKey":"ios-legacy-0001","occurredAt":782000000,"attempts":2}]
        """
        try Data(legacy.utf8).write(to: fileURL)

        let queue = StampQueue(fileName: fileName)

        XCTAssertEqual(queue.pending.count, 1)
        let stamp = try XCTUnwrap(queue.pending.first)
        XCTAssertEqual(stamp.cardToken, "DAAhsNXnnW5ZCHA9rKVHMke7m0B7mVaE")
        XCTAssertEqual(stamp.idempotencyKey, "ios-legacy-0001")
        XCTAssertEqual(stamp.attempts, 2)
        XCTAssertNil(stamp.customerCardId)
        XCTAssertNil(stamp.purchaseAmount)
        XCTAssertNil(stamp.note)
        XCTAssertNil(stamp.locationId)
    }

    func testALegacyStampStillSendsTheSameBody() throws {
        let legacy = """
        [{"id":"6F1C2E2A-3A43-4C55-9E0B-0D7C8E0B1A11","cardToken":"DAAhsNXnnW5ZCHA9rKVHMke7m0B7mVaE",\
        "count":1,"idempotencyKey":"ios-legacy-0001","occurredAt":782000000,"attempts":0}]
        """
        try Data(legacy.utf8).write(to: fileURL)
        let body = try XCTUnwrap(StampQueue(fileName: fileName).pending.first).requestBody

        XCTAssertEqual(body["cardToken"] as? String, "DAAhsNXnnW5ZCHA9rKVHMke7m0B7mVaE")
        XCTAssertEqual(body["idempotencyKey"] as? String, "ios-legacy-0001")
        XCTAssertEqual(body["count"] as? Int, 1)
        XCTAssertNotNil(body["occurredAt"] as? String)
        XCTAssertNil(body["purchaseAmount"])
        XCTAssertNil(body["note"])
        XCTAssertNil(body["locationId"])
        XCTAssertNil(body["customerCardId"])
    }

    func testKeepsEveryNewFieldAcrossARelaunch() {
        let queue = StampQueue(fileName: fileName)
        queue.enqueue(PendingStamp(
            cardToken: "DAAhsNXnnW5ZCHA9rKVHMke7m0B7mVaE",
            customerCardId: "295fdf4b-a8d4-412e-ab22-125842480b47",
            count: 3,
            purchaseAmount: 25_000,
            note: "pagó con tarjeta",
            locationId: "93f31c0c-8dcf-4acb-8c51-7d50089c2cfc"
        ))

        let stamp = StampQueue(fileName: fileName).pending.first
        XCTAssertEqual(stamp?.count, 3)
        XCTAssertEqual(stamp?.purchaseAmount, 25_000)
        XCTAssertEqual(stamp?.note, "pagó con tarjeta")
        XCTAssertEqual(stamp?.locationId, "93f31c0c-8dcf-4acb-8c51-7d50089c2cfc")
        XCTAssertEqual(stamp?.customerCardId, "295fdf4b-a8d4-412e-ab22-125842480b47")
    }

    func testSendsTheAmountNoteAndLocation() {
        let body = PendingStamp(
            cardToken: "DAAhsNXnnW5ZCHA9rKVHMke7m0B7mVaE",
            count: 2,
            purchaseAmount: 18_500,
            note: "mesa 4",
            locationId: "93f31c0c-8dcf-4acb-8c51-7d50089c2cfc"
        ).requestBody

        XCTAssertEqual(body["count"] as? Int, 2)
        XCTAssertEqual(body["purchaseAmount"] as? Int, 18_500)
        XCTAssertEqual(body["note"] as? String, "mesa 4")
        XCTAssertEqual(body["locationId"] as? String, "93f31c0c-8dcf-4acb-8c51-7d50089c2cfc")
    }

    func testAStampFromAProfileGoesByCustomerCardId() {
        // Picked from the customer list: there is no scanned token, only the card's id.
        let body = PendingStamp(cardToken: nil, customerCardId: "295fdf4b-a8d4-412e-ab22-125842480b47").requestBody
        XCTAssertNil(body["cardToken"])
        XCTAssertEqual(body["customerCardId"] as? String, "295fdf4b-a8d4-412e-ab22-125842480b47")
    }

    func testAnEmptyNoteIsNotSent() {
        let body = PendingStamp(cardToken: "DAAhsNXnnW5ZCHA9rKVHMke7m0B7mVaE", note: "").requestBody
        XCTAssertNil(body["note"])
    }

    func testACooldownIsRejectedAtOnceInsteadOfRetried() async {
        let queue = StampQueue(fileName: fileName)
        queue.enqueue(PendingStamp(cardToken: "a"))

        await queue.flush { _ in
            .failure(APIError(status: 429, code: "STAMP_COOLDOWN_ACTIVE", message: "Ya recibió sello hace poco."))
        }

        // A business refusal, not a busy server: it is shown, not kept for later.
        XCTAssertTrue(queue.pending.isEmpty)
        XCTAssertEqual(queue.rejected.first?.reason, "Ya recibió sello hace poco.")
    }
}
