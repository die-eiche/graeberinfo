import Foundation

struct AppSettings: Codable, Equatable {
    var blz: String = ""
    var userId: String = ""
    var pin: String = ""
    var iban: String = ""
    var fintsUrl: String = "https://fints.commerzbank.de/fints"
    var smtpHost: String = ""
    var smtpPort: Int = 587
    var smtpUser: String = ""
    var smtpPassword: String = ""
    var mailFrom: String = ""
    var mailTo: String = ""
    var mailSubjectPrefix: String = "Kontoauszug"
    var tanMethodCode: String = ""

    var isBankConfigured: Bool {
        !blz.isEmpty && !userId.isEmpty && !pin.isEmpty
    }

    var isMailConfigured: Bool {
        !smtpHost.isEmpty && !smtpUser.isEmpty && !smtpPassword.isEmpty && !mailFrom.isEmpty && !mailTo.isEmpty
    }

    var isReady: Bool { isBankConfigured && isMailConfigured }
}

struct DownloadedStatement {
    let id: String
    let filename: String
    let pdfData: Data
    let label: String
}

enum TanChallenge: Identifiable {
    case text(message: String)
    case photo(message: String, imageData: Data)
    case decoupled(message: String)
    case chooseMethod(options: [(code: String, label: String)])

    var id: String {
        switch self {
        case .text(let message): return "text-\(message)"
        case .photo(let message, _): return "photo-\(message)"
        case .decoupled(let message): return "decoupled-\(message)"
        case .chooseMethod(let options): return "choose-\(options.map(\.code).joined())"
        }
    }
}
