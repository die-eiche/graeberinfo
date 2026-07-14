package de.familie.kontoauszug.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SettingsRepository(context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "kontoauszug_secure_prefs",
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun load(): AppSettings = AppSettings(
        blz = prefs.getString(KEY_BLZ, "") ?: "",
        userId = prefs.getString(KEY_USER, "") ?: "",
        pin = prefs.getString(KEY_PIN, "") ?: "",
        iban = prefs.getString(KEY_IBAN, "") ?: "",
        fintsUrl = prefs.getString(KEY_FINTS_URL, DEFAULT_FINTS_URL) ?: DEFAULT_FINTS_URL,
        smtpHost = prefs.getString(KEY_SMTP_HOST, "") ?: "",
        smtpPort = prefs.getInt(KEY_SMTP_PORT, 587),
        smtpUser = prefs.getString(KEY_SMTP_USER, "") ?: "",
        smtpPassword = prefs.getString(KEY_SMTP_PASSWORD, "") ?: "",
        mailFrom = prefs.getString(KEY_MAIL_FROM, "") ?: "",
        mailTo = prefs.getString(KEY_MAIL_TO, "") ?: "",
        mailSubjectPrefix = prefs.getString(KEY_MAIL_SUBJECT, "Kontoauszug") ?: "Kontoauszug",
    )

    fun save(settings: AppSettings) {
        prefs.edit()
            .putString(KEY_BLZ, settings.blz.trim())
            .putString(KEY_USER, settings.userId.trim())
            .putString(KEY_PIN, settings.pin)
            .putString(KEY_IBAN, settings.iban.replace(" ", "").uppercase())
            .putString(KEY_FINTS_URL, settings.fintsUrl.trim().ifBlank { DEFAULT_FINTS_URL })
            .putString(KEY_SMTP_HOST, settings.smtpHost.trim())
            .putInt(KEY_SMTP_PORT, settings.smtpPort)
            .putString(KEY_SMTP_USER, settings.smtpUser.trim())
            .putString(KEY_SMTP_PASSWORD, settings.smtpPassword)
            .putString(KEY_MAIL_FROM, settings.mailFrom.trim())
            .putString(KEY_MAIL_TO, settings.mailTo.trim())
            .putString(KEY_MAIL_SUBJECT, settings.mailSubjectPrefix.trim().ifBlank { "Kontoauszug" })
            .apply()
    }

    companion object {
        private const val DEFAULT_FINTS_URL = "https://fints.commerzbank.de/fints"
        private const val KEY_BLZ = "blz"
        private const val KEY_USER = "user_id"
        private const val KEY_PIN = "pin"
        private const val KEY_IBAN = "iban"
        private const val KEY_FINTS_URL = "fints_url"
        private const val KEY_SMTP_HOST = "smtp_host"
        private const val KEY_SMTP_PORT = "smtp_port"
        private const val KEY_SMTP_USER = "smtp_user"
        private const val KEY_SMTP_PASSWORD = "smtp_password"
        private const val KEY_MAIL_FROM = "mail_from"
        private const val KEY_MAIL_TO = "mail_to"
        private const val KEY_MAIL_SUBJECT = "mail_subject"
    }
}
