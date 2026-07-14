import SwiftUI
import UIKit

struct ContentView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            HomeView()
                .navigationDestination(for: String.self) { value in
                    if value == "settings" {
                        SettingsView()
                    }
                }
        }
        .sheet(item: $model.tanPrompt) { challenge in
            TanSheet(challenge: challenge)
                .environmentObject(model)
        }
    }
}

struct HomeView: View {
    @EnvironmentObject private var model: AppModel

    private let teal = Color(red: 15 / 255, green: 92 / 255, blue: 76 / 255)
    private let cream = Color(red: 243 / 255, green: 247 / 255, blue: 245 / 255)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Commerzbank")
                    .font(.largeTitle.bold())
                    .foregroundStyle(teal)

                Text("Holt neue PDF-Kontoauszüge und schickt sie per E-Mail.")
                    .font(.title3)
                    .foregroundStyle(.primary)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Status")
                        .font(.headline)
                    Text(model.statusMessage)
                        .font(.body)
                    if let last = model.lastResult {
                        Text(last)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    if model.isRunning {
                        HStack(spacing: 12) {
                            ProgressView()
                            Text("Bitte warten …")
                        }
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: .black.opacity(0.04), radius: 4, y: 1)

                Button(action: model.runFetchAndSend) {
                    Text("Jetzt holen und senden")
                        .font(.title3.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                }
                .buttonStyle(.borderedProminent)
                .tint(teal)
                .disabled(model.isRunning)

                NavigationLink(value: "settings") {
                    Text("Einstellungen")
                        .font(.body.weight(.medium))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.bordered)

                Text("Bei Bedarf erscheint eine TAN-Abfrage. Dann in der Commerzbank-App freigeben oder TAN tippen.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding(20)
        }
        .background(cream.ignoresSafeArea())
        .navigationTitle("Kontoauszug senden")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: "settings") {
                    Image(systemName: "gearshape")
                }
            }
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    private let teal = Color(red: 15 / 255, green: 92 / 255, blue: 76 / 255)

    var body: some View {
        Form {
            Section("Bank (Commerzbank)") {
                TextField("Bankleitzahl (BLZ)", text: $model.settings.blz)
                    .keyboardType(.numberPad)
                TextField("Benutzerkennung", text: $model.settings.userId)
                    .keyboardType(.numberPad)
                SecureField("PIN", text: $model.settings.pin)
                    .keyboardType(.numberPad)
                TextField("IBAN (optional)", text: $model.settings.iban)
                    .textInputAutocapitalization(.characters)
                TextField("FinTS-Adresse", text: $model.settings.fintsUrl)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("TAN-Verfahren-Code (optional)", text: $model.settings.tanMethodCode)
                    .keyboardType(.numberPad)
            }

            Section("E-Mail-Versand (SMTP)") {
                TextField("SMTP-Server", text: $model.settings.smtpHost)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("SMTP-Port", value: $model.settings.smtpPort, format: .number)
                    .keyboardType(.numberPad)
                TextField("SMTP-Benutzer", text: $model.settings.smtpUser)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("SMTP-Passwort", text: $model.settings.smtpPassword)
                TextField("Absender (From)", text: $model.settings.mailFrom)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                TextField("Empfänger (To)", text: $model.settings.mailTo)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                TextField("Betreff-Prefix", text: $model.settings.mailSubjectPrefix)
            }

            Section {
                Button("Speichern") {
                    model.saveSettings()
                    dismiss()
                }
                .font(.body.weight(.semibold))
                .foregroundStyle(teal)
            } footer: {
                Text("Zugangsdaten bleiben im iOS-Keychain auf diesem Gerät. Nichts wird in die Cloud hochgeladen.")
            }
        }
        .navigationTitle("Einstellungen")
    }
}

struct TanSheet: View {
    @EnvironmentObject private var model: AppModel
    let challenge: TanChallenge

    var body: some View {
        NavigationStack {
            Form {
                switch challenge {
                case .text(let message):
                    Text(message)
                    SecureField("TAN", text: $model.tanInput)
                        .keyboardType(.numberPad)
                case .photo(let message, let imageData):
                    Text(message)
                    if let uiImage = UIImage(data: imageData) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 220)
                    }
                    SecureField("TAN", text: $model.tanInput)
                        .keyboardType(.numberPad)
                case .decoupled(let message):
                    Text(message)
                    Text("Tippe auf Weiter, wenn die Freigabe in der Banking-App erledigt ist.")
                        .foregroundStyle(.secondary)
                case .chooseMethod(let options):
                    Text("Bitte TAN-Verfahren wählen")
                    ForEach(options, id: \.code) { option in
                        Button(option.label) {
                            model.submitTan(option.code)
                        }
                    }
                }
            }
            .navigationTitle("Freigabe nötig")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { model.submitTan(nil) }
                }
                ToolbarItem(placement: .confirmationAction) {
                    switch challenge {
                    case .chooseMethod:
                        EmptyView()
                    case .decoupled:
                        Button("Weiter") { model.submitTan("ok") }
                    default:
                        Button("Bestätigen") {
                            model.submitTan(model.tanInput.trimmingCharacters(in: .whitespacesAndNewlines))
                        }
                        .disabled(model.tanInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
        }
        .interactiveDismissDisabled()
    }
}
