import SwiftUI

/// Campaigns running now and the ones already over, and a new one from a template.
struct CampaignsScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var list: Loadable<CampaignList> = .loading
    @State private var creating = false
    @State private var cancelling: Campaign?

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
        .navigationTitle("Campañas")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    creating = true
                } label: {
                    Label("Nueva", systemImage: "plus")
                }
                .accessibilityLabel("Nueva campaña")
                .disabled(list.value == nil || list.value?.thisMonth.remaining == 0)
            }
        }
        .sheet(isPresented: $creating) {
            CampaignTemplatePicker { Task { await load() } }
        }
        .confirmationDialog(
            "¿Cancelar \(cancelling?.name ?? "la campaña")?",
            isPresented: Binding(get: { cancelling != nil }, set: { if !$0 { cancelling = nil } }),
            titleVisibility: .visible
        ) {
            Button("Cancelar campaña", role: .destructive) {
                if let campaign = cancelling { Task { await cancel(campaign) } }
            }
            Button("No", role: .cancel) {}
        } message: {
            Text("La oferta deja de aplicar en las tarjetas al instante.")
        }
        .refreshable { await load() }
        .task { await load() }
    }

    private func content(_ list: CampaignList) -> some View {
        let live = list.campaigns.filter(\.isLive)
        let past = list.campaigns.filter { !$0.isLive }
        return List {
            Section { usage(list.thisMonth, noun: "campañas") }
            Section("Activas") {
                if live.isEmpty {
                    Text("No hay campañas activas.").foregroundStyle(.secondary)
                } else {
                    ForEach(live) { campaign in
                        row(campaign)
                            .swipeActions {
                                Button("Cancelar", role: .destructive) { cancelling = campaign }
                            }
                    }
                }
            }
            Section("Pasadas") {
                if past.isEmpty {
                    Text("Todavía no hay campañas terminadas.").foregroundStyle(.secondary)
                } else {
                    ForEach(past) { row($0) }
                }
            }
        }
    }

    private func row(_ campaign: Campaign) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(campaign.name).font(.body.weight(.medium))
                Spacer()
                StatusBadge(status: campaign.status)
            }
            Text(campaign.headline).font(.subheadline).foregroundStyle(.secondary)
            Text("\(DateText.short(campaign.startsAt)) – \(DateText.short(campaign.endsAt))\(stats(campaign))")
                .font(.caption)
                .foregroundStyle(.secondary)
            if campaign.isLive {
                Button("Cancelar campaña", role: .destructive) { cancelling = campaign }
                    .font(.caption.weight(.medium))
                    .buttonStyle(.borderless)
                    .padding(.top, 2)
            }
        }
    }

    private func stats(_ campaign: Campaign) -> String {
        guard let stats = campaign.stats else { return "" }
        var parts: [String] = []
        if let targeted = stats.targeted, targeted > 0 { parts.append("\(targeted) avisados") }
        if let stamps = stats.stamps, stamps > 0 { parts.append("\(stamps) sellos") }
        return parts.isEmpty ? "" : " · " + parts.joined(separator: " · ")
    }

    private func load() async {
        do {
            list = .loaded(try await model.api.campaigns())
        } catch {
            list = .failed(model.describe(error) ?? "Las campañas no están en tu plan.")
        }
    }

    private func cancel(_ campaign: Campaign) async {
        do {
            _ = try await model.api.cancelCampaign(id: campaign.id)
            Haptics.warning()
            await load()
        } catch {
            if let message = model.describe(error) { list = .failed(message) }
        }
    }
}

/// A real situation a shop owner recognises, with the offer and timing already sensible.
/// The same nine as the web composer (`CampaignComposer.tsx`).
struct CampaignTemplate: Identifiable, Hashable {
    let id: String
    let name: String
    let headline: String
    let body: String
    let offer: CampaignOffer
    let days: Int
    var hours: (from: String, to: String)? = nil
    var segment: String = "all"
    let description: String
    var passHeader: String? = nil
    var passBanner: String? = nil
    var endsOnFirstStamp = false

