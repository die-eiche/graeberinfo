import Foundation
import UIKit

/// Bridges HBCI callbacks (background) to the SwiftUI main actor.
final class TanBridge: NSObject, HBCICallback {
    private let onChallenge: @MainActor (TanChallenge) async -> String?

    init(onChallenge: @escaping @MainActor (TanChallenge) async -> String?) {
        self.onChallenge = onChallenge
    }

    func getTan(_ user: HBCIUser, challenge: String?, challenge_hhd_uc: String?, type: HBCIChallengeType) throws -> String {
        let message = challenge?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? "Bitte TAN eingeben oder in der Banking-App freigeben."

        let challengeModel: TanChallenge
        switch type {
        case .photo:
            let imageData = Self.decodeChallengeImage(challenge_hhd_uc)
            challengeModel = .photo(message: message, imageData: imageData ?? Data())
        case .flicker:
            challengeModel = .text(message: message + "\n(Flicker-Code – bitte TAN aus der App übernehmen.)")
        case .none:
            challengeModel = .text(message: message)
        @unknown default:
            challengeModel = .text(message: message)
        }

        let answer = Self.waitForMainActorAnswer {
            await onChallenge(challengeModel)
        }
        guard let answer, !answer.isEmpty else {
            throw NSError(domain: "TanBridge", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "TAN-Eingabe abgebrochen",
            ])
        }
        return answer
    }

    func decoupledNotification(_ user: HBCIUser, challenge: String?) {
        let message = challenge?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? "Bitte Freigabe in der Commerzbank-App bestätigen und danach weiter."
        _ = Self.waitForMainActorAnswer {
            await onChallenge(.decoupled(message: message))
        }
    }

    func vopConfirmation(_ vopResult: HBCIVoPResult) -> HBCIVopConfirmationCallbackResult {
        .proceed
    }

    private static func decodeChallengeImage(_ raw: String?) -> Data? {
        guard let raw, !raw.isEmpty else { return nil }
        if let data = Data(base64Encoded: raw) { return data }
        // Some banks wrap binary payload; best-effort UTF-8 fallback is useless for images.
        return nil
    }

    private static func waitForMainActorAnswer(_ work: @escaping @MainActor () async -> String?) -> String? {
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

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
