package de.familie.kontoauszug

import android.app.Application
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import de.familie.kontoauszug.banking.FintsStatementService
import de.familie.kontoauszug.banking.TanChallenge
import de.familie.kontoauszug.banking.UiTanInteractor
import de.familie.kontoauszug.data.AppSettings
import de.familie.kontoauszug.data.SentLogRepository
import de.familie.kontoauszug.data.SettingsRepository
import de.familie.kontoauszug.mail.SmtpMailer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import java.io.File

data class TanUiState(
    val challenge: TanChallenge,
    val message: String,
    val image: ImageBitmap? = null,
    val options: List<Pair<String, String>> = emptyList(),
)

data class AppUiState(
    val settings: AppSettings = AppSettings(),
    val statusMessage: String = "Bereit.",
    val isRunning: Boolean = false,
    val lastResult: String? = null,
    val tanPrompt: TanUiState? = null,
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val settingsRepo = SettingsRepository(application)
    private val sentLog = SentLogRepository(application)
    private val fints = FintsStatementService(application)
    private val mailer = SmtpMailer()

    private val _state = MutableStateFlow(AppUiState(settings = settingsRepo.load()))
    val state: StateFlow<AppUiState> = _state.asStateFlow()

    @Volatile
    private var tanAnswerCallback: ((String?) -> Unit)? = null

    fun updateSettings(transform: (AppSettings) -> AppSettings) {
        _state.update { it.copy(settings = transform(it.settings)) }
    }

    fun saveSettings() {
        settingsRepo.save(_state.value.settings)
        _state.update { it.copy(statusMessage = "Einstellungen gespeichert.") }
    }

    fun submitTan(answer: String?) {
        val cb = tanAnswerCallback
        tanAnswerCallback = null
        _state.update { it.copy(tanPrompt = null) }
        cb?.invoke(answer)
    }

    fun runFetchAndSend() {
        val settings = _state.value.settings
        if (!settings.isReady()) {
            _state.update {
                it.copy(statusMessage = "Bitte zuerst Bank- und E-Mail-Daten in den Einstellungen ausfüllen.")
            }
            return
        }
        if (_state.value.isRunning) return

        settingsRepo.save(settings)
        _state.update {
            it.copy(
                isRunning = true,
                statusMessage = "Starte Abruf …",
                lastResult = null,
            )
        }

        viewModelScope.launch {
            try {
                val interactor = UiTanInteractor(
                    onChallenge = { challenge, answer ->
                        // HBCI callbacks run off the main thread; hop to Main for Compose state.
                        runBlocking(Dispatchers.Main.immediate) {
                            tanAnswerCallback = answer
                            val image = when (challenge) {
                                is TanChallenge.PhotoTan -> challenge.imageBytes.toImageBitmapOrNull()
                                is TanChallenge.QrTan -> challenge.imageBytes.toImageBitmapOrNull()
                                else -> null
                            }
                            val message = when (challenge) {
                                is TanChallenge.TextTan -> challenge.message
                                is TanChallenge.PhotoTan -> challenge.message
                                is TanChallenge.QrTan -> challenge.message
                                is TanChallenge.Decoupled -> challenge.message
                                is TanChallenge.ChooseMechanism -> "Bitte TAN-Verfahren wählen"
                                is TanChallenge.ChooseMedia -> "Bitte Gerät für die TAN wählen"
                            }
                            val options = when (challenge) {
                                is TanChallenge.ChooseMechanism -> challenge.options
                                is TanChallenge.ChooseMedia -> challenge.options.map { it to it }
                                else -> emptyList()
                            }
                            _state.update {
                                it.copy(
                                    tanPrompt = TanUiState(
                                        challenge = challenge,
                                        message = message,
                                        image = image,
                                        options = options,
                                    ),
                                    statusMessage = "Warte auf Freigabe / TAN …",
                                )
                            }
                        }
                    },
                    onStatusUpdate = { msg ->
                        runBlocking(Dispatchers.Main.immediate) {
                            _state.update { it.copy(statusMessage = msg) }
                        }
                    },
                )

                val statements = withContext(Dispatchers.IO) {
                    fints.fetchPdfStatements(settings, interactor)
                }

                if (statements.isEmpty()) {
                    _state.update {
                        it.copy(
                            isRunning = false,
                            statusMessage = "Keine PDF-Kontoauszüge verfügbar.",
                            lastResult = "0 Dateien",
                        )
                    }
                    return@launch
                }

                val statementsDir = File(getApplication<Application>().filesDir, "statements").apply {
                    mkdirs()
                }

                var downloaded = 0
                var mailed = 0
                var skipped = 0
                val details = mutableListOf<String>()

                withContext(Dispatchers.IO) {
                    for (statement in statements) {
                        val out = File(statementsDir, statement.filename)
                        if (!out.exists()) {
                            out.writeBytes(statement.pdfBytes)
                            downloaded++
                        }

                        if (sentLog.hasSent(statement.id)) {
                            skipped++
                            details += "${statement.label}: schon gesendet"
                            continue
                        }

                        _state.update {
                            it.copy(statusMessage = "Sende ${statement.label} …")
                        }
                        mailer.sendPdf(
                            settings = settings,
                            subject = "${settings.mailSubjectPrefix} ${statement.id}",
                            bodyText = buildString {
                                appendLine("Guten Tag,")
                                appendLine()
                                appendLine("anbei der Kontoauszug: ${statement.label}.")
                                appendLine()
                                appendLine("Diese E-Mail wurde automatisch von der App „Kontoauszug senden“ erzeugt.")
                            },
                            filename = statement.filename,
                            pdfBytes = statement.pdfBytes,
                        )
                        sentLog.markSent(statement.id, statement.filename, settings.mailTo)
                        mailed++
                        details += "${statement.label}: per E-Mail gesendet"
                    }
                }

                _state.update {
                    it.copy(
                        isRunning = false,
                        statusMessage = "Fertig. Neu geladen: $downloaded, gesendet: $mailed, übersprungen: $skipped.",
                        lastResult = details.joinToString("\n"),
                    )
                }
            } catch (t: Throwable) {
                submitTan(null)
                _state.update {
                    it.copy(
                        isRunning = false,
                        statusMessage = "Fehler: ${t.message ?: t.javaClass.simpleName}",
                        tanPrompt = null,
                    )
                }
            }
        }
    }
}

private fun ByteArray.toImageBitmapOrNull(): ImageBitmap? {
    if (isEmpty()) return null
    val bitmap = BitmapFactory.decodeByteArray(this, 0, size) ?: return null
    return bitmap.asImageBitmap()
}
