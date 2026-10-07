import Foundation

/// A stamp that was taken from a real customer and has not reached the server yet.
struct PendingStamp: Codable, Sendable, Hashable, Identifiable {
    let id: UUID
    let cardToken: String
    let count: Int
    /// Generated once, at the counter, and reused on every retry. It is what makes a
    /// retry safe: the server replays the original result instead of stamping twice.
    let idempotencyKey: String
    /// When it really happened, so a stamp sent two hours later is not counted at the
    /// wrong hour in the business's analytics.
    let occurredAt: Date
    var attempts: Int

    init(cardToken: String, count: Int = 1, occurredAt: Date = Date()) {
        self.id = UUID()
        self.cardToken = cardToken
        self.count = count
        self.idempotencyKey = "ios-\(UUID().uuidString)"
        self.occurredAt = occurredAt
        self.attempts = 0
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
