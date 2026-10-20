import SwiftUI

/// One-off notices to the wallet passes: the list, this month's usage and a composer.
struct MessagesScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var list: Loadable<MessageList> = .loading
    @State private var composing = false
    @State private var cancelling: OutboundMessage?

    var body: some View {
        Group {
            switch list {
            case .loading:
                StatusView(kind: .loading)
            case .failed(let message):
                StatusView(kind: .failed(message) { Task { await load() } })
            case .loaded(let list):
                content(list)
            }
        }
        .navigationTitle("Mensajes")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    composing = true
                } label: {
                    Label("Nuevo", systemImage: "square.and.pencil")
                }
                .accessibilityLabel("Nuevo mensaje")
                .disabled(list.value == nil || list.value?.thisMonth.remaining == 0)
            }
        }
        .sheet(isPresented: $composing) {
            MessageComposer(remaining: list.value?.thisMonth.remaining) { Task { await load() } }
        }
        .confirmationDialog(
            "¿Cancelar este mensaje?",
            isPresented: Binding(get: { cancelling != nil }, set: { if !$0 { cancelling = nil } }),
            titleVisibility: .visible
        ) {
            Button("Cancelar envío", role: .destructive) {
                if let message = cancelling { Task { await cancel(message) } }
            }
            Button("No", role: .cancel) {}
        }
        .refreshable { await load() }
        .task { await load() }
    }

    private func content(_ list: MessageList) -> some View {
        List {
            Section {
                usage(list.thisMonth, noun: "mensajes")
            }
            Section("Enviados") {
                if list.messages.isEmpty {
                    Text("Aún no has enviado mensajes.").foregroundStyle(.secondary)
                } else {
                    ForEach(list.messages) { message in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(message.headline).font(.body.weight(.medium))
                                Spacer()
                                StatusBadge(status: message.status)
                            }
                            Text(message.body).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                            Text(line(message)).font(.caption).foregroundStyle(.secondary)
                        }
                        .swipeActions {
                            if message.status == "scheduled" || message.status == "draft" {
                                Button("Cancelar", role: .destructive) { cancelling = message }
                            }
                        }
                    }
                }
            }
        }
    }

    private func line(_ message: OutboundMessage) -> String {
        if let sent = message.sentAt {
            return "\(DateText.short(sent)) · llegó a \(message.deliveredCount) de \(message.targetedCount)"
        }
        if let scheduled = message.scheduledAt { return "Programado para \(DateText.short(scheduled))" }
        return DateText.short(message.createdAt)
    }

    private func load() async {
        do {
            list = .loaded(try await model.api.messages())
        } catch {
            list = .failed(model.describe(error) ?? "Los mensajes no están en tu plan.")
        }
    }

    private func cancel(_ message: OutboundMessage) async {
        do {
            _ = try await model.api.cancelMessage(id: message.id)
            await load()
        } catch {
            list = .failed(model.describe(error) ?? "")
        }
    }
}

/// "2 de 4 este mes", or unlimited.
@ViewBuilder
func usage(_ usage: MonthlyUsage, noun: String) -> some View {
    if let limit = usage.limit {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(usage.used) de \(limit) \(noun) este mes").font(.subheadline.weight(.medium))
            ProgressView(value: Double(min(usage.used, limit)), total: Double(max(limit, 1)))
                .tint(usage.used >= limit ? .volviaOrange : .volviaNavy)
        }
    } else {
        Text("\(usage.used) \(noun) este mes · sin límite").font(.subheadline.weight(.medium))
    }
}

struct StatusBadge: View {
    let status: String

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }

    private var label: String {
        switch status {
        case "draft": return "Borrador"
        case "scheduled": return "Programado"
        case "sending": return "Enviando"
        case "sent": return "Enviado"
        case "failed": return "Falló"
        case "running": return "Activa"
        case "finished": return "Terminada"
        case "cancelled": return "Cancelada"
        default: return status
        }
    }

    private var color: Color {
        switch status {
        case "sent", "running": return .green
        case "failed": return .red
        case "scheduled", "sending": return .volviaViolet
        default: return .secondary
        }
    }
}

/// Picking who a message or a campaign goes to: everyone, or one of the segments.
struct AudiencePicker: View {
    @EnvironmentObject private var model: AppModel
    @Binding var audience: Audience
    @State private var segments: SegmentList?

