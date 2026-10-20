package co.volvia.biz.ui.scan

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.volvia.biz.ui.InlineError
import kotlinx.coroutines.launch

/**
 * "Código": a reward code read out or shown on the customer's screen, typed at the till.
 * For the customer whose phone has no battery left, or whose QR will not scan.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RedeemCodeSheet(model: ScanViewModel, onDismiss: () -> Unit) {
    var code by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }
    val valid = code.trim().length in 4..12

    fun submit() {
        if (!valid || working) return
        working = true
        error = null
        scope.launch {
            val failure = model.redeemCode(code)
            working = false
            if (failure == null) onDismiss() else error = failure
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.background,
    ) {
        Column(
            Modifier.fillMaxWidth().imePadding().padding(horizontal = 20.dp).padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Entregar un premio", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "Escribe el código que aparece en la tarjeta del cliente.",
                fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = code,
                onValueChange = { value -> code = value.filter { it.isLetterOrDigit() }.take(12).uppercase() },
                label = { Text("Código del premio") },
                singleLine = true,
                textStyle = LocalTextStyle.current.copy(fontSize = 22.sp, letterSpacing = 3.sp),
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Characters,
                    autoCorrectEnabled = false,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { submit() }),
                shape = RoundedCornerShape(9.dp),
                modifier = Modifier.fillMaxWidth().focusRequester(focus),
            )
            InlineError(error)
            Button(
                onClick = ::submit,
                enabled = valid && !working,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) {
                Text(if (working) "Entregando…" else "Entregar", fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
}
