# Aufnahme Eiche – Echte App bauen und installieren

Wir nutzen **kein Expo Go**.  
Stattdessen wird eine **richtige App** gebaut, die Sie auf dem Handy installieren.

Wenn sich der Programmcode ändert, können Sie die alte App löschen und eine **neue Version** bauen und installieren.

---

## Was Sie brauchen

1. Ein **Expo-Konto** (kostenlos): https://expo.dev/signup  
2. Einen Computer mit Internet  
3. Den **Mistral-API-Schlüssel** (später in der App unter Einst.)  
4. Für **Android**: fast jedes Android-Handy  
5. Für **iPhone**: zusätzlich ein **Apple-Entwicklerkonto** (kostenpflichtig) und oft Hilfe von der IT

**Tipp zum Start:** Zuerst **Android** bauen. Das ist einfacher.

---

## Teil 1: Einmalig einrichten (Computer)

### Schritt 1 – Ordner öffnen

Im Terminal:

```bash
cd aufnahme-app
npm install
```

### Schritt 2 – Bei Expo anmelden

```bash
npx eas login
```

E-Mail und Passwort vom Expo-Konto eingeben.

### Schritt 3 – Projekt bei Expo anlegen

```bash
npx eas init
```

Den Fragen zustimmen (Projekt verknüpfen / neu anlegen).

---

## Teil 2: App bauen

### Android-App (APK) erzeugen

```bash
npm run build:android
```

Oder:

```bash
npx eas build --platform android --profile preview
```

- Der Build läuft in der Cloud (dauert oft 10–20 Minuten).  
- Am Ende bekommen Sie einen **Download-Link** für eine Datei `…apk`.

### iPhone-App erzeugen (nur mit Apple-Konto)

```bash
npm run build:ios
```

Hier fragt Expo nach Apple-Zugangsdaten. Das richtet die IT ein.

---

## Teil 3: App auf dem Handy installieren

### Android

1. Die `.apk`-Datei aufs Handy laden (Link im Browser öffnen oder per USB/Mail).  
2. Installation erlauben (bei Warnung „unbekannte Quelle“ einmal zustimmen).  
3. App **Aufnahme Eiche** installieren.  
4. App öffnen.  
5. Oben rechts **Einst.** → Mistral-Schlüssel eintragen → Speichern.  
6. **Start** drücken.

### iPhone

1. Über den Expo-/Apple-Installationsweg installieren (IT).  
2. Unter Einstellungen ggf. Entwickler/Profil vertrauen.  
3. App öffnen → Schlüssel eintragen → Start.

---

## Wenn der Code geändert wurde

Genau so, wie Sie es wollen:

1. Alte App auf dem Handy **löschen** (optional, aber klar und sauber).  
2. Am Computer erneut bauen:

```bash
cd aufnahme-app
npm run build:android
```

3. Neue `.apk` herunterladen und **neu installieren**.  
4. Schlüssel unter **Einst.** ggf. erneut eintragen.

---

## Bedienung im Gespräch

| Knopf | Bedeutung |
|---|---|
| **Start** | Aufnahme beginnt |
| **Pause** | Kurz unterbrechen |
| **Weiter** | Fortsetzen |
| **Stop** | Gespräch beenden |

- Erkannte Daten erscheinen auf dem Bildschirm.  
- Nach Stop: Teilen → **Notizen** wählen.

---

## Wenn etwas nicht geht

| Problem | Was tun |
|---|---|
| `eas login` fehlgeschlagen | Expo-Konto prüfen, Passwort neu setzen |
| Build bricht ab | Fehlermeldung an die IT / den Agenten schicken |
| APK installiert nicht | In Android „Installation aus unbekannten Quellen“ erlauben |
| „Schlüssel fehlt“ | In der App unter **Einst.** speichern |
| Kein Mikrofon | In den Handy-Einstellungen Mikrofon für „Aufnahme Eiche“ erlauben |

---

## Datenschutz kurz

- App läuft auf dem Handy und nutzt Mistral (EU).  
- In Notizen landet nur die Tabelle, nicht das ganze Gespräch.  
- Handys mit Code/Face ID schützen, weil der API-Schlüssel auf dem Gerät liegt.

---

## Für die IT

| Datei | Zweck |
|---|---|
| `eas.json` | Build-Profil `preview` → Android-APK zum direkten Installieren |
| `app.json` | App-Name, Paket-ID `de.eiche.aufnahme` |
| `npm run build:android` | Cloud-Build starten |

Kein Expo Go, kein eigener Server/NAS im Alltag.
