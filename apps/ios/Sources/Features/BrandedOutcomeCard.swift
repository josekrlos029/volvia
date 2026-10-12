import SwiftUI

extension Color {
    init(_ rgb: CardRGB) {
        self.init(red: rgb.red, green: rgb.green, blue: rgb.blue)
    }
}

/// The scan result in the business's own colours: the person at the counter sees at a
/// glance that the stamp landed on the right card, how far along the customer is, and
/// any reward to hand over, in the accent the customer knows from their own card.
struct BrandedOutcomeCard: View {
    @EnvironmentObject private var model: AppModel
    let result: StampResult
    let look: CardLook
    let onDismiss: () -> Void

    private var foreground: Color { Color(look.foreground) }
    private var accent: Color { Color(look.accent) }
    private var onAccent: Color { Color(look.onAccent) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                badge
                VStack(alignment: .leading, spacing: 2) {
                    Text(look.cardName.uppercased())
                        .font(.system(size: 11, weight: .medium))
                        .tracking(1.4)
                        .foregroundStyle(foreground.opacity(0.7))
                        .lineLimit(1)
                    Text(result.customer.firstName)
                        .font(.system(size: 22, weight: .semibold))
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                ProgressRing(filled: look.filled, total: look.total, color: accent, track: foreground.opacity(0.18))
            }

            grid

            if let line = look.remainingLine {
                Text(line)
                    .font(.system(size: 15))
                    .foregroundStyle(foreground.opacity(0.85))
            }

            if let reward = result.unlockedRewards.first {
                VStack(alignment: .leading, spacing: 4) {
                    Text("¡Ganó \(reward.title)!")
                        .font(.system(size: 18, weight: .semibold))
                    Text("Código \(reward.code)")
                        .font(.system(size: 15))
                        .monospacedDigit()
                        .opacity(0.85)
                }
                .foregroundStyle(onAccent)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(accent, in: RoundedRectangle(cornerRadius: 14))

                Button {
                    Task { await model.redeem(grantId: reward.grantId) }
                } label: {
                    Text("Entregar ahora")
                        .font(.system(size: 16, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .foregroundStyle(onAccent)
                .background(accent, in: RoundedRectangle(cornerRadius: 12))
            } else if let pending = result.pendingRewards.first {
                Text("Tiene \(pending.title) sin recoger")
                    .font(.system(size: 15, weight: .medium))
                Button("Entregar ahora") {
                    Task { await model.redeem(grantId: pending.grantId) }
                }
                .buttonStyle(.bordered)
                .tint(foreground)
            }

            Button("Siguiente cliente", action: onDismiss)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(foreground)
                .frame(maxWidth: .infinity)
                .padding(.top, 2)
        }
        .foregroundStyle(foreground)
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(look.background), in: RoundedRectangle(cornerRadius: 18))
        .shadow(color: .black.opacity(0.25), radius: 12, y: 6)
    }

    /// The business's logo, or its initial on the accent when it has none.
    private var badge: some View {
        ZStack {
            Circle().fill(accent)
            Text(String(look.businessName.prefix(1)).uppercased())
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(onAccent)
            if let url = look.logoURL {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                        .background(.white)
                } placeholder: {
                    Color.clear
                }
                .clipShape(Circle())
            }
        }
        .frame(width: 42, height: 42)
        .accessibilityHidden(true)
    }

    /// The customer's stamps in miniature, laid out like the web card so the two agree.
    private var grid: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: look.columns)
        return LazyVGrid(columns: columns, spacing: 6) {
            ForEach(1...max(look.total, 1), id: \.self) { position in
                slot(position)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(look.filled) de \(look.total) sellos")
    }

    @ViewBuilder
    private func slot(_ position: Int) -> some View {
        let filled = position <= look.filled
        let reward = look.rewardPositions.contains(position)
        let shape = SlotShape(style: look.stampStyle)
        ZStack {
            shape.fill(filled ? accent : .clear)
            shape.strokeBorder(filled ? accent : reward ? accent.opacity(0.7) : Color(look.empty), lineWidth: 2)
            if filled {
                if let emoji = look.emoji {
                    Text(emoji).font(.system(size: 16))
                } else {
                    glyph(look.glyph ?? "Stamps/check", tint: onAccent)
                }
            } else if reward {
                glyph("Stamps/gift", tint: accent)
            }
        }
        .aspectRatio(1, contentMode: .fit)
    }

    private func glyph(_ name: String, tint: Color) -> some View {
        Image(name)
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .foregroundStyle(tint)
            // The same share of the slot as the web card's glyph.
            .scaleEffect(0.58)
    }
}

/// The slot outline the business picked: circle, rounded square or square.
private struct SlotShape: InsettableShape {
    let style: String
    var inset: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        let box = rect.insetBy(dx: inset, dy: inset)
        switch style {
        case "rounded": return RoundedRectangle(cornerRadius: box.width * 0.3).path(in: box)
        case "square": return RoundedRectangle(cornerRadius: 6).path(in: box)
        default: return Circle().path(in: box)
        }
    }

    func inset(by amount: CGFloat) -> SlotShape {
        var copy = self
        copy.inset += amount
        return copy
    }
}

/// How far through the card the customer is, as a ring with the count inside.
private struct ProgressRing: View {
    let filled: Int
    let total: Int
    let color: Color
    let track: Color

    var body: some View {
        let fraction = total > 0 ? min(1, Double(filled) / Double(total)) : 0
        ZStack {
            Circle().stroke(track, lineWidth: 4)
            Circle()
                .trim(from: 0, to: fraction)
                .stroke(color, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(filled)/\(total)")
                .font(.system(size: 13, weight: .semibold))
                .monospacedDigit()
        }
        .frame(width: 52, height: 52)
        .accessibilityLabel("\(filled) de \(total) sellos")
    }
}
