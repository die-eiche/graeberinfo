import Foundation
import SwiftUI

@MainActor
final class AppModel: ObservableObject {
    @Published var settings: AppSettings
    @Published var statusMessage = "Bereit."
    @Published var lastResult: String?
    @Published var isRunning = false
    @Published var tanPrompt: TanChallenge?
    @Published var tanInput = ""

    private let settingsStore = SettingsStore()
    private let sentLog = SentLogStore()
    private let fints = FintsService()
    private let mailer = SmtpMailer()
    private var tanContinuation: CheckedContinuation<String?, Never>?

    init() {
        settings = settingsStore.load()
    }

    func saveSettings() {
        do {
            try settingsStore.save(settings)
            statusMessage = "Einstellungen gespeichert."
        } catch {
            statusMessage = "Speichern fehlgeschlagen: \(error.localizedDescription)"
        }
    }

    func submitTan(_ answer: String?) {
        tanPrompt = nil
        tanInput = ""
        tanContinuation?.resume(returning: answer)
        tanContinuation = nil
    }

    func runFetchAndSend() {
        guard settings.isReady else {
            statusMessage = "Bitte zuerst Bank- und E-Mail-Daten in den Einstellungen ausfüllen."
            return
        }
        guard !isRunning else { return }

        saveSettings()
        isRunning = true
        statusMessage = "Starte Abruf …"
        lastResult = nil

        let currentSettings = settings
        let fintsService = fints
        let mailService = mailer
        let log = sentLog

        Task {
            do {
                let statements: [DownloadedStatement] = try await withCheckedThrowingContinuation { continuation in
                    DispatchQueue.global(qos: .userInitiated).async {
                        do {
                            let result = try fintsService.fetchPdfStatements(
                                settings: currentSettings,
                                onStatus: { message in
                                    Task { @MainActor in
                                        self.statusMessage = message
                                    }
                                },
                                onChallenge: { challenge in
                                    await self.waitForTan(challenge)
                                }
                            )
                            continuation.resume(returning: result)
                        } catch {
                            continuation.resume(throwing: error)
                        }
                    }
                }

                if statements.isEmpty {
                    isRunning = false
                    statusMessage = "Keine PDF-Kontoauszüge verfügbar."
                    lastResult = "0 Dateien"
                    return
                }

                let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                    .appendingPathComponent("statements", isDirectory: true)
                try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

                var downloaded = 0
                var mailed = 0
                var skipped = 0
                var details: [String] = []

                for statement in statements {
                    let fileURL = dir.appendingPathComponent(statement.filename)
                    if !FileManager.default.fileExists(atPath: fileURL.path) {
                        try statement.pdfData.write(to: fileURL, options: .atomic)
                        downloaded += 1
                    }

                    if log.hasSent(statement.id) {
                        skipped += 1
                        details.append("\(statement.label): schon gesendet")
                        continue
                    }

                    statusMessage = "Sende \(statement.label) …"
                    try await Task.detached {
                        try mailService.sendPdf(
                            settings: currentSettings,
                            subject: "\(currentSettings.mailSubjectPrefix) \(statement.id)",
                            body: """
                            Guten Tag,

                            anbei der Kontoauszug: \(statement.label).

                            Diese E-Mail wurde automatisch von der App „Kontoauszug senden“ erzeugt.
                            """,
                            filename: statement.filename,
                            pdfData: statement.pdfData
                        )
                    }.value

                    log.markSent(id: statement.id, filename: statement.filename, mailedTo: currentSettings.mailTo)
                    mailed += 1
                    details.append("\(statement.label): per E-Mail gesendet")
                }

                isRunning = false
                statusMessage = "Fertig. Neu geladen: \(downloaded), gesendet: \(mailed), übersprungen: \(skipped)."
                lastResult = details.joined(separator: "\n")
            } catch {
                submitTan(nil)
                isRunning = false
                statusMessage = "Fehler: \(error.localizedDescription)"
                tanPrompt = nil
            }
        }
    }

    private func waitForTan(_ challenge: TanChallenge) async -> String? {
        await withCheckedContinuation { continuation in
            tanContinuation = continuation
            tanPrompt = challenge
            statusMessage = "Warte auf Freigabe / TAN …"
        }
    }
}
