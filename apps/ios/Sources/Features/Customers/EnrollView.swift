import SwiftUI

/// Signing a customer up at the counter, for someone who will not do it on their phone.
///
/// The customer's authorisation to keep their data (Habeas Data, Ley 1581) is a box the
/// staff member ticks after asking out loud; nothing is sent until it is ticked.
struct EnrollView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let onFinish: (String) -> Void

    @State private var cardId: String?
    @State private var firstName = ""
    @State private var email = ""
    @State private var phone = PhoneNumber.defaultPrefix
    @State private var hasBirthday = false
    @State private var month = 1
    @State private var day = 1
    @State private var marketingConsent = false
    @State private var dataConsent = false
    @State private var stampNow = true
    @State private var error: String?
    @State private var isWorking = false
    @State private var result: EnrollResult?
    /// One per form, so a double tap or a retry after a timeout signs up once.
    @State private var idempotencyKey = "ios-enroll-\(UUID().uuidString)"

    init(onFinish: @escaping (String) -> Void) {
        self.onFinish = onFinish
        #if targetEnvironment(simulator)
        if SimulatorFixtures.state == .enrolled { _result = State(initialValue: SimulatorFixtures.enrollResult) }
        if SimulatorFixtures.state == .enroll {
            _firstName = State(initialValue: "Valentina")
            _email = State(initialValue: "valentina@correo.test")
            _phone = State(initialValue: "+57 300 555 0199")
            _marketingConsent = State(initialValue: true)
        }
        #endif
    }

    private var cards: [LoyaltyCard] { model.activeCards }
    private var selectedCard: String? { cardId ?? (cards.count == 1 ? cards.first?.id : nil) }
    private var parsedPhone: PhoneNumber.Parsed { PhoneNumber.parse(phone) }
    private var emailIsValid: Bool {
        email.trimmingCharacters(in: .whitespaces)
            .range(of: #"^[^@\s]+@[^@\s]+\.[^@\s]+$"#, options: .regularExpression) != nil
    }

    private var canSubmit: Bool {
        selectedCard != nil && !firstName.trimmingCharacters(in: .whitespaces).isEmpty && emailIsValid
            && parsedPhone != .invalid && dataConsent && !isWorking
    }

    var body: some View {
        NavigationStack {
            Group {
                if let result {
                    EnrollSuccessView(
                        result: result,
                        firstName: firstName.isEmpty ? "El cliente" : firstName,
                        phone: { if case .valid(let value) = parsedPhone { return value } else { return nil } }(),
                        businessName: model.org?.name ?? model.session.membership?.orgName ?? "",
                        onDone: { onFinish(result.customerId) }
                    )
                } else {
                    form
                }
            }
            .navigationTitle(result == nil ? "Inscribir cliente" : "Tarjeta lista")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if result == nil {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancelar") { dismiss() }
                    }
                }
            }
        }
        .interactiveDismissDisabled(isWorking)
    }

    private var form: some View {
        Form {
            if cards.isEmpty {
                Section {
                    Text("No hay tarjetas activas. Publica una desde el panel web para inscribir clientes.")
                        .foregroundStyle(.secondary)
                }
            } else if cards.count > 1 {
                Section("Tarjeta") {
                    Picker("Tarjeta", selection: $cardId) {
                        Text("Elige una").tag(String?.none)
                        ForEach(cards) { card in
                            Text(card.name).tag(Optional(card.id))
                        }
                    }
                }
            }

            Section {
                TextField("Nombre", text: $firstName)
                    .textContentType(.givenName)
                    .onChange(of: firstName) { _, value in
                        if value.count > 60 { firstName = String(value.prefix(60)) }
                    }
                TextField("Correo", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("Celular (opcional)", text: $phone)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
            } header: {
                Text("Datos del cliente")
            } footer: {
                if parsedPhone == .invalid {
                    Text("Ese celular no parece válido. Ej.: +57 300 123 4567").foregroundStyle(.red)
                } else if !email.isEmpty && !emailIsValid {
                    Text("Revisa el correo.").foregroundStyle(.red)
                } else {
                    Text("El correo es obligatorio: así reconocemos al cliente si vuelve a inscribirse.")
                }
            }

            Section("Cumpleaños") {
                Toggle("Agregar cumpleaños", isOn: $hasBirthday)
                if hasBirthday {
                    Picker("Mes", selection: $month) {
                        ForEach(1...12, id: \.self) { value in
                            Text(DateText.months[value - 1].capitalized).tag(value)
                        }
                    }
                    Picker("Día", selection: $day) {
                        ForEach(1...daysIn(month), id: \.self) { value in
                            Text("\(value)").tag(value)
                        }
                    }
                }
            }
            .onChange(of: month) { _, value in day = min(day, daysIn(value)) }

            Section {
                Toggle("Acepta recibir novedades", isOn: $marketingConsent)
                Toggle(isOn: $stampNow) {
                    Text("Sumar el primer sello")
                }
            }

            Section {
                Toggle(isOn: $dataConsent) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("El cliente autoriza el tratamiento de sus datos personales según la política de \(model.org?.legalDisplayName ?? model.session.membership?.orgName ?? "el negocio").")
                            .font(.subheadline)
                            .fixedSize(horizontal: false, vertical: true)
                        if let url = model.org?.privacyURL {
                            Link("Ver política de datos", destination: url)
                                .font(.caption.weight(.medium))
                        }
                    }
                }
                .toggleStyle(CheckboxToggleStyle())
            } header: {
                Text("Autorización (obligatoria)")
            } footer: {
                Text("Pregúntale al cliente antes de marcarla.")
            }

            if let error {
                Section { Text(error).foregroundStyle(.red) }
            }

            Section {
                Button {
                    Task { await submit() }
                } label: {
                    Text(isWorking ? "Inscribiendo…" : "Inscribir")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                }
                .disabled(!canSubmit)
            }
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func daysIn(_ month: Int) -> Int {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][max(0, min(11, month - 1))]
    }

    private func submit() async {
        guard let card = selectedCard, canSubmit else { return }
        var phoneValue: String?
        if case .valid(let value) = parsedPhone { phoneValue = value }

        let form = EnrollForm(
            cardId: card,
            firstName: firstName.trimmingCharacters(in: .whitespaces),
            email: email.trimmingCharacters(in: .whitespaces).lowercased(),
            phone: phoneValue,
            birthday: hasBirthday ? Birthday(month: month, day: day) : nil,
            marketingConsent: marketingConsent,
            stampNow: stampNow,
            idempotencyKey: idempotencyKey
        )

        isWorking = true
        error = nil
        defer { isWorking = false }
        do {
            result = try await model.api.enroll(form, locationId: model.locationId)
            Haptics.success()
        } catch {
            self.error = model.describe(error)
            Haptics.error()
        }
    }
}

