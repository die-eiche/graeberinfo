import Foundation

final class FintsService {
    private let productName = "KontoauszugSender"
    private let productVersion = "1.0"

    func fetchPdfStatements(
        settings: AppSettings,
        onStatus: @escaping @MainActor (String) -> Void,
        onChallenge: @escaping @MainActor (TanChallenge) async -> String?
    ) throws -> [DownloadedStatement] {
        let bridge = TanBridge(onChallenge: onChallenge)
        HBCIDialog.callback = bridge

        let user = try HBCIUser(
            userId: settings.userId,
            customerId: settings.userId,
            bankCode: settings.blz,
            hbciVersion: "300",
            bankURLString: settings.fintsUrl
        )
        user.pin = settings.pin
        user.setSecurityMethod(HBCISecurityMethodPinTan())

        Task { @MainActor in onStatus("TAN-Verfahren werden ermittelt …") }
        let dialogForMethods = try HBCIDialog(user: user, product: productName, version: productVersion)
        let methods = dialogForMethods.getTanMethods() ?? dialogForMethods.getBankTanMethods() ?? []
        _ = dialogForMethods.dialogEnd()

        let selectedMethod: String
        if !settings.tanMethodCode.isEmpty {
            selectedMethod = settings.tanMethodCode
        } else if methods.count == 1, let only = methods[0].secfunc {
            selectedMethod = only
        } else if methods.count > 1 {
            let options: [(code: String, label: String)] = methods.compactMap { method in
                guard let code = method.secfunc else { return nil }
                let labelName = method.name ?? code
                return (code: code, label: "\(labelName) (\(code))")
            }
            let picked = Self.waitForAnswer {
                await onChallenge(.chooseMethod(options: options))
            }
            guard let picked, !picked.isEmpty else {
                throw makeError("Kein TAN-Verfahren gewählt")
            }
            selectedMethod = picked
        } else {
            // Common photoTAN/pushTAN placeholder; bank may negotiate during dialog.
            selectedMethod = "999"
        }
        user.tanMethod = selectedMethod

        Task { @MainActor in onStatus("Synchronisiere mit der Bank …") }
        let syncDialog = try HBCIDialog(user: user, product: productName, version: productVersion)
        guard try syncDialog.syncInit(selectedMethod)?.isOk() == true else {
            _ = syncDialog.dialogEnd()
            throw makeError("Synchronisation fehlgeschlagen. FinTS PIN/TAN und Zugangsdaten prüfen.")
        }
        _ = syncDialog.dialogEnd()

        guard user.sysId != nil else {
            throw makeError("Keine System-ID von der Bank erhalten.")
        }

        Task { @MainActor in onStatus("Dialog wird geöffnet …") }
        let dialog = try HBCIDialog(user: user, product: productName, version: productVersion)
        defer { _ = dialog.dialogEnd() }

        guard try dialog.dialogInit()?.isOk() == true else {
            throw makeError("Dialog-Initialisierung fehlgeschlagen.")
        }

        let accounts = user.parameters.getAccounts()
        guard !accounts.isEmpty else {
            throw makeError("Keine Konten gefunden.")
        }

        let account = selectAccount(from: accounts, iban: settings.iban)
        Task { @MainActor in onStatus("Kontoauszüge werden abgerufen …") }

        guard let message = HBCICustomMessage.newInstance(dialog) else {
            throw makeError("Auftragsnachricht konnte nicht erzeugt werden.")
        }
        guard let order = HBCIAccountStatementOrder(message: message, account: account) else {
            throw makeError("Geschäftsvorfall Kontoauszug wird für dieses Konto nicht unterstützt.")
        }
        order.format = .pdf
        guard order.enqueue() else {
            throw makeError("Kontoauszug-Auftrag konnte nicht eingereiht werden.")
        }
        guard try message.send() else {
            throw makeError("Kontoauszug-Abruf fehlgeschlagen.")
        }

        return order.statements.enumerated().compactMap { index, statement in
            guard statement.format == .pdf, let data = statement.booked, !data.isEmpty else {
                return nil
            }
            let year = statement.year ?? Calendar.current.component(.year, from: statement.endDate ?? Date())
            let number = statement.number ?? (index + 1)
            let id = String(format: "%d-%03d", year, number)
            let filename = "kontoauszug_\(id).pdf"
            let label = "Kontoauszug \(year) / Nr. \(number)"
            return DownloadedStatement(id: id, filename: filename, pdfData: data, label: label)
        }
    }

    private func selectAccount(from accounts: [HBCIAccount], iban: String) -> HBCIAccount {
        let normalized = iban.replacingOccurrences(of: " ", with: "").uppercased()
        if !normalized.isEmpty,
           let match = accounts.first(where: {
               ($0.iban ?? "").replacingOccurrences(of: " ", with: "").uppercased() == normalized
           }) {
            return match
        }
        return accounts[0]
    }

    private func makeError(_ message: String) -> NSError {
        NSError(domain: "FintsService", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private static func waitForAnswer(_ work: @escaping @MainActor () async -> String?) -> String? {
        let semaphore = DispatchSemaphore(value: 0)
        var result: String?
        Task { @MainActor in
            result = await work()
            semaphore.signal()
        }
        _ = semaphore.wait(timeout: .now() + 300)
        return result
    }
}
