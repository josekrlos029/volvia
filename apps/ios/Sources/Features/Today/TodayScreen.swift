import SwiftUI

/// "Hoy": how the day is going, what this staff member did, and who has a birthday soon.
struct TodayScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var pulse: Loadable<Pulse> = .loading
    @State private var mine: [MyActivityItem] = []
    @State private var undoing: MyActivityItem?

    var body: some View {
        NavigationStack {
            Group {
                switch pulse {
                case .loading:
                    StatusView(kind: .loading)
                case .failed(let message):
                    StatusView(kind: .failed(message) { Task { await load() } })
                case .loaded(let pulse):
                    content(pulse)
                }
            }
            .navigationTitle("Hoy")
            .navigationDestination(for: CustomerRoute.self) { route in
                CustomerProfileView(customerId: route.id)
            }
            .refreshable { await load() }
            .task(id: model.revision) { await load() }
            .confirmationDialog(
                undoQuestion,
                isPresented: Binding(get: { undoing != nil }, set: { if !$0 { undoing = nil } }),
                titleVisibility: .visible
            ) {
                if let item = undoing {
                    Button("Quitar \(stampsWord(item.delta))", role: .destructive) {
                        Task { await model.undo(eventId: item.id, customerName: item.firstName) }
                    }
                }
                Button("Cancelar", role: .cancel) {}
            }
        }
    }

    private func content(_ pulse: Pulse) -> some View {
        List {
            Section {
                HStack(spacing: 10) {
                    MetricTile(title: "Sellos", value: "\(pulse.today.stamps)")
                    MetricTile(title: "Inscritos", value: "\(pulse.today.joins)", tint: .volviaViolet)
                    MetricTile(title: "Premios", value: "\(pulse.today.rewards)", tint: .volviaOrange)
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            Section("Mis sellos de hoy") {
                if mine.isEmpty {
                    Text("Todavía no has sellado hoy.").foregroundStyle(.secondary)
                } else {
                    ForEach(mine) { item in
                        mineRow(item)
                    }
                }
            }

            Section("Cumpleaños, próximos 14 días") {
                if pulse.birthdays.isEmpty {
                    Text("Nadie cumple años estos días.").foregroundStyle(.secondary)
                } else {
                    ForEach(pulse.birthdays) { birthday in
                        NavigationLink(value: CustomerRoute(id: birthday.customerId)) {
                            Label {
                                HStack {
                                    Text(birthday.firstName)
                                    Spacer()
                                    Text(DateText.birthday(month: birthday.month, day: birthday.day))
                                        .foregroundStyle(.secondary)
                                }
                            } icon: {
                                Image(systemName: "birthday.cake").foregroundStyle(Color.volviaOrange)
                            }
                        }
                    }
                }
            }

            Section("Actividad reciente") {
                if pulse.activity.isEmpty {
                    Text("Aún no hay movimiento.").foregroundStyle(.secondary)
                } else {
                    ForEach(Array(pulse.activity.enumerated()), id: \.offset) { _, entry in
                        NavigationLink(value: CustomerRoute(id: entry.customerId)) {
                            HStack {
                                Image(systemName: icon(entry.kind))
                                    .foregroundStyle(color(entry.kind))
                                    .frame(width: 24)
                                    .accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(entry.firstName)
                                    Text(activityLine(entry)).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(DateText.time(entry.at)).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
    }

    private func mineRow(_ item: MyActivityItem) -> some View {
        HStack(spacing: 10) {
            Image(systemName: item.kind == "redeem" ? "gift.fill" : item.kind == "void" ? "arrow.uturn.backward" : "checkmark.seal.fill")
                .foregroundStyle(item.kind == "redeem" ? Color.volviaViolet : item.kind == "void" ? .secondary : Color.volviaNavy)
                .frame(width: 24)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.firstName).font(.body.weight(.medium))
                Text(mineLine(item)).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if item.kind == "stamp" && item.canVoid {
                Button("Deshacer") { undoing = item }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            } else {
                Text(DateText.time(item.at)).font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private var undoQuestion: String {
        guard let item = undoing else { return "" }
        return "¿Quitar \(stampsWord(item.delta)) a \(item.firstName)?"
    }

    private func stampsWord(_ count: Int) -> String {
        abs(count) == 1 ? "1 sello" : "\(abs(count)) sellos"
    }

    private func mineLine(_ item: MyActivityItem) -> String {
        switch item.kind {
        case "redeem": return "Entregó \(item.rewardTitle ?? "un premio") · \(DateText.time(item.at))"
        case "void": return "Deshizo \(stampsWord(item.delta)) · \(item.cardName)"
        default: return "+\(stampsWord(item.delta)) · \(item.cardName) · \(DateText.time(item.at))"
        }
    }

    private func activityLine(_ entry: Pulse.Activity) -> String {
        switch entry.kind {
        case "join": return "Se inscribió"
        case "reward": return "Recibió un premio"
        default: return entry.count == 1 ? "1 sello" : "\(entry.count) sellos"
        }
    }

    private func icon(_ kind: String) -> String {
        switch kind {
        case "join": return "person.badge.plus"
        case "reward": return "gift.fill"
        default: return "checkmark.seal.fill"
        }
    }

    private func color(_ kind: String) -> Color {
        switch kind {
        case "join": return .volviaViolet
        case "reward": return .volviaOrange
        default: return .volviaNavy
        }
    }

    private func load() async {
        let api = model.api
        async let pulseCall = api.pulse()
        async let mineCall = api.myActivity()
        do {
            pulse = .loaded(try await pulseCall)
        } catch {
            if pulse.value == nil { pulse = .failed(model.describe(error) ?? "No disponible en tu plan.") }
        }
        mine = (try? await mineCall.items) ?? mine
    }
}

/// A customer to open, pushed from any list that names one.
struct CustomerRoute: Hashable {
    let id: String
}
