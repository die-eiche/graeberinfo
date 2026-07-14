import Foundation
import Security

final class SettingsStore {
    private let service = "de.familie.kontoauszug.settings"

    func load() -> AppSettings {
        guard let data = readKeychain(),
              let settings = try? JSONDecoder().decode(AppSettings.self, from: data) else {
            return AppSettings()
        }
        return settings
    }

    func save(_ settings: AppSettings) throws {
        let data = try JSONEncoder().encode(settings)
        try writeKeychain(data)
    }

    private func readKeychain() -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "settings",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return item as? Data
    }

    private func writeKeychain(_ data: Data) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "settings",
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: "SettingsStore", code: Int(status), userInfo: [
                NSLocalizedDescriptionKey: "Keychain-Speicher fehlgeschlagen (\(status))",
            ])
        }
    }
}

final class SentLogStore {
    private let url: URL

    init(fileManager: FileManager = .default) {
        let dir = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("KontoauszugSender", isDirectory: true)
        try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        url = dir.appendingPathComponent("sent_log.json")
    }

    func hasSent(_ id: String) -> Bool {
        load().contains { $0.id == id }
    }

    func markSent(id: String, filename: String, mailedTo: String) {
        var items = load()
        items.append(SentEntry(id: id, filename: filename, mailedTo: mailedTo, sentAt: Date().timeIntervalSince1970))
        save(items)
    }

    private struct SentEntry: Codable {
        let id: String
        let filename: String
        let mailedTo: String
        let sentAt: Double
    }

    private func load() -> [SentEntry] {
        guard let data = try? Data(contentsOf: url),
              let items = try? JSONDecoder().decode([SentEntry].self, from: data) else {
            return []
        }
        return items
    }

    private func save(_ items: [SentEntry]) {
        guard let data = try? JSONEncoder().encode(items) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