    /// `all`, `suggested:<key>` or `custom:<id>`.
    private var selection: Binding<String> {
        Binding(
            get: {
                if let key = audience.suggested { return "suggested:\(key)" }
                if let id = audience.segmentId { return "custom:\(id)" }
                return audience.segment == "all" ? "all" : "segment:\(audience.segment)"
            },
            set: { value in
                let parts = value.split(separator: ":", maxSplits: 1).map(String.init)
                var next = Audience()
                switch parts.first {
                case "suggested": next.suggested = parts.last
                case "custom": next.segmentId = parts.last
                case "segment": next.segment = parts.last ?? "all"
                default: break
                }
                audience = next
            }
        )
    }

    static func segmentLabel(_ segment: String) -> String {
        switch segment {
        case "regulars": return "Habituales"
        case "returning": return "Vuelven"
        case "new": return "Nuevos"
        case "missing": return "Se alejan"
        case "lost": return "Perdidos"
        case "cold": return "Fríos"
        case "recurring": return "Recurrentes"
        case "birthday_month": return "Cumplen este mes"
        default: return "Segmento de la plantilla"
        }
    }

    var body: some View {
        Picker("Para", selection: selection) {
            Text("Todos los clientes").tag("all")
            if audience.segment != "all" {
                Text(Self.segmentLabel(audience.segment)).tag("segment:\(audience.segment)")
            }
            if let segments {
                ForEach(segments.suggested) { item in
                    Text("\(item.name) (\(item.count))").tag("suggested:\(item.key)")
                }
                ForEach(segments.segments) { item in
                    Text(item.name).tag("custom:\(item.id)")
                }
            }
        }
        .task {
            if segments == nil { segments = try? await model.api.segments() }
        }
    }
}

struct MessageComposer: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let remaining: Int?
    let onSent: () -> Void

    @State private var headline = ""
    @State private var text = ""
    @State private var audience = Audience()
    @State private var reach: AudiencePreview?
    @State private var confirming = false
    @State private var error: String?
    @State private var isWorking = false

    private var valid: Bool {
        let h = headline.trimmingCharacters(in: .whitespacesAndNewlines)
        let b = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return (2...60).contains(h.count) && (2...240).contains(b.count) && (reach?.size ?? 0) > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Título", text: $headline)
                        .onChange(of: headline) { _, value in if value.count > 60 { headline = String(value.prefix(60)) } }
                    TextField("Mensaje", text: $text, axis: .vertical)
                        .lineLimit(3...6)
                        .onChange(of: text) { _, value in if value.count > 240 { text = String(value.prefix(240)) } }
                } header: {
                    Text("Qué dice")
                } footer: {
                    Text("Título \(headline.count)/60 · mensaje \(text.count)/240. Llega como aviso a la tarjeta en el Wallet.")
                }

                Section {
                    AudiencePicker(audience: $audience)
                } header: {
                    Text("A quién")
                } footer: {
                    if let reach {
                        Text(reach.size == 0
                             ? "Nadie en este grupo aceptó recibir novedades."
                             : "Llega a \(reach.size) \(reach.size == 1 ? "cliente" : "clientes")\(reach.withWallet.map { ", \($0) con la tarjeta en el móvil" } ?? "").")
                    } else {
                        Text("Calculando a cuántos les llega…")
                    }
                }

                if let remaining {
                    Section { Text("Te quedan \(remaining) mensajes este mes.").foregroundStyle(.secondary) }
                }

                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Nuevo mensaje")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isWorking ? "Enviando…" : "Enviar") { confirming = true }
                        .disabled(!valid || isWorking)
                }
            }
            .task(id: audience) { await preview() }
            .confirmationDialog(
                "¿Enviar a \(reach?.size ?? 0) \((reach?.size ?? 0) == 1 ? "cliente" : "clientes")?",
                isPresented: $confirming,
                titleVisibility: .visible
            ) {
                Button("Enviar ahora") { Task { await send() } }
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("No se puede deshacer una vez enviado.")
            }
        }
    }

    private func preview() async {
        reach = nil
        do {
            reach = try await model.api.previewMessage(audience)
        } catch {
            self.error = model.describe(error)
        }
    }

    private func send() async {
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await model.api.sendMessage(
                headline: headline.trimmingCharacters(in: .whitespacesAndNewlines),
                body: text.trimmingCharacters(in: .whitespacesAndNewlines),
                audience: audience
            )
            Haptics.success()
            onSent()
            dismiss()
        } catch {
            self.error = model.describe(error)
        }
    }
}
