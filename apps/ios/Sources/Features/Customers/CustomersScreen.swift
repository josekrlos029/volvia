import SwiftUI

/// Everyone on the business's cards, searchable, with sign-up at the counter.
struct CustomersScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var search = ""
    @State private var items: [CustomerListItem] = []
    @State private var page = 1
    @State private var hasMore = false
    @State private var total = 0
    @State private var state: Loadable<Void> = .loading
    @State private var isLoadingMore = false
    @State private var enrolling = false
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            list
                .navigationTitle("Clientes")
                .searchable(text: $search, prompt: "Nombre, correo o celular")
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            enrolling = true
                        } label: {
                            Text("+ Inscribir").font(.body.weight(.semibold))
                        }
                        .accessibilityLabel("Inscribir cliente")
                    }
                }
                .navigationDestination(for: CustomerRoute.self) { route in
                    CustomerProfileView(customerId: route.id)
                }
                // ~300 ms after the last keystroke, not on every letter.
                .task(id: search) {
                    if !search.isEmpty { try? await Task.sleep(for: .milliseconds(300)) }
                    guard !Task.isCancelled else { return }
                    await reload()
                }
                .refreshable { await reload() }
                .sheet(isPresented: $enrolling) {
                    EnrollView { customerId in
                        enrolling = false
                        model.noteChange()
                        path.append(CustomerRoute(id: customerId))
                    }
                }
        }
        #if targetEnvironment(simulator)
        .onAppear(perform: applyFixture)
        #endif
    }

    @ViewBuilder
    private var list: some View {
        switch state {
        case .loading where items.isEmpty:
            StatusView(kind: .loading)
        case .failed(let message) where items.isEmpty:
            StatusView(kind: .failed(message) { Task { await reload() } })
        default:
            if items.isEmpty {
                StatusView(kind: .empty(
                    title: search.isEmpty ? "Aún no hay clientes" : "Sin resultados",
                    message: search.isEmpty ? "Inscribe al primero con el botón +." : "Prueba con otro nombre o correo.",
                    systemImage: search.isEmpty ? "person.2" : "magnifyingglass"
                ))
            } else {
                List {
                    Section {
                        ForEach(items) { customer in
                            NavigationLink(value: CustomerRoute(id: customer.id)) {
                                row(customer)
                            }
                            .onAppear {
                                if customer.id == items.last?.id { Task { await loadMore() } }
                            }
                        }
                        if isLoadingMore {
                            HStack { Spacer(); ProgressView(); Spacer() }
                        }
                    } header: {
                        Text(total == 1 ? "1 cliente" : "\(total) clientes")
                    }
                }
            }
        }
    }

    private func row(_ customer: CustomerListItem) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Color.volviaNavy.opacity(0.12))
                Text(String(customer.firstName.prefix(1)).uppercased())
                    .font(.headline)
                    .foregroundStyle(Color.volviaNavy)
            }
            .frame(width: 38, height: 38)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(customer.firstName).font(.body.weight(.medium))
                Text(subtitle(customer))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(customer.totalStamps)")
                    .font(.headline.monospacedDigit())
                Text(customer.totalStamps == 1 ? "sello" : "sellos")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
        }
    }

    private func subtitle(_ customer: CustomerListItem) -> String {
        if let last = customer.lastStampAt { return "Última visita \(DateText.relative(last))" }
        return "Se unió \(DateText.relative(customer.joinedAt))"
    }

    private func reload() async {
        state = .loading
        do {
            let result = try await model.api.customers(search: search, page: 1)
            items = result.items
            page = 1
            hasMore = result.hasMore
            total = result.total
            state = .loaded(())
        } catch is CancellationError {
            return
        } catch {
            state = .failed(model.describe(error) ?? "No disponible en tu plan.")
        }
    }

    private func loadMore() async {
        guard hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        if let next = try? await model.api.customers(search: search, page: page + 1) {
            let known = Set(items.map(\.id))
            items += next.items.filter { !known.contains($0.id) }
            page = next.page
            hasMore = next.hasMore
        }
    }

    #if targetEnvironment(simulator)
    private func applyFixture() {
        switch SimulatorFixtures.state {
        case .profile: if path.isEmpty { path.append(CustomerRoute(id: SimulatorFixtures.customerId)) }
        case .enroll, .enrolled: enrolling = true
        default: break
        }
    }
    #endif
}
