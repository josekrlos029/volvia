import AuthenticationServices
import GoogleSignIn
import SwiftUI

/// Signing in on a shared phone, at a counter, probably in a hurry.
///
/// Apple and Google come first because they are one tap. App Store rule 4.8 wants the
/// Apple button at least as prominent as any other third-party sign-in, so the two
/// buttons share a size and Apple's goes on top.
struct LoginView: View {
    @EnvironmentObject private var model: AppModel

    #if targetEnvironment(simulator)
    // A filled-in form reads better in the store screenshot than two empty fields.
    @State private var email = SimulatorFixtures.state == .login ? "ana@cafe-raices.test" : ""
    @State private var password = SimulatorFixtures.state == .login ? "volvia-local-2026" : ""
    #else
    @State private var email = ""
    @State private var password = ""
    #endif
    @State private var isWorking = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Volvia Biz")
                        .font(.system(size: 15, weight: .semibold))
                    Text("Entra para empezar a sellar")
                        .font(.system(size: 26, weight: .semibold))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.bottom, 8)

                VStack(spacing: 10) {
                    SignInWithAppleButton(.signIn) { request in
                        request.requestedScopes = [.email, .fullName]
                    } onCompletion: { result in
                        Task { await signInWithApple(result) }
                    }
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 9))

                    if AppModel.googleSignInAvailable {
                        Button {
                            Task { await signInWithGoogle() }
                        } label: {
                            HStack(spacing: 8) {
                                GoogleMark().frame(width: 18, height: 18)
                                Text("Entrar con Google")
                                    .font(.system(size: 17, weight: .medium))
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                        }
                        .buttonStyle(.bordered)
                        .tint(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 9))
                    }
                }
                .disabled(isWorking)

                HStack(spacing: 12) {
                    Rectangle().fill(.quaternary).frame(height: 1)
                    Text("o").font(.system(size: 13)).foregroundStyle(.secondary)
                    Rectangle().fill(.quaternary).frame(height: 1)
                }

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
            }
            .padding(24)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: - Email

    private func signIn() async {
        await run { try await model.signIn(email: email, password: password) }
    }

    // MARK: - Apple

    private func signInWithApple(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .failure(let failure):
            // Closing the sheet is not an error worth a red line.
            if (failure as? ASAuthorizationError)?.code == .canceled { return }
            error = "No pudimos entrar con Apple. Intenta de nuevo."
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let data = credential.identityToken,
                  let token = String(data: data, encoding: .utf8)
            else {
                error = "Apple no devolvió una identidad válida."
                return
            }
            let name = credential.fullName.map {
                PersonNameComponentsFormatter.localizedString(from: $0, style: .default)
            }
            await run { try await model.signIn(appleIdentityToken: token, name: name) }
        }
    }

    // MARK: - Google

    private func signInWithGoogle() async {
        guard let presenter = Self.presentingViewController() else {
            error = "No pudimos abrir Google. Intenta de nuevo."
            return
        }
        await run {
            let result: GIDSignInResult
            do {
                result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
            } catch let failure as NSError
                where failure.domain == kGIDSignInErrorDomain
                && failure.code == GIDSignInError.canceled.rawValue {
                return
            }
            guard let token = result.user.idToken?.tokenString else {
                throw APIError(status: 0, code: "DECODE", message: "Google no devolvió una identidad válida.")
            }
            try await model.signIn(googleIdToken: token)
        }
    }

    @MainActor
    private static func presentingViewController() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController
    }

    // MARK: - Shared

    private func run(_ work: () async throws -> Void) async {
        isWorking = true
        error = nil
        defer { isWorking = false }

        do {
            try await work()
        } catch let failure as APIError {
            error = Self.message(for: failure)
        } catch {
            self.error = "Algo salió mal. Intenta de nuevo."
        }
    }

    private static func message(for failure: APIError) -> String {
        switch failure.code {
        case "INVALID_CREDENTIALS":
            return "Correo o contraseña incorrectos."
        case "OFFLINE":
            return "Sin conexión. Para entrar la primera vez hace falta internet."
        case "ACCOUNT_NOT_FOUND":
            return "Ese correo no tiene cuenta en Volvia. Pide al dueño del negocio que te invite desde el panel."
        case "SOCIAL_EMAIL_HIDDEN":
            return "Apple nos dio un correo oculto. En Ajustes → tu nombre → Inicio de sesión con Apple → Volvia Biz, deja de usar Apple ID y vuelve a entrar eligiendo \"Compartir mi correo\"."
        case "SERVICE_UNAVAILABLE":
            return "Ese método de entrada no está disponible ahora."
        default:
            return failure.message
        }
    }
}

/// The four-colour "G", drawn so the button needs no image asset.
private struct GoogleMark: View {
    var body: some View {
        Canvas { context, size in
            let rect = CGRect(origin: .zero, size: size).insetBy(dx: 1, dy: 1)
            let width = rect.width * 0.22
            let arcs: [(Color, Angle, Angle)] = [
                (Color(red: 0.26, green: 0.52, blue: 0.96), .degrees(-45), .degrees(45)),
                (Color(red: 0.20, green: 0.66, blue: 0.33), .degrees(45), .degrees(135)),
                (Color(red: 0.98, green: 0.74, blue: 0.02), .degrees(135), .degrees(225)),
                (Color(red: 0.92, green: 0.26, blue: 0.21), .degrees(225), .degrees(315)),
            ]
            for (color, from, to) in arcs {
                var path = Path()
                path.addArc(
                    center: CGPoint(x: rect.midX, y: rect.midY),
                    radius: rect.width / 2 - width / 2,
                    startAngle: from, endAngle: to, clockwise: false
                )
                context.stroke(path, with: .color(color), lineWidth: width)
            }
            var bar = Path()
            bar.move(to: CGPoint(x: rect.midX, y: rect.midY))
            bar.addLine(to: CGPoint(x: rect.maxX - width / 2, y: rect.midY))
            context.stroke(bar, with: .color(Color(red: 0.26, green: 0.52, blue: 0.96)), lineWidth: width)
        }
    }
}
