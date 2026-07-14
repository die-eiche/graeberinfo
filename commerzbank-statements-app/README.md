# Kontoauszug senden

Eigenständige Android-App für das Handy: holt monatliche **PDF-Kontoauszüge** der Commerzbank per FinTS und sendet neue Auszüge per **E-Mail (SMTP)** an eine Empfängeradresse.

## Für wen

Gedacht zum Installieren auf dem Handy der Mutter (oder deinem). Ein großer Knopf: **„Jetzt holen und senden“**.

Verfügbar für **Android** und **iOS**.

## Voraussetzungen bei der Commerzbank

1. Elektronisches Postfach aktivieren („Mein Postfach“ → elektronischer Versand).
2. FinTS / HBCI mit PIN/TAN freischalten.
3. photoTAN-App der Commerzbank auf demselben Handy (für Freigaben).
4. BLZ und 10-stellige Benutzerkennung bereithalten.

FinTS-Adresse (bereits voreingestellt): `https://fints.commerzbank.de/fints`

## E-Mail (SMTP)

Beliebiger SMTP-Zugang, z. B. Gmail mit App-Passwort, Posteo, eigener Provider:

- SMTP-Host / Port (meist 587 mit STARTTLS)
- Benutzer + Passwort
- Absender und Empfänger

Die App speichert Zugangsdaten **verschlüsselt nur auf dem Gerät**.

## APK bauen

Auf einem Rechner mit Android Studio bzw. Android SDK:

```bash
cd commerzbank-statements-app
# local.properties muss enthalten: sdk.dir=/pfad/zum/Android/Sdk
./gradlew :app:assembleDebug
```

Die Debug-APK liegt unter `app/build/outputs/apk/debug/app-debug.apk`.

Auf dem Handy: Installation aus unbekannten Quellen erlauben und die APK öffnen.

Alternativ in Android Studio den Ordner `commerzbank-statements-app` öffnen und auf dem Gerät starten.

## Einrichtung in der App

1. App öffnen → **Einstellungen**
2. Bankdaten eintragen (BLZ, Benutzerkennung, PIN, optional IBAN)
3. SMTP und Empfänger-E-Mail eintragen → **Speichern**
4. Zurück → **Jetzt holen und senden**
5. Falls die Bank eine TAN will: Freigabe in der Commerzbank-App bzw. TAN eingeben

Bereits versendete Auszüge werden lokal gemerkt und nicht erneut geschickt.



## iOS (iPhone)

Benötigt einen Mac mit Xcode.

```bash
cd commerzbank-statements-app/ios
brew install xcodegen   # falls noch nicht vorhanden
./scripts/bootstrap.sh
open KontoauszugSender.xcodeproj
```

In Xcode: Team für Code-Signing wählen, App auf dem iPhone starten (Developer Mode / persönliches Team genügt für die eigene Mama).

FinTS kommt von HBCI4Swift (vendored), E-Mail über Swift-SMTP. Bedienung entspricht der Android-App.

## Technik

- Android: Kotlin + Jetpack Compose, FinTS über [hbci4j](https://github.com/hbci4j/hbci4java)
- iOS: SwiftUI, FinTS über [HBCI4Swift](https://github.com/macemmi/HBCI4Swift), SMTP über Swift-SMTP

## Sicherheit

- Keine Bankdaten ins Git committen
- Gerät mit Display-Sperre nutzen
- App nur auf vertrauenswürdigen Handys belassen
- Bei Verlust des Handys PIN/Bankzugang sperren bzw. ändern

## Bekannte Grenzen

- Eine Freigabe/TAN kann nötig sein (PSD2) – völlig unbeaufsichtigter Abruf ist oft nicht möglich.
- Commerzbank muss das elektronische Postfach freigeschaltet haben, sonst gibt es keine PDFs über FinTS.
