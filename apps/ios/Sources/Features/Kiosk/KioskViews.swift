import SwiftUI
import UIKit

/// Choosing the kiosk's card and location: a one-time step before the screen goes
/// chrome-free for the rest of the day.
struct KioskSetupView: View {
    @EnvironmentObject private var model: AppModel
    @State private var cardId = ""
    @State private var locationId = ""
    @State private var session: KioskSession?
    @State private var error: String?
    @State private var isOpening = false

    private var eligible: [LoyaltyCard] { model.activeCards.filter(\.rules.kioskEnabled) }
    private var card: LoyaltyCard? { eligible.first { $0.id == cardId } ?? eligible.first }
    private var pinnedLocation: String? { model.session.membership?.locationId }
    private var location: String? {
        pinnedLocation ?? (locationId.isEmpty ? (model.locationId ?? model.locations.first?.id) : locationId)
    }

    var body: some View {
        Group {
            if eligible.isEmpty {
                StatusView(kind: .empty(
                    title: "Modo kiosko no disponible",
                    message: "Actívalo en una tarjeta publicada desde el panel web para usar esta pantalla.",
                    systemImage: "ipad.landscape"
                ))
            } else {
                form
            }
        }
        .navigationTitle("Modo kiosko")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $session) { session in
            if let card {
                KioskScreen(session: session, card: card) { self.session = nil }
            }
        }
        #if targetEnvironment(simulator)
        .task {
            if SimulatorFixtures.state == .kiosk, session == nil {
                session = KioskSession(sessionId: "00000000-0000-4000-8000-00000000000a", secret: "simulator-secret-0000000000")
            }
        }
        #endif
    }

    private var form: some View {
        Form {
            Section {
                if eligible.count > 1 {
                    Picker("Tarjeta", selection: Binding(get: { card?.id ?? "" }, set: { cardId = $0 })) {
                        ForEach(eligible) { Text($0.name).tag($0.id) }
                    }
                } else {
                    LabeledContent("Tarjeta", value: card?.name ?? "")
                }
                if pinnedLocation == nil && model.locations.count > 1 {
                    Picker("Sede", selection: Binding(get: { location ?? "" }, set: { locationId = $0 })) {
                        ForEach(model.locations) { Text($0.name).tag($0.id) }
                    }
                }
            } footer: {
                Text("El cliente escanea el código de la pantalla con su teléfono y suma su sello solo. El código cambia cada 30 segundos.")
            }

            if let error {
                Section { Text(error).foregroundStyle(.red) }
            }

            Section {
                Button {
                    Task { await open() }
                } label: {
                    Text(isOpening ? "Abriendo…" : "Abrir kiosko").font(.headline).frame(maxWidth: .infinity)
                }
                .disabled(isOpening || card == nil || location == nil)
            } footer: {
                Text("Para salir, mantén presionada 2 segundos la esquina superior izquierda.")
            }
        }
    }

    private func open() async {
        guard let card, let location else { return }
        isOpening = true
        error = nil
        defer { isOpening = false }
        do {
            session = try await model.api.openKiosk(cardId: card.id, locationId: location)
        } catch let failure as APIError where failure.code == "CONFLICT" {
            error = "El modo kiosko está apagado en esta tarjeta. Actívalo desde el panel web."
        } catch {
            self.error = model.describe(error)
        }
    }
}

extension KioskSession: Identifiable {
    var id: String { sessionId }
}

/// The kiosk itself: a QR that changes every 30 seconds and dies on first use, so a
/// photo of the screen buys nothing. When someone stamps through it, the screen
/// celebrates for three seconds and swaps the spent code at once.
///
/// Mirrors `apps/app/src/components/Kiosk.tsx`: rotate on expiry or after a stamp, poll
/// the status every 3 seconds, and treat the first answer as the baseline.
struct KioskScreen: View {
    @EnvironmentObject private var model: AppModel
    let session: KioskSession
    let card: LoyaltyCard
    let onClose: () -> Void

    @State private var nonce: String?
    @State private var secondsLeft = 30
    @State private var ttl = 30
    @State private var seenStampAt: Double?
    @State private var celebration: KioskStatus.LastStamp?
    @State private var error: String?
    @State private var confirmingExit = false

    private static let pollEvery = 3
    private static let celebrationSeconds = 3.0

    private var background: Color { Color(CardRGB(hex: card.design?.backgroundColor ?? "#1E3A8A")) }
    private var foreground: Color { Color(CardRGB(hex: card.design?.foregroundColor ?? "#FFFFFF")) }
    private var accent: Color { Color(CardRGB(hex: card.design?.accentColor ?? "#FB923C")) }