    static func == (lhs: CampaignTemplate, rhs: CampaignTemplate) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    static let all: [CampaignTemplate] = [
        CampaignTemplate(id: "slow_day", name: "Día flojo", headline: "Hoy tus sellos valen doble",
                         body: "Pásate hoy y suma dos sellos en lugar de uno.", offer: .multiplier(2), days: 1,
                         description: "Para llenar el día más tranquilo de tu semana.",
                         passHeader: "HOY DOBLE", passBanner: "sparkle", endsOnFirstStamp: true),
        CampaignTemplate(id: "happy_hour", name: "Hora feliz", headline: "De 3 a 6 sumas doble",
                         body: "Esta semana, cada visita entre las 3 y las 6 suma dos sellos.", offer: .multiplier(2),
                         days: 7, hours: ("15:00", "18:00"),
                         description: "Mueve gente a las horas muertas de la tarde.",
                         passHeader: "HORA FELIZ", passBanner: "stars"),
        CampaignTemplate(id: "win_back", name: "Recupéralos", headline: "Te dejamos un sello de regalo",
                         body: "Hace rato no te vemos, {{name}}. Pasa y encuentra un sello ya puesto en tu tarjeta.",
                         offer: .bonusStamps(1), days: 14, segment: "missing",
                         description: "Para quienes llevan más de lo normal sin aparecer.",
                         passHeader: "TE EXTRAÑAMOS", passBanner: "hearts", endsOnFirstStamp: true),
        CampaignTemplate(id: "double_stamps", name: "Sellos dobles", headline: "Fin de semana de sellos dobles",
                         body: "Viernes, sábado y domingo cada visita cuenta por dos.", offer: .multiplier(2), days: 3,
                         description: "Un empujón corto, sin regalar nada de tu margen.",
                         passHeader: "SELLOS DOBLES", passBanner: "sparkle"),
        CampaignTemplate(id: "spend_and_get", name: "Gasta y gana", headline: "Un sello extra en tu próxima visita",
                         body: "Llévate algo más y te ponemos un sello de más. Van {{stamps}} de tu tarjeta.",
                         offer: .bonusStamps(1), days: 7, description: "Sube el ticket medio sin tocar los precios.",
                         passBanner: "gift", endsOnFirstStamp: true),
        CampaignTemplate(id: "new_offer", name: "Novedad", headline: "Algo nuevo en la carta",
                         body: "Estrenamos algo y queremos que lo pruebes tú primero, {{name}}.", offer: .messageOnly,
                         days: 10, description: "Cuenta una novedad sin regalar sellos.", passBanner: "confetti"),
        CampaignTemplate(id: "vip_thanks", name: "Gracias, habitual", headline: "Esto es solo para los de siempre",
                         body: "Gracias por volver tanto, {{name}}. La próxima te invitamos nosotros.",
                         offer: .instantReward("Invitación de la casa"), days: 14, segment: "regulars",
                         description: "Un gesto para quienes sostienen el negocio.",
                         passHeader: "PARA TI", passBanner: "gift"),
        CampaignTemplate(id: "last_chance", name: "Última llamada", headline: "Tu recompensa está por vencer",
                         body: "Te quedan {{remaining}} sellos. No dejes que se enfríe la tarjeta.", offer: .messageOnly,
                         days: 5, segment: "returning",
                         description: "Empuja a quien va a medio camino y se está enfriando.",
                         passHeader: "ÚLTIMA LLAMADA", passBanner: "sale"),
        CampaignTemplate(id: "special_deal", name: "Oferta puntual", headline: "Solo hoy, a partir de las {{hour}}",
                         body: "Una oferta corta para quien pueda pasarse. Te esperamos en {{business}}.",
                         offer: .messageOnly, days: 1,
                         description: "Para una ocasión suelta: un puente, una fecha, una sobra de stock.",
                         passHeader: "SOLO HOY", passBanner: "sale"),
    ]
}

struct CampaignTemplatePicker: View {
    @Environment(\.dismiss) private var dismiss
    let onLaunched: () -> Void

