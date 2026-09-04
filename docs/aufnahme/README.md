# Aufnahme Eiche – Anleitung (nur Handy)

Diese App läuft **vollständig auf dem Handy**.  
Sie brauchen **keinen Computer und kein NAS** für den Alltag.

---

## Was die App macht

1. Vor dem Kundengespräch App öffnen.
2. Oben sehen Sie die Uhr.
3. **Start** beginnt die Aufnahme.
4. **Pause** unterbricht, **Weiter** macht weiter.
5. **Stop** beendet das Gespräch.
6. Erkannte Angaben (Name, Adresse, Grabnummer …) erscheinen auf dem Bildschirm.
7. Nach Stop können Sie die Tabelle in die **Notizen-App** speichern.

Bei einem Anruf pausiert die App von selbst und macht danach weiter.

---

## Einmalig vorbereiten

### 1. Mistral-Schlüssel besorgen

1. Jemand aus dem Team legt ein Mistral-Konto an: https://console.mistral.ai  
2. Dort einen **API-Schlüssel** erzeugen.  
3. Diesen Schlüssel sicher aufbewahren (wie ein Passwort).  
4. **Denselben Schlüssel** bekommen alle Mitarbeiter-Handys.

### 2. App auf dem Handy öffnen

Solange die App noch in der Testphase ist:

1. Im App Store / Google Play die App **Expo Go** installieren.
2. Eine IT-Person startet die App einmal zum Testen und zeigt Ihnen den QR-Code  
   **oder** installiert Ihnen später die fertige App direkt.

> Später soll die App wie jede normale Handy-App installiert werden.  
> Bis dahin reicht Expo Go für Tests.

### 3. Schlüssel in der App speichern

1. App öffnen.
2. Oben rechts auf **Einst.** tippen.
3. Den Mistral-Schlüssel einfügen.
4. **Speichern** tippen.
5. **Schließen**.

Das muss pro Handy **einmal** gemacht werden.

---

## So nutzen Sie die App im Gespräch

| Knopf | Bedeutung |
|---|---|
| **Start** | Aufnahme beginnt |
| **Pause** | Kurz unterbrechen |
| **Weiter** | Nach Pause fortsetzen |
| **Stop** | Gespräch beenden |

Während der Aufnahme:
- Neue erkannte Daten erscheinen auf dem Bildschirm.
- Ältere Einträge rutschen nach oben.
- Der Titel wird z. B. zu `Müller, Anna`, sobald der Name klar ist.

Nach **Stop**:
1. Es öffnet sich ein Teilen-Menü.
2. Dort **Notizen** wählen.
3. Fertig.

---

## Wenn etwas nicht geht

| Problem | Was tun |
|---|---|
| Meldung „Schlüssel fehlt“ | Unter **Einst.** den Mistral-Schlüssel speichern |
| Kein Mikrofon | In den Handy-Einstellungen Mikrofon für die App erlauben |
| Keine Daten erscheinen | Internet prüfen (WLAN oder Mobilfunk) |
| Schlüssel ungültig | Neuen Schlüssel bei Mistral holen und erneut unter Einst. speichern |

---

## Datenschutz in einfachen Worten

- Alles läuft auf dem Handy + der europäischen KI von Mistral.
- In die Notiz kommt **nur die ausgefüllte Tabelle**, nicht das ganze Gespräch.
- Audio wird zur Auswertung an Mistral geschickt und **nicht** als Aufnahme in den Notizen gespeichert.
- Der Schlüssel liegt auf dem Handy – Handys bitte mit Code/Face ID schützen.

---

## Für die IT (kurz)

- App-Ordner: `aufnahme-app/`
- Direktaufruf Mistral (Transkription + Extraktion), kein eigener Server nötig
- Prompt: `docs/aufnahme/system-prompt.md` (auch in der App eingebettet)
- Optionaler alter Server-Ordner `aufnahme-api/` wird für diese Variante **nicht** benötigt

Teststart:

```bash
cd aufnahme-app
npm install
npx expo start
```

Dann QR-Code mit Expo Go scannen.
