# Aufnahme Eiche – App & API

Mobile Datenerfassung für Grab-Buchungen: Audio aufnehmen, per Mistral (EU) nur Formularfelder extrahieren, Notiz als Markdown speichern.

## Komponenten

| Ordner | Zweck |
|---|---|
| `aufnahme-app/` | Expo-App (iOS Glas-Buttons, Android dunkle Alternative) |
| `aufnahme-api/` | Gemeinsamer Mistral-Proxy (ein Token für alle Mitarbeiter) |
| `docs/aufnahme/system-prompt.md` | Finaler Extraktions-Prompt |

## UI

- Schwarzer Vollbildschirm
- Oben mittig: Systemuhr
- **Start / Pause** (Toggle)
- **Stop** (Sessionende)
- Auto-Pause bei App-Hintergrund/Anruf, Auto-Resume danach

## Starten

### 1. API

```bash
cd aufnahme-api
export MISTRAL_API_KEY='…'   # nur serverseitig
npm install
npm run start
```

API lauscht auf `http://0.0.0.0:8787`.

### 2. App

```bash
cd aufnahme-app
export EXPO_PUBLIC_API_BASE_URL='http://<IP-des-API-Servers>:8787'
npm install
npx expo start
```

Auf dem Handy: Expo Go oder Dev-Build. Mikrofon erlauben.

## Notizen

- Während der Session wird die Markdown-Tabelle lokal aktualisiert und bei bekanntem Namen umbenannt (`Nachname, Vorname`).
- Nach **Stop** öffnet sich die System-Teilen-Sheet → Ziel „Notizen“ wählen.
- Direkter Dauerzugriff auf Apple Notizen ist von Drittanbieter-Apps aus nicht vorgesehen; deshalb Datei + Teilen.

## Datenschutz

- API-Key liegt nur auf dem Server.
- Kein Volltranskript in der Notiz – nur die Formular-Tabelle.
- Audio-Segmente werden zur Transkription/Extraktion an Mistral gesendet und nicht in der Notiz gespeichert.