/// A square box rather than a switch: consent reads as a signature, not a setting.
struct CheckboxToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: configuration.isOn ? "checkmark.square.fill" : "square")
                    .font(.system(size: 22))
                    .foregroundStyle(configuration.isOn ? Color.volviaNavy : .secondary)
                configuration.label
                    .foregroundStyle(.primary)
            }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(configuration.isOn ? .isSelected : [])
    }
}

/// The card is made: a big QR the customer scans to save it, and the ways to send it.
struct EnrollSuccessView: View {
    let result: EnrollResult
    let firstName: String
    let phone: String?
    let businessName: String
    let onDone: () -> Void

    private var message: String {
        "¡Hola \(firstName)! Esta es tu tarjeta de \(businessName): \(result.cardUrl) Guárdala en tu Wallet para ir sumando sellos."
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                VStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(.green)
                        .accessibilityHidden(true)
                    Text(result.isNew ? "\(firstName) ya tiene su tarjeta" : "\(firstName) ya estaba inscrito")
                        .font(.title2.weight(.semibold))
                        .multilineTextAlignment(.center)
                    Text(stampLine)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                QRCodeView(text: result.cardUrl)
                    .frame(maxWidth: 280)
                    .padding(16)
                    .background(.white, in: RoundedRectangle(cornerRadius: 16))
                    .shadow(color: .black.opacity(0.08), radius: 8, y: 2)
                Text("Que lo escanee con la cámara para guardar la tarjeta en su Wallet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                if let url = WhatsApp.url(phone: phone, text: message) {
                    Link(destination: url) {
                        Label("Enviar por WhatsApp", systemImage: "message.fill")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.15, green: 0.68, blue: 0.38))
                }

                ShareLink(item: URL(string: result.cardUrl) ?? URL(string: "https://somosvolvia.com")!, message: Text(message)) {
                    Label("Compartir…", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.bordered)

                Button {
                    onDone()
                } label: {
                    Text("Listo").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .tint(.volviaNavy)
            }
            .padding(24)
        }
        .onAppear { Brightness.max() }
        .onDisappear { Brightness.restore() }
    }

    private var stampLine: String {
        guard let stamp = result.stamp else { return "Sin sellos todavía." }
        return "Primer sello sumado: \(stamp.stampsCount) de \(stamp.stampsRequired)."
    }
}
