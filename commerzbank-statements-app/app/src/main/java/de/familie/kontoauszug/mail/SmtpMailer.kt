package de.familie.kontoauszug.mail

import de.familie.kontoauszug.data.AppSettings
import java.util.Properties
import javax.mail.Authenticator
import javax.mail.Message
import javax.mail.PasswordAuthentication
import javax.mail.Session
import javax.mail.Transport
import javax.mail.internet.InternetAddress
import javax.mail.internet.MimeBodyPart
import javax.mail.internet.MimeMessage
import javax.mail.internet.MimeMultipart
import javax.activation.DataHandler
import javax.mail.util.ByteArrayDataSource

class SmtpMailer {
    fun sendPdf(
        settings: AppSettings,
        subject: String,
        bodyText: String,
        filename: String,
        pdfBytes: ByteArray,
    ) {
        val props = Properties().apply {
            put("mail.smtp.host", settings.smtpHost)
            put("mail.smtp.port", settings.smtpPort.toString())
            put("mail.smtp.auth", "true")
            put("mail.smtp.starttls.enable", "true")
            put("mail.smtp.ssl.trust", settings.smtpHost)
            put("mail.smtp.connectiontimeout", "30000")
            put("mail.smtp.timeout", "60000")
        }

        val session = Session.getInstance(props, object : Authenticator() {
            override fun getPasswordAuthentication(): PasswordAuthentication =
                PasswordAuthentication(settings.smtpUser, settings.smtpPassword)
        })

        val message = MimeMessage(session).apply {
            setFrom(InternetAddress(settings.mailFrom))
            setRecipients(Message.RecipientType.TO, InternetAddress.parse(settings.mailTo, false))
            this.subject = subject
        }

        val textPart = MimeBodyPart().apply {
            setText(bodyText, "UTF-8")
        }
        val pdfPart = MimeBodyPart().apply {
            dataHandler = DataHandler(ByteArrayDataSource(pdfBytes, "application/pdf"))
            fileName = filename
            disposition = MimeBodyPart.ATTACHMENT
        }

        message.setContent(MimeMultipart().apply {
            addBodyPart(textPart)
            addBodyPart(pdfPart)
        })

        Transport.send(message)
    }
}
