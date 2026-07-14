package de.familie.kontoauszug.banking

import android.content.Context
import de.familie.kontoauszug.data.AppSettings
import org.kapott.hbci.GV.HBCIJob
import org.kapott.hbci.GV_Result.GVRKontoauszug
import org.kapott.hbci.callback.AbstractHBCICallback
import org.kapott.hbci.manager.HBCIHandler
import org.kapott.hbci.manager.HBCIUtils
import org.kapott.hbci.manager.HBCIVersion
import org.kapott.hbci.passport.AbstractHBCIPassport
import org.kapott.hbci.passport.HBCIPassport
import org.kapott.hbci.structures.Konto
import java.io.File
import java.util.Date
import java.util.Properties
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

data class DownloadedStatement(
    val id: String,
    val filename: String,
    val pdfBytes: ByteArray,
    val label: String,
)

sealed class TanChallenge {
    data class TextTan(val message: String) : TanChallenge()
    data class PhotoTan(val message: String, val imageBytes: ByteArray) : TanChallenge()
    data class QrTan(val message: String, val imageBytes: ByteArray) : TanChallenge()
    data class Decoupled(val message: String) : TanChallenge()
    data class ChooseMechanism(val options: List<Pair<String, String>>) : TanChallenge()
    data class ChooseMedia(val options: List<String>) : TanChallenge()
}

interface TanInteractor {
    fun requestTan(challenge: TanChallenge): String?
    fun onStatus(message: String)
}

class FintsStatementService(
    private val context: Context,
) {
    fun fetchPdfStatements(
        settings: AppSettings,
        tanInteractor: TanInteractor,
    ): List<DownloadedStatement> {
        val callback = AppHbciCallback(settings, tanInteractor)
        val props = Properties()
        HBCIUtils.init(props, callback)

        val passportFile = File(context.filesDir, "commerzbank_pintan.passport")
        HBCIUtils.setParam("client.passport.default", "PinTan")
        HBCIUtils.setParam("client.passport.PinTan.init", "1")
        HBCIUtils.setParam("client.passport.PinTan.checkcert", "1")

        val passport = AbstractHBCIPassport.getInstance(passportFile)
        var handler: HBCIHandler? = null

        try {
            passport.setCountry("DE")
            // PinTan erwartet Host inkl. Pfad, ohne Schema.
            passport.setHost(
                settings.fintsUrl
                    .removePrefix("https://")
                    .removePrefix("http://")
                    .trimEnd('/'),
            )
            passport.setPort(443)
            passport.setFilterType("Base64")

            handler = HBCIHandler(HBCIVersion.HBCI_300.id, passport)
            tanInteractor.onStatus("Verbindung zur Bank hergestellt …")

            val account = selectAccount(passport.accounts, settings.iban)
                ?: error("Kein Konto gefunden. Bitte IBAN in den Einstellungen prüfen.")

            tanInteractor.onStatus("Kontoauszüge werden abgerufen …")
            @Suppress("UNCHECKED_CAST")
            val job = handler.newJob("KontoauszugPdf") as HBCIJob<*>
            job.setParam("my", account)
            job.setParam("maxentries", "12")
            job.addToQueue()

            val status = handler.execute()
            if (!status.isOK) {
                error("Bank-Abruf fehlgeschlagen: $status")
            }

            val result = job.jobResult as GVRKontoauszug
            if (!result.isOK) {
                error("Kontoauszug-Abruf fehlgeschlagen: $result")
            }

            return result.entries.mapIndexedNotNull { index, entry ->
                val data = entry.data ?: return@mapIndexedNotNull null
                if (data.isEmpty()) return@mapIndexedNotNull null

                val cal = java.util.Calendar.getInstance()
                entry.date?.let { cal.time = it }
                val safeYear = if (entry.year > 0) entry.year else cal.get(java.util.Calendar.YEAR)
                val safeNumber = if (entry.number > 0) entry.number else index + 1
                val id = "${safeYear}-${safeNumber.toString().padStart(3, '0')}"
                val filename = entry.filename?.takeIf { it.isNotBlank() }
                    ?: "kontoauszug_${id}.pdf"
                val label = "Kontoauszug $safeYear / Nr. $safeNumber"

                DownloadedStatement(
                    id = id,
                    filename = filename.replace(Regex("[^A-Za-z0-9._-]"), "_"),
                    pdfBytes = data,
                    label = label,
                )
            }
        } finally {
            handler?.close()
            passport.close()
            HBCIUtils.done()
        }
    }

    private fun selectAccount(accounts: Array<Konto>?, iban: String): Konto? {
        if (accounts.isNullOrEmpty()) return null
        if (iban.isBlank()) return accounts[0]
        val normalized = iban.replace(" ", "").uppercase()
        return accounts.firstOrNull {
            it.iban?.replace(" ", "")?.uppercase() == normalized
        } ?: accounts[0]
    }
}

