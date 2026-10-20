import Charts
import SwiftUI

/// The last 30 days in numbers, a chart of the stamps, when the shop fills up and how
/// many customers come back. The last two need `full_analytics`.
struct StatsScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var overview: Loadable<AnalyticsOverview> = .loading
    @State private var series: [TimeseriesPoint] = []
    @State private var busiest: Gated<Busiest> = .loading
    @State private var retention: Gated<Retention> = .loading
    @State private var announcedGate = false

    /// A section that may be outside the plan: shown locked rather than as an error.
    enum Gated<Value> {
        case loading
        case locked(plan: String?)
        case failed(String)
        case loaded(Value)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                switch overview {
                case .loading:
                    StatusView(kind: .loading)
                case .failed(let message):
                    StatusView(kind: .failed(message) { Task { await load() } })
                case .loaded(let overview):
                    kpis(overview)
                    chart
                    busiestSection
                    retentionSection
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Estadísticas")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
    }

    // MARK: - KPIs

    private func kpis(_ overview: AnalyticsOverview) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Últimos 30 días").font(.headline)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                MetricTile(title: "Clientes", value: "\(overview.customers.total)",
                           detail: "\(overview.customers.new) nuevos\(change(overview.customers.changePct))")
                MetricTile(title: "Sellos", value: "\(overview.stamps.total)",
                           detail: change(overview.stamps.changePct, prefix: false), tint: .volviaViolet)
                MetricTile(title: "Premios entregados", value: "\(overview.rewards.redeemed)",
                           detail: "de \(overview.rewards.unlocked) ganados", tint: .volviaOrange)
                MetricTile(title: "Vuelven", value: "\(Int(overview.repeatRate.rounded()))%",
                           detail: "\(String(format: "%.1f", overview.averageVisitsPerCustomer)) visitas por cliente")
                MetricTile(title: "Días entre visitas", value: overview.medianDaysBetweenVisits.map { "\(Int($0.rounded()))" } ?? "—",
                           detail: "mediana", tint: .volviaViolet)
                MetricTile(title: "Tarjetas activas", value: "\(overview.activeCards)",
                           detail: overview.pageViews.map { "\($0) visitas a tu página" }, tint: .volviaInk)
            }
        }
    }

    private func change(_ pct: Double?, prefix: Bool = true) -> String {
        guard let pct else { return prefix ? "" : "Sin comparación" }
        let sign = pct >= 0 ? "+" : ""
        let text = "\(sign)\(Int(pct.rounded()))% vs. antes"
        return prefix ? " · \(text)" : text
    }

    // MARK: - Chart

    private var chart: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Sellos por día").font(.headline)
            if series.isEmpty {
                Text("Sin datos todavía.").foregroundStyle(.secondary)
            } else {
                Chart(series) { point in
                    if let day = point.day {
                        BarMark(x: .value("Día", day, unit: .day), y: .value("Sellos", point.stamps))
                            .foregroundStyle(Color.volviaNavy)
                        if point.joins > 0 {
                            PointMark(x: .value("Día", day, unit: .day), y: .value("Inscritos", point.joins))
                                .foregroundStyle(Color.volviaOrange)
                                .symbolSize(30)
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .stride(by: .day, count: 7)) { _ in
                        AxisGridLine()
                        AxisValueLabel(format: .dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_CO")))
                    }
                }
                .frame(height: 200)
                .accessibilityLabel("Sellos por día en los últimos 30 días: \(series.reduce(0) { $0 + $1.stamps }) en total")
                HStack(spacing: 14) {
                    legend("Sellos", .volviaNavy)
                    legend("Inscritos", .volviaOrange)
                }
                .font(.caption)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    private func legend(_ label: String, _ color: Color) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label).foregroundStyle(.secondary)
        }
    }

    // MARK: - Busiest

    private static let weekdays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

    private var busiestSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Horas pico").font(.headline)
            Text("Últimos 90 días").font(.caption).foregroundStyle(.secondary)
            switch busiest {
            case .loading: ProgressView()
            case .locked(let plan): locked(plan)
            case .failed(let message): Text(message).foregroundStyle(.secondary)
            case .loaded(let busiest): heatmap(busiest)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    /// The API answers per weekday and per hour separately, so the map is two heat rows
    /// (days of the week, hours of the day) rather than a 7 × 24 grid it cannot fill.
    private func heatmap(_ busiest: Busiest) -> some View {
        let dayMax = max(1, busiest.byWeekday.map(\.stamps).max() ?? 1)
        let hourMax = max(1, busiest.byHour.map(\.stamps).max() ?? 1)
        // Monday first, as a Colombian calendar reads.
        let days = busiest.byWeekday.sorted { ($0.weekday + 6) % 7 < ($1.weekday + 6) % 7 }
        let hours = busiest.byHour.filter { (6...23).contains($0.hour) }
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 4) {
                ForEach(days, id: \.weekday) { day in
                    VStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color.volviaNavy.opacity(0.1 + 0.9 * Double(day.stamps) / Double(dayMax)))
                            .frame(height: 34)
                        Text(Self.weekdays[day.weekday % 7]).font(.caption2).foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(Self.weekdays[day.weekday % 7]): \(day.stamps) sellos")
                }
            }
            HStack(spacing: 2) {
                ForEach(hours, id: \.hour) { hour in
                    VStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.volviaViolet.opacity(0.1 + 0.9 * Double(hour.stamps) / Double(hourMax)))
                            .frame(height: 34)
                        Text(hour.hour % 3 == 0 ? "\(hour.hour)" : " ")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(hour.hour):00: \(hour.stamps) sellos")
                }
            }
            if let peakDay = days.max(by: { $0.stamps < $1.stamps }), peakDay.stamps > 0,
               let peakHour = hours.max(by: { $0.stamps < $1.stamps }) {
                Text("Más movimiento: \(Self.weekdays[peakDay.weekday % 7].lowercased()) hacia las \(peakHour.hour):00.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Retention

    private var retentionSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Retención").font(.headline)
            Text("De cada mes de inscripción, qué parte volvió en los meses siguientes.")
                .font(.caption)
                .foregroundStyle(.secondary)
            switch retention {
            case .loading: ProgressView()
            case .locked(let plan): locked(plan)
            case .failed(let message): Text(message).foregroundStyle(.secondary)
            case .loaded(let retention):
                if retention.cohorts.isEmpty {
                    Text("Aún no hay meses para comparar.").foregroundStyle(.secondary)
                } else {
                    cohorts(retention)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    private func cohorts(_ retention: Retention) -> some View {
        let width = retention.cohorts.map(\.values.count).max() ?? 0
        return ScrollView(.horizontal, showsIndicators: false) {
            Grid(horizontalSpacing: 4, verticalSpacing: 4) {
                GridRow {
                    Text("Mes").font(.caption2.weight(.semibold))
                    Text("Clientes").font(.caption2.weight(.semibold))
                    ForEach(0..<width, id: \.self) { index in
                        Text("M\(index)").font(.caption2.weight(.semibold))
                    }
                }
                ForEach(retention.cohorts) { cohort in
                    GridRow {
                        Text(cohort.cohort).font(.caption.monospacedDigit())
                        Text("\(cohort.size)").font(.caption.monospacedDigit())
                        ForEach(0..<width, id: \.self) { index in
                            let value = index < cohort.values.count ? cohort.values[index] : nil
                            Text(value.map { "\(Int($0.rounded()))%" } ?? "")
                                .font(.caption2.monospacedDigit())
                                .frame(width: 44, height: 28)
                                .background(
                                    Color.volviaNavy.opacity(value.map { 0.08 + 0.8 * $0 / 100 } ?? 0.03),
                                    in: RoundedRectangle(cornerRadius: 5)
                                )
                                .foregroundStyle((value ?? 0) > 55 ? .white : .primary)
                        }
                    }
                }
            }
        }
    }

    private func locked(_ plan: String?) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "lock.fill").foregroundStyle(Color.volviaViolet).accessibilityHidden(true)
            Text("Disponible en el plan \(PlanName.label(plan)).")
            Spacer()
            Button("Ver") { model.planGate = PlanGate(plan: plan, isLimit: false) }
                .buttonStyle(.bordered)
        }
        .font(.subheadline)
    }

    // MARK: - Loading

    private func load() async {
        let api = model.api
        async let overviewCall = api.overview()
        async let seriesCall = api.timeseries()
        async let busiestCall = Self.capture { try await api.busiest() }
        async let retentionCall = Self.capture { try await api.retention() }

        do {
            overview = .loaded(try await overviewCall)
        } catch {
            overview = .failed(model.describe(error) ?? "No disponible en tu plan.")
        }
        series = (try? await seriesCall) ?? series
        busiest = gated(await busiestCall)
        retention = gated(await retentionCall)

        // Outside the plan: the sheet says so once, and the sections stay locked below.
        if !announcedGate {
            if case .locked(let plan) = busiest {
                announcedGate = true
                model.planGate = PlanGate(plan: plan, isLimit: false)
            } else if case .locked(let plan) = retention {
                announcedGate = true
                model.planGate = PlanGate(plan: plan, isLimit: false)
            }
        }
    }

    /// A 402 here locks the section instead of failing the screen, so the KPIs above
    /// stay readable behind the plan sheet.
    private func gated<Value>(_ result: Result<Value, Error>) -> Gated<Value> {
        switch result {
        case .success(let value):
            return .loaded(value)
        case .failure(let error as APIError) where error.isPlanGate:
            return .locked(plan: error.upgradeTo)
        case .failure(let error):
            return .failed(model.describe(error) ?? "No disponible.")
        }
    }

    private static func capture<Value: Sendable>(_ work: @Sendable () async throws -> Value) async -> Result<Value, Error> {
        do {
            return .success(try await work())
        } catch {
            return .failure(error)
        }
    }
}
