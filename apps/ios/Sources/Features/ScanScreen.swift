import SwiftUI

/// The screen the app lives on.
struct ScanScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var showsAccount = false

    var body: some View {
        ZStack {
            ScannerView { code in
                Task { await model.handleScan(code) }
            }
            .ignoresSafeArea()

            VStack {
                header
                Spacer()
                if let outcome = model.outcome {
                    ScanOutcomeCard(outcome: outcome) { model.outcome = nil }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 24)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                } else {
                    aim
                }
            }
        }
        .animation(.snappy(duration: 0.22), value: model.outcome)
        .sheet(isPresented: $showsAccount) { AccountSheet() }
        .task { await model.flush() }
    }

    private var header: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(model.session.membership?.orgName ?? "Volvia Biz")
                    .font(.system(size: 15, weight: .semibold))
                if !model.queue.pending.isEmpty {
                    // The only number worth showing here: stamps taken and not yet sent.
                    Label(
                        "\(model.queue.pending.count) por enviar",
                        systemImage: "arrow.triangle.2.circlepath"
                    )
                    .font(.system(size: 12, weight: .medium))
                }
            }
            Spacer()
            Button { showsAccount = true } label: {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 22))
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(.black.opacity(0.45))
    }

    private var aim: some View {
        VStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 22)
                .stroke(.white.opacity(0.9), lineWidth: 3)
                .frame(width: 228, height: 228)
            Text("Apunta al código del cliente")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(.white)
                .shadow(radius: 4)
        }
        .padding(.bottom, 90)
    }
}

/// What happened, in the words a person would use, large enough to read at arm's length.
struct ScanOutcomeCard: View {
    @EnvironmentObject private var model: AppModel
    let outcome: ScanOutcome
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            switch outcome {
            case .stamped(let result):
                Text(result.customer.firstName)
                    .font(.system(size: 24, weight: .semibold))
                Text("\(result.stampsCount) de \(result.stampsRequired) sellos")
                    .font(.system(size: 17))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()

                if let reward = result.unlockedRewards.first {
                    Divider()
                    Text("¡Ganó \(reward.title)!")
                        .font(.system(size: 18, weight: .semibold))
                    Text("Código \(reward.code)")
                        .font(.system(size: 15))
                        .foregroundStyle(.secondary)
                    Button("Entregar ahora") {
                        Task { await model.redeem(grantId: reward.grantId) }
                    }
                    .buttonStyle(.borderedProminent)
                } else if let pending = result.pendingRewards.first {
                    Divider()
                    Text("Tiene \(pending.title) sin recoger")
                        .font(.system(size: 15, weight: .medium))
                    Button("Entregar ahora") {
                        Task { await model.redeem(grantId: pending.grantId) }
                    }
                    .buttonStyle(.bordered)
                }

            case .queued:
                Text("Sello guardado")
                    .font(.system(size: 24, weight: .semibold))
                Text("Sin conexión ahora mismo. Se envía solo cuando vuelva; el cliente ya lo tiene.")
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

            case .failed(let message):
                Text("No se pudo sellar")
                    .font(.system(size: 22, weight: .semibold))
                Text(message)
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button("Siguiente cliente", action: onDismiss)
                .font(.system(size: 15, weight: .medium))
                .frame(maxWidth: .infinity)
                .padding(.top, 2)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
    }
}

struct AccountSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Tu cuenta") {
                    LabeledContent("Nombre", value: model.session.user?.name ?? "—")
                    LabeledContent("Negocio", value: model.session.membership?.orgName ?? "—")
                }

                if model.session.user?.memberships.count ?? 0 > 1 {
                    Section("Cambiar de negocio") {
                        ForEach(model.session.user?.memberships ?? []) { membership in
                            Button {
                                model.session.select(membership)
                                dismiss()
                            } label: {
                                HStack {
                                    Text(membership.orgName)
                                    Spacer()
                                    if membership.orgId == model.session.membership?.orgId {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    }
                }

                Section("Sellos por enviar") {
                    if model.queue.pending.isEmpty {
                        Text("Todo enviado").foregroundStyle(.secondary)
                    } else {
                        LabeledContent("Pendientes", value: "\(model.queue.pending.count)")
                        Button("Enviar ahora") { Task { await model.flush() } }
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

                Section {
                    Button("Cerrar sesión", role: .destructive) {
                        model.signOut()
                        dismiss()
                    }
                }
            }
            .navigationTitle("Cuenta")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Listo") { dismiss() }
                }
            }
        }
    }
}
