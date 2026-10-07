import Foundation

/// Pulls the card token out of whatever the camera read.
///
/// The QR on a customer's phone encodes the full card URL. Parsing it here rather than
/// at the call site means a staff member can also scan a printed link, a shortened one
/// with a query string, or paste a token by hand, and all three behave the same.
enum CardToken {
    /// Tokens are 32 url-safe characters; anything shorter is a different QR entirely.
    static let minimumLength = 16

    static func parse(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let candidate: String
        if let url = URL(string: trimmed), url.scheme != nil {
            // .../c/<token> — the last path segment, query string discarded.
            candidate = url.pathComponents.last ?? ""
        } else {
            candidate = trimmed.split(separator: "/").last.map(String.init) ?? trimmed
        }

        let token = candidate.split(separator: "?").first.map(String.init) ?? candidate
        guard token.count >= minimumLength else { return nil }
        guard token.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
            return nil
        }
        return token
    }
}
