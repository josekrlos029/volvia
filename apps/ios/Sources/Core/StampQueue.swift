import Foundation

/// A stamp that was taken from a real customer and has not reached the server yet.
///
/// Files written by 1.1 carry only the token, the count and the bookkeeping; every field
/// added in 1.2 is optional so those stamps still load and still go out.
struct PendingStamp: Codable, Sendable, Hashable, Identifiable {
    let id: UUID
    /// The scanned card. Nil only when the stamp was taken from a customer's profile,
    /// where the card is known by its id instead.
    let cardToken: String?
    let count: Int
    /// Generated once, at the counter, and reused on every retry. It is what makes a
    /// retry safe: the server replays the original result instead of stamping twice.
    let idempotencyKey: String
    /// When it really happened, so a stamp sent two hours later is not counted at the
    /// wrong hour in the business's analytics.
    let occurredAt: Date
    var attempts: Int
    /// The customer card's id, when the staff member picked the customer from the list.
    let customerCardId: String?
    /// Whole pesos, for a card that only stamps above a minimum spend.
    let purchaseAmount: Int?
    let note: String?
    /// The location the phone was at when the stamp was taken, not when it was sent.
    let locationId: String?

    init(
        cardToken: String?,
        customerCardId: String? = nil,
        count: Int = 1,
        purchaseAmount: Int? = nil,
        note: String? = nil,
        locationId: String? = nil,
        occurredAt: Date = Date()
    ) {
        self.id = UUID()
        self.cardToken = cardToken
        self.customerCardId = customerCardId
        self.count = count
        self.purchaseAmount = purchaseAmount
        self.note = note
        self.locationId = locationId
        self.idempotencyKey = "ios-\(UUID().uuidString)"
        self.occurredAt = occurredAt
        self.attempts = 0
    }

    /// The `/v1/stamp` body. The token wins when both references are known: it is what
    /// the camera read, and it works even if the id was mistyped by a fixture.
    var requestBody: [String: Any] {
        var body: [String: Any] = [
            "count": count,
            "idempotencyKey": idempotencyKey,
            "occurredAt": ISO8601DateFormatter().string(from: occurredAt),
        ]
        if let cardToken {
            body["cardToken"] = cardToken
        } else if let customerCardId {
            body["customerCardId"] = customerCardId
        }
        if let purchaseAmount { body["purchaseAmount"] = purchaseAmount }
        if let note, !note.isEmpty { body["note"] = note }
        if let locationId { body["locationId"] = locationId }
        return body
    }
}

/// The offline queue.
///
/// The counter does not stop when the wifi does. A stamp is written here first and sent
/// afterwards, so the answer a staff member sees never depends on the network — and the
/// customer, who is standing right there, is never asked to wait or come back.
@MainActor
final class StampQueue: ObservableObject {
    @Published private(set) var pending: [PendingStamp] = []
    @Published private(set) var isFlushing = false
    /// Stamps the server refused for good: kept visible rather than deleted in silence.
    @Published private(set) var rejected: [(stamp: PendingStamp, reason: String)] = []

    private let fileURL: URL
    private let maximumAttempts = 8

    init(fileName: String = "pending-stamps.json") {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        fileURL = support.appendingPathComponent(fileName)
        load()
    }

    func enqueue(_ stamp: PendingStamp) {
        pending.append(stamp)
        persist()
    }

    /// Sends everything waiting, oldest first, and stops at the first transient failure.
    ///
    /// Stopping matters: if the network is down, trying the other forty only burns
    /// battery and makes the log harder to read.
    func flush(using send: (PendingStamp) async -> Result<StampResult, APIError>) async {
        guard !isFlushing, !pending.isEmpty else { return }
        isFlushing = true
        defer { isFlushing = false }

        while let next = pending.first {
            switch await send(next) {
            case .success:
                pending.removeFirst()
                persist()

            case .failure(let error) where error.isTransient:
                // Still worth trying later. Count the attempt and leave it in place.
                pending[0].attempts += 1
                if pending[0].attempts >= maximumAttempts {
                    reject(pending.removeFirst(), reason: error.message)
                }
                persist()
                return

            case .failure(let error) where error.isAlreadyApplied:
                // The server has it. Nothing left to do.
                pending.removeFirst()
                persist()

            case .failure(let error):
                reject(pending.removeFirst(), reason: error.message)
                persist()
            }
        }
    }

    /// Takes one entry out by identity: the scan it belongs to already succeeded.
    func removeMatching(_ id: UUID) {
        guard let index = pending.firstIndex(where: { $0.id == id }) else { return }
        pending.remove(at: index)
        persist()
    }

    func clearRejected() {
        rejected.removeAll()
    }

    /// Drops everything, sent or not. Only the simulator fixtures call this: on a real
    /// phone a pending stamp belongs to a customer and is never discarded wholesale.
    func removeAll() {
        pending.removeAll()
        rejected.removeAll()
        persist()
    }

    private func reject(_ stamp: PendingStamp, reason: String) {
        rejected.append((stamp, reason))
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let stored = try? JSONDecoder().decode([PendingStamp].self, from: data)
        else { return }
        pending = stored
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(pending) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }
}
