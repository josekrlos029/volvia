import SwiftUI

/// Signing in on a shared phone, at a counter, probably in a hurry.
struct LoginView: View {
    @EnvironmentObject private var model: AppModel

    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Volvia Biz")
                    .font(.system(size: 15, weight: .semibold))
                Text("Entra para empezar a sellar")
                    .font(.system(size: 26, weight: .semibold))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.bottom, 8)

            VStack(alignment: .leading, spacing: 6) {
                Text("Correo").font(.system(size: 14, weight: .medium))
                TextField("", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Contraseña").font(.system(size: 14, weight: .medium))
                SecureField("", text: $password)
                    .textContentType(.password)
                    .textFieldStyle(.roundedBorder)
            }

            if let error {
                Text(error)
                    .font(.system(size: 14))
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button {
                Task { await signIn() }
            } label: {
                Text(isWorking ? "Entrando" : "Entrar")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isWorking || email.isEmpty || password.isEmpty)

            Text("Usa el mismo correo con el que entras al panel de Volvia.")
                .font(.system(size: 13))
                .foregroundStyle(.secondary)

            Spacer()
        }
        .padding(24)
    }

    private func signIn() async {
        isWorking = true
        error = nil
        defer { isWorking = false }

        do {
            try await model.signIn(email: email, password: password)
        } catch let failure as APIError {
            error = failure.code == "INVALID_CREDENTIALS"
                ? "Correo o contraseña incorrectos."
                : failure.code == "OFFLINE"
                    ? "Sin conexión. Para entrar la primera vez hace falta internet."
                    : failure.message
        } catch {
            // `error` here is the thrown value; the field is the one on the view.
            self.error = "Algo salió mal. Intenta de nuevo."
        }
    }
}