    var body: some View {
        NavigationStack {
            List(CampaignTemplate.all) { template in
                NavigationLink {
                    CampaignEditor(template: template) {
                        onLaunched()
                        dismiss()
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(template.name).font(.body.weight(.medium))
                            Spacer()
                            Text(template.offer.summary).font(.caption.weight(.semibold)).foregroundStyle(Color.volviaViolet)
                        }
                        Text(template.description).font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
            }
            .navigationTitle("Elige una plantilla")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
            }
        }
    }
}

/// The minimum a template leaves to the business: the wording, how long, and who.
struct CampaignEditor: View {
    @EnvironmentObject private var model: AppModel
    let template: CampaignTemplate
    let onLaunched: () -> Void

    @State private var headline: String
    @State private var text: String
    @State private var days: Int
    @State private var audience: Audience
    @State private var reach: AudiencePreview?
    @State private var confirming = false
    @State private var error: String?
    @State private var isWorking = false

    init(template: CampaignTemplate, onLaunched: @escaping () -> Void) {
        self.template = template
        self.onLaunched = onLaunched
        _headline = State(initialValue: template.headline)
        _text = State(initialValue: template.body)
        _days = State(initialValue: template.days)
        _audience = State(initialValue: Audience(segment: template.segment))
    }

    private var valid: Bool {
        (2...60).contains(headline.trimmingCharacters(in: .whitespaces).count)
            && (2...240).contains(text.trimmingCharacters(in: .whitespaces).count)
    }

    var body: some View {
        Form {
            Section {
                LabeledContent("Oferta", value: template.offer.summary)
                if let hours = template.hours {
                    LabeledContent("Horario", value: "\(hours.from) a \(hours.to)")
                }
                Stepper(value: $days, in: 1...60) {
                    LabeledContent("Duración", value: days == 1 ? "1 día" : "\(days) días")
                }
            } header: {
                Text(template.name)
            } footer: {
                Text("Empieza ahora y termina el \(DateText.short(Date().addingTimeInterval(Double(days) * 86_400))).")
            }

            Section {
                TextField("Título", text: $headline)
                    .onChange(of: headline) { _, value in if value.count > 60 { headline = String(value.prefix(60)) } }
                TextField("Mensaje", text: $text, axis: .vertical)
                    .lineLimit(3...6)
                    .onChange(of: text) { _, value in if value.count > 240 { text = String(value.prefix(240)) } }
            } header: {
                Text("Qué dice")
            } footer: {
                Text("{{name}} se cambia por el nombre de cada cliente.")
            }

            Section {
                AudiencePicker(audience: $audience)
            } header: {
                Text("A quién")
            } footer: {
                if let reach {
                    Text("Llega a \(reach.size) \(reach.size == 1 ? "cliente" : "clientes") que aceptaron novedades.")
                } else {
                    Text("Calculando a cuántos les llega…")
                }
            }

            if let error {
                Section { Text(error).foregroundStyle(.red) }
            }

            Section {
                Button {
                    confirming = true
                } label: {
                    Text(isWorking ? "Lanzando…" : "Lanzar campaña").font(.headline).frame(maxWidth: .infinity)
                }
                .disabled(!valid || isWorking)
            }
        }
        .navigationTitle("Nueva campaña")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: audience) {
            reach = nil
            reach = try? await model.api.previewCampaign(audience)
        }
        .confirmationDialog("¿Lanzar \(template.name)?", isPresented: $confirming, titleVisibility: .visible) {
            Button("Lanzar ahora") { Task { await launch() } }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Se avisa a \(reach?.size ?? 0) clientes y la oferta aplica desde ya.")
        }
    }

    private func launch() async {
        let start = Date()
        let draft = CampaignDraft(
            name: template.name,
            template: template.id,
            headline: headline.trimmingCharacters(in: .whitespacesAndNewlines),
            body: text.trimmingCharacters(in: .whitespacesAndNewlines),
            offer: template.offer,
            audience: audience,
            startsAt: start,
            endsAt: start.addingTimeInterval(Double(days) * 86_400),
            activeHours: template.hours,
            passHeader: template.passHeader,
            passBanner: template.passBanner,
            endsOnFirstStamp: template.endsOnFirstStamp
        )
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await model.api.launchCampaign(draft)
            Haptics.success()
            onLaunched()
        } catch {
            self.error = model.describe(error)
        }
    }
}
