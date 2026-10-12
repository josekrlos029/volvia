package co.volvia.biz.core

/**
 * API errors in the words a staff member reads, the same copy as the iOS app
 * (apps/ios/Sources/Core/AppModel.swift). Plain functions so the JVM tests can pin them.
 */
object Messages {
    const val GENERIC = "Algo salió mal. Intenta de nuevo."
    const val GOOGLE_FAILED = "No pudimos entrar con Google. Intenta de nuevo."
    const val GOOGLE_NO_IDENTITY = "Google no devolvió una identidad válida."
    const val REDEEM_FAILED = "No pudimos entregar la recompensa."
    const val NOT_A_CARD = "Ese código no es una tarjeta de Volvia."

    fun signIn(error: ApiException): String = when (error.code) {
        "INVALID_CREDENTIALS" -> "Correo o contraseña incorrectos."
        "OFFLINE" -> "Sin conexión. Para entrar la primera vez hace falta internet."
        "ACCOUNT_NOT_FOUND" ->
            "Ese correo no tiene cuenta en Volvia. Pide al dueño del negocio que te invite desde el panel."
        "SERVICE_UNAVAILABLE" -> "Ese método de entrada no está disponible ahora."
        else -> error.message
    }

    fun stamp(error: ApiException): String = when (error.code) {
        "CUSTOMER_CARD_NOT_FOUND", "CARD_NOT_FOUND" -> "Esa tarjeta ya no existe."
        "CARD_NOT_ACTIVE" -> "Esa tarjeta no está activa."
        "CUSTOMER_CARD_BLOCKED" -> "Esa tarjeta está bloqueada."
        "STAMP_COOLDOWN_ACTIVE", "STAMP_TOO_SOON" -> "Ya tiene un sello muy reciente."
        "STAMP_DAILY_CAP_REACHED", "DAILY_CAP_REACHED" -> "Llegó al tope de sellos de hoy."
        "FORBIDDEN", "NOT_A_MEMBER" -> "Esa tarjeta no es de este negocio."
        else -> error.message
    }
}
