import SwiftUI

/// The scanned card before anything is added to it.
///
/// Opens when "Sellado rápido" is off, when the card only stamps above a minimum spend,
/// and from a customer's profile. Everything the staff member might need to decide is
/// here: who it is, where the card stands, rewards waiting, how many stamps, the amount.
struct StampPreviewSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let preview: StampPreview

    @State private var count = 1
    @State private var amountText = ""
    @State private var note = ""
    @State private var error: String?
    @State private var isWorking = false
    @State private var delivered: Set<String> = []
    @State private var delivering: String?

    private var lookup: CardLookup { preview.lookup }
    private var amount: Int? { Money.parse(amountText) }
    private var minimum: Int { lookup.card.minSpendAmount ?? 0 }

    private var amountProblem: String? {
        guard lookup.requiresAmount else { return nil }
        guard let amount else { return "Escribe el monto para poder sellar." }
        return amount < minimum ? "No alcanza el mínimo de \(Money.format(minimum))." : nil
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    CardFace(look: CardLook(lookup), customerName: lookup.customer.firstName)
                        .padding(18)
                        .background(Color(CardLook(lookup).background), in: RoundedRectangle(cornerRadius: 18))

                    if lookup.cooldownSecondsLeft > 0 {
                        Label(waitLine, systemImage: "clock")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Color.volviaOrange)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    if !lookup.pendingRewards.isEmpty { rewards }

                    if lookup.card.maxStampsPerScan > 1 { countControl }

                    if lookup.requiresAmount { amountField }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Nota (opcional)").font(.subheadline.weight(.medium))
                        TextField("Ej.: pagó con tarjeta", text: $note, axis: .vertical)
                            .lineLimit(1...3)
                            .textFieldStyle(.roundedBorder)
                            .onChange(of: note) { _, value in
                                if value.count > 200 { note = String(value.prefix(200)) }
                            }
                    }

                    if let error {
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Button {
                        Task { await submit() }
                    } label: {
                        Text(isWorking ? "Sellando…" : count == 1 ? "Sellar 1" : "Sellar \(count)")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.volviaNavy)
                    .disabled(isWorking || amountProblem != nil)
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(lookup.card.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
    }

    private var waitLine: String {
        let minutes = max(1, Int((Double(lookup.cooldownSecondsLeft) / 60).rounded(.up)))
        return "Espera \(minutes) min: ya recibió sello hace poco."
    }

    private var rewards: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Premios por entregar").font(.subheadline.weight(.medium))
            ForEach(lookup.pendingRewards) { reward in
                HStack(spacing: 12) {
                    Image(systemName: "gift.fill")
                        .foregroundStyle(Color.volviaViolet)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(reward.title).font(.body.weight(.medium))
                        Text("Código \(reward.code)").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if delivered.contains(reward.grantId) {
                        Label("Entregado", systemImage: "checkmark.circle.fill")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.green)
                    } else {
                        Button(delivering == reward.grantId ? "Entregando…" : "Entregar") {
                            Task { await deliver(reward) }
                        }
                        .buttonStyle(.bordered)
                        .tint(.volviaViolet)
                        .disabled(delivering != nil)
                    }
                }
                .padding(12)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private var countControl: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Cantidad de sellos").font(.subheadline.weight(.medium))
                Text("Hasta \(lookup.card.maxStampsPerScan) por escaneo")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                count = max(1, count - 1)
            } label: {
                Image(systemName: "minus.circle.fill").font(.system(size: 30))
            }
            .disabled(count <= 1)
            .accessibilityLabel("Un sello menos")
            Text("\(count)")
                .font(.title2.weight(.semibold))
                .monospacedDigit()
                .frame(minWidth: 36)
                .accessibilityLabel("\(count) sellos")
            Button {
                count = min(lookup.card.maxStampsPerScan, count + 1)
            } label: {
                Image(systemName: "plus.circle.fill").font(.system(size: 30))
            }
            .disabled(count >= lookup.card.maxStampsPerScan)
            .accessibilityLabel("Un sello más")
        }
        .tint(.volviaNavy)
    }

    private var amountField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Monto de la compra").font(.subheadline.weight(.medium))
            HStack {
                Text("$").foregroundStyle(.secondary)
                TextField("0", text: $amountText)
                    .keyboardType(.numberPad)
                    .font(.title3.monospacedDigit())
                    .onChange(of: amountText) { _, value in
                        // Thousands separators as the staff member types: 25.000, not 25000.
                        let formatted = Money.parse(value).map { String(Money.format($0).dropFirst(2)) } ?? ""
                        if formatted != value { amountText = formatted }
                    }
            }
            .padding(10)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
            Text(amountProblem ?? "Mínimo \(Money.format(minimum)) para sumar sello.")
                .font(.caption)
                .foregroundStyle(amountProblem == nil ? Color.secondary : Color.volviaOrange)
        }
    }

    private func deliver(_ reward: CardLookup.Reward) async {
        delivering = reward.grantId
        defer { delivering = nil }
        if let failure = await model.redeem(grantId: reward.grantId) {
            error = failure
        } else {
            delivered.insert(reward.grantId)
            error = nil
        }
    }

    private func submit() async {
        isWorking = true
        error = nil
        defer { isWorking = false }
        let refusal = await model.stamp(
            lookup,
            count: count,
            purchaseAmount: lookup.requiresAmount ? amount : nil,
            note: note
        )
        if let refusal {
            error = refusal
        } else {
            dismiss()
        }
    }
}

/// The reward code a customer reads out loud, typed in when there is nothing to scan.
struct RedeemCodeSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var error: String?
    @State private var isWorking = false
    @FocusState private var focused: Bool

    private var trimmed: String { code.trimmingCharacters(in: .whitespaces) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Ej.: TUTXV5", text: $code)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .font(.title3.monospaced())
                        .focused($focused)
                        .onSubmit { Task { await submit() } }
                } header: {
                    Text("Código del premio")
                } footer: {
                    Text("El cliente lo ve en su tarjeta, debajo del premio.")
                }

                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        Text(isWorking ? "Entregando…" : "Entregar premio").frame(maxWidth: .infinity)
                    }
                    .disabled(isWorking || trimmed.count < 4)
                }
            }
            .navigationTitle("Entregar con código")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
            .onAppear { focused = true }
        }
        .presentationDetents([.medium, .large])
    }

    private func submit() async {
        guard trimmed.count >= 4 else { return }
        isWorking = true
        defer { isWorking = false }
        if let failure = await model.redeem(code: trimmed) {
            error = failure
        } else {
            dismiss()
        }
    }
}
