# Aufnahme Eiche – PC + iPhone mit Expo Go

## QR-Code scannen

In Expo Go oft **kein Scan-Button**. So geht’s:

1. Am PC läuft `npx expo start` und zeigt den QR-Code.
2. Am iPhone die normale **Kamera-App** öffnen.
3. Auf den QR-Code am Bildschirm richten.
4. Einblendung antippen → Expo Go öffnet das Projekt.

Oder in Expo Go die Adresse unter dem QR-Code manuell eingeben (z. B. `exp://10.0.0.14:8081`).

## Start am PC

```bat
cd C:\Users\MA\Documents\graeberinfo\aufnahme-app
git pull
npm install
npx expo start
```

Bei WLAN-Problemen:

```bat
npx expo start --tunnel
```

## In der App

1. **Einst.** → Mistral-Schlüssel speichern  
2. **Start** / Pause / Stop  

## Technik

- Expo SDK **57** (passend zur aktuellen Expo-Go-App)
- Audio über `expo-audio` (nicht mehr `expo-av`)
