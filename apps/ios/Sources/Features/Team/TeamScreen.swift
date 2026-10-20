import SwiftUI

/// Who works here: members, pending invitations, and inviting someone new. Changing a
/// role or a location, or removing someone, is the owner's call alone.
struct TeamScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var team: Loadable<Team> = .loading
    @State private var inviting = false
    @State private var removing: TeamMember?
    @State private var revoking: TeamInvite?
    @State private var error: String?

    var body: some View {
        Group {
            switch team {
            case .loading:
                StatusView(kind: .loading)
            case .failed(let message):
                StatusView(kind: .failed(message) { Task { await load() } })
            case .loaded(let team):
                content(team)
            }
        }
        .navigationTitle("Equipo")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    inviting = true
                } label: {
                    Label("Invitar", systemImage: "person.badge.plus")
                }
                .accessibilityLabel("Invitar a alguien")
            }
        }
        .sheet(isPresented: $inviting) {
            InviteSheet(locations: model.locations) { Task { await load() } }
        }
        .confirmationDialog(
            "¿Quitar a \(removing?.name ?? "")?",
            isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }),
            titleVisibility: .visible
        ) {
            Button("Quitar del equipo", role: .destructive) {
                if let member = removing { Task { await remove(member) } }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Dejará de poder sellar y entrar a este negocio.")
        }
        .confirmationDialog(
            "¿Anular la invitación a \(revoking?.email ?? "")?",
            isPresented: Binding(get: { revoking != nil }, set: { if !$0 { revoking = nil } }),
            titleVisibility: .visible
        ) {
            Button("Anular invitación", role: .destructive) {
                if let invite = revoking { Task { await revoke(invite) } }
            }
            Button("Cancelar", role: .cancel) {}
        }
        .alert("No se pudo", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
            Button("Entendido", role: .cancel) {}
        } message: {
            Text(error ?? "")
        }
        .refreshable { await load() }
        .task { await load() }
    }

    private func content(_ team: Team) -> some View {
        List {
            Section {
                ForEach(team.members) { member in
                    memberRow(member)
                }
            } header: {
                Text("Miembros")
            } footer: {
                Text(team.seatLimit.map { "\(team.seats) de \($0) puestos en uso." } ?? "\(team.seats) puestos en uso.")
            }

            Section("Invitaciones pendientes") {
                if team.pending.isEmpty {
                    Text("No hay invitaciones pendientes.").foregroundStyle(.secondary)
                } else {
                    ForEach(team.pending) { invite in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(invite.email)
                                Text(RoleName.label(invite.role)).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Anular", role: .destructive) { revoking = invite }
                                .buttonStyle(.borderless)
                        }
                    }
                }
            }
        }
    }

    private func memberRow(_ member: TeamMember) -> some View {
        let isSelf = member.userId == model.session.user?.id
        return HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(member.name + (isSelf ? " (tú)" : "")).font(.body.weight(.medium))
                Text(member.email).font(.caption).foregroundStyle(.secondary)
                Text(RoleName.label(member.role) + locationSuffix(member.locationId))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if model.isOwner && member.role != "owner" && !isSelf {
                Menu {
                    Picker("Rol", selection: Binding(
                        get: { member.role },
                        set: { role in Task { await update(member, role: role, locationId: nil) } }
                    )) {
                        Text("Equipo").tag("staff")
                        Text("Administrador").tag("admin")
                    }
                    if model.locations.count > 1 {
                        Picker("Sede", selection: Binding(
                            get: { member.locationId ?? "" },
                            set: { id in Task { await update(member, role: nil, locationId: .some(id.isEmpty ? nil : id)) } }
                        )) {
                            Text("Todas las sedes").tag("")
                            ForEach(model.locations) { Text($0.name).tag($0.id) }
                        }
                    }
                    Divider()
                    Button("Quitar del equipo", systemImage: "person.badge.minus", role: .destructive) {
                        removing = member
                    }
                } label: {
                    Image(systemName: "ellipsis.circle").font(.title3)
                }
                .accessibilityLabel("Opciones de \(member.name)")
            }
        }
    }

    private func locationSuffix(_ id: String?) -> String {
        guard let id, let location = model.locations.first(where: { $0.id == id }) else { return "" }
        return " · \(location.name)"
    }

    private func load() async {
        do {
            team = .loaded(try await model.api.team())
        } catch {
            team = .failed(model.describe(error) ?? "No disponible en tu plan.")
        }
    }

    private func update(_ member: TeamMember, role: String?, locationId: String??) async {
        do {
            try await model.api.updateMember(id: member.id, role: role, locationId: locationId)
            await load()
        } catch {
            self.error = model.describe(error)
        }
    }

    private func remove(_ member: TeamMember) async {
        do {
            try await model.api.removeMember(id: member.id)
            Haptics.warning()
            await load()
        } catch {
            self.error = model.describe(error)
        }
    }

    private func revoke(_ invite: TeamInvite) async {
        do {
            try await model.api.revokeInvite(id: invite.id)
            await load()
        } catch {
            self.error = model.describe(error)
        }
    }
}

struct InviteSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let locations: [OrgLocation]
    let onInvited: () -> Void

    @State private var email = ""
    @State private var role = "staff"
    @State private var locationId = ""
    @State private var error: String?
    @State private var isWorking = false

    private var emailIsValid: Bool {
        email.trimmingCharacters(in: .whitespaces).range(of: #"^[^@\s]+@[^@\s]+\.[^@\s]+$"#, options: .regularExpression) != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("correo@ejemplo.com", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Correo")
                } footer: {
                    Text("Le llega un correo para crear su acceso.")
                }
                Section {
                    Picker("Rol", selection: $role) {
                        Text("Equipo: solo sella y entrega premios").tag("staff")
                        Text("Administrador: también gestiona").tag("admin")
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                } header: {
                    Text("Rol")
                }
                if locations.count > 1 {
                    Section("Sede") {
                        Picker("Sede", selection: $locationId) {
                            Text("Todas las sedes").tag("")
                            ForEach(locations) { Text($0.name).tag($0.id) }
                        }
                    }
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Invitar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isWorking ? "Enviando…" : "Invitar") { Task { await invite() } }
                        .disabled(!emailIsValid || isWorking)
                }
            }
        }
    }

    private func invite() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await model.api.invite(
                email: email.trimmingCharacters(in: .whitespaces).lowercased(),
                role: role,
                locationId: locationId.isEmpty ? nil : locationId
            )
            Haptics.success()
            onInvited()
            dismiss()
        } catch {
            self.error = model.describe(error)
        }
    }
}
