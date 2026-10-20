import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

/// The Volvia palette, the same five colours as the web.
extension Color {
    static let volviaNavy = Color(red: 0x1E / 255, green: 0x3A / 255, blue: 0x8A / 255)
    static let volviaViolet = Color(red: 0x7C / 255, green: 0x3A / 255, blue: 0xED / 255)
    static let volviaOrange = Color(red: 0xFB / 255, green: 0x92 / 255, blue: 0x3C / 255)
    static let volviaOffWhite = Color(red: 0xF8 / 255, green: 0xFA / 255, blue: 0xFC / 255)
    static let volviaInk = Color(red: 0x0F / 255, green: 0x17 / 255, blue: 0x2A / 255)
}

/// Where a screen's data stands. Every screen shows one of these three before content.
enum Loadable<Value> {
    case loading
    case failed(String)
    case loaded(Value)

    var value: Value? {
        if case .loaded(let value) = self { return value }
        return nil
    }
}

/// Loading, empty and error, in a short sentence each, with a retry where it helps.
struct StatusView: View {
    enum Kind {
        case loading
        case empty(title: String, message: String?, systemImage: String)
        case failed(String, retry: () -> Void)
    }

    let kind: Kind

    var body: some View {
        switch kind {
        case .loading:
            ProgressView("Cargando…")
                .frame(maxWidth: .infinity, minHeight: 160)
        case .empty(let title, let message, let image):
            ContentUnavailableView {
                Label(title, systemImage: image)
            } description: {
                if let message { Text(message) }
            }
        case .failed(let message, let retry):
            ContentUnavailableView {
                Label("No se pudo cargar", systemImage: "wifi.exclamationmark")
            } description: {
                Text(message)
            } actions: {
                Button("Reintentar", action: retry).buttonStyle(.bordered)
            }
        }
    }
}

/// A QR drawn on the phone, sharp at any size: no network, no image to download.
struct QRCodeView: View {
    let text: String

    var body: some View {
        if let image = Self.image(for: text) {
            Image(uiImage: image)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
                .accessibilityLabel("Código QR")
        } else {
            Color.secondary.opacity(0.2)
        }
    }

    static func image(for text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage,
              let cgImage = CIContext().createCGImage(output, from: output.extent)
        else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

/// "Disponible en el plan Negocio": what a 402 turns into.
struct PlanSheet: View {
    let gate: PlanGate
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: "sparkles")
                .font(.system(size: 28))
                .foregroundStyle(Color.volviaViolet)
                .accessibilityHidden(true)
            Text(gate.isLimit ? "Llegaste al límite de tu plan" : "Disponible en el plan \(PlanName.label(gate.plan))")
                .font(.title2.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
            Text(gate.isLimit
                 ? "Para seguir, sube al plan \(PlanName.label(gate.plan)) desde el panel web de Volvia."
                 : "Tu plan actual no incluye esta función. Puedes mejorar tu plan desde el panel web de Volvia.")
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button {
                dismiss()
            } label: {
                Text("Entendido").frame(maxWidth: .infinity).padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .tint(.volviaNavy)
        }
        .padding(24)
        .presentationDetents([.height(320), .medium])
    }
}

/// Links that open WhatsApp with the message already written.
enum WhatsApp {
    /// `https://wa.me/<digits>?text=…`; with no phone, WhatsApp asks who to send it to.
    static func url(phone: String?, text: String?) -> URL? {
        let digits = (phone ?? "").filter(\.isNumber)
        var components = URLComponents(string: "https://wa.me/\(digits)")
        if let text, !text.isEmpty {
            components?.queryItems = [URLQueryItem(name: "text", value: text)]
        }
        return components?.url
    }
}

/// Whole pesos with the thousands separator a Colombian counter expects: `$ 25.000`.
enum Money {
    static func format(_ amount: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = "."
        formatter.usesGroupingSeparator = true
        formatter.maximumFractionDigits = 0
        return "$ " + (formatter.string(from: NSNumber(value: amount)) ?? "\(amount)")
    }

    /// Digits only, as the staff member types them, back to a number.
    static func parse(_ text: String) -> Int? {
        let digits = text.filter(\.isNumber)
        return digits.isEmpty ? nil : Int(digits.prefix(12))
    }
}

/// Spanish dates the way people say them.
enum DateText {
    static func short(_ date: Date) -> String {
        date.formatted(.dateTime.day().month(.abbreviated).year().locale(Locale(identifier: "es_CO")))
    }

    static func time(_ date: Date) -> String {
        date.formatted(.dateTime.hour().minute().locale(Locale(identifier: "es_CO")))
    }

    static func relative(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "es_CO")
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    static let months = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]

    static func birthday(month: Int, day: Int) -> String {
        guard (1...12).contains(month) else { return "—" }
        return "\(day) de \(months[month - 1])"
    }
}

/// Phone numbers as the API accepts them (`phoneSchema`): `+57 300 123 4567` becomes
/// `+573001234567`. Nil for an empty field; `.invalid` for anything else that would fail.
enum PhoneNumber {
    enum Parsed: Equatable {
        case empty
        case valid(String)
        case invalid
    }

    static let defaultPrefix = "+57 "

    static func parse(_ raw: String) -> Parsed {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        // The prefilled country code alone counts as left blank.
        if trimmed.isEmpty || trimmed == "+" || trimmed == defaultPrefix.trimmingCharacters(in: .whitespaces) {
            return .empty
        }
        guard trimmed.range(of: #"^\+?[0-9(][0-9 ()./-]{5,24}$"#, options: .regularExpression) != nil else {
            return .invalid
        }
        let digits = trimmed.filter(\.isNumber)
        let normalised = trimmed.hasPrefix("+") ? "+\(digits)" : digits
        return (7...16).contains(normalised.count) ? .valid(normalised) : .invalid
    }
}

/// Screen brightness at full while a QR is up, back to what it was afterwards.
@MainActor
enum Brightness {
    private static var saved: CGFloat?

    private static var screen: UIScreen? {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first?.screen
    }

    static func max() {
        guard let screen else { return }
        if saved == nil { saved = screen.brightness }
        screen.brightness = 1
    }

    static func restore() {
        guard let screen, let saved else { return }
        screen.brightness = saved
        self.saved = nil
    }
}

/// A big number with its label, for the KPI rows.
struct MetricTile: View {
    let title: String
    let value: String
    var detail: String? = nil
    var tint: Color = .volviaNavy

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            Text(value)
                .font(.title2.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(tint)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            if let detail {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
    }
}
