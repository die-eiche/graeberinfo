# Aufnahme Eiche – Anleitung zum Starten

Diese Anleitung erklärt in einfachen Schritten, wie Sie die Aufnahme-App zum Laufen bringen.  
Sie brauchen dafür **keinen Programmierkenntnisse** – nur etwas Geduld und die Hilfe einer Person, die einmal den Computer-Teil einrichtet.

---

## Was macht die App?

1. Sie starten die App auf dem Handy **vor dem Kundengespräch**.
2. Oben sehen Sie die Uhr.
3. Mit **Start** beginnt die Aufnahme.
4. Mit **Pause** können Sie unterbrechen, mit **Start/Weiter** geht es weiter.
5. Mit **Stop** beenden Sie das Gespräch endgültig.
6. Währenddessen erscheinen erkannte Angaben (Name, Adresse, Grabnummer usw.) auf dem Bildschirm.
7. Am Ende können Sie die ausgefüllte Tabelle in die **Notizen-App** speichern.

Wenn ein Anruf kommt, pausiert die App von selbst und macht danach weiter.

---

## Was brauchen Sie vorher?

Bitte einmalig vorbereiten (am besten mit IT-Hilfe):

1. Ein **Mistral-Konto** (europäische KI) mit einem **API-Schlüssel**  
   → Das ist wie ein Passwort für die KI. Diesen Schlüssel **nicht** im Handy speichern und **nicht** weitergeben.
2. Einen **Computer** (oder Mini-Server), der während der Gespräche eingeschaltet bleibt und mit demselben WLAN wie das Handy verbunden ist.
3. Auf dem Handy die App **Expo Go** (kostenlos im App Store / Google Play).
4. Dieses Projekt auf dem Computer (Ordner mit `aufnahme-api` und `aufnahme-app`).

---

## Teil A: Computer einschalten (einmal pro Arbeitstag)

Alles Folgende passiert **am Computer**, nicht am Handy.

### Schritt 1 – Terminal öffnen

- **Mac:** Programm „Terminal“ öffnen  
- **Windows:** „Eingabeaufforderung“ oder „PowerShell“ öffnen  

Das ist ein schwarzes oder weißes Fenster, in das man Befehle tippt.

### Schritt 2 – In den API-Ordner wechseln

Tippen (Pfad anpassen, falls der Ordner woanders liegt) und Enter drücken:

```bash
cd aufnahme-api
```

### Schritt 3 – Geheimschlüssel bekannt machen

Den Mistral-Schlüssel eintragen (den echten Schlüssel statt der Punkte):

**Mac:**

```bash
export MISTRAL_API_KEY='IhrSchlüsselHier'
```

**Windows (PowerShell):**

```powershell
$env:MISTRAL_API_KEY='IhrSchlüsselHier'
```

### Schritt 4 – Programm starten

Beim ersten Mal:

```bash
npm install
```

Danach immer:

```bash
npm run start
```

Wenn es geklappt hat, bleibt das Fenster offen und meldet sinngemäß, dass die API läuft.  
**Dieses Fenster nicht schließen**, solange Gespräche aufgenommen werden.

---

## Teil B: Handy verbinden

### Schritt 5 – IP-Adresse des Computers notieren

Der Computer und das Handy müssen im **gleichen WLAN** sein.

Finden Sie die IP-Adresse des Computers (sieht z. B. so aus: `192.168.1.20`).  
Fragen Sie bei Bedarf die IT. Notieren Sie die Zahl.

### Schritt 6 – App-Ordner am Computer starten

Ein **zweites** Terminal-Fenster öffnen und eingeben:

```bash
cd aufnahme-app
```

Dann die Adresse des Computers eintragen (Ihre IP statt dem Beispiel):

**Mac:**

```bash
export EXPO_PUBLIC_API_BASE_URL='http://192.168.1.20:8787'
```

**Windows (PowerShell):**

```powershell
$env:EXPO_PUBLIC_API_BASE_URL='http://192.168.1.20:8787'
```

Beim ersten Mal:

```bash
npm install
```

Danach:

```bash
npx expo start
```

Es erscheint ein **QR-Code** im Terminal oder im Browser.

### Schritt 7 – Am Handy öffnen

1. App **Expo Go** öffnen.
2. QR-Code scannen (iPhone: mit der Kamera oder in Expo Go; Android: in Expo Go).
3. Warten, bis die schwarze App mit der Uhr erscheint.
4. Wenn nach dem Mikrofon gefragt wird: **Erlauben**.

---

## So bedienen Sie die App im Gespräch

| Knopf | Bedeutung |
|---|---|
| **Start** | Aufnahme beginnt |
| **Pause** | Kurz unterbrechen |
| **Weiter** | Nach Pause fortsetzen |
| **Stop** | Gespräch beenden, Notiz fertigmachen |

Während der Aufnahme:
- Neue erkannte Daten erscheinen auf dem Bildschirm.
- Ältere Einträge rutschen nach oben.
- Der Notiz-Titel wird später z. B. zu `Müller, Anna`, sobald der Name klar ist.

Nach **Stop**:
1. Es öffnet sich ein Teilen-Menü.
2. Dort **Notizen** (oder „In Notizen sichern“) wählen.
3. Fertig – die Tabelle liegt in den Notizen.

---

## Wenn etwas nicht geht

| Problem | Was tun |
|---|---|
| App findet den Computer nicht | Gleichen WLAN prüfen; IP-Adresse nochmal prüfen; API-Fenster am Computer muss offen sein |
| Kein Mikrofon | In den Handy-Einstellungen für Expo Go das Mikrofon erlauben |
| Keine Daten erscheinen | Internet prüfen (KI braucht Verbindung); API-Fenster auf Fehlermeldungen prüfen |
| QR-Code geht nicht | In Expo Go die angezeigte Adresse manuell eingeben lassen (IT fragen) |

---

## Datenschutz in einfachen Worten

- Der KI-Schlüssel bleibt am Computer, nicht auf dem Handy.
- In die Notiz kommt **nur die ausgefüllte Tabelle**, nicht das ganze Gespräch.
- Das Audio wird zur Auswertung an die europäische KI geschickt und **nicht** als Aufnahme in den Notizen gespeichert.

---

## Für die IT (kurz)

| Ordner | Aufgabe |
|---|---|
| `aufnahme-api/` | Server mit gemeinsamem Mistral-Schlüssel |
| `aufnahme-app/` | Handy-Oberfläche (Expo) |
| `docs/aufnahme/system-prompt.md` | Textregeln für die KI |

API-Standardport: `8787`
