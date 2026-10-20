import SwiftUI

/// One customer: their cards in their colours, what they are owed, and their history.
struct CustomerProfileView: View {
    @EnvironmentObject private var model: AppModel
    let customerId: String

    @State private var detail: Loadable<CustomerDetail> = .loading
    /// The card's look and pending rewards, by customer card id, from `/v1/lookup`.
    @State private var looks: [String: CardLookup] = [:]
    @State private var error: String?
    @State private var editing = false
    @State private var adjusting = false
    @State private var opening: String?

    var body: some View {
        Group {
            switch detail {
            case .loading:
                StatusView(kind: .loading)
            case .failed(let message):
                StatusView(kind: .failed(message) { Task { await load() } })
            case .loaded(let detail):
                content(detail)
            }
        }
        .navigationTitle(detail.value?.customer.firstName ?? "Cliente")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if model.isAdmin, let detail = detail.value {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button("Editar datos", systemImage: "pencil") { editing = true }
                        if !detail.cards.isEmpty {
                            Button("Ajustar sellos", systemImage: "plusminus") { adjusting = true }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Más acciones")
                }
            }
        }
        .sheet(isPresented: $editing) {
            if let detail = detail.value {
                EditCustomerSheet(detail: detail) { Task { await load() } }
            }
        }
        .sheet(isPresented: $adjusting) {
            if let detail = detail.value {
                AdjustStampsSheet(cards: detail.cards) {
                    model.noteChange()
                }
            }
        }
        .task(id: model.revision) { await load() }
        .refreshable { await load() }
        .alert("No se pudo", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
            Button("Entendido", role: .cancel) {}
        } message: {
            Text(error ?? "")
        }
    }

    private func content(_ detail: CustomerDetail) -> some View {
        List {
            Section { header(detail) }

            ForEach(detail.cards) { card in
                Section(card.cardName) { cardSection(card, detail: detail) }
            }

            if let notes = detail.customer.notes, !notes.trimmingCharacters(in: .whitespaces).isEmpty {
                Section("Notas") { Text(notes) }
            }

            Section("Visitas") {
                if detail.activity.isEmpty {
                    Text("Sin visitas todavía.").foregroundStyle(.secondary)
                } else {
                    ForEach(detail.activity.prefix(30)) { event in
                        HStack {
                            Text(event.delta > 0 ? "+\(event.delta)" : "\(event.delta)")
                                .font(.body.monospacedDigit().weight(.semibold))
                                .foregroundStyle(event.delta > 0 ? Color.volviaNavy : .red)
                                .frame(width: 40, alignment: .leading)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(sourceLabel(event.source))
                                Text(DateText.short(event.occurredAt) + " · " + DateText.time(event.occurredAt))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let count = event.resultingCount {
                                Text("\(count)").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }

            Section("Premios") {
                if detail.rewards.isEmpty {
                    Text("Todavía no ha ganado premios.").foregroundStyle(.secondary)
                } else {
                    ForEach(detail.rewards) { reward in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(reward.title)
                                Text("Código \(reward.code) · \(DateText.short(reward.grantedAt))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(rewardStatus(reward.status))
                                .font(.caption.weight(.medium))
                                .foregroundStyle(reward.status == "pending" ? Color.volviaViolet : .secondary)
                        }
                    }
                }
            }
        }
    }

    private func header(_ detail: CustomerDetail) -> some View {
        let customer = detail.customer
        return VStack(alignment: .leading, spacing: 10) {
            Text(customer.firstName).font(.title2.weight(.semibold))
            VStack(alignment: .leading, spacing: 4) {
                if let phone = customer.phone, !phone.isEmpty {
                    Label(phone, systemImage: "phone")
                }
                if let email = customer.email, !email.isEmpty {
                    Label(email, systemImage: "envelope")
                }
                Label("Cliente desde \(DateText.short(customer.joinedAt))", systemImage: "calendar")
                if let month = customer.birthdayMonth, let day = customer.birthdayDay {
                    Label("Cumple el \(DateText.birthday(month: month, day: day))", systemImage: "birthday.cake")
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)

            HStack(spacing: 10) {
                if let url = whatsAppURL(detail, text: nil) {
                    Link(destination: url) {
                        Label("WhatsApp", systemImage: "message.fill").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
                if let url = resendURL(detail) {
                    Link(destination: url) {
                        Label("Reenviar tarjeta", systemImage: "paperplane").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(.top, 4)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func cardSection(_ card: CustomerDetail.Card, detail: CustomerDetail) -> some View {
        if let lookup = looks[card.id] {
            let look = CardLook(lookup)
            CardFace(look: look, customerName: detail.customer.firstName, compact: true)
                .padding(14)
                .background(Color(look.background), in: RoundedRectangle(cornerRadius: 16))
                .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))

            ForEach(lookup.pendingRewards) { reward in
                HStack {
                    Image(systemName: "gift.fill").foregroundStyle(Color.volviaViolet).accessibilityHidden(true)
                    VStack(alignment: .leading) {
                        Text(reward.title)
                        Text("Código \(reward.code)").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Canjear") {
                        Task { await model.redeem(grantId: reward.grantId) }
                    }
                    .buttonStyle(.bordered)
                    .tint(.volviaViolet)
                }
            }
        } else {
            HStack {
                Text("\(card.stampsCount) de \(card.stampsRequired) sellos").monospacedDigit()
                Spacer()
                if card.status != "active" { Text("Bloqueada").foregroundStyle(.secondary) }
            }
        }

        if card.status == "active" {
            Button {
                Task {
                    opening = card.id
                    error = await model.openPreview(customerCardId: card.id)
                    opening = nil
                }
            } label: {
                Label(opening == card.id ? "Abriendo…" : "Sumar sello", systemImage: "plus.circle.fill")
                    .font(.body.weight(.semibold))
            }
            .disabled(opening != nil)
        }
    }

    // MARK: - Links

    private func whatsAppURL(_ detail: CustomerDetail, text: String?) -> URL? {
        // A masked number (plan without contact details) cannot be dialled.
        guard detail.masked != true, let phone = detail.customer.phone, phone.contains(where: \.isNumber),
              !phone.contains("*")
        else { return nil }
        return WhatsApp.url(phone: phone, text: text)
    }

    /// "Reenviar tarjeta": the card link (`PASS_URL/c/<token>`) in a WhatsApp message.
    private func resendURL(_ detail: CustomerDetail) -> URL? {
        guard let card = detail.cards.first(where: { $0.status == "active" }) ?? detail.cards.first,
              let token = card.token ?? looks[card.id]?.cardToken,
              let base = model.org?.passBaseURL
        else { return nil }
        let link = "\(base)/c/\(token)"
        let business = model.org?.name ?? ""
        let text = "¡Hola \(detail.customer.firstName)! Esta es tu tarjeta de \(business): \(link)"
        if detail.masked != true, let phone = detail.customer.phone, !phone.contains("*") {
            return WhatsApp.url(phone: phone, text: text)
        }
        return WhatsApp.url(phone: nil, text: text)
    }

    private func sourceLabel(_ source: String) -> String {
        switch source {
        case "staff_scan": return "Sello en mostrador"
        case "kiosk": return "Sello en kiosko"
        case "manual": return "Ajuste manual"
        case "import": return "Importado"
        case "campaign": return "Campaña"
        case "signup_bonus": return "Bono de bienvenida"
        case "void": return "Sello deshecho"
        default: return source
        }
    }

    private func rewardStatus(_ status: String) -> String {
        switch status {
        case "pending": return "Por entregar"
        case "redeemed": return "Entregado"
        case "expired": return "Vencido"
        case "revoked": return "Anulado"
        default: return status
        }
    }

    private func load() async {
        do {
            let fresh = try await model.api.customer(id: customerId)
            detail = .loaded(fresh)
            let api = model.api
            var found: [String: CardLookup] = [:]
            await withTaskGroup(of: (String, CardLookup?).self) { group in
                for card in fresh.cards {
                    group.addTask { (card.id, try? await api.lookup(customerCardId: card.id)) }
                }
                for await (id, lookup) in group {
                    if let lookup { found[id] = lookup }
                }
            }
            looks = found
        } catch {
            if detail.value == nil { detail = .failed(model.describe(error) ?? "No disponible en tu plan.") }
        }
    }
}
