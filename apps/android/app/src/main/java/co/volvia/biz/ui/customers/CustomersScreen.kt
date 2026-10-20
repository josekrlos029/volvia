package co.volvia.biz.ui.customers

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import co.volvia.biz.core.CustomerListItem
import co.volvia.biz.core.Dates
import co.volvia.biz.core.Phone
import co.volvia.biz.ui.EmptyState
import co.volvia.biz.ui.ErrorState
import co.volvia.biz.ui.LoadingState
import co.volvia.biz.ui.TabTitle
import co.volvia.biz.ui.UiState

/** "Clientes": find anyone in a couple of letters, and sign a new one up at the counter. */
@Composable
fun CustomersScreen(app: UiState, model: CustomersViewModel, onCustomer: (String) -> Unit, onEnroll: () -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    val list = rememberLazyListState()

    // Ask for the next page a few rows before the end, so scrolling never hits a wall.
    val nearEnd by remember {
        derivedStateOf {
            val last = list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            last >= list.layoutInfo.totalItemsCount - 5
        }
    }
    LaunchedEffect(nearEnd, state.items.size) { if (nearEnd) model.loadMore() }

    Box(Modifier.fillMaxSize().statusBarsPadding()) {
        Column(Modifier.fillMaxSize()) {
            TabTitle("Clientes", if (state.total > 0) "${state.total} en total" else null)
            OutlinedTextField(
                value = state.query,
                onValueChange = model::search,
                placeholder = { Text("Nombre, correo o celular") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                trailingIcon = {
                    if (state.query.isNotEmpty()) {
                        IconButton(onClick = { model.search("") }) { Icon(Icons.Filled.Close, contentDescription = "Borrar búsqueda") }
                    }
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                ),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            )
            if (state.masked) {
                Text(
                    "Tu plan muestra el correo y el celular ocultos.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 20.dp),
                )
            }

            when {
                state.isLoading && state.items.isEmpty() -> LoadingState()
                state.error != null && state.items.isEmpty() -> ErrorState(state.error!!, onRetry = { model.reload() })
                state.items.isEmpty() -> EmptyState(
                    if (state.query.isBlank()) "Aún no hay clientes" else "Nadie con “${state.query}”",
                    if (state.query.isBlank()) "Inscribe al primero con el botón de abajo." else "Prueba con otra parte del nombre o el celular.",
                )
                else -> LazyColumn(
                    state = list,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 120.dp),
                ) {
                    itemsIndexed(state.items, key = { _, item -> item.id }) { index, item ->
                        CustomerRow(item, first = index == 0, last = index == state.items.lastIndex) { onCustomer(item.id) }
                    }
                    if (state.isLoadingMore) item { LoadingState(label = "Cargando más…") }
                }
            }
        }

        ExtendedFloatingActionButton(
            onClick = onEnroll,
            icon = { Icon(Icons.Filled.Add, contentDescription = null) },
            text = { Text("Inscribir", fontWeight = FontWeight.SemiBold) },
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }
}

@Composable
private fun CustomerRow(item: CustomerListItem, first: Boolean, last: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(
        topStart = if (first) 12.dp else 0.dp,
        topEnd = if (first) 12.dp else 0.dp,
        bottomStart = if (last) 12.dp else 0.dp,
        bottomEnd = if (last) 12.dp else 0.dp,
    )
    Surface(shape = shape, color = colors.surface, modifier = Modifier.fillMaxWidth()) {
        Column {
            Row(
                Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Initial(item.firstName)
                Column(Modifier.weight(1f)) {
                    Text(item.firstName, fontSize = 16.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        item.phone?.takeIf { it.isNotBlank() }?.let { Phone.display(Phone.normalize(it) ?: it) } ?: item.email,
                        fontSize = 13.sp,
                        color = colors.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("${item.totalStamps} ${if (item.totalStamps == 1) "sello" else "sellos"}", fontSize = 14.sp)
                    item.lastStampAt?.let { Text(Dates.relative(it), fontSize = 12.sp, color = colors.onSurfaceVariant) }
                }
            }
            if (!last) HorizontalDivider(Modifier.padding(start = 64.dp), color = colors.outlineVariant)
        }
    }
}

@Composable
fun Initial(name: String, size: Int = 36) {
    Box(
        Modifier.size(size.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            name.take(1).uppercase(),
            color = MaterialTheme.colorScheme.onPrimaryContainer,
            fontSize = (size * 0.42f).sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
