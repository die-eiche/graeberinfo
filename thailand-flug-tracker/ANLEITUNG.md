# Schritt-für-Schritt-Anleitung (für Nicht-Techniker)

Diese Anleitung beschreibt **nur die Schritte, die du selbst machen musst**. Alles andere ist bereits eingerichtet.

---

## Was bereits erledigt ist (du musst nichts tun)

- Der Flug-Tracker heißt jetzt **`thailand-flug-tracker`** und ist von GraeberInfo getrennt
- Die Abflugtermine sind auf **frühestens 03.02.2027** (besser **04.02.2027**) umgestellt
- Das Dashboard ist online: **https://die-eiche.github.io/graeberinfo/**
- Tägliche automatische Preis-Updates sind vorbereitet (starten nach Schritt 1 unten)

---

## Schritt 1: Ersten Flugpreis-Abruf starten (ca. 5 Minuten)

**Warum?** Das Dashboard zeigt erst Preise, nachdem einmalig Flugdaten abgerufen wurden. Danach läuft alles automatisch jeden Tag um ca. 7–8 Uhr morgens (deutsche Zeit).

### So geht's:

1. Öffne im Browser:  
   **https://github.com/die-eiche/graeberinfo/actions**

2. Links in der Liste findest du den Eintrag:  
   **„Tägliche Flugpreis-Aktualisierung“**  
   → darauf klicken

3. Rechts oben siehst du einen grauen Button:  
   **„Run workflow“** (oder „Workflow ausführen“)  
   → darauf klicken

4. Es öffnet sich ein kleines Fenster. Dort nochmals auf den grünen Button **„Run workflow“** klicken

5. Die Seite lädt neu. Nach ein paar Sekunden erscheint oben ein neuer Eintrag mit einem **gelben Punkt** (läuft gerade) oder **grünen Häkchen** (fertig)

6. **Warten:** Der Lauf dauert etwa **10–20 Minuten** (viele Flughäfen und Airlines werden abgefragt)

7. Wenn der Punkt **grün** ist: Fertig!  
   Öffne das Dashboard: **https://die-eiche.github.io/graeberinfo/**  
   (ggf. Seite mit F5 neu laden)

### Falls etwas schiefgeht (roter Punkt):

- Auf den roten Eintrag klicken
- Links **„fetch-prices“** anklicken
- Nach roten Fehlermeldungen schauen
- Einfach nochmal Schritt 3–4 wiederholen (manchmal hilft ein zweiter Versuch)

---

## Schritt 2: Dashboard als Lesezeichen speichern

**Adresse:** https://die-eiche.github.io/graeberinfo/

Dort siehst du:
- Günstigste Gesamtreise (inkl. Anreise ab Ahrensbök)
- Preisverlauf über die Zeit
- Buchungsempfehlung (abwarten / bald buchen / jetzt buchen)
- Vergleich Hamburg, Kopenhagen, Lübeck, Billund

**Hinweis:** Die ersten Tage steht bei der Prognose „niedrige Konfidenz“ – das ist normal. Nach etwa 2 Wochen täglicher Messungen wird die Empfehlung genauer.

---

## Schritt 3 (optional): Eigenes GitHub-Repository anlegen

**Brauchst du nur, wenn der Tracker komplett aus GraeberInfo heraus soll** (eigene Webadresse, kein Grabstätten-Projekt mehr im Hintergrund).

Wenn dir die aktuelle Lösung reicht (Dashboard unter der obigen Adresse), **kannst du diesen Schritt überspringen**.

### So legst du ein eigenes Repo an:

1. Öffne: **https://github.com/new**

2. Ausfüllen:
   - **Repository name:** `thailand-flug-tracker`
   - **Description:** `Thailand Flugpreis-Tracker Bangkok/Phuket`
   - **Public** auswählen
   - **NICHT** ankreuzen: „Add a README file“ (das Repo soll leer starten)

3. Auf **„Create repository“** klicken

4. GitHub zeigt dir danach Anweisungen. Ignoriere die meisten und mach Folgendes:

   a) Öffne auf deinem Computer ein Terminal (oder bitte jemanden mit Technik-Kenntnissen).

   b) Diese Befehle nacheinander eingeben (jeweils Enter drücken):

   ```bash
   git clone https://github.com/die-eiche/graeberinfo.git temp-graeber
   cd temp-graeber/thailand-flug-tracker
   git init
   git add .
   git commit -m "Thailand Flug-Tracker initial"
   git branch -M main
   git remote add origin https://github.com/die-eiche/thailand-flug-tracker.git
   git push -u origin main
   ```

5. **GitHub Pages für das neue Repo aktivieren:**
   - Öffne: `https://github.com/die-eiche/thailand-flug-tracker/settings/pages`
   - Bei **Source:** „GitHub Actions“ wählen
   - Speichern

6. Unter **Actions** im neuen Repo einmal **„Tägliche Flugpreis-Aktualisierung“** starten (wie in Schritt 1)

7. Neue Dashboard-Adresse wird dann etwa:  
   **https://die-eiche.github.io/thailand-flug-tracker/**

---

## Kurz-Übersicht: Deine neuen Reisedaten

| Was | Datum |
|-----|-------|
| Frühester Hinflug aus Deutschland | **03.02.2027** |
| Bevorzugter Hinflug | **04.02.2027** |
| Aufenthalt | ca. 4 Wochen |
| Rückflug ab Phuket (bei Abflug 04.02.) | **04.03.2027** |

Die genauen Alternativtermine (03.02. und 06.02.) werden automatisch mit abgefragt.

---

## Fragen & Antworten

**Muss ich jeden Tag etwas tun?**  
Nein. Nach Schritt 1 läuft alles automatisch.

**Kostet das etwas?**  
Nein. GitHub ist für dieses Projekt kostenlos.

**Kann ich Termine später ändern?**  
Ja – in der Datei `config.yaml` im Ordner `thailand-flug-tracker`. Dafür am besten wieder den Cursor-Agenten oder jemanden mit Git-Kenntnissen fragen.

**Wo ist die alte Preishistorie?**  
Archiviert in `thailand-flug-tracker/data/history-archiv-vor-2027-02.json` (galt noch für Januar-Abflug).