private class AppHbciCallback(
    private val settings: AppSettings,
    private val tanInteractor: TanInteractor,
) : AbstractHBCICallback() {
    override fun log(msg: String?, level: Int, date: Date?, trace: StackTraceElement?) {
        // intentional no-op: avoid logging sensitive banking chatter
    }

    override fun status(passport: HBCIPassport?, statusTag: Int, o: Array<out Any>?) {
        // no-op
    }

    override fun callback(
        passport: HBCIPassport?,
        reason: Int,
        msg: String?,
        datatype: Int,
        retData: StringBuffer,
    ) {
        when (reason) {
            NEED_PASSPHRASE_LOAD, NEED_PASSPHRASE_SAVE -> {
                retData.replace(0, retData.length, settings.pin)
            }

            NEED_PT_PIN -> retData.replace(0, retData.length, settings.pin)
            NEED_BLZ -> retData.replace(0, retData.length, settings.blz)
            NEED_USERID -> retData.replace(0, retData.length, settings.userId)
            NEED_CUSTOMERID -> retData.replace(0, retData.length, settings.userId)

            NEED_PT_SECMECH -> {
                val options = parseSecMech(retData.toString())
                val selected = tanInteractor.requestTan(TanChallenge.ChooseMechanism(options))
                    ?: options.firstOrNull()?.first
                    ?: error("Kein TAN-Verfahren gewählt")
                retData.replace(0, retData.length, selected)
            }

            NEED_PT_TANMEDIA -> {
                val options = retData.toString().split("|").filter { it.isNotBlank() }
                if (options.size <= 1) return
                val selected = tanInteractor.requestTan(TanChallenge.ChooseMedia(options))
                    ?: options.first()
                retData.replace(0, retData.length, selected)
            }

            NEED_PT_TAN -> {
                val tan = tanInteractor.requestTan(
                    TanChallenge.TextTan(msg ?: "Bitte TAN eingeben"),
                ) ?: error("TAN-Eingabe abgebrochen")
                retData.replace(0, retData.length, tan)
            }

            NEED_PT_PHOTOTAN -> {
                val image = decodeImagePayload(retData.toString())
                val tan = tanInteractor.requestTan(
                    TanChallenge.PhotoTan(msg ?: "Bitte photoTAN scannen und TAN eingeben", image),
                ) ?: error("photoTAN abgebrochen")
                retData.replace(0, retData.length, tan)
            }

            NEED_PT_QRTAN -> {
                val image = decodeImagePayload(retData.toString())
                val tan = tanInteractor.requestTan(
                    TanChallenge.QrTan(msg ?: "Bitte QR-TAN scannen und TAN eingeben", image),
                ) ?: error("QR-TAN abgebrochen")
                retData.replace(0, retData.length, tan)
            }

            NEED_PT_DECOUPLED -> {
                tanInteractor.requestTan(
                    TanChallenge.Decoupled(msg ?: "Bitte Freigabe in der Banking-App bestätigen und danach weiter."),
                )
            }

            HAVE_ERROR -> {
                tanInteractor.onStatus(msg ?: "Unbekannter Bankfehler")
            }

            else -> Unit
        }
    }

    private fun parseSecMech(raw: String): List<Pair<String, String>> =
        raw.split("|").mapNotNull { part ->
            val bits = part.split(":", limit = 2)
            if (bits.size == 2) bits[0] to bits[1] else null
        }

    private fun decodeImagePayload(raw: String): ByteArray {
        return try {
            val matrix = org.kapott.hbci.manager.MatrixCode(raw)
            matrix.getImage()
        } catch (_: Exception) {
            try {
                HBCIUtils.decodeBase64(raw)
            } catch (_: Exception) {
                ByteArray(0)
            }
        }
    }
}

/**
 * Bridges HBCI worker-thread callbacks to the UI via latches.
 */
class UiTanInteractor(
    private val onChallenge: (TanChallenge, (String?) -> Unit) -> Unit,
    private val onStatusUpdate: (String) -> Unit,
) : TanInteractor {
    private val timeoutMinutes = 5L

    override fun onStatus(message: String) {
        onStatusUpdate(message)
    }

    override fun requestTan(challenge: TanChallenge): String? {
        val latch = CountDownLatch(1)
        val result = AtomicReference<String?>(null)
        onChallenge(challenge) { answer ->
            result.set(answer)
            latch.countDown()
        }
        val completed = latch.await(timeoutMinutes, TimeUnit.MINUTES)
        if (!completed) error("Zeitüberschreitung bei der TAN-Eingabe")
        return result.get()
    }
}
