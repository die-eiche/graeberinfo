# Aufnahme Eiche – PC + iPhone mit Expo Go

Einfacher Weg ohne Apple-Entwicklerkonto.

## Was Sie brauchen

1. PC und iPhone im **gleichen WLAN**
2. Auf dem iPhone: **Expo Go** aus dem App Store
3. Mistral-API-Schlüssel

## QR-Code scannen (wichtig)

In neueren Expo-Go-Versionen gibt es oft **keinen eigenen Scan-Button**.

So geht’s:

1. Am PC läuft `npx expo start` und zeigt einen QR-Code.
2. Auf dem iPhone die normale **Kamera-App** öffnen.
3. Kamera auf den QR-Code am PC-Bildschirm richten.
4. Oben erscheint eine Meldung → antippen → Expo Go öffnet die App.

Falls das nicht klappt: In Expo Go nach einem Feld **„Enter URL“** suchen und die Adresse vom PC eintragen  
(z. B. `exp://10.0.0.14:8081` – steht unter dem QR-Code).

## Start am PC

```bat
cd C:\Users\MA\Documents\graeberinfo\aufnahme-app
git pull
npm install
npx expo start
```

Fenster offen lassen.

Bei WLAN-Problemen:

```bat
npx expo start --tunnel
```

## In der App

1. **Einst.** → Mistral-Schlüssel speichern  
2. **Start** / Pause / Stop  

## Wenn der Code geändert wurde

Am PC:

```bat
cd C:\Users\MA\Documents\graeberinfo\aufnahme-app
git pull
npm install
npx expo start
```

Am iPhone erneut per Kamera/QR öffnen.

## Hinweis zur Technik

Dieses Projekt nutzt **Expo SDK 54**, passend zur Expo-Go-Version aus dem App Store.
