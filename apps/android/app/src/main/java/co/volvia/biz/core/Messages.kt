package co.volvia.biz.core

/**
 * API errors in the words a staff member reads, the same copy as the iOS app
 * (apps/ios/Sources/Core/AppModel.swift). Plain functions so the JVM tests can pin them.
 */
object Messages {
    const val GENERIC = "Algo salió mal. Intenta de nuevo."
    const val OFFLINE = "Sin conexión. Revisa el internet e intenta de nuevo."
    const val GOOGLE_FAILED = "No pudimos entrar con Google. Intenta de nuevo."
    const val GOOGLE_NO_IDENTITY = "Google no devolvió una identidad válida."
    const val REDEEM_FAILED = "No pudimos entregar la recompensa."
    const val NOT_A_CARD = "Ese código no es una tarjeta de Volvia."
    const val COOLDOWN = "Ya recibió sello hace poco."
    const val DAILY_CAP = "Llegó al límite de sellos de hoy."

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
        "STAMP_COOLDOWN_ACTIVE", "STAMP_TOO_SOON" -> cooldown(error.retryAfterSeconds ?: 0)
        "STAMP_DAILY_CAP_REACHED", "DAILY_CAP_REACHED" -> DAILY_CAP
        "FORBIDDEN", "NOT_A_MEMBER" -> "Esa tarjeta no es de este negocio."
        // The only validation a scan can fail at the counter is the purchase amount.
        "VALIDATION_FAILED" -> amount(error)
        "OFFLINE" -> OFFLINE
        else -> common(error)
    }

    /** The cooldown with the wait spelled out, when the lookup told us how long it is. */
    fun cooldown(secondsLeft: Int): String {
        if (secondsLeft <= 0) return COOLDOWN
        val minutes = (secondsLeft + 59) / 60
        return "Ya recibió sello hace poco (espera $minutes min)"
    }

    fun redeem(error: ApiException): String = when (error.code) {
        "REWARD_NOT_AVAILABLE" -> "Ese premio no está disponible: ya venció, se anuló o el código no existe."
        "REWARD_ALREADY_REDEEMED" -> "Ese premio ya se entregó."
        "VALIDATION_FAILED" -> "Revisa el código: son de 4 a 12 letras o números."
        "OFFLINE" -> OFFLINE
        else -> common(error)
    }

    fun void(error: ApiException): String = when (error.code) {
        "STAMP_VOID_NOT_ALLOWED" ->
            "Ya no se puede deshacer: pasaron más de 5 minutos, lo hizo otra persona o la tarjeta cambió después."
        "NOT_FOUND" -> "Ese sello ya no existe."
        "OFFLINE" -> OFFLINE
        else -> common(error)
    }

    fun enroll(error: ApiException): String = when (error.code) {
        "VALIDATION_FAILED" -> "Revisa los datos: el correo y el celular deben ser válidos."
        "CARD_NOT_ACTIVE" -> "Esa tarjeta no está recibiendo clientes nuevos."
        "CARD_NOT_FOUND" -> "Esa tarjeta ya no existe."
        "PLAN_LIMIT_REACHED" -> "Llegaste al máximo de clientes de tu plan."
        "OFFLINE" -> "Sin conexión. Inscribir a alguien necesita internet."
        else -> common(error)
    }

    /** Anything else that reads or saves: lists, profiles, settings. */
    fun load(error: ApiException): String = when (error.code) {
        "OFFLINE" -> OFFLINE
        else -> common(error)
    }

    private fun amount(error: ApiException): String = when {
        error.message.contains("required") -> "Escribe el monto de la compra."
        error.message.contains("minimum") -> "La compra no alcanza el mínimo para sellar."
        else -> "Revisa los datos e intenta de nuevo."
    }

    private fun common(error: ApiException): String = when (error.code) {
        "FORBIDDEN" -> "Tu rol no permite hacer esto."
        "RATE_LIMITED" -> "Demasiados intentos seguidos. Espera un momento."
        "INTERNAL", "SERVICE_UNAVAILABLE" -> GENERIC
        "FEATURE_NOT_IN_PLAN" -> "Disponible en el plan ${Plans.name(error.upgradeTo)}."
        "PLAN_LIMIT_REACHED" -> "Llegaste al límite de tu plan."
        else -> error.message.ifBlank { GENERIC }
    }
}
