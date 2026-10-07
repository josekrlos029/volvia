package co.volvia.biz.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.volvia.biz.core.ScanOutcomeUi

/** Signing in on a shared phone, at a counter, probably in a hurry. */
@Composable
fun LoginScreen(state: UiState, onSignIn: (String, String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.height(40.dp))
        Text("Volvia Biz", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "Entra para empezar a sellar",
            fontSize = 26.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = 30.sp,
        )

        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Correo") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Contraseña") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
        )

        state.signInError?.let {
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
        }

        Button(
            onClick = { onSignIn(email.trim(), password) },
            enabled = !state.isWorking && email.isNotBlank() && password.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(50.dp),
        ) {
            Text(if (state.isWorking) "Entrando" else "Entrar")
        }

        Text(
            "Usa el mismo correo con el que entras al panel de Volvia.",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** What happened, in the words a person would use, large enough to read at arm's length. */
@Composable
fun ScanOutcomeCard(
    outcome: ScanOutcomeUi,
    onRedeem: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        tonalElevation = 3.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(outcome.title, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
            Text(
                outcome.body,
                fontSize = 16.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            outcome.rewardGrantId?.let { grantId ->
                HorizontalDivider()
                outcome.rewardTitle?.let {
                    Text(it, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                }
                Button(onClick = { onRedeem(grantId) }) { Text("Entregar ahora") }
            }

            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) {
                Text("Siguiente cliente")
            }
        }
    }
}

/** The viewfinder frame. Everything that is not the camera belongs on another screen. */
@Composable
fun AimFrame(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier
                .size(228.dp)
                .border(3.dp, Color.White.copy(alpha = 0.9f), RoundedCornerShape(22.dp)),
        )
        Text("Apunta al código del cliente", color = Color.White, fontSize = 15.sp)
    }
}

@Composable
fun ScanHeader(businessName: String, pendingCount: Int, onAccount: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.Black.copy(alpha = 0.45f))
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(businessName, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            if (pendingCount > 0) {
                // The only number worth showing here: stamps taken and not yet sent.
                Text("$pendingCount por enviar", color = Color.White, fontSize = 12.sp)
            }
        }
        TextButton(onClick = onAccount) { Text("Cuenta", color = Color.White) }
    }
}
