package co.volvia.biz.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.volvia.biz.R
import co.volvia.biz.ui.theme.VolviaColors
import kotlinx.coroutines.launch

private val FieldShape = RoundedCornerShape(9.dp)

/**
 * Signing in on a shared phone, at a counter, probably in a hurry. Same order as iOS
 * (apps/ios/Sources/Features/LoginView.swift): Google first, then email and password.
 * There is no Apple button: Android has no native Sign in with Apple.
 */
@Composable
fun LoginScreen(state: UiState, model: AppViewModel) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val colors = MaterialTheme.colorScheme

    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Spacer(Modifier.height(24.dp))

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            VolviaMark()
            Spacer(Modifier.height(8.dp))
            Text("Volvia Biz", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = colors.onBackground)
            Text(
                "Entra para empezar a sellar",
                fontSize = 26.sp,
                fontWeight = FontWeight.SemiBold,
                lineHeight = 30.sp,
                color = colors.onBackground,
            )
        }

        if (state.googleAvailable) {
            OutlinedButton(
                onClick = {
                    model.googleStarted()
                    scope.launch {
                        when (val result = requestGoogleIdToken(context, model.googleWebClientId)) {
                            is GoogleSignInResult.Token -> model.signInWithGoogle(result.idToken)
                            GoogleSignInResult.Cancelled -> model.googleCancelled()
                            is GoogleSignInResult.Failed -> model.googleFailed(result.message)
                        }
                    }
                },
                enabled = !state.isWorking,
                shape = FieldShape,
                border = androidx.compose.foundation.BorderStroke(1.dp, colors.outline),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.onSurface),
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                GoogleMark(Modifier.size(18.dp))
                Spacer(Modifier.width(10.dp))
                Text("Entrar con Google", fontSize = 17.sp, fontWeight = FontWeight.Medium)
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                HorizontalDivider(Modifier.weight(1f), color = colors.outlineVariant)
                Text("o", fontSize = 13.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(horizontal = 12.dp))
                HorizontalDivider(Modifier.weight(1f), color = colors.outlineVariant)
            }
        }

        LabeledField("Correo") {
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                singleLine = true,
                shape = FieldShape,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        LabeledField("Contraseña") {
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                singleLine = true,
                shape = FieldShape,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        state.signInError?.let {
            Text(it, color = colors.error, fontSize = 14.sp)
        }

        Button(
            onClick = { model.signIn(email.trim(), password) },
            enabled = !state.isWorking && email.isNotBlank() && password.isNotBlank(),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(50.dp),
        ) {
            Text(if (state.isWorking) "Entrando" else "Entrar", fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        }

        Text(
            "Usa el mismo correo con el que entras al panel de Volvia.",
            fontSize = 13.sp,
            color = colors.onSurfaceVariant,
        )
    }
}

@Composable
private fun LabeledField(label: String, field: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onBackground)
        field()
    }
}

/** The brand "V", white on a navy tile: the app icon, small. */
@Composable
fun VolviaMark(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(56.dp)
            .background(VolviaColors.Navy, RoundedCornerShape(14.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            painter = painterResource(R.drawable.ic_volvia_mark),
            contentDescription = "Volvia",
            modifier = Modifier.width(30.dp).offset(y = (-1).dp),
        )
    }
}

/**
 * Google's four-colour "G", drawn rather than shipped as an image, like `GoogleMark` on
 * iOS: four arcs and the bar.
 */
@Composable
private fun GoogleMark(modifier: Modifier = Modifier) {
    val blue = Color(0xFF4285F4)
    val green = Color(0xFF34A853)
    val yellow = Color(0xFFFBBC05)
    val red = Color(0xFFEA4335)
    Canvas(modifier) {
        val stroke = size.width * 0.2f
        val inset = stroke / 2
        val arc = Size(size.width - stroke, size.height - stroke)
        val topLeft = Offset(inset, inset)
        val style = Stroke(width = stroke)
        drawArc(red, startAngle = 200f, sweepAngle = 115f, useCenter = false, topLeft = topLeft, size = arc, style = style)
        drawArc(yellow, startAngle = 145f, sweepAngle = 55f, useCenter = false, topLeft = topLeft, size = arc, style = style)
        drawArc(green, startAngle = 45f, sweepAngle = 100f, useCenter = false, topLeft = topLeft, size = arc, style = style)
        drawArc(blue, startAngle = 0f, sweepAngle = 45f, useCenter = false, topLeft = topLeft, size = arc, style = style)
        drawRect(
            blue,
            topLeft = Offset(size.width / 2, size.height / 2 - stroke / 2),
            size = Size(size.width / 2, stroke),
        )
    }
}
