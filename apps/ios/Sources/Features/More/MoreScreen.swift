import SwiftUI

/// "Más": the business and location this phone works for, the counter's settings, and,
/// for admins and owners, the management screens.
struct MoreScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var showsJoinQR = false
    @State private var confirmingSignOut = false
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List {
                businessSection
                if showsLocationPicker { locationSection }

                Section("Mostrador") {
                    Button {
                        showsJoinQR = true
                    } label: {
                        Label("QR de inscripción", systemImage: "qrcode")
                    }
                    .disabled(model.activeCards.isEmpty)

                    Toggle(isOn: Binding(
                        get: { model.session.quickStamp },
                        set: { model.session.quickStamp = $0 }
                    )) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Sellado rápido")
                            Text("Al escanear suma 1 sello sin preguntar. Las tarjetas con monto mínimo siempre preguntan.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                queueSection

                if model.isAdmin { adminSection }

                Section {
                    Button("Cerrar sesión", role: .destructive) { confirmingSignOut = true }
                } footer: {
                    Text("Volvia Biz \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")")
                }
            }
            .navigationTitle("Más")
            .navigationDestination(for: ManageRoute.self) { route in
                switch route {
                case .stats: StatsScreen()
                case .messages: MessagesScreen()
                case .campaigns: CampaignsScreen()
                case .team: TeamScreen()
                case .kiosk: KioskSetupView()
                }
            }
            .refreshable { await model.loadContext() }
            .fullScreenCover(isPresented: $showsJoinQR) { JoinQRView() }
            .confirmationDialog("¿Cerrar sesión?", isPresented: $confirmingSignOut, titleVisibility: .visible) {
                Button("Cerrar sesión", role: .destructive) { Task { await model.signOut() } }
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text(model.queue.pending.isEmpty
                     ? "Tendrás que volver a entrar para sellar."
                     : "Los \(model.queue.pending.count) sellos por enviar se quedan en el teléfono y salen al volver a entrar.")
            }
        }
        #if targetEnvironment(simulator)
        .onAppear(perform: applyFixture)
        #endif
    }

    private var businessSection: some View {
        Section("Negocio") {
            LabeledContent("Negocio", value: model.session.membership?.orgName ?? "—")
            LabeledContent("Tu rol", value: RoleName.label(model.role))
            LabeledContent("Cuenta", value: model.session.user?.email ?? "—")

            if model.session.user?.memberships.count ?? 0 > 1 {
                Menu {
                    ForEach(model.session.user?.memberships ?? []) { membership in
                        Button {
                            Task { await model.switchOrg(to: membership) }
                        } label: {
                            if membership.orgId == model.session.membership?.orgId {
                                Label(membership.orgName, systemImage: "checkmark")
                            } else {
                                Text(membership.orgName)
                            }
                        }
                    }
                } label: {
                    Label("Cambiar de negocio", systemImage: "arrow.left.arrow.right")
                }
            }
        }
    }

    /// Hidden for a member pinned to one location, and when there is only one.
    private var showsLocationPicker: Bool {
        model.session.membership?.locationId == nil && model.locations.count > 1
    }

    private var locationSection: some View {
        Section {
            Picker("Sede", selection: Binding(
                get: { model.locationId ?? "" },
                set: { model.session.selectLocation($0.isEmpty ? nil : $0) }
            )) {
                Text("Sin elegir").tag("")
                ForEach(model.locations) { location in
                    Text(location.name).tag(location.id)
                }
            }
        } footer: {
            Text("Los sellos y premios de este teléfono quedan a nombre de esta sede.")
        }
    }

    private var queueSection: some View {
        Section("Sellos por enviar") {
            if model.queue.pending.isEmpty {
                Text("Todo enviado").foregroundStyle(.secondary)
            } else {
                LabeledContent("Pendientes", value: "\(model.queue.pending.count)")
                Button("Enviar ahora") { Task { await model.flush() } }
                    .disabled(model.queue.isFlushing)
            }

            if !model.queue.rejected.isEmpty {
                // Never deleted in silence: somebody took these from a real
                // customer and deserves to know they did not land.
                ForEach(model.queue.rejected, id: \.stamp.id) { entry in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Rechazado").font(.system(size: 14, weight: .medium))
                        Text(entry.reason)
                            .font(.system(size: 13))
                            .foregroundStyle(.secondary)
                    }
                }
                Button("Entendido", role: .destructive) { model.queue.clearRejected() }
            }
        }
    }

    private var adminSection: some View {
        Section("Administrar") {
            NavigationLink(value: ManageRoute.stats) {
                Label("Estadísticas", systemImage: "chart.xyaxis.line")
            }
            NavigationLink(value: ManageRoute.messages) {
                Label("Mensajes", systemImage: "bell.badge")
            }
            NavigationLink(value: ManageRoute.campaigns) {
                Label("Campañas", systemImage: "megaphone")
            }
            NavigationLink(value: ManageRoute.team) {
                Label("Equipo", systemImage: "person.3")
            }
            NavigationLink(value: ManageRoute.kiosk) {
                Label("Modo kiosko", systemImage: "ipad.landscape")
            }
        }
    }

    #if targetEnvironment(simulator)
    private func applyFixture() {
        guard path.isEmpty else { return }
        switch SimulatorFixtures.state {
        case .stats: path.append(ManageRoute.stats)
        case .kiosk: path.append(ManageRoute.kiosk)
        default: break
        }
    }
    #endif
}

enum ManageRoute: Hashable {
    case stats, messages, campaigns, team, kiosk
}

/// The counter's sign-up QR, full screen and at full brightness, for a customer to scan
/// from across the counter. With several cards, the staff member picks which.
struct JoinQRView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var cardId: String?
    @State private var png: UIImage?

    private var cards: [LoyaltyCard] { model.activeCards }
    private var card: LoyaltyCard? { cards.first { $0.id == cardId } ?? cards.first }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                if cards.count > 1 {
                    Picker("Tarjeta", selection: Binding(get: { card?.id ?? "" }, set: { cardId = $0 })) {
                        ForEach(cards) { Text($0.name).tag($0.id) }
                    }
                    .pickerStyle(.menu)
                }

                Spacer(minLength: 0)
                Group {
                    if let png {
                        Image(uiImage: png).resizable().interpolation(.none).scaledToFit()
                            .accessibilityLabel("Código QR de inscripción")
                    } else if let url = card?.joinUrl {
                        // Drawn here while the API's version (with the logo) downloads, and
                        // instead of it when there is no connection.
                        QRCodeView(text: url)
                    } else {
                        ProgressView()
                    }
                }
                .frame(maxWidth: 360, maxHeight: 360)
                .padding(20)
                .background(.white, in: RoundedRectangle(cornerRadius: 20))

                VStack(spacing: 6) {
                    Text(card?.name ?? "")
                        .font(.title2.weight(.semibold))
                    Text("Escanea con la cámara para unirte y guardar tu tarjeta.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                Spacer(minLength: 0)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.volviaOffWhite)
            .navigationTitle("QR de inscripción")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Listo") { dismiss() } }
            }
            .task(id: card?.id) { await loadPNG() }
        }
        .onAppear { Brightness.max() }
        .onDisappear { Brightness.restore() }
    }

    private func loadPNG() async {
        png = nil
        guard let id = card?.id else { return }
        if let data = try? await model.api.cardQR(cardId: id), let image = UIImage(data: data) {
            png = image
        }
    }
}
