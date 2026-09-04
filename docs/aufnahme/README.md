# Aufnahme Eiche – iPhone-App bauen und installieren

Wir nutzen **kein Expo Go**.  
Es wird eine **richtige iPhone-App** gebaut und auf dem iPhone installiert.

Wenn sich der Code ändert: alte App löschen → neu bauen → neu installieren.

---

## Was Sie brauchen

1. Ein **iPhone**
2. Ein **Expo-Konto** (kostenlos): https://expo.dev/signup  
3. Ein **Apple-Entwicklerkonto** (kostenpflichtig, ca. jährlich): https://developer.apple.com/programs/  
4. Den **Mistral-API-Schlüssel** (später in der App unter Einst.)  
5. Kurze Hilfe von jemandem mit Mac/Computer für den ersten Build

Ohne Apple-Entwicklerkonto kann die App **nicht** dauerhaft auf einem normalen iPhone installiert werden. Das ist eine Apple-Regel.

---

## Teil 1: Konten einrichten (einmalig)

### 1. Expo-Konto
- Anlegen unter https://expo.dev/signup  
- E-Mail und Passwort notieren

### 2. Apple-Entwicklerkonto
- Anmelden / kaufen unter https://developer.apple.com/programs/  
- Dieselbe Apple-ID nutzen, die auch fürs iPhone gilt (oder eine Firmen-Apple-ID)

---

## Teil 2: App bauen (Computer)

Im Terminal:

```bash
cd aufnahme-app
npm install
npx eas login
npx eas init
npm run build:ios
```

Beim iOS-Build fragt Expo nach:
- Apple-ID / App-Passwort bzw. Entwicklerzugang  
- Rechten für Zertifikate („credentials“) → meist **von Expo verwalten lassen** (empfohlen)

Der Build läuft in der Cloud (oft 15–30 Minuten).  
Am Ende gibt es einen **Installationslink**.

---

## Teil 3: Auf dem iPhone installieren

1. Installationslink **auf dem iPhone** im Safari öffnen.  
2. App installieren.  
3. Falls nötig: iPhone → Einstellungen → Allgemein → VPN & Geräteverwaltung → Entwickler/Profil **vertrauen**.  
4. App **Aufnahme Eiche** öffnen.  
5. Oben rechts **Einst.** → Mistral-Schlüssel eintragen → Speichern.  
6. **Start** drücken.

---

## Wenn der Code geändert wurde

1. Alte App auf dem iPhone löschen (optional, aber klar).  
2. Am Computer erneut:

```bash
cd aufnahme-app
npm run build:ios
```

3. Neue Version über den neuen Link installieren.  
4. Schlüssel unter **Einst.** ggf. erneut eintragen.

---

## Bedienung

| Knopf | Bedeutung |
|---|---|
| **Start** | Aufnahme beginnt |
| **Pause** | Unterbrechen |
| **Weiter** | Fortsetzen |
| **Stop** | Beenden |

Nach Stop: Teilen → **Notizen** wählen.

---

## Wenn etwas nicht geht

| Problem | Was tun |
|---|---|
| Kein Apple-Entwicklerkonto | Muss zuerst eingerichtet werden |
| Installation blockiert | Unter „VPN & Geräteverwaltung“ dem Profil vertrauen |
| „Schlüssel fehlt“ | In der App unter **Einst.** speichern |
| Kein Mikrofon | iPhone-Einstellungen → Aufnahme Eiche → Mikrofon erlauben |
| Build-Fehler | Meldung an IT / Agenten schicken |

---

## Datenschutz kurz

- App auf dem iPhone + Mistral (EU)  
- In Notizen nur die Tabelle, nicht das ganze Gespräch  
- iPhone mit Code/Face ID schützen (API-Schlüssel liegt auf dem Gerät)

---

## Für die IT

```bash
cd aufnahme-app
npx eas login
npx eas init
npx eas build --platform ios --profile preview
```

- Bundle-ID: `de.eiche.aufnahme`  
- Profil `preview` in `eas.json` = interne Verteilung  
- Credentials möglichst von EAS verwalten lassen
