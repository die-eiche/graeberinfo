package de.familie.kontoauszug.data

data class AppSettings(
    val blz: String = "",
    val userId: String = "",
    val pin: String = "",
    val iban: String = "",
    val fintsUrl: String = "https://fints.commerzbank.de/fints",
    val smtpHost: String = "",
    val smtpPort: Int = 587,
    val smtpUser: String = "",
    val smtpPassword: String = "",
    val mailFrom: String = "",
    val mailTo: String = "",
    val mailSubjectPrefix: String = "Kontoauszug",
) {
    fun isBankConfigured(): Boolean =
        blz.isNotBlank() && userId.isNotBlank() && pin.isNotBlank()

    fun isMailConfigured(): Boolean =
        smtpHost.isNotBlank() &&
            smtpUser.isNotBlank() &&
            smtpPassword.isNotBlank() &&
            mailFrom.isNotBlank() &&
            mailTo.isNotBlank()

    fun isReady(): Boolean = isBankConfigured() && isMailConfigured()
}
