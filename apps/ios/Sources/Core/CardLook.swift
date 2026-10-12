import Foundation

/// A colour as the API sends it (`#RRGGBB`), in 0…1 components.
struct CardRGB: Hashable, Sendable {
    let red: Double
    let green: Double
    let blue: Double

    /// `#RRGGBB` or `#RGB`; black when it does not parse.
    init(hex: String) {
        var value = hex.trimmingCharacters(in: .whitespaces)
        if value.hasPrefix("#") { value.removeFirst() }
        if value.count == 3 { value = value.map { "\($0)\($0)" }.joined() }
        let int = value.count == 6 ? UInt32(value, radix: 16) ?? 0 : 0
        red = Double((int >> 16) & 0xFF) / 255
        green = Double((int >> 8) & 0xFF) / 255
        blue = Double(int & 0xFF) / 255
    }

    /// WCAG relative luminance, the same maths as `packages/shared/src/color.ts`.
    var luminance: Double {
        func channel(_ c: Double) -> Double { c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
    }

    func contrast(with other: CardRGB) -> Double {
        let a = luminance, b = other.luminance
        return (max(a, b) + 0.05) / (min(a, b) + 0.05)
    }

    /// Whichever candidate reads best on this colour.
    func readable(among candidates: [CardRGB]) -> CardRGB {
        candidates.max { contrast(with: $0) < contrast(with: $1) } ?? CardRGB(hex: "#000000")
    }
}

/// The stamped card, in the business's colours, ready to draw.
///
/// The decisions — which colour the mark takes, how full the grid is, what is left —
/// live here rather than in the view, so a unit test can check them.
struct CardLook: Hashable, Sendable {
    let businessName: String
    let cardName: String
    let logoURL: URL?
    let background: CardRGB
    let foreground: CardRGB
    let accent: CardRGB
    let empty: CardRGB
    /// The mark inside a filled slot, and text on the accent.
    let onAccent: CardRGB
    let stampStyle: String
    /// The asset name of a preset glyph (`Stamps/coffee`), nil for an emoji or a picture.
    let glyph: String?
    let emoji: String?
    let filled: Int
    let total: Int
    let rewardPositions: [Int]
    /// "Le faltan 3 para Café gratis"; nil once the scan unlocked something.
    let remainingLine: String?

    /// Columns that fill every row, the same choice as the web grid.
    var columns: Int {
        if total <= 6 { return max(total, 1) }
        return [6, 5, 4, 3].first { total % $0 == 0 } ?? 5
    }

    init?(_ result: StampResult) {
        guard let design = result.design else { return nil }
        let unlocked = !result.unlockedRewards.isEmpty
        // Completing the card starts a new cycle at 0 on the server; an empty grid next to
        // "¡Ganó…!" reads like the stamp was lost, so show it full.
        let shown = unlocked && result.stampsCount == 0 ? result.stampsRequired : result.stampsCount

        businessName = design.businessName
        cardName = design.cardName
        logoURL = design.logoUrl.flatMap(URL.init(string:))
        background = CardRGB(hex: design.backgroundColor)
        foreground = CardRGB(hex: design.foregroundColor)
        accent = CardRGB(hex: design.accentColor)
        empty = CardRGB(hex: design.emptyStampColor)
        onAccent = accent.readable(among: [background, foreground])
        stampStyle = design.stampStyle
        glyph = design.stampIcon.kind == "preset" ? "Stamps/\(design.stampIcon.value)" : nil
        emoji = design.stampIcon.kind == "emoji" ? design.stampIcon.value : nil
        filled = shown
        total = result.stampsRequired
        rewardPositions = design.rewardPositions

        if !unlocked, let next = design.nextReward, next.atStamp > shown {
            let left = next.atStamp - shown
            remainingLine = left == 1 ? "Le falta 1 para \(next.title)" : "Le faltan \(left) para \(next.title)"
        } else {
            remainingLine = nil
        }
    }
}