    private var scanURL: String? {
        guard let nonce else { return nil }
        let base = model.org?.passBaseURL ?? "https://tarjeta.somosvolvia.com"
        return "\(base)/k/\(nonce)"
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            background.ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()
                Text(model.org?.name ?? model.session.membership?.orgName ?? "")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(foreground.opacity(0.8))
                Text("Escanea y suma tu sello")
                    .font(.system(size: 34, weight: .bold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(foreground)

                ZStack {
                    RoundedRectangle(cornerRadius: 28).fill(.white)
                    if let scanURL {
                        QRCodeView(text: scanURL).padding(22)
                    } else if let error {
                        Text(error).foregroundStyle(.black).padding().multilineTextAlignment(.center)
                    } else {
                        ProgressView()
                    }
                }
                .frame(width: 320, height: 320)

                HStack(spacing: 10) {
                    ZStack {
                        Circle().stroke(foreground.opacity(0.2), lineWidth: 4)
                        Circle()
                            .trim(from: 0, to: Double(secondsLeft) / Double(max(ttl, 1)))
                            .stroke(accent, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                            .animation(.linear(duration: 1), value: secondsLeft)
                    }
                    .frame(width: 26, height: 26)
                    Text("El código cambia en \(secondsLeft) s")
                        .font(.system(size: 17).monospacedDigit())
                        .foregroundStyle(foreground.opacity(0.85))
                }
                .accessibilityElement(children: .combine)
                Text(card.name)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(foreground.opacity(0.6))
                Spacer()
            }
            .frame(maxWidth: .infinity)
            .padding(24)

            if let celebration {
                ZStack {
                    accent.ignoresSafeArea()
                    VStack(spacing: 16) {
                        Image(systemName: celebration.rewardUnlocked ? "gift.fill" : "checkmark.seal.fill")
                            .font(.system(size: 96))
                        Text(celebration.rewardUnlocked ? "¡Ganaste un premio!" : "¡Sello sumado!")
                            .font(.system(size: 40, weight: .bold))
                        Text(celebration.rewardUnlocked ? "Muéstralo en caja para reclamarlo." : "Gracias por volver.")
                            .font(.title3)
                    }
                    .foregroundStyle(Color(CardRGB(hex: card.design?.accentColor ?? "#FB923C")
                        .readable(among: [CardRGB(hex: "#0F172A"), CardRGB(hex: "#FFFFFF")])))
                }
                .transition(.opacity)
            }

            // The way out: a corner held for two seconds, then a question. A customer
            // tapping around never gets there by accident.
            Color.clear
                .frame(width: 90, height: 90)
                .contentShape(Rectangle())
                .onLongPressGesture(minimumDuration: 2) { confirmingExit = true }
                .accessibilityLabel("Salir del modo kiosko")
                .accessibilityAddTraits(.isButton)
                .accessibilityAction { confirmingExit = true }
        }
        .animation(.easeInOut(duration: 0.25), value: celebration)
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        .confirmationDialog("¿Salir del modo kiosko?", isPresented: $confirmingExit, titleVisibility: .visible) {
            Button("Salir y cerrar la sesión", role: .destructive) { Task { await close() } }
            Button("Seguir en kiosko", role: .cancel) {}
        }
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true
            Brightness.max()
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
            Brightness.restore()
        }
        .task { await run() }
    }

    /// One loop for the whole screen: a second-by-second countdown, a fresh code when it
    /// runs out, and a status poll every few seconds.
    private func run() async {
        await rotate()
        var tick = 0
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(1))
            if Task.isCancelled { return }
            tick += 1
            secondsLeft = max(0, secondsLeft - 1)
            if secondsLeft == 0 { await rotate() }
            if tick % Self.pollEvery == 0 { await poll() }
        }
    }

    private func rotate() async {
        #if targetEnvironment(simulator)
        if SimulatorFixtures.state == .kiosk {
            nonce = "simulador-\(UUID().uuidString.prefix(8))"
            secondsLeft = 30
            ttl = 30
            return
        }
        #endif
        do {
            let issued = try await model.api.kioskNonce(session)
            nonce = issued.nonce
            secondsLeft = issued.expiresInSeconds
            ttl = issued.expiresInSeconds
            error = nil
        } catch {
            nonce = nil
            self.error = "Se perdió la sesión del kiosko. Sal y vuelve a abrirlo."
        }
    }

    private func poll() async {
        #if targetEnvironment(simulator)
        if SimulatorFixtures.state == .kiosk { return }
        #endif
        guard let status = try? await model.api.kioskStatus(session) else { return }
        let last = status.lastStamp
        // The first answer only sets the baseline: a stamp from before the screen opened
        // is not news. No stamp yet counts as a baseline of zero.
        guard let seen = seenStampAt else {
            seenStampAt = last?.at ?? 0
            return
        }
        if let last, last.at > seen {
            seenStampAt = last.at
            celebration = last
            Haptics.success()
            await rotate()
            try? await Task.sleep(for: .seconds(Self.celebrationSeconds))
            celebration = nil
        }
    }

    private func close() async {
        #if targetEnvironment(simulator)
        if SimulatorFixtures.state != .kiosk { try? await model.api.closeKiosk(session) }
        #else
        try? await model.api.closeKiosk(session)
        #endif
        onClose()
    }
}
