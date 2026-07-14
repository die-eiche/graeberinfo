import Foundation
import SwiftSMTP

final class SmtpMailer {
    func sendPdf(settings: AppSettings, subject: String, body: String, filename: String, pdfData: Data) throws {
        let smtp = SMTP(
            hostname: settings.smtpHost,
            email: settings.smtpUser,
            password: settings.smtpPassword,
            port: Int32(settings.smtpPort),
            tlsMode: .requireSTARTTLS,
            tlsConfiguration: nil,
            authMethods: [],
            domainName: "localhost",
            timeout: 60
        )

        let from = Mail.User(email: settings.mailFrom)
        let to = Mail.User(email: settings.mailTo)
        let attachment = Attachment(
            data: pdfData,
            mime: "application/pdf",
            name: filename
        )
        let mail = Mail(
            from: from,
            to: [to],
            subject: subject,
            text: body,
            attachments: [attachment]
        )

        let semaphore = DispatchSemaphore(value: 0)
        var sendError: Error?
        smtp.send(mail) { error in
            sendError = error
            semaphore.signal()
        }
        _ = semaphore.wait(timeout: .now() + 90)
        if let sendError {
            throw sendError
        }
    }
}
