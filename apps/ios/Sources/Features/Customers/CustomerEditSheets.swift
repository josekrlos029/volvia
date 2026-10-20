import SwiftUI

/// Admin only: notes, phone and birthday. The rest of the profile belongs to the customer.
struct EditCustomerSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let detail: CustomerDetail
    let onSaved: () -> Void

    @State private var notes: String
    @State private var phone: String
    @State private var hasBirthday: Bool
    @State private var month: Int
    @State private var day: Int
    @State private var error: String?
    @State private var isWorking = false

    init(detail: CustomerDetail, onSaved: @escaping () -> Void) {
        self.detail = detail
        self.onSaved = onSaved
        let customer = detail.customer
        _notes = State(initialValue: customer.notes ?? "")
        // A masked number cannot be edited back into itself; start blank instead.
        let shownPhone = customer.phone.flatMap { $0.contains("*") ? nil : $0 }
        _phone = State(initialValue: shownPhone ?? PhoneNumber.defaultPrefix)
        _hasBirthday = State(initialValue: customer.birthdayMonth != nil)
        _month = State(initialValue: customer.birthdayMonth ?? 1)
        _day = State(initialValue: customer.birthdayDay ?? 1)
    }

    private var parsedPhone: PhoneNumber.Parsed { PhoneNumber.parse(phone) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Celular") {
                    TextField("+57 300 123 4567", text: $phone)
                        .keyboardType(.phonePad)
                    if parsedPhone == .invalid {
                        Text("Ese celular no parece válido.").font(.caption).foregroundStyle(.red)
                    }
                }
                Section("Cumpleaños") {
                    Toggle("Tiene cumpleaños", isOn: $hasBirthday)
                    if hasBirthday {
                        Picker("Mes", selection: $month) {
                            ForEach(1...12, id: \.self) { Text(DateText.months[$0 - 1].capitalized).tag($0) }
                        }
                        Picker("Día", selection: $day) {
                            ForEach(1...31, id: \.self) { Text("\($0)").tag($0) }
                        }
                    }
                }
                Section {
                    TextField("Lo que el equipo debe saber", text: $notes, axis: .vertical)
                        .lineLimit(3...8)
                        .onChange(of: notes) { _, value in
                            if value.count > 1000 { notes = String(value.prefix(1000)) }
                        }
                } header: {
                    Text("Notas")
                } footer: {
                    Text("Las ve todo el equipo. No anotes datos sensibles.")
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Editar cliente")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isWorking ? "Guardando…" : "Guardar") { Task { await save() } }
                        .disabled(isWorking || parsedPhone == .invalid)
                }
            }
        }
    }

    private func save() async {
        var phoneValue: String?
        if case .valid(let value) = parsedPhone { phoneValue = value }
        let patch = CustomerPatch(
            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines),
            phone: phoneValue,
            birthday: hasBirthday ? Birthday(month: month, day: day) : nil
        )
        isWorking = true
        defer { isWorking = false }
        do {
            try await model.api.updateCustomer(id: detail.customer.id, patch: patch)
            onSaved()
            dismiss()
        } catch {
            self.error = model.describe(error)
        }
    }
}

/// Admin only: add or take away stamps by hand, always with a reason (it is audited).
struct AdjustStampsSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let cards: [CustomerDetail.Card]
    let onDone: () -> Void

    @State private var cardId: String
    @State private var delta = 1
    @State private var reason = ""
    @State private var error: String?
    @State private var isWorking = false

    init(cards: [CustomerDetail.Card], onDone: @escaping () -> Void) {
        self.cards = cards
        self.onDone = onDone
        _cardId = State(initialValue: cards.first?.id ?? "")
    }

    private var trimmedReason: String { reason.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            Form {
                if cards.count > 1 {
                    Picker("Tarjeta", selection: $cardId) {
                        ForEach(cards) { Text($0.cardName).tag($0.id) }
                    }
                }
                Section {
                    Stepper(value: $delta, in: -20...20) {
                        Text(delta > 0 ? "Sumar \(delta)" : "Quitar \(abs(delta))")
                            .monospacedDigit()
                    }
                    .onChange(of: delta) { old, new in
                        // Zero is not an adjustment: skip over it.
                        if new == 0 { delta = old > 0 ? -1 : 1 }
                    }
                } header: {
                    Text("Sellos")
                } footer: {
                    if let card = cards.first(where: { $0.id == cardId }) {
                        Text("Ahora tiene \(card.stampsCount) de \(card.stampsRequired).")
                    }
                }
                Section {
                    TextField("Ej.: se le olvidó escanear ayer", text: $reason, axis: .vertical)
                        .lineLimit(2...4)
                } header: {
                    Text("Motivo (obligatorio)")
                } footer: {
                    Text("Queda registrado con tu nombre.")
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Ajustar sellos")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isWorking ? "Guardando…" : "Guardar") { Task { await save() } }
                        .disabled(isWorking || trimmedReason.count < 3 || cardId.isEmpty)
                }
            }
        }
    }

    private func save() async {
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await model.api.adjust(customerCardId: cardId, delta: delta, reason: String(trimmedReason.prefix(200)))
            Haptics.success()
            onDone()
            dismiss()
        } catch {
            self.error = model.describe(error)
        }
    }
}
