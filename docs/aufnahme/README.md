# Aufnahme Eiche – Start mit PC und iPhone (Expo Go)

Wir starten **einfach**:
- **PC** startet die App-Entwicklungsumgebung
- **iPhone** installiert einmalig **Expo Go** und öffnet die App darüber

Kein Apple-Entwicklerkonto nötig. Kein NAS. Kein komplizierter App-Store-Build.

Wenn der Code später geändert wird: Am PC neu starten, auf dem iPhone in Expo Go neu laden.

---

## Was Sie brauchen

1. Einen **PC** (Windows ist okay) mit Internet  
2. Ein **iPhone**  
3. **Dasselbe WLAN** für PC und iPhone  
4. Den **Mistral-API-Schlüssel**  
5. Die App **Expo Go** vom App Store (kostenlos)

---

## Einmalig auf dem iPhone

1. App Store öffnen  
2. Nach **Expo Go** suchen  
3. Installieren  
4. Fertig – Expo Go erst öffnen, wenn der PC soweit ist

---

## Jeden Arbeitstag / zum Testen: PC starten

### 1. Terminal öffnen

- Windows: „PowerShell“ oder „Eingabeaufforderung“

### 2. In den App-Ordner wechseln

```bash
cd aufnahme-app
```

(Falls der Ordner woanders liegt: den richtigen Pfad verwenden.)

### 3. Beim ersten Mal installieren

```bash
npm install
```

### 4. App-Server starten

```bash
npx expo start
```

Es erscheint ein **QR-Code**.

**Dieses Fenster offen lassen**, solange Sie die App nutzen.

---

## Auf dem iPhone öffnen

1. **Expo Go** öffnen  
2. QR-Code vom PC-Bildschirm scannen  
   - Mit der iPhone-Kamera **oder** in Expo Go unter „Scan QR code“  
3. Warten, bis die schwarze App mit der Uhr erscheint  
4. Wenn nach dem Mikrofon gefragt wird: **Erlauben**

### Falls der QR-Code nicht funktioniert

Am PC abbrechen (Strg + C) und so starten:

```bash
npx expo start --tunnel
```

Dann erneut QR-Code scannen.  
(`--tunnel` ist etwas langsamer, funktioniert aber oft besser in schwierigen WLANs.)

---

## Einmalig in der App: Schlüssel speichern

1. Oben rechts auf **Einst.** tippen  
2. Mistral-API-Schlüssel einfügen  
3. **Speichern**  
4. **Schließen**

Das muss pro iPhone einmal gemacht werden (solange die App-Daten nicht gelöscht werden).

---

## Bedienung im Gespräch

| Knopf | Bedeutung |
|---|---|
| **Start** | Aufnahme beginnt |
| **Pause** | Kurz unterbrechen |
| **Weiter** | Fortsetzen |
| **Stop** | Gespräch beenden |

- Erkannte Angaben erscheinen auf dem Bildschirm und bleiben stehen.  
- Neue Einträge schieben ältere nach oben.  
- Nach **Stop**: Teilen-Menü → **Notizen** wählen.

Bei einem Anruf pausiert die App von selbst und macht danach weiter.

---

## Wenn der Code geändert wurde

1. Am PC im Terminal ggf. alten Lauf beenden (Strg + C)  
2. Neu starten:

```bash
cd aufnahme-app
npx expo start
```

3. Auf dem iPhone in Expo Go die App erneut öffnen / neu laden  
4. Fertig – **keine** Neuinstallation nötig

---

## Wenn etwas nicht geht

| Problem | Was tun |
|---|---|
| QR-Code geht nicht | Gleichen WLAN prüfen oder `npx expo start --tunnel` |
| Schwarzer Bildschirm / lädt nicht | PC-Fenster prüfen, ob noch läuft; in Expo Go neu verbinden |
| „Schlüssel fehlt“ | Unter **Einst.** speichern |
| Kein Mikrofon | iPhone-Einstellungen → Expo Go → Mikrofon erlauben |
| Keine erkannten Daten | Internet am iPhone prüfen |

---

## Datenschutz kurz

- Die Auswertung läuft über Mistral (EU).  
- In die Notizen kommt nur die Tabelle, nicht das ganze Gespräch.  
- Der API-Schlüssel liegt auf dem iPhone – Gerät mit Code/Face ID schützen.

---

## Für die IT (kurz)

```bash
cd aufnahme-app
npm install
npx expo start
# bei Netzwerkproblemen:
npx expo start --tunnel
```

Spätere echte App-Store-/IPA-Builds sind möglich, aber **jetzt bewusst nicht** der Weg.
