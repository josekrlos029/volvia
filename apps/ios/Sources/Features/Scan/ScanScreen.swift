import SwiftUI

/// The counter: the camera, and the answer to the last scan on top of it.
struct ScanScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var showsCodeEntry = false

    var body: some View {
        ZStack {
            ScannerView { code in
                Task { await model.handleScan(code) }
            }
            .ignoresSafeArea(edges: .top)

            VStack {
                header
                Spacer()
                if let outcome = model.outcome {
                    ScanOutcomeCard(outcome: outcome) { model.outcome = nil }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                } else if model.isSending {
                    ProgressView()
                        .controlSize(.large)
                        .tint(.white)
                        .padding(.bottom, 120)
                } else {
                    aim
                }
            }
        }
        .animation(.snappy(duration: 0.22), value: model.outcome)
        .sheet(isPresented: $showsCodeEntry) { RedeemCodeSheet() }
    }

    private var header: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(model.session.membership?.orgName ?? "Volvia Biz")
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
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
            Button {
                showsCodeEntry = true
            } label: {
                Label("Código", systemImage: "gift")
                    .font(.system(size: 15, weight: .semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(.white.opacity(0.18), in: Capsule())
            }
            .accessibilityHint("Entregar un premio tecleando su código")
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
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
        if case .stamped(let result, let at) = outcome, let look = CardLook(result) {
            BrandedOutcomeCard(result: result, stampedAt: at, look: look, onDismiss: onDismiss)
        } else {
            plain
        }
    }

    /// Queued, refused, undone, redeemed, or a replay from before the API sent the look.
    private var plain: some View {
        VStack(alignment: .leading, spacing: 12) {
            switch outcome {
            case .stamped(let result, let at):
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
                UndoButton(result: result, stampedAt: at)

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

            case .voided(let result, let name):
                Label("Sello deshecho", systemImage: "arrow.uturn.backward.circle.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.volviaNavy)
                Text(voidLine(result, name: name))
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

            case .redeemed(let result):
                Label("Premio entregado", systemImage: "gift.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.volviaViolet)
                Text(redeemLine(result))
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

            case .notice(let title, let message):
                Text(title)
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

    private func voidLine(_ result: VoidResult, name: String) -> String {
        let removed = result.stampsRemoved == 1 ? "1 sello" : "\(result.stampsRemoved) sellos"
        var line = "Se quitó \(removed) a \(name). Ahora tiene \(result.stampsCount) de \(result.stampsRequired)."
        if result.rewardsRevoked > 0 {
            line += result.rewardsRevoked == 1 ? " Se anuló 1 premio." : " Se anularon \(result.rewardsRevoked) premios."
        }
        return line
    }

    private func redeemLine(_ result: RedeemResult) -> String {
        if let name = result.customer?.firstName, !name.isEmpty {
            return "\(result.title) para \(name)."
        }
        return result.title
    }
}
