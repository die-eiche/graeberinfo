package de.familie.kontoauszug

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import de.familie.kontoauszug.banking.TanChallenge
import de.familie.kontoauszug.data.AppSettings

class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            KontoauszugTheme {
                val state by viewModel.state.collectAsState()
                val navController = rememberNavController()

                NavHost(navController = navController, startDestination = "home") {
                    composable("home") {
                        HomeScreen(
                            state = state,
                            onOpenSettings = { navController.navigate("settings") },
                            onRun = viewModel::runFetchAndSend,
                            onSubmitTan = viewModel::submitTan,
                        )
                    }
                    composable("settings") {
                        SettingsScreen(
                            settings = state.settings,
                            onBack = { navController.popBackStack() },
                            onChange = viewModel::updateSettings,
                            onSave = {
                                viewModel.saveSettings()
                                navController.popBackStack()
                            },
                        )
                    }
                }
            }
        }
    }
}

private val Teal = Color(0xFF0F5C4C)
private val Cream = Color(0xFFF3F7F5)
private val Ink = Color(0xFF1A2B26)

@Composable
fun KontoauszugTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Teal,
            onPrimary = Color.White,
            background = Cream,
            surface = Color.White,
            onBackground = Ink,
            onSurface = Ink,
        ),
        content = content,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    state: AppUiState,
    onOpenSettings: () -> Unit,
    onRun: () -> Unit,
    onSubmitTan: (String?) -> Unit,
) {
    Scaffold(
        containerColor = Cream,
        topBar = {
            TopAppBar(
                title = { Text("Kontoauszug senden", fontSize = 22.sp) },
                actions = {
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Einstellungen")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Cream,
                    titleContentColor = Ink,
                ),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = "Commerzbank",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Teal,
            )
            Text(
                text = "Holt neue PDF-Kontoauszüge und schickt sie per E-Mail.",
                fontSize = 18.sp,
                lineHeight = 26.sp,
            )

            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("Status", fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                    Text(state.statusMessage, fontSize = 17.sp, lineHeight = 24.sp)
                    state.lastResult?.let {
                        Text(it, fontSize = 15.sp, color = Ink.copy(alpha = 0.75f))
                    }
                    if (state.isRunning) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            CircularProgressIndicator()
                            Text("Bitte warten …", fontSize = 16.sp)
                        }
                    }
                }
            }

            Button(
                onClick = onRun,
                enabled = !state.isRunning,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Teal),
            ) {
                Text("Jetzt holen und senden", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            }

            OutlinedButton(
                onClick = onOpenSettings,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
            ) {
                Text("Einstellungen", fontSize = 17.sp)
            }

            Text(
                text = "Bei Bedarf erscheint eine TAN-Abfrage. Dann in der Commerzbank-App freigeben oder TAN tippen.",
                fontSize = 15.sp,
                color = Ink.copy(alpha = 0.7f),
                lineHeight = 22.sp,
            )
            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    state.tanPrompt?.let { prompt ->
        TanDialog(prompt = prompt, onSubmit = onSubmitTan)
    }
}

@Composable
fun TanDialog(prompt: TanUiState, onSubmit: (String?) -> Unit) {
    var tanText by remember { mutableStateOf("") }
    val isChoice = prompt.challenge is TanChallenge.ChooseMechanism ||
        prompt.challenge is TanChallenge.ChooseMedia
    val isDecoupled = prompt.challenge is TanChallenge.Decoupled

    AlertDialog(
        onDismissRequest = { },
        title = { Text("Freigabe nötig", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(prompt.message, fontSize = 16.sp, lineHeight = 22.sp)
                prompt.image?.let { bmp ->
                    Image(
                        bitmap = bmp,
                        contentDescription = "TAN-Grafik",
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp),
                    )
                }
                if (isChoice) {
                    prompt.options.forEach { (code, label) ->
                        OutlinedButton(
                            onClick = { onSubmit(code) },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(label, textAlign = TextAlign.Start)
                        }
                    }
                } else if (!isDecoupled) {
                    OutlinedTextField(
                        value = tanText,
                        onValueChange = { tanText = it },
                        label = { Text("TAN") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        },
        confirmButton = {
            when {
                isChoice -> { }
                isDecoupled -> TextButton(onClick = { onSubmit("ok") }) { Text("Weiter") }
                else -> TextButton(
                    onClick = { onSubmit(tanText.trim().ifBlank { null }) },
                    enabled = tanText.isNotBlank(),
                ) { Text("Bestätigen") }
            }
        },
        dismissButton = {
            TextButton(onClick = { onSubmit(null) }) { Text("Abbrechen") }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    settings: AppSettings,
    onBack: () -> Unit,
    onChange: ((AppSettings) -> AppSettings) -> Unit,
    onSave: () -> Unit,
) {
    Scaffold(
        containerColor = Cream,
        topBar = {
            TopAppBar(
                title = { Text("Einstellungen", fontSize = 22.sp) },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("Zurück") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Cream),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SectionTitle("Bank (Commerzbank)")
            SettingsField("Bankleitzahl (BLZ)", settings.blz, KeyboardType.Number) {
                onChange { s -> s.copy(blz = it) }
            }
            SettingsField("Benutzerkennung", settings.userId, KeyboardType.Number) {
                onChange { s -> s.copy(userId = it) }
            }
            SettingsField("PIN", settings.pin, KeyboardType.NumberPassword, password = true) {
                onChange { s -> s.copy(pin = it) }
            }
            SettingsField("IBAN (optional)", settings.iban, KeyboardType.Ascii) {
                onChange { s -> s.copy(iban = it) }
            }
            SettingsField("FinTS-Adresse", settings.fintsUrl, KeyboardType.Uri) {
                onChange { s -> s.copy(fintsUrl = it) }
            }

            Spacer(modifier = Modifier.height(8.dp))
            SectionTitle("E-Mail-Versand (SMTP)")
            SettingsField("SMTP-Server", settings.smtpHost, KeyboardType.Uri) {
                onChange { s -> s.copy(smtpHost = it) }
            }
            SettingsField("SMTP-Port", settings.smtpPort.toString(), KeyboardType.Number) {
                onChange { s -> s.copy(smtpPort = it.toIntOrNull() ?: 587) }
            }
            SettingsField("SMTP-Benutzer", settings.smtpUser, KeyboardType.Email) {
                onChange { s -> s.copy(smtpUser = it) }
            }
            SettingsField("SMTP-Passwort", settings.smtpPassword, KeyboardType.Password, password = true) {
                onChange { s -> s.copy(smtpPassword = it) }
            }
            SettingsField("Absender (From)", settings.mailFrom, KeyboardType.Email) {
                onChange { s -> s.copy(mailFrom = it) }
            }
            SettingsField("Empfänger (To)", settings.mailTo, KeyboardType.Email) {
                onChange { s -> s.copy(mailTo = it) }
            }
            SettingsField("Betreff-Prefix", settings.mailSubjectPrefix, KeyboardType.Text) {
                onChange { s -> s.copy(mailSubjectPrefix = it) }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = onSave,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Teal),
            ) {
                Text("Speichern", fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            }
            Text(
                text = "Zugangsdaten bleiben verschlüsselt auf diesem Handy. Nichts wird in die Cloud hochgeladen.",
                fontSize = 14.sp,
                color = Ink.copy(alpha = 0.65f),
                lineHeight = 20.sp,
            )
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Teal)
}

@Composable
private fun SettingsField(
    label: String,
    value: String,
    keyboardType: KeyboardType,
    password: Boolean = false,
    onValueChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
    )
}
